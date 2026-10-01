import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, RefreshControl, ScrollView, View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { useFocusEffect, useLocalSearchParams } from 'expo-router';
import { Text } from '@/components/ui/Text';
import { InlineLoadError } from '@/components/ui/InlineLoadError';
import { ProfileListCard } from '@/components/app/ProfileListCard';
import { TabTitleBar } from '@/components/app/TabTitleBar';
import { UserProfileSheet } from '@/components/profile/UserProfileSheet';
import { usersService } from '@/lib/usersService';
import { apiMessage, t } from '@/lib/profileDisplay';
import { useColors } from '@/hooks/useColors';
import { scale } from '@/hooks/useResponsive';
import { useToast } from '@/hooks/useToast';
import { useDeliberateRefresh } from '@/hooks/useDeliberateRefresh';
import { queryClient } from '@/lib/queryClient';
import { queryKeys } from '@/lib/queryKeys';

type Mode = 'saved' | 'visitors' | 'visited';

type CachedProfileList = {
    items: any[];
    nextCursor: string | null;
};

const MODES: Array<{ value: Mode; labelKey: string; fallback: string }> = [
    { value: 'saved', labelKey: 'favourited', fallback: 'Saved' },
    { value: 'visitors', labelKey: 'visitors', fallback: 'Visitors' },
    { value: 'visited', labelKey: 'visited', fallback: 'Visited' },
];

function normalizeMode(value: unknown): Mode {
    const raw = Array.isArray(value) ? value[0] : value;
    return raw === 'visitors' || raw === 'visited' ? raw : 'saved';
}

function isModeParam(value: unknown) {
    const raw = Array.isArray(value) ? value[0] : value;
    return raw === 'saved' || raw === 'visitors' || raw === 'visited';
}

function listQueryKey(mode: Mode) {
    return mode === 'saved' ? queryKeys.favourites.list : queryKeys.activities.list(mode);
}

