import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AppState, LayoutChangeEvent, Linking, Platform, StyleSheet, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Compass, MapPin } from 'phosphor-react-native';
import { Skeleton } from '@/components/ui/Skeleton';
import { EmptyState } from '@/components/ui/EmptyState';
import { useAppMenu } from '@/components/app/AppMenuProvider';
import { EmailVerificationRequiredBanner } from '@/components/app/EmailVerificationRequiredBanner';
import { ExploreActionBar, ExploreActionBarSkeleton } from '@/components/explore/ExploreActionBar';
import { ExploreFilterDrawer } from '@/components/explore/ExploreFilterDrawer';
import { SwipeableDeck, SwipeableDeckHandle, SwipeDirection } from '@/components/explore/SwipeableDeck';
import { ExploreTopOverlay } from '@/components/explore/ExploreTopOverlay';
import { ExploreTourModal } from '@/components/explore/ExploreTourModal';
import { UserProfileSheet } from '@/components/profile/UserProfileSheet';
import { scale } from '@/hooks/useResponsive';
import { useColors } from '@/hooks/useColors';
import { useToast } from '@/hooks/useToast';
import { useConnectivity } from '@/hooks/useConnectivity';
import { useExploreLocationGate } from '@/hooks/useExploreLocationGate';
import { useAuthStore } from '@/store/authStore';
import { useExploreFilterStore } from '@/store/exploreFilterStore';
import {
    ExploreFilterState,
    DEFAULT_EXPLORE_FILTERS,
    activeExploreFilterCount,
    buildExploreParams,
    clearDroppedFilters,
    describeDroppedFilters,
} from '@/lib/exploreFilters';
import { firstProfileImage, profileId } from '@/lib/exploreProfile';
import { profileCoordinates } from '@/lib/exploreProfile';
import { Image } from 'expo-image';
import * as Location from 'expo-location';
import { apiMessage, t } from '@/lib/profileDisplay';
import { usersService } from '@/lib/usersService';
import { DevRenderProfiler } from '@/components/dev/DevRenderProfiler';
import { markStartup } from '@/lib/performanceDiagnostics';
import {
    clearExploreDeckCache,
    readExploreDeckCache,
    writeExploreDeckCache,
} from '@/lib/exploreDeckCache';
import { takeExploreStartup } from '@/lib/exploreStartup';
import { warmFirstExploreImage } from '@/lib/exploreImageWarmup';
import type { UserListResponse } from '@/lib/usersService';

type HistoryEntry = { action: 'skip' | 'favorite' | 'view'; profile: any };
type VerificationReason = 'browse_limit' | 'save_or_skip' | null;
type ExploreMode = 'fresh' | 'skipped';

