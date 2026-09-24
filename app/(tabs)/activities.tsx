import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Animated as NativeAnimated, FlatList, PanResponder, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { useLocalSearchParams } from 'expo-router';
import { Text } from '@/components/ui/Text';
import { ProfileListCard } from '@/components/app/ProfileListCard';
import { TabTitleBar } from '@/components/app/TabTitleBar';
import { UserProfileSheet } from '@/components/profile/UserProfileSheet';
import { usersService } from '@/lib/usersService';
import { apiMessage, t } from '@/lib/profileDisplay';
import { useColors } from '@/hooks/useColors';
import { scale } from '@/hooks/useResponsive';
import { useToast } from '@/hooks/useToast';
import { queryClient } from '@/lib/queryClient';
import { queryKeys } from '@/lib/queryKeys';

type Mode = 'visitors' | 'visited' | 'blocked';

type CachedProfileList = {
    items: any[];
    nextCursor: string | null;
};

const MODES: Array<{ value: Mode; labelKey: string; fallback: string }> = [
    { value: 'visitors', labelKey: 'visitors', fallback: 'Visitors' },
    { value: 'visited', labelKey: 'visited', fallback: 'Visited' },
    { value: 'blocked', labelKey: 'blocked_users', fallback: 'Blocked users' },
];

function normalizeMode(value: unknown): Mode {
    const raw = Array.isArray(value) ? value[0] : value;
    return raw === 'visited' || raw === 'blocked' ? raw : 'visitors';
}

