import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, AppState, Linking, Platform, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Compass, MapPin } from 'lucide-react-native';
import { Skeleton } from '@/components/ui/Skeleton';
import { EmptyState } from '@/components/ui/EmptyState';
import { AppMenuDrawer } from '@/components/app/AppMenuDrawer';
import { EmailVerificationRequiredBanner } from '@/components/app/EmailVerificationRequiredBanner';
import { ExploreActionBar } from '@/components/explore/ExploreActionBar';
import { ExploreFilterDrawer } from '@/components/explore/ExploreFilterDrawer';
import { SwipeableDeck, SwipeableDeckHandle, SwipeDirection } from '@/components/explore/SwipeableDeck';
import { ExploreTopOverlay } from '@/components/explore/ExploreTopOverlay';
import { ExploreTourModal } from '@/components/explore/ExploreTourModal';
import { UserProfileSheet } from '@/components/profile/UserProfileSheet';
import { scale } from '@/hooks/useResponsive';
import { useColors } from '@/hooks/useColors';
import { useToast } from '@/hooks/useToast';
import { useExploreLocationGate } from '@/hooks/useExploreLocationGate';
import { useAuthStore } from '@/store/authStore';
import {
    ExploreFilterState,
    activeExploreFilterCount,
    buildExploreParams,
    clearDroppedFilters,
    describeDroppedFilters,
    resetExploreFilters,
} from '@/lib/exploreFilters';
import { firstProfileImage, profileId } from '@/lib/exploreProfile';
import { profileCoordinates } from '@/lib/exploreProfile';
import { Image } from 'expo-image';
import * as Location from 'expo-location';
import { apiMessage, t } from '@/lib/profileDisplay';
import { usersService } from '@/lib/usersService';

type HistoryEntry = { action: 'skip' | 'favorite' | 'view'; profile: any };
type VerificationReason = 'browse_limit' | 'save_or_skip' | null;
type ExploreMode = 'fresh' | 'skipped';

const EXPLORE_BATCH_LIMIT = 30;
const PREFETCH_THRESHOLD = 5;

function normalizeDroppedFilters(droppedFilters: any[] = []) {
    return droppedFilters
        .map((entry) => {
            if (typeof entry === 'string') return entry.split(/[=:]/)[0].trim();
            if (entry && typeof entry === 'object') return String(entry.key || entry.param || '').trim();
            return '';
        })
        .filter(Boolean);
}

