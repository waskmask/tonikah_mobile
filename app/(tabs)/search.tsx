import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Text } from '@/components/ui/Text';
import { AppMenuDrawer } from '@/components/app/AppMenuDrawer';
import { EmailVerificationRequiredBanner } from '@/components/app/EmailVerificationRequiredBanner';
import { ExploreActionBar } from '@/components/explore/ExploreActionBar';
import { ExploreDeckCard } from '@/components/explore/ExploreDeckCard';
import { ExploreFilterDrawer } from '@/components/explore/ExploreFilterDrawer';
import { ExploreTopOverlay } from '@/components/explore/ExploreTopOverlay';
import { ExploreTourModal } from '@/components/explore/ExploreTourModal';
import { UserProfileSheet } from '@/components/profile/UserProfileSheet';
import { scale } from '@/hooks/useResponsive';
import { useTheme } from '@/hooks/useTheme';
import { useToast } from '@/hooks/useToast';
import { useAuthStore } from '@/store/authStore';
import {
    ExploreFilterState,
    activeExploreFilterCount,
    buildExploreParams,
    clearDroppedFilters,
    describeDroppedFilters,
    resetExploreFilters,
} from '@/lib/exploreFilters';
import { profileId } from '@/lib/exploreProfile';
import { profileCoordinates } from '@/lib/exploreProfile';
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
    const { isDark } = useTheme();
    const insets = useSafeAreaInsets();
    const toast = useToast();
    const user = useAuthStore((state) => state.user);
    const emailVerified = Boolean(user?.email_verified ?? user?.emailVerified);
    const [profiles, setProfiles] = useState<any[]>([]);
    const [filters, setFilters] = useState<ExploreFilterState>(() => resetExploreFilters());
    const [loading, setLoading] = useState(true);
    const [busy, setBusy] = useState(false);
    const [message, setMessage] = useState('');
    const [history, setHistory] = useState<HistoryEntry[]>([]);
    const [detailOpen, setDetailOpen] = useState(false);
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
        let mode = options.mode ?? exploreModeRef.current;
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
            const responseMode: ExploreMode = res.mode === 'skipped' || res.showingSkipped ? 'skipped' : mode;
            exploreModeRef.current = responseMode;

            const droppedFilters = responseMode === 'fresh' ? normalizeDroppedFilters(res.droppedFilters as any[]) : [];
            if (droppedFilters.length > 0) {
                const labels = describeDroppedFilters(nextFilters, droppedFilters);
                if (labels.length) {
                    const cleanedFilters = clearDroppedFilters(nextFilters, droppedFilters);
                    setFilters(cleanedFilters);
                    filtersRef.current = cleanedFilters;

                    const filtersText = labels.join(', ');
                    const messageText = t(
                        'filters_reset_msg',
                        'No data found for {filters}. Those filters were reset.',
                        { filters: filtersText },
                    )
                        .replaceAll('{filters}', filtersText)
                        .replaceAll('{{filters}}', filtersText);
                    toast.show(messageText, 'info', 5000);

                    if (allowDroppedRetry) {
                        isFetchingRef.current = false;
                        await load(cleanedFilters, { reset: true, allowDroppedRetry: false, mode: 'fresh' });
                        return;
                    }
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
                responseMode === 'fresh' &&
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
        void load(filtersRef.current, { reset: true });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

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

    const skip = async () => {
        if (!current || !currentId) return;
        if (!emailVerified) {
            setVerificationReason('save_or_skip');
            return;
        }
        setBusy(true);
        const res = await usersService.skip(currentId);
        setBusy(false);
        if (res.success) advance({ action: 'skip', profile: current });
        else if (res.message === 'email_verification_required') setVerificationReason('save_or_skip');
        else Alert.alert(t('error', 'Error'), apiMessage(res.message));
    };

    const favorite = async () => {
        if (!current || !currentId) return;
        if (!emailVerified) {
            setVerificationReason('save_or_skip');
            return;
        }
        setBusy(true);
        const res = await usersService.favorite(currentId);
        setBusy(false);
        if (res.success) {
            advance({ action: 'favorite', profile: current });
            toast.show(t('saved', 'Saved'), 'success', 3000);
        } else if (res.message === 'email_verification_required') {
            setVerificationReason('save_or_skip');
        } else {
            Alert.alert(t('error', 'Error'), apiMessage(res.message));
        }
    };

    const viewProfile = () => {
        if (!current) return;
        if (viewedCount >= 5 && !emailVerified) {
            setVerificationReason('browse_limit');
            return;
        }
        setDetailOpen(true);
    };

    const closeDetailAndAdvance = () => {
        if (current) {
            const viewedId = profileId(current);
            advance({ action: 'skip', profile: current });
            if (viewedId) void usersService.skip(viewedId).catch(() => undefined);
        }
        setViewedCount((count) => count + 1);
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

    return (
        <View style={[styles.root, { backgroundColor: isDark ? '#0F172A' : '#F8FAFC', paddingTop: insets.top }]}>
            {loading ? (
                <View style={styles.center}>
                    <ActivityIndicator size="large" color="#F34B6F" />
                </View>
            ) : current ? (
                <>
                    <ExploreTopOverlay
                        filterCount={filterCount}
                        onOpenFilters={() => setFiltersOpen(true)}
                        onOpenTour={() => setTourOpen(true)}
                        onOpenMenu={() => setMenuOpen(true)}
                    />
                    {verificationReason ? (
                        <View style={styles.verificationBanner}>
                            <EmailVerificationRequiredBanner
                                compact
                                email={user?.email}
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
                    <View style={styles.deckArea}>
                        <ExploreDeckCard
                            profile={current}
                            viewerLat={viewerCoordinates?.lat}
                            viewerLng={viewerCoordinates?.lng}
                            onPress={viewProfile}
                        />
                    </View>
                    <ExploreActionBar
                        canUndo={history.length > 0}
                        busy={busy}
                        onUndo={undo}
                        onSkip={skip}
                        onFavorite={favorite}
                        onView={viewProfile}
                    />
                </>
            ) : (
                <View style={styles.empty}>
                    {verificationReason ? (
                        <EmailVerificationRequiredBanner
                            compact
                            email={user?.email}
                            title={t('verify_email_browse_limit_title', 'Verify your email to keep browsing')}
                            message={t('verify_email_browse_limit_message', 'You can browse your first profiles now. Verify your email to continue exploring more matches.')}
                        />
                    ) : null}
                    <Text variant="h3" align="center">
                        {message || t('explore_no_profiles_title', 'No matches right now')}
                    </Text>
                    <Text variant="body-sm" align="center" style={{ color: isDark ? '#94A3B8' : '#64748B', marginTop: scale(8) }}>
                        {t('explore_no_profiles', 'Expand your filters to see more profiles.')}
                    </Text>
                    <View style={styles.emptyActions}>
                        <Pressable onPress={refreshSkippedProfiles} style={styles.emptyButton}>
                            <Text variant="body-sm" className="font-body-semi" style={{ color: '#FFFFFF' }}>
                                {t('refresh', 'Refresh')}
                            </Text>
                        </Pressable>
                        <Pressable onPress={() => setFiltersOpen(true)} style={[styles.emptyButton, styles.emptyButtonSecondary]}>
                            <Text variant="body-sm" className="font-body-semi" style={{ color: '#F34B6F' }}>
                                {t('filters', 'Filters')}
                            </Text>
                        </Pressable>
                    </View>
                </View>
            )}

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
                advanceOnClose
                onClose={() => setDetailOpen(false)}
                onAfterClose={closeDetailAndAdvance}
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
    deckArea: { flex: 1, position: 'relative' },
    verificationBanner: {
        paddingHorizontal: scale(12),
        paddingTop: scale(10),
        paddingBottom: scale(8),
        backgroundColor: 'transparent',
    },
    empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: scale(24) },
    emptyActions: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: scale(10),
        marginTop: scale(18),
    },
    emptyButton: {
        borderRadius: scale(999),
        backgroundColor: '#F34B6F',
        paddingHorizontal: scale(18),
        paddingVertical: scale(11),
    },
    emptyButtonSecondary: {
        backgroundColor: 'transparent',
        borderWidth: 1,
        borderColor: '#F34B6F',
    },
});