function isModeParam(value: unknown) {
    const raw = Array.isArray(value) ? value[0] : value;
    return raw === 'visitors' || raw === 'visited' || raw === 'blocked';
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
    const initialCache = useRef(queryClient.getQueryData<CachedProfileList>(queryKeys.activities.list(normalizeMode(params.tab))));
    const [items, setItems] = useState<any[]>(() => initialCache.current?.items || []);
    const [loading, setLoading] = useState(!initialCache.current);
    const [refreshing, setRefreshing] = useState(false);
    const [loadingMore, setLoadingMore] = useState(false);
    const [nextCursor, setNextCursor] = useState<string | null>(() => initialCache.current?.nextCursor || null);
    const [hasMore, setHasMore] = useState(() => Boolean(initialCache.current?.nextCursor));
    const [selectedProfile, setSelectedProfile] = useState<any | null>(null);
    const [unblockingId, setUnblockingId] = useState<string | null>(null);
    const listScrollY = useRef(0);
    const refreshingRef = useRef(false);
    const pullDistance = useRef(new NativeAnimated.Value(0)).current;

    const load = useCallback(async (cursor?: string | null, append = false) => {
        const res = mode === 'visitors'
            ? await usersService.visitors({ limit: 30, cursor })
            : mode === 'visited'
                ? await usersService.visited({ limit: 30, cursor })
                : await usersService.blocked({ limit: 30, cursor });
        if (activeModeRef.current !== mode) return;
        if (res.success) {
            const responseCursor = res.nextCursor || null;
            setItems((current) => {
                const nextItems = append ? [...current, ...(res.items || [])] : (res.items || []);
                queryClient.setQueryData(queryKeys.activities.list(mode), {
                    items: nextItems,
                    nextCursor: responseCursor,
                });
                return nextItems;
            });
            setNextCursor(responseCursor);
            setHasMore(Boolean(responseCursor));
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

    const indicatorStyle = useAnimatedStyle(() => ({
        opacity: indicatorOpacity.value,
        width: indicatorWidth.value,
        transform: [{ translateX: indicatorX.value }],
    }));

    useEffect(() => {
        (async () => {
            const cached = queryClient.getQueryData<CachedProfileList>(queryKeys.activities.list(mode));
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
            await load();
            setLoading(false);
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

    const resetPull = useCallback(() => {
        NativeAnimated.spring(pullDistance, {
            toValue: 0,
            damping: 18,
            stiffness: 220,
            mass: 0.7,
            useNativeDriver: true,
        }).start();
    }, [pullDistance]);

    const pullResponder = useMemo(() => {
        const threshold = scale(72);
        const heldDistance = scale(44);
        const maxVisualDistance = scale(64);

        return PanResponder.create({
            onMoveShouldSetPanResponderCapture: (_, gesture) => (
                !refreshingRef.current
                && listScrollY.current <= 0
                && gesture.dy > scale(8)
                && Math.abs(gesture.dy) > Math.abs(gesture.dx) * 1.25
            ),
            onPanResponderMove: (_, gesture) => {
                pullDistance.setValue(Math.min(maxVisualDistance, Math.max(0, gesture.dy * 0.55)));
            },
            onPanResponderRelease: (_, gesture) => {
                if (gesture.dy < threshold || refreshingRef.current) {
                    resetPull();
                    return;
                }
                NativeAnimated.spring(pullDistance, {
                    toValue: heldDistance,
                    damping: 18,
                    stiffness: 220,
                    mass: 0.7,
                    useNativeDriver: true,
                }).start();
                void refresh().finally(resetPull);
            },
            onPanResponderTerminate: resetPull,
        });
    }, [pullDistance, refresh, resetPull]);

    const pullIndicatorStyle = useMemo(() => ({
        opacity: pullDistance.interpolate({
            inputRange: [0, scale(16), scale(44)],
            outputRange: [0, 0.45, 1],
            extrapolate: 'clamp',
        }),
    }), [pullDistance]);

    const loadMore = async () => {
        if (loading || refreshing || loadingMore || !hasMore || !nextCursor) return;
        setLoadingMore(true);
        await load(nextCursor, true);
        setLoadingMore(false);
    };

    const unblock = async (item: any) => {
        const id = String(item.id || item._id);
        if (!id || unblockingId) return;
        setUnblockingId(id);
        try {
            const res = await usersService.unblock(id);
            if (res.success) {
                queryClient.removeQueries({ queryKey: queryKeys.profile.detail(id), exact: true });
                setItems((current) => {
                    const nextItems = current.filter((entry) => String(entry.id || entry._id) !== String(id));
                    queryClient.setQueryData(queryKeys.activities.list(mode), { items: nextItems, nextCursor });
                    return nextItems;
                });
                setSelectedProfile({ ...item, blocked: false });
                toast.show(t('unblocked', 'User has been unblocked.'), 'success', 2500);
            } else {
                toast.show(apiMessage(res.message), 'error');
            }
        } finally {
            setUnblockingId(null);
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
            ) : (
                <View style={styles.pullArea} {...pullResponder.panHandlers}>
                    <NativeAnimated.View pointerEvents="none" style={[styles.pullIndicator, pullIndicatorStyle]}>
                        <ActivityIndicator color={primary} />
                    </NativeAnimated.View>
                    <NativeAnimated.View style={[styles.listMotion, { transform: [{ translateY: pullDistance }] }]}>
                        <FlatList
                            data={items}
                            keyExtractor={(item) => String(item.id || item._id)}
                            numColumns={2}
                            columnWrapperStyle={{ gap: scale(10) }}
                            contentContainerStyle={{ paddingHorizontal: scale(14), paddingTop: scale(6), paddingBottom: scale(110), flexGrow: 1 }}
                            alwaysBounceVertical={false}
                            overScrollMode="never"
                            onScroll={(event) => {
                                listScrollY.current = Math.max(0, event.nativeEvent.contentOffset.y);
                            }}
                            scrollEventThrottle={16}
                            onEndReached={loadMore}
                            onEndReachedThreshold={0.35}
                            ListFooterComponent={loadingMore ? <View style={{ paddingVertical: scale(18) }}><ActivityIndicator color={primary} /></View> : null}
                            ListEmptyComponent={
                                <View style={{ paddingTop: scale(60), paddingHorizontal: scale(24) }}>
                                    <Text variant="h3" align="center">
                                        {mode === 'visitors'
                                            ? t('no_visitors_yet', 'No visitors yet')
                                            : mode === 'visited'
                                                ? t('no_visited_yet', 'No visited profiles yet')
                                                : t('no_blocked_users', 'No blocked users')}
                                    </Text>
                                    <Text variant="body-sm" align="center" style={{ color: colors.brand.text.subtitle, marginTop: scale(8) }}>
                                        {mode === 'visitors'
                                            ? t('no_visitors_hint', 'When someone views your profile, they will show up here.')
                                            : mode === 'visited'
                                                ? t('no_visited_hint', 'Profiles you view will appear here.')
                                                : t('no_data_blocked', 'Users you block will appear here.')}
                                    </Text>
                                </View>
                            }
                            renderItem={({ item }) => (
                                <ProfileListCard
                                    item={item}
                                    onPress={() => setSelectedProfile(item)}
                                    badgeLabel={mode === 'visitors' ? t('visitor_label', 'Visitor') : mode === 'visited' ? t('visited_label', 'Visited') : t('blocked_label', 'Blocked')}
                                    onFavorite={mode === 'blocked' ? () => unblock(item) : undefined}
                                    favoriteLabel={mode === 'blocked' ? t('unblock', 'Unblock') : undefined}
                                    actionTone="danger"
                                    actionPlacement="overlayPill"
                                    actionLoading={unblockingId === String(item.id || item._id)}
                                />
                            )}
                        />
                    </NativeAnimated.View>
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
                        queryClient.setQueryData(queryKeys.activities.list(mode), { items: nextItems, nextCursor });
                        return nextItems;
                    });
                }}
                onUnblocked={(id) => {
                    if (mode === 'blocked') {
                        setItems((current) => {
                            const nextItems = current.filter((item) => String(item.id || item._id) !== String(id));
                            queryClient.setQueryData(queryKeys.activities.list(mode), { items: nextItems, nextCursor });
                            return nextItems;
                        });
                    }
                }}
                onFavoriteChanged={(id, favorited) => {
                    setItems((current) => {
                        const nextItems = current.map((item) => String(item.id || item._id) === String(id) ? { ...item, is_favorited: favorited } : item);
                        queryClient.setQueryData(queryKeys.activities.list(mode), { items: nextItems, nextCursor });
                        return nextItems;
                    });
                }}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    pullArea: {
        flex: 1,
        overflow: 'hidden',
    },
    pullIndicator: {
        position: 'absolute',
        top: 0,
        right: 0,
        left: 0,
        height: scale(44),
        alignItems: 'center',
        justifyContent: 'center',
    },
    listMotion: {
        flex: 1,
    },
});