const EXPLORE_BATCH_LIMIT = 30;
const PREFETCH_THRESHOLD = 5;
const ANDROID_TAB_BAR_CONTENT_HEIGHT = 68;

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
    const { height: windowHeight } = useWindowDimensions();
    const toast = useToast();
    const { isOffline } = useConnectivity();
    const [compensateInitialAndroidTabBar, setCompensateInitialAndroidTabBar] = useState(Platform.OS === 'android');
    const { openMenu } = useAppMenu();
    const { state: locationState, retry: retryLocation, retrying: locationRetrying } = useExploreLocationGate();

    const requestDeviceLocationServices = useCallback(async () => {
        if (Platform.OS !== 'android') {
            await Linking.openSettings();
            return;
        }

        try {
            await Location.enableNetworkProviderAsync();
            await retryLocation();
        } catch {
            // Declining the native prompt should leave the user on this recovery screen.
        }
    }, [retryLocation]);

    const openLocationSettings = useCallback(async () => {
        if (locationState === 'services_disabled') {
            await requestDeviceLocationServices();
            return;
        }

        if (locationState === 'permission_denied') {
            try {
                const permission = await Location.getForegroundPermissionsAsync();
                if (permission.status !== Location.PermissionStatus.GRANTED && permission.canAskAgain) {
                    const requested = await Location.requestForegroundPermissionsAsync();
                    if (requested.status === Location.PermissionStatus.GRANTED) {
                        await retryLocation();
                    }
                    return;
                }

                if (permission.status === Location.PermissionStatus.GRANTED) {
                    await retryLocation();
                    return;
                }
            } catch {
                // When Android cannot request again, app settings is the only recovery route.
            }

            await Linking.openSettings();
            return;
        }

        await Linking.openSettings();
    }, [locationState, requestDeviceLocationServices, retryLocation]);

    const retryLocationAccess = useCallback(async () => {
        if (locationState === 'services_disabled') {
            await requestDeviceLocationServices();
            return;
        }

        if (locationState === 'permission_denied') {
            try {
                const permission = await Location.getForegroundPermissionsAsync();
                if (permission.status !== Location.PermissionStatus.GRANTED && permission.canAskAgain) {
                    const requested = await Location.requestForegroundPermissionsAsync();
                    if (requested.status === Location.PermissionStatus.GRANTED) {
                        await retryLocation();
                    }
                    return;
                }
            } catch {
                // The regular retry below keeps the current recovery state visible.
            }
        }

        await retryLocation();
    }, [locationState, requestDeviceLocationServices, retryLocation]);
    const user = useAuthStore((state) => state.user);
    const refreshUser = useAuthStore((state) => state.refreshUser);
    const emailVerified = Boolean(user?.email_verified ?? user?.emailVerified);
    const filterAccountId = String(user?._id || user?.id || user?.user_id || 'anonymous');
    const [profiles, setProfiles] = useState<any[]>([]);
    const filters = useExploreFilterStore((state) => state.filtersByAccount[filterAccountId]) || DEFAULT_EXPLORE_FILTERS;
    const setStoredFilters = useExploreFilterStore((state) => state.setFilters);
    const setFilters = useCallback(
        (next: ExploreFilterState) => setStoredFilters(filterAccountId, next),
        [filterAccountId, setStoredFilters],
    );
    const [loading, setLoading] = useState(true);
    const [cacheHydrated, setCacheHydrated] = useState(false);
    const [message, setMessage] = useState('');
    const [history, setHistory] = useState<HistoryEntry[]>([]);
    const [detailOpen, setDetailOpen] = useState(false);
    const [profileSheetClosing, setProfileSheetClosing] = useState(false);
    const [viewedCount, setViewedCount] = useState(0);
    const [filtersOpen, setFiltersOpen] = useState(false);
    const [tourOpen, setTourOpen] = useState(false);
    const [verificationReason, setVerificationReason] = useState<VerificationReason>(null);
    const nextCursorRef = useRef<string | null>(null);
    const hasMoreRef = useRef(true);
    const isFetchingRef = useRef(false);
    const requestVersionRef = useRef(0);
    const accountIdRef = useRef(filterAccountId);
    accountIdRef.current = filterAccountId;
    const seenRef = useRef<Set<string>>(new Set());
    const filtersRef = useRef(filters);
    const exploreModeRef = useRef<ExploreMode>('fresh');
    const deckRef = useRef<SwipeableDeckHandle>(null);
    // Whether the last response displayed already-viewed (skipped) profiles —
    // drives the notice toast; never fed back into request params.
    const wasShowingSkippedRef = useRef(false);
    const hasCachedDeckRef = useRef(false);
    const cacheWriteEnabledRef = useRef(false);
    const interactedProfileIdsRef = useRef<Set<string>>(new Set());
    const startupResponseRef = useRef<{ response: UserListResponse; filterKey: string } | null>(null);

    useEffect(() => {
        let cancelled = false;
        requestVersionRef.current += 1;
        isFetchingRef.current = false;
        setCacheHydrated(false);
        hasCachedDeckRef.current = false;
        cacheWriteEnabledRef.current = false;
        interactedProfileIdsRef.current = new Set();

        if (filterAccountId === 'anonymous') {
            setCacheHydrated(true);
            return () => {
                cancelled = true;
            };
        }

        const startupRequest = takeExploreStartup(filterAccountId);
        const hydrationRequest = startupRequest
            ? startupRequest
            : readExploreDeckCache(filterAccountId).then((cached) => ({ cached, response: null, filterKey: null }));

        void hydrationRequest.then(({ cached, response, filterKey }) => {
            if (cancelled) return;
            if (cached) {
                setFilters(cached.filters);
                filtersRef.current = cached.filters;
                // Cached people may no longer be eligible. Their photos remain
                // available in the image disk cache if the fresh deck matches.
                markStartup('explore-cache-read', { count: cached.profiles.length });
            }
            startupResponseRef.current = response && filterKey ? { response, filterKey } : null;
            setCacheHydrated(true);
        });

        return () => {
            cancelled = true;
            requestVersionRef.current += 1;
        };
    }, [filterAccountId, setFilters]);

    useEffect(() => {
        markStartup('explore-mounted');
    }, []);

    useEffect(() => {
        if (locationState !== 'checking') {
            markStartup('explore-location-resolved', { state: locationState });
        }
    }, [locationState]);

    const current = profiles[0] || null;
    const currentId = current ? profileId(current) : '';
    const filterCount = useMemo(() => activeExploreFilterCount(filters), [filters]);
    const viewerCoordinates = useMemo(() => profileCoordinates(user?.profile || user), [user]);

    const load = useCallback(async (
        nextFilters = filtersRef.current,
        options: {
            reset?: boolean;
            allowDroppedRetry?: boolean;
            mode?: ExploreMode;
            preserveVisible?: boolean;
        } = {},
    ) => {
        const reset = options.reset ?? true;
        const allowDroppedRetry = options.allowDroppedRetry ?? true;
        const preserveVisible = options.preserveVisible ?? false;
        const preservedDeckState = preserveVisible ? {
            nextCursor: nextCursorRef.current,
            hasMore: hasMoreRef.current,
            mode: exploreModeRef.current,
            seen: new Set(seenRef.current),
        } : null;
        const restorePreservedDeckState = () => {
            if (!preservedDeckState) return;
            nextCursorRef.current = preservedDeckState.nextCursor;
            hasMoreRef.current = preservedDeckState.hasMore;
            exploreModeRef.current = preservedDeckState.mode;
            seenRef.current = preservedDeckState.seen;
        };
        // `mode=skipped` is only sent when explicitly requested (review-skipped
        // button, deck-exhausted fallback) or when paginating an explicit skipped
        // browse — never because a previous *response* happened to show skipped
        // profiles. A reset without a mode always restarts fresh (parity with
        // the Next.js skippedOnlyRef behavior).
        let mode = options.mode ?? (reset ? 'fresh' : exploreModeRef.current);
        if (!reset && isFetchingRef.current) return;
        const requestVersion = ++requestVersionRef.current;
        const isCurrentRequest = () => requestVersion === requestVersionRef.current
            && filterAccountId === accountIdRef.current;

        if (!reset && !hasMoreRef.current) {
            if (exploreModeRef.current !== 'fresh') return;
            mode = 'skipped';
            exploreModeRef.current = 'skipped';
            nextCursorRef.current = null;
            hasMoreRef.current = true;
        }

        isFetchingRef.current = true;
        if (reset) {
            if (!preserveVisible) {
                cacheWriteEnabledRef.current = false;
                setLoading(true);
            }
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
        const startupResult = reset
            && mode === 'fresh'
            && !cursor
            && startupResponseRef.current?.filterKey === JSON.stringify(params)
            ? startupResponseRef.current
            : null;
        if (reset && mode === 'fresh') startupResponseRef.current = null;
        if (reset && !startupResult) markStartup('explore-request-start');
        let res: UserListResponse;
        try {
            res = startupResult?.response || await usersService.list({
                limit: EXPLORE_BATCH_LIMIT,
                ...params,
                ...(mode === 'skipped' ? { mode: 'skipped' } : {}),
                ...(cursor ? { cursor } : {}),
            });
        } catch {
            if (!isCurrentRequest()) return;
            if (reset && !preserveVisible) {
                setProfiles([]);
                setMessage(apiMessage(undefined, 'list_failed'));
                setLoading(false);
            }
            isFetchingRef.current = false;
            return;
        }
        if (!isCurrentRequest()) return;
        if (reset && !startupResult) markStartup('explore-response-received', { success: Boolean(res.success) });

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
                    restorePreservedDeckState();
                    await load(cleanedFilters, {
                        reset: true,
                        allowDroppedRetry: false,
                        mode: 'fresh',
                        preserveVisible,
                    });
                    return;
                }
            }

            const incoming = Array.isArray(res.items) ? res.items : [];
            const uniqueItems = incoming.filter((item) => {
                const id = profileId(item);
                if (!id || seenRef.current.has(id) || interactedProfileIdsRef.current.has(id)) return false;
                seenRef.current.add(id);
                return true;
            });

            nextCursorRef.current = res.nextCursor || null;
            hasMoreRef.current = typeof res.hasMore === 'boolean' ? res.hasMore : Boolean(res.nextCursor);
            cacheWriteEnabledRef.current = true;
            hasCachedDeckRef.current = uniqueItems.length > 0;
            if (reset && uniqueItems.length > 0) {
                await warmFirstExploreImage(uniqueItems);
                if (!isCurrentRequest()) return;
            }
            setProfiles((items) => reset ? uniqueItems : [...items, ...uniqueItems]);

            const shouldTrySkipped =
                mode === 'fresh' &&
                !showingSkipped &&
                uniqueItems.length === 0 &&
                !hasMoreRef.current;

            if (shouldTrySkipped) {
                isFetchingRef.current = false;
                restorePreservedDeckState();
                await load(nextFilters, {
                    reset,
                    allowDroppedRetry: false,
                    mode: 'skipped',
                    preserveVisible,
                });
                return;
            }
        } else {
            if (reset && !preserveVisible) {
                setProfiles([]);
                void clearExploreDeckCache(filterAccountId).catch(() => undefined);
                if (res.message === 'email_verification_required') {
                    setVerificationReason('browse_limit');
                }
                setMessage(apiMessage(res.message, 'list_failed'));
            }
            if (preservedDeckState) {
                restorePreservedDeckState();
            } else {
                hasMoreRef.current = false;
            }
        }

        if (reset) setLoading(false);
        isFetchingRef.current = false;
    }, [filterAccountId, setFilters, toast]);

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
        if (locationState !== 'ready' || !cacheHydrated) return;
        void load(filtersRef.current, {
            reset: true,
            preserveVisible: false,
        });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [cacheHydrated, locationState]);

    const advance = (entry?: HistoryEntry) => {
        if (entry) setHistory((items) => [entry, ...items].slice(0, 1));
        setProfiles((items) => items.slice(1));
    };

    const undo = async () => {
        const last = history[0];
        if (!last) {
            toast.show(t('explore_undo_unavailable', 'Nothing to undo yet.'), 'info', 2500);
            return;
        }
        if (last.action === 'favorite') {
            const id = profileId(last.profile);
            if (id) void usersService.unfavorite(id).catch(() => undefined);
        }
        const restoredId = profileId(last.profile);
        if (restoredId) interactedProfileIdsRef.current.delete(restoredId);
        deckRef.current?.prepareRestore(last.action === 'favorite' ? 'right' : 'left');
        setProfiles((items) => [last.profile, ...items]);
        setHistory([]);
    };

    // Optimistic swipe: advance the deck immediately, sync with the API in the
    // background, and put the card back if the request fails.
    const rollbackSwipe = (profile: any, message?: string) => {
        const id = profileId(profile);
        if (id) interactedProfileIdsRef.current.delete(id);
        setProfiles((items) => [profile, ...items.filter((item) => profileId(item) !== id)]);
        setHistory((items) => items.filter((entry) => entry.profile !== profile));
        if (message === 'email_verification_required') setVerificationReason('save_or_skip');
        else toast.show(apiMessage(message), 'error', 3500);
    };

    const handleSwiped = (direction: SwipeDirection) => {
        const profile = current;
        const id = currentId;
        if (!profile || !id) return;
        const action = direction === 'right' ? 'favorite' : 'skip';
        interactedProfileIdsRef.current.add(id);
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
        if (isOffline) {
            toast.show(t('explore_offline_actions', 'Reconnect to save or skip profiles.'), 'info', 2500);
            return false;
        }
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

    useEffect(() => {
        if (
            !cacheHydrated
            || !cacheWriteEnabledRef.current
            || loading
            || filterAccountId === 'anonymous'
        ) return;

        hasCachedDeckRef.current = profiles.length > 0;
        const timeoutId = setTimeout(() => {
            void writeExploreDeckCache(filterAccountId, {
                profiles,
                filters: filtersRef.current,
                nextCursor: nextCursorRef.current,
                hasMore: hasMoreRef.current,
                mode: exploreModeRef.current,
            }).catch(() => undefined);
        }, 150);
        return () => clearTimeout(timeoutId);
    }, [cacheHydrated, filterAccountId, loading, profiles]);

    useEffect(() => {
        if (loading) return;
        if (current) {
            markStartup('explore-first-card-committed');
            return;
        }
        markStartup('explore-empty-state-committed');
    }, [current, loading]);

    // Warm the next cards' photos while the current one is on screen so the
    // deck never shows a loading image (Tinder-style).
    useEffect(() => {
        for (const profile of profiles.slice(1, 4)) {
            const uri = firstProfileImage(profile);
            if (uri) void Image.prefetch(uri);
        }
    }, [profiles]);

    const handleRootLayout = useCallback((event: LayoutChangeEvent) => {
        if (Platform.OS !== 'android') return;
        const layoutHeight = event.nativeEvent.layout.height;
        const nativeTabBarHeight = ANDROID_TAB_BAR_CONTENT_HEIGHT + insets.bottom;
        const settledSceneHeight = windowHeight - nativeTabBarHeight;
        setCompensateInitialAndroidTabBar(layoutHeight > settledSceneHeight + 2);
    }, [insets.bottom, windowHeight]);

    const showBodyLoading = locationState === 'checking' || (locationState === 'ready' && loading);

    return (
        <View
            onLayout={handleRootLayout}
            style={[
                styles.root,
                {
                    backgroundColor: palette.chrome.explore.screen,
                    paddingTop: insets.top,
                    paddingBottom: compensateInitialAndroidTabBar
                        ? ANDROID_TAB_BAR_CONTENT_HEIGHT + insets.bottom
                        : 0,
                },
            ]}
        >
            <ExploreTopOverlay
                filterCount={filterCount}
                onOpenFilters={() => setFiltersOpen(true)}
                onOpenTour={() => setTourOpen(true)}
                onOpenMenu={openMenu}
            />
            {showBodyLoading ? (
                <>
                    <View style={styles.deckArea} pointerEvents="none">
                        <Skeleton width="100%" height={undefined} borderRadius={scale(22)} style={{ flex: 1 }} />
                    </View>
                    <ExploreActionBarSkeleton />
                </>
            ) : locationState !== 'ready' ? (
                <View style={styles.empty}>
                    <EmptyState
                        icon={<MapPin size={scale(30)} color={palette.chrome.primary} />}
                        title={t('explore_location_required_title', 'Location access is required')}
                        description={
                            locationState === 'permission_denied'
                                ? t('explore_location_permission_denied', 'Allow location access to continue to Explore. This is required to verify your current city.')
                                : locationState === 'services_disabled'
                                    ? t('explore_location_services_disabled', 'Turn on device location to continue. Explore is unavailable while location is off.')
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
                                onPress: () => void retryLocationAccess(),
                                variant: 'secondary' as const,
                                disabled: locationRetrying,
                                loading: locationRetrying,
                            },
                        ]}
                    />
                </View>
            ) : current ? (
                <>
                    <View style={styles.deckArea} pointerEvents={deckLocked ? 'none' : 'auto'}>
                        <DevRenderProfiler id="ExploreDeck">
                            <SwipeableDeck
                                ref={deckRef}
                                profiles={profiles}
                                viewerLat={viewerCoordinates?.lat}
                                viewerLng={viewerCoordinates?.lng}
                                onPressCard={viewProfile}
                                onSwiped={handleSwiped}
                                canSwipe={canSwipe}
                            />
                        </DevRenderProfiler>
                    </View>
                    <ExploreActionBar
                        canUndo={history.length > 0}
                        busy={deckLocked}
                        writeDisabled={isOffline}
                        onUndo={undo}
                        onSkip={skip}
                        onFavorite={favorite}
                        onView={viewProfile}
                    />
                </>
            ) : (
                <View style={styles.empty}>
                    <EmptyState
                        icon={<Compass size={scale(30)} color={palette.chrome.primary} />}
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
