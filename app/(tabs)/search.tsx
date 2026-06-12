import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Text } from '@/components/ui/Text';
import { AppMenuDrawer } from '@/components/app/AppMenuDrawer';
import { ExploreActionBar } from '@/components/explore/ExploreActionBar';
import { ExploreDeckCard } from '@/components/explore/ExploreDeckCard';
import { ExploreFilterDrawer } from '@/components/explore/ExploreFilterDrawer';
import { ExploreTopOverlay } from '@/components/explore/ExploreTopOverlay';
import { ExploreTourModal } from '@/components/explore/ExploreTourModal';
import { UserProfileView } from '@/components/profile/UserProfileView';
import { useEmailVerificationGuard } from '@/hooks/useEmailVerificationGuard';
import { scale } from '@/hooks/useResponsive';
import { useTheme } from '@/hooks/useTheme';
import { useAuthStore } from '@/store/authStore';
import {
    ExploreFilterState,
    activeExploreFilterCount,
    buildExploreParams,
    resetExploreFilters,
} from '@/lib/exploreFilters';
import { profileId } from '@/lib/exploreProfile';
import { profileCoordinates } from '@/lib/exploreProfile';
import { apiMessage, t } from '@/lib/profileDisplay';
import { usersService } from '@/lib/usersService';

type HistoryEntry = { action: 'skip' | 'favorite' | 'view'; profile: any };

export default function ExploreScreen() {
    const { isDark } = useTheme();
    const insets = useSafeAreaInsets();
    const { requireVerified } = useEmailVerificationGuard();
    const user = useAuthStore((state) => state.user);
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

    const current = profiles[0] || null;
    const currentId = current ? profileId(current) : '';
    const filterCount = useMemo(() => activeExploreFilterCount(filters), [filters]);
    const viewerCoordinates = useMemo(() => profileCoordinates(user?.profile || user), [user]);

    const load = useCallback(async (nextFilters = filters) => {
        setLoading(true);
        setMessage('');
        const res = await usersService.list({ limit: 20, ...buildExploreParams(nextFilters) });
        if (res.success) {
            setProfiles(res.items || []);
        } else {
            setProfiles([]);
            setMessage(apiMessage(res.message, 'list_failed'));
        }
        setLoading(false);
    }, [filters]);

    useEffect(() => {
        void load(filters);
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
        if (!current || !currentId || !requireVerified('profileActions')) return;
        setBusy(true);
        const res = await usersService.skip(currentId);
        setBusy(false);
        if (res.success) advance({ action: 'skip', profile: current });
        else Alert.alert(t('error', 'Error'), apiMessage(res.message));
    };

    const favorite = async () => {
        if (!current || !currentId || !requireVerified('profileActions')) return;
        setBusy(true);
        const res = await usersService.favorite(currentId);
        setBusy(false);
        if (res.success) {
            advance({ action: 'favorite', profile: current });
            Alert.alert(t('saved', 'Saved'), t('saved', 'Saved'));
        } else {
            Alert.alert(t('error', 'Error'), apiMessage(res.message));
        }
    };

    const viewProfile = () => {
        if (!current) return;
        if (viewedCount >= 5 && !requireVerified('browse')) return;
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
        setHistory([]);
        setViewedCount(0);
        void load(next);
    };

    if (detailOpen && currentId) {
        return (
            <UserProfileView
                userId={currentId}
                initialProfile={current}
                mode="inline"
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
        );
    }

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
                    <Text variant="h3" align="center">
                        {message || t('explore_no_profiles_title', 'No matches right now')}
                    </Text>
                    <Text variant="body-sm" align="center" style={{ color: isDark ? '#94A3B8' : '#64748B', marginTop: scale(8) }}>
                        {t('explore_no_profiles', 'Expand your filters to see more profiles.')}
                    </Text>
                    <Pressable onPress={() => setFiltersOpen(true)} style={styles.emptyButton}>
                        <Text variant="body-sm" className="font-body-semi" style={{ color: '#FFFFFF' }}>
                            {t('filters', 'Filters')}
                        </Text>
                    </Pressable>
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
        </View>
    );
}

const styles = StyleSheet.create({
    root: { flex: 1 },
    center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    deckArea: { flex: 1, position: 'relative' },
    empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: scale(24) },
    emptyButton: {
        marginTop: scale(18),
        borderRadius: scale(999),
        backgroundColor: '#F34B6F',
        paddingHorizontal: scale(18),
        paddingVertical: scale(11),
    },
});