export default function ExploreScreen() {
    const palette = useColors();
    const insets = useSafeAreaInsets();
    const toast = useToast();
    const { state: locationState, retry: retryLocation, retrying: locationRetrying } = useExploreLocationGate();

    const openLocationSettings = useCallback(async () => {
        if (locationState === 'services_disabled' && Platform.OS === 'android') {
            try {
                await Location.enableNetworkProviderAsync();
                await retryLocation();
                return;
            } catch {
                // Fall through to app settings when Android cannot show its location prompt.
            }
        }
        await Linking.openSettings();
    }, [locationState, retryLocation]);
    const user = useAuthStore((state) => state.user);
    const refreshUser = useAuthStore((state) => state.refreshUser);
    const emailVerified = Boolean(user?.email_verified ?? user?.emailVerified);
    const [profiles, setProfiles] = useState<any[]>([]);
    const [filters, setFilters] = useState<ExploreFilterState>(() => resetExploreFilters());
    const [loading, setLoading] = useState(true);
    const [message, setMessage] = useState('');
    const [history, setHistory] = useState<HistoryEntry[]>([]);
    const [detailOpen, setDetailOpen] = useState(false);
    const [profileSheetClosing, setProfileSheetClosing] = useState(false);
    const [viewedCount, setViewedCount] = useState(0);
    const [filtersOpen, setFiltersOpen] = useState(false);
    const [tourOpen, setTourOpen] = useState(false);
    const [menuOpen, setMenuOpen] = useState(false);
    const [verificationReason, setVerificationReason] = useState<VerificationReason>(null);
    const nextCursorRef = useRef<string | null>(null);
    const hasMoreRef = useRef(true);
    const isFetchingRef = useRef(false);
    const seenRef = useRef<Set<string>>(new Set());
    const filtersRef = useRef(filters);
    const exploreModeRef = useRef<ExploreMode>('fresh');
    const deckRef = useRef<SwipeableDeckHandle>(null);
    // Whether the last response displayed already-viewed (skipped) profiles —
    // drives the notice toast; never fed back into request params.
    const wasShowingSkippedRef = useRef(false);

    const current = profiles[0] || null;
    const currentId = current ? profileId(current) : '';
    const filterCount = useMemo(() => activeExploreFilterCount(filters), [filters]);
    const viewerCoordinates = useMemo(() => profileCoordinates(user?.profile || user), [user]);

    const load = useCallback(async (
        nextFilters = filtersRef.current,
        options: { reset?: boolean; allowDroppedRetry?: boolean; mode?: ExploreMode } = {},
    ) => {
        const reset = options.reset ?? true;
        const allowDroppedRetry = options.allowDroppedRetry ?? true;
        // `mode=skipped` is only sent when explicitly requested (review-skipped
        // button, deck-exhausted fallback) or when paginating an explicit skipped
        // browse — never because a previous *response* happened to show skipped
        // profiles. A reset without a mode always restarts fresh (parity with
        // the Next.js skippedOnlyRef behavior).
        let mode = options.mode ?? (reset ? 'fresh' : exploreModeRef.current);
        if (isFetchingRef.current) return;

        if (!reset && !hasMoreRef.current) {
            if (exploreModeRef.current !== 'fresh') return;
            mode = 'skipped';
            exploreModeRef.current = 'skipped';
            nextCursorRef.current = null;
            hasMoreRef.current = true;
        }

        isFetchingRef.current = true;
        if (reset) {
            setLoading(true);
            setMessage('');
            setVerificationReason(null);
            nextCursorRef.current = null;
            hasMoreRef.current = true;
            exploreModeRef.current = mode;
            seenRef.current = new Set();
            filtersRef.current = nextFilters;
            if (mode === 'fresh') wasShowingSkippedRef.current = false;
        }

        const params = buildExploreParams(nextFilters);
        const cursor = reset ? null : nextCursorRef.current;
        const res = await usersService.list({
            limit: EXPLORE_BATCH_LIMIT,
            ...params,
            ...(mode === 'skipped' ? { mode: 'skipped' } : {}),
            ...(cursor ? { cursor } : {}),
        });

        if (res.success) {
            const showingSkipped = res.mode === 'skipped'
                || res.showingSkipped === true
                || res.notice === 'showing_already_viewed_profiles';
            if (showingSkipped && !wasShowingSkippedRef.current) {
                toast.show(t('showing_already_viewed_profiles', 'Showing profiles you have already viewed.'), 'info', 4000);
            }
            wasShowingSkippedRef.current = showingSkipped;

            const droppedFilters = mode === 'fresh' && !showingSkipped && Array.isArray(res.droppedFilters)
                ? res.droppedFilters
                : [];
            if (droppedFilters.length > 0) {
                const labels = describeDroppedFilters(nextFilters, droppedFilters);
                const cleanedFilters = clearDroppedFilters(nextFilters, droppedFilters);
                setFilters(cleanedFilters);
                filtersRef.current = cleanedFilters;

                if (labels.length) {
                    const filtersText = labels.join(', ');
                    const messageText = t(
                        'filters_reset_msg',
                        'No data found for {filters}. Those filters were reset.',
                        { filters: filtersText },
                    )
                        .replaceAll('{filters}', filtersText)
                        .replaceAll('{{filters}}', filtersText);
                    toast.show(messageText, 'info', 5000);
                }

                if (allowDroppedRetry) {
                    isFetchingRef.current = false;
                    await load(cleanedFilters, { reset: true, allowDroppedRetry: false, mode: 'fresh' });
                    return;
                }
            }

            const incoming = Array.isArray(res.items) ? res.items : [];
            const uniqueItems = incoming.filter((item) => {
                const id = profileId(item);
                if (!id || seenRef.current.has(id)) return false;
                seenRef.current.add(id);
                return true;
            });

            nextCursorRef.current = res.nextCursor || null;
            hasMoreRef.current = typeof res.hasMore === 'boolean' ? res.hasMore : Boolean(res.nextCursor);
            setProfiles((items) => reset ? uniqueItems : [...items, ...uniqueItems]);

            const shouldTrySkipped =
                mode === 'fresh' &&
                !showingSkipped &&
                uniqueItems.length === 0 &&
                !hasMoreRef.current;

            if (shouldTrySkipped) {
                isFetchingRef.current = false;
                await load(nextFilters, { reset, allowDroppedRetry: false, mode: 'skipped' });
                return;
            }
        } else {
            if (reset) {
                setProfiles([]);
                if (res.message === 'email_verification_required') {
                    setVerificationReason('browse_limit');
                }
                setMessage(apiMessage(res.message, 'list_failed'));
            }
            hasMoreRef.current = false;
        }

        if (reset) setLoading(false);
        isFetchingRef.current = false;
    }, [toast]);

    useEffect(() => {
        if (emailVerified && verificationReason) setVerificationReason(null);
    }, [emailVerified, verificationReason]);

    useEffect(() => {
        if (emailVerified) return;
        const subscription = AppState.addEventListener('change', (nextState) => {
            if (nextState === 'active') void refreshUser();
        });
        return () => subscription.remove();
    }, [emailVerified, refreshUser]);

    useEffect(() => {
        if (locationState !== 'ready') return;
        void load(filtersRef.current, { reset: true });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [locationState]);

    const advance = (entry?: HistoryEntry) => {
        if (entry) setHistory((items) => [entry, ...items].slice(0, 1));
        setProfiles((items) => items.slice(1));
    };

    const undo = async () => {
        const last = history[0];
        if (!last) {
            Alert.alert(t('undo', 'Undo'), t('explore_undo_unavailable', 'Nothing to undo yet.'));
            return;
        }
        if (last.action === 'favorite') {
            const id = profileId(last.profile);
            if (id) void usersService.unfavorite(id).catch(() => undefined);
        }
        setProfiles((items) => [last.profile, ...items]);
        setHistory([]);
    };

    // Optimistic swipe: advance the deck immediately, sync with the API in the
    // background, and put the card back if the request fails.
    const rollbackSwipe = (profile: any, message?: string) => {
        const id = profileId(profile);
        setProfiles((items) => [profile, ...items.filter((item) => profileId(item) !== id)]);
        setHistory((items) => items.filter((entry) => entry.profile !== profile));
        if (message === 'email_verification_required') setVerificationReason('save_or_skip');
        else Alert.alert(t('error', 'Error'), apiMessage(message));
    };

    const handleSwiped = (direction: SwipeDirection) => {
        const profile = current;
        const id = currentId;
        if (!profile || !id) return;
        const action = direction === 'right' ? 'favorite' : 'skip';
        advance({ action, profile });
        if (action === 'favorite') toast.show(t('saved', 'Saved'), 'success', 3000);
        const request = action === 'favorite' ? usersService.favorite(id) : usersService.skip(id);
        request
            .then((res) => {
                if (!res.success) rollbackSwipe(profile, res.message);
            })
            .catch(() => rollbackSwipe(profile));
    };

    const canSwipe = (_direction: SwipeDirection) => {
        if (!emailVerified) {
            setVerificationReason('save_or_skip');
            return false;
        }
        return true;
    };

    const skip = () => {
        if (!current || !currentId) return;
        if (!canSwipe('left')) return;
        deckRef.current?.swipe('left');
    };

    const favorite = () => {
        if (!current || !currentId) return;
        if (!canSwipe('right')) return;
        deckRef.current?.swipe('right');
    };

    const deckLocked = detailOpen || profileSheetClosing;

    const viewProfile = () => {
        if (!current) return;
        if (viewedCount >= 5 && !emailVerified) {
            setVerificationReason('browse_limit');
            return;
        }
        setProfileSheetClosing(false);
        setViewedCount((count) => count + 1);
        setDetailOpen(true);
    };

    const closeProfileSheet = () => {
        setDetailOpen(false);
        // Block deck taps until the modal slide animation finishes (prevents accidental skip).
        setProfileSheetClosing(true);
        setTimeout(() => setProfileSheetClosing(false), 450);
    };

    const applyFilters = (next: ExploreFilterState) => {
        setFilters(next);
        filtersRef.current = next;
        setHistory([]);
        setViewedCount(0);
        void load(next, { reset: true, mode: 'fresh' });
    };

    const refreshSkippedProfiles = () => {
        setHistory([]);
        setViewedCount(0);
        void load(filtersRef.current, { reset: true, allowDroppedRetry: false, mode: 'skipped' });
    };

    useEffect(() => {
        if (loading || isFetchingRef.current || profiles.length === 0) return;
        if (profiles.length <= PREFETCH_THRESHOLD) void load(filtersRef.current, { reset: false });
    }, [load, loading, profiles.length]);

    // Warm the next cards' photos while the current one is on screen so the
    // deck never shows a loading image (Tinder-style).
    useEffect(() => {
        for (const profile of profiles.slice(1, 4)) {
            const uri = firstProfileImage(profile);
            if (uri) void Image.prefetch(uri);
        }
    }, [profiles]);

    return (
        <View style={[styles.root, { backgroundColor: palette.chrome.explore.screen, paddingTop: insets.top }]}>
            {locationState !== 'ready' ? (
                <View style={styles.empty}>
                    {locationState === 'checking' ? (
                        <View style={{ width: '100%', gap: scale(14) }}>
                            <Skeleton width="100%" height={scale(420)} borderRadius={scale(22)} />
                            <Skeleton width="70%" height={scale(44)} borderRadius={scale(22)} style={{ alignSelf: 'center' }} />
                        </View>
                    ) : (
                        <EmptyState
                            icon={<MapPin size={scale(30)} color={palette.chrome.primary} strokeWidth={1.8} />}
                            title={t('explore_location_required_title', 'Location is needed for Explore')}
                            description={
                                locationState === 'permission_denied'
                                    ? t('explore_location_permission_denied', 'Allow location access in Settings to discover relevant profiles.')
                                    : locationState === 'services_disabled'
                                        ? t('explore_location_services_disabled', 'Turn on device location services to use Explore.')
                                        : locationState === 'network_error'
                                            ? t('explore_location_network_error', 'We could not verify your location. Check your connection and try again.')
                                            : t('explore_location_unavailable', 'We could not get your current location. Move to an open area and try again.')
                            }
                            actions={[
                                ...(locationState === 'permission_denied' || locationState === 'services_disabled'
                                    ? [{ label: t('open_settings', 'Open Settings'), onPress: () => void openLocationSettings() }]
                                    : []),
                                {
                                    label: locationRetrying
                                        ? t('please_wait', 'Please wait...')
                                        : t('btn_try_again', 'Try Again'),
                                    onPress: () => void retryLocation(),
                                    variant: 'secondary' as const,
                                    disabled: locationRetrying,
                                    loading: locationRetrying,
                                },
                            ]}
                        />
                    )}
                </View>
            ) : loading ? (
                <View style={{ flex: 1, padding: scale(12), gap: scale(14) }}>
                    <Skeleton width="100%" height={undefined} borderRadius={scale(22)} style={{ flex: 1 }} />
                    <View style={{ flexDirection: 'row', justifyContent: 'center', gap: scale(18), paddingBottom: scale(8) }}>
                        {[0, 1, 2].map((index) => (
                            <Skeleton key={index} width={scale(52)} height={scale(52)} borderRadius={scale(26)} />
                        ))}
                    </View>
                </View>
            ) : current ? (
                <>
                    <ExploreTopOverlay
                        filterCount={filterCount}
                        onOpenFilters={() => setFiltersOpen(true)}
                        onOpenTour={() => setTourOpen(true)}
                        onOpenMenu={() => setMenuOpen(true)}
                    />
                    <View style={styles.deckArea} pointerEvents={deckLocked ? 'none' : 'auto'}>
                        <SwipeableDeck
                            ref={deckRef}
                            profiles={profiles}
                            viewerLat={viewerCoordinates?.lat}
                            viewerLng={viewerCoordinates?.lng}
                            onPressCard={viewProfile}
                            onSwiped={handleSwiped}
                            canSwipe={canSwipe}
                        />
                    </View>
                    <ExploreActionBar
                        canUndo={history.length > 0}
                        busy={deckLocked}
                        onUndo={undo}
                        onSkip={skip}
                        onFavorite={favorite}
                        onView={viewProfile}
                    />
                </>
            ) : (
                <View style={styles.empty}>
                    <EmptyState
                        icon={<Compass size={scale(30)} color={palette.chrome.primary} strokeWidth={1.8} />}
                        title={message || t('explore_no_profiles_title', 'No matches right now')}
                        description={t('explore_no_profiles', 'Expand your filters to see more profiles.')}
                        actions={[
                            { label: t('refresh', 'Refresh'), onPress: refreshSkippedProfiles },
                            { label: t('filters', 'Filters'), onPress: () => setFiltersOpen(true), variant: 'secondary' },
                        ]}
                    />
                </View>
            )}

            {verificationReason ? (
                <View style={[styles.verificationToast, { top: insets.top + scale(48) }]}>
                    <EmailVerificationRequiredBanner
                        compact
                        floating
                        email={user?.email}
                        onDismiss={() => setVerificationReason(null)}
                        title={
                            verificationReason === 'browse_limit'
                                ? t('verify_email_browse_limit_title', 'Verify your email to keep browsing')
                                : t('verify_email_profile_actions_title', 'Verify your email to save profiles')
                        }
                        message={
                            verificationReason === 'browse_limit'
                                ? t('verify_email_browse_limit_message', 'You can browse your first profiles now. Verify your email to continue exploring more matches.')
                                : t('verify_email_profile_actions_message', 'Please verify your email before saving or skipping profiles.')
                        }
                    />
                </View>
            ) : null}

            <ExploreFilterDrawer
                visible={filtersOpen}
                state={filters}
                onClose={() => setFiltersOpen(false)}
                onApply={applyFilters}
            />
            <ExploreTourModal visible={tourOpen} onClose={() => setTourOpen(false)} />
            <AppMenuDrawer visible={menuOpen} onClose={() => setMenuOpen(false)} />
            <UserProfileSheet
                visible={detailOpen && Boolean(currentId)}
                userId={currentId}
                initialProfile={current}
                onClose={closeProfileSheet}
                onBlocked={(id) => {
                    setProfiles((items) => items.filter((item) => profileId(item) !== id));
                }}
                onFavoriteChanged={(id, favorited) => {
                    setProfiles((items) => items.map((item) => profileId(item) === id ? { ...item, is_favorited: favorited } : item));
                }}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    root: { flex: 1 },
    center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    // Deck is inset from the screen edges (same side spacing as the bottom
    // bar's paddingHorizontal) with a small breather under the top bar
    deckArea: {
        flex: 1,
        position: 'relative',
        paddingHorizontal: scale(16),
        paddingTop: scale(7),
    },
    verificationToast: {
        elevation: 20,
        left: scale(12),
        position: 'absolute',
        right: scale(12),
        zIndex: 40,
    },
    empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: scale(24) },
});