export default function ActivitiesScreen() {
    const colors = useColors();
    const primary = colors.chrome.primary;
    const toast = useToast();
    const params = useLocalSearchParams<{ tab?: string }>();
    const [mode, setMode] = useState<Mode>(() => normalizeMode(params.tab));
    const tabLayouts = useRef<Partial<Record<Mode, { x: number; width: number }>>>({});
    const indicatorReady = useRef(false);
    const indicatorX = useSharedValue(0);
    const indicatorWidth = useSharedValue(0);
    const indicatorOpacity = useSharedValue(0);
    const activeModeRef = useRef(mode);
    activeModeRef.current = mode;
    const initialCache = useRef(queryClient.getQueryData<CachedProfileList>(listQueryKey(normalizeMode(params.tab))));
    const [items, setItems] = useState<any[]>(() => initialCache.current?.items || []);
    const [loading, setLoading] = useState(!initialCache.current);
    const [refreshing, setRefreshing] = useState(false);
    const [loadingMore, setLoadingMore] = useState(false);
    const [loadError, setLoadError] = useState('');
    const [nextCursor, setNextCursor] = useState<string | null>(() => initialCache.current?.nextCursor || null);
    const [hasMore, setHasMore] = useState(() => Boolean(initialCache.current?.nextCursor));
    const [selectedProfile, setSelectedProfile] = useState<any | null>(null);
    const [removingId, setRemovingId] = useState<string | null>(null);
    const refreshingRef = useRef(false);

    const load = useCallback(async (cursor?: string | null, append = false) => {
        try {
            const res = mode === 'saved'
                ? await usersService.favorites({ limit: 30, cursor })
                : mode === 'visitors'
                    ? await usersService.visitors({ limit: 30, cursor })
                    : await usersService.visited({ limit: 30, cursor });
            if (activeModeRef.current !== mode) return false;
            if (res.success) {
                setLoadError('');
                const responseCursor = res.nextCursor || null;
                setItems((current) => {
                    const nextItems = append ? [...current, ...(res.items || [])] : (res.items || []);
                    queryClient.setQueryData(listQueryKey(mode), {
                        items: nextItems,
                        nextCursor: responseCursor,
                    });
                    return nextItems;
                });
                setNextCursor(responseCursor);
                setHasMore(Boolean(responseCursor));
                return true;
            }
            setLoadError(apiMessage(res.message));
            return false;
        } catch (cause) {
            if (activeModeRef.current === mode) {
                setLoadError(apiMessage(cause instanceof Error ? cause.message : undefined));
            }
            return false;
        }
    }, [mode]);

    useEffect(() => {
        if (isModeParam(params.tab)) {
            setMode(normalizeMode(params.tab));
        }
    }, [params.tab]);

    useEffect(() => {
        const layout = tabLayouts.current[mode];
        if (!layout) return;
        if (!indicatorReady.current) {
            indicatorX.value = layout.x;
            indicatorWidth.value = layout.width;
            indicatorOpacity.value = 1;
            indicatorReady.current = true;
            return;
        }
        const timing = { duration: 240, easing: Easing.out(Easing.cubic) };
        indicatorX.value = withTiming(layout.x, timing);
        indicatorWidth.value = withTiming(layout.width, timing);
    }, [indicatorOpacity, indicatorWidth, indicatorX, mode]);

    useFocusEffect(
        useCallback(() => {
            const frame = requestAnimationFrame(() => {
                const layout = tabLayouts.current[activeModeRef.current];
                if (!layout || layout.width <= 0) return;
                indicatorX.value = layout.x;
                indicatorWidth.value = layout.width;
                indicatorOpacity.value = 1;
                indicatorReady.current = true;
            });
            return () => cancelAnimationFrame(frame);
        }, [indicatorOpacity, indicatorWidth, indicatorX]),
    );

    const indicatorStyle = useAnimatedStyle(() => ({
        opacity: indicatorOpacity.value,
        width: indicatorWidth.value,
        transform: [{ translateX: indicatorX.value }],
    }));

    useEffect(() => {
        (async () => {
            setLoadError('');
            const cached = queryClient.getQueryData<CachedProfileList>(listQueryKey(mode));
            if (cached) {
                setItems(cached.items);
                setNextCursor(cached.nextCursor);
                setHasMore(Boolean(cached.nextCursor));
                setLoading(false);
            } else {
                setItems([]);
                setNextCursor(null);
                setHasMore(false);
                setLoading(true);
            }
            try {
                await load();
            } finally {
                setLoading(false);
            }
        })();
    }, [load]);

    const refresh = useCallback(async () => {
        if (refreshingRef.current) return;
        refreshingRef.current = true;
        setRefreshing(true);
        try {
            await load(null, false);
        } finally {
            refreshingRef.current = false;
            setRefreshing(false);
        }
    }, [load]);
    const refreshGesture = useDeliberateRefresh(refresh, !refreshing);

    const loadMore = async () => {
        if (loading || refreshing || loadingMore || !hasMore || !nextCursor) return;
        setLoadingMore(true);
        try {
            const loaded = await load(nextCursor, true);
            if (!loaded) toast.show(t('load_more_failed', 'Could not load more. Please try again.'), 'error');
        } finally {
            setLoadingMore(false);
        }
    };

    const removeSaved = async (item: any) => {
        const id = String(item.id || item._id);
        if (!id || removingId) return;
        setRemovingId(id);
        try {
            const res = await usersService.unfavorite(id);
            if (res.success) {
                queryClient.removeQueries({ queryKey: queryKeys.profile.detail(id), exact: true });
                setItems((current) => {
                    const nextItems = current.filter((entry) => String(entry.id || entry._id) !== String(id));
                    queryClient.setQueryData(queryKeys.favourites.list, { items: nextItems, nextCursor });
                    return nextItems;
                });
                setSelectedProfile((current: any) => (
                    String(current?.id || current?._id) === id ? null : current
                ));
                toast.show(t('unfavorited', 'Removed from Saved'), 'success', 2500);
            } else {
                toast.show(apiMessage(res.message), 'error');
            }
        } finally {
            setRemovingId(null);
        }
    };

    return (
        <View style={{ flex: 1, backgroundColor: colors.brand.bg.surface }}>
            <TabTitleBar title={t('activities', 'Activities')} showMenu hideBottomBorder />
            <View style={{ paddingHorizontal: scale(14), paddingTop: scale(2), paddingBottom: 0 }}>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: scale(8) }}>
                    <View style={{ flexDirection: 'row', gap: scale(8), paddingRight: scale(2) }}>
                        {MODES.map(({ value, labelKey, fallback }) => (
                            <Pressable
                                key={value}
                                onPress={() => setMode(value)}
                                onLayout={(event) => {
                                    const { x, width } = event.nativeEvent.layout;
                                    tabLayouts.current[value] = { x, width };
                                    if (mode === value && !indicatorReady.current) {
                                        indicatorX.value = x;
                                        indicatorWidth.value = width;
                                        indicatorOpacity.value = 1;
                                        indicatorReady.current = true;
                                    }
                                }}
                                style={{
                                    minWidth: scale(112),
                                    minHeight: scale(38),
                                    paddingTop: scale(6),
                                    paddingBottom: scale(9),
                                    paddingHorizontal: scale(12),
                                    borderRadius: 0,
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    flexDirection: 'row',
                                    backgroundColor: 'transparent',
                                }}
                            >
                                <Text variant="body-sm" className="font-body-semi" numberOfLines={1} style={{ fontSize: 15, color: mode === value ? colors.brand.text.body : colors.brand.text.muted }}>
                                    {t(labelKey, fallback)}
                                </Text>
                            </Pressable>
                        ))}
                        <Animated.View
                            pointerEvents="none"
                            style={[{ position: 'absolute', bottom: 0, left: 0, height: scale(2), backgroundColor: colors.brand.text.body }, indicatorStyle]}
                        />
                    </View>
                </ScrollView>
            </View>
            {loading ? (
                <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}><ActivityIndicator color={primary} /></View>
            ) : loadError && items.length === 0 ? (
                <View style={{ flex: 1, justifyContent: 'center', paddingBottom: scale(80) }}>
                    <InlineLoadError
                        title={t('could_not_load', 'Could not load this content')}
                        description={loadError}
                        retryLabel={t('btn_try_again', 'Try Again')}
                        onRetry={() => {
                            setLoading(true);
                            void load().finally(() => setLoading(false));
                        }}
                    />
                </View>
            ) : (
                <View style={{ flex: 1 }}>
                        <FlatList
                            data={items}
                            keyExtractor={(item) => String(item.id || item._id)}
                            numColumns={2}
                            columnWrapperStyle={{ gap: scale(10) }}
                            contentContainerStyle={{ paddingHorizontal: scale(14), paddingTop: scale(6), paddingBottom: scale(110), flexGrow: 1 }}
                            alwaysBounceVertical
                            onScroll={refreshGesture.onScroll}
                            onTouchStart={refreshGesture.onTouchStart}
                            onTouchMove={refreshGesture.onTouchMove}
                            onTouchEnd={refreshGesture.onTouchEnd}
                            onTouchCancel={refreshGesture.onTouchCancel}
                            scrollEventThrottle={16}
                            refreshControl={(
                                <RefreshControl
                                    refreshing={refreshing}
                                    onRefresh={refreshGesture.guardedRefresh}
                                    tintColor={primary}
                                    colors={[primary]}
                                    progressBackgroundColor={colors.chrome.header.background}
                                />
                            )}
                            onEndReached={loadMore}
                            onEndReachedThreshold={0.35}
                            ListFooterComponent={loadingMore ? <View style={{ paddingVertical: scale(18) }}><ActivityIndicator color={primary} /></View> : null}
                            ListHeaderComponent={loadError ? (
                                <View style={{ paddingVertical: scale(18) }}>
                                    <InlineLoadError
                                        title={t('refresh_failed', 'Could not refresh')}
                                        description={loadError}
                                        retryLabel={t('btn_try_again', 'Try Again')}
                                        onRetry={() => void refresh()}
                                        retrying={refreshing}
                                    />
                                </View>
                            ) : null}
                            ListEmptyComponent={
                                <View style={{ paddingTop: scale(60), paddingHorizontal: scale(24) }}>
                                    <Text variant="h3" align="center">
                                        {mode === 'saved'
                                            ? t('no_favourites', 'No favourites yet')
                                            : mode === 'visitors'
                                                ? t('no_visitors_yet', 'No visitors yet')
                                                : t('no_visited_yet', 'No visited profiles yet')}
                                    </Text>
                                    <Text variant="body-sm" align="center" style={{ color: colors.brand.text.subtitle, marginTop: scale(8) }}>
                                        {mode === 'saved'
                                            ? t('no_favourites_hint', 'Profiles you save while exploring will appear here.')
                                            : mode === 'visitors'
                                                ? t('no_visitors_hint', 'When someone views your profile, they will show up here.')
                                                : t('no_visited_hint', 'Profiles you view will appear here.')}
                                    </Text>
                                </View>
                            }
                            renderItem={({ item }) => (
                                <ProfileListCard
                                    item={item}
                                    onPress={() => setSelectedProfile(item)}
                                    badgeLabel={mode === 'saved' ? t('saved', 'Saved') : mode === 'visitors' ? t('visitor_label', 'Visitor') : t('visited_label', 'Visited')}
                                    onFavorite={mode === 'saved' ? () => removeSaved(item) : undefined}
                                    favoriteLabel={mode === 'saved' ? t('remove', 'Remove') : undefined}
                                    actionTone={mode === 'saved' ? 'neutral' : undefined}
                                    actionPlacement={mode === 'saved' ? 'overlayIcon' : undefined}
                                    actionLoading={removingId === String(item.id || item._id)}
                                />
                            )}
                        />
                </View>
            )}
            <UserProfileSheet
                visible={Boolean(selectedProfile)}
                userId={String(selectedProfile?.id || selectedProfile?._id || '')}
                initialProfile={selectedProfile}
                onClose={() => setSelectedProfile(null)}
                onBlocked={(id) => {
                    setSelectedProfile(null);
                    setItems((current) => {
                        const nextItems = current.filter((item) => String(item.id || item._id) !== String(id));
                        queryClient.setQueryData(listQueryKey(mode), { items: nextItems, nextCursor });
                        return nextItems;
                    });
                }}
                onUnblocked={() => undefined}
                onFavoriteChanged={(id, favorited) => {
                    setItems((current) => {
                        const nextItems = mode === 'saved' && !favorited
                            ? current.filter((item) => String(item.id || item._id) !== String(id))
                            : current.map((item) => String(item.id || item._id) === String(id) ? { ...item, is_favorited: favorited } : item);
                        queryClient.setQueryData(listQueryKey(mode), { items: nextItems, nextCursor });
                        return nextItems;
                    });
                }}
            />
        </View>
    );
}
