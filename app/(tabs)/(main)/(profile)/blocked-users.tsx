import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, RefreshControl, View } from 'react-native';
import { Text } from '@/components/ui/Text';
import { ProfileListCard } from '@/components/app/ProfileListCard';
import { AppBackTitleBar } from '@/components/app/AppBackTitleBar';
import { UserProfileSheet } from '@/components/profile/UserProfileSheet';
import { usersService } from '@/lib/usersService';
import { apiMessage, t } from '@/lib/profileDisplay';
import { useColors } from '@/hooks/useColors';
import { scale } from '@/hooks/useResponsive';
import { useToast } from '@/hooks/useToast';
import { queryClient } from '@/lib/queryClient';
import { queryKeys } from '@/lib/queryKeys';

type CachedProfileList = {
    items: any[];
    nextCursor: string | null;
};

export default function BlockedUsersScreen() {
    const colors = useColors();
    const primary = colors.chrome.primary;
    const toast = useToast();
    const cachedList = queryClient.getQueryData<CachedProfileList>(queryKeys.activities.list('blocked'));
    const [items, setItems] = useState<any[]>(() => cachedList?.items || []);
    const [loading, setLoading] = useState(!cachedList);
    const [refreshing, setRefreshing] = useState(false);
    const [loadingMore, setLoadingMore] = useState(false);
    const [nextCursor, setNextCursor] = useState<string | null>(() => cachedList?.nextCursor || null);
    const [hasMore, setHasMore] = useState(() => Boolean(cachedList?.nextCursor));
    const [selectedProfile, setSelectedProfile] = useState<any | null>(null);
    const [unblockingId, setUnblockingId] = useState<string | null>(null);

    const load = useCallback(async (cursor?: string | null, append = false) => {
        const res = await usersService.blocked({ limit: 30, cursor });
        if (res.success) {
            const responseCursor = res.nextCursor || null;
            setItems((current) => {
                const nextItems = append ? [...current, ...(res.items || [])] : (res.items || []);
                queryClient.setQueryData(queryKeys.activities.list('blocked'), {
                    items: nextItems,
                    nextCursor: responseCursor,
                });
                return nextItems;
            });
            setNextCursor(responseCursor);
            setHasMore(Boolean(responseCursor));
        }
    }, []);

    useEffect(() => {
        (async () => {
            setLoading(true);
            await load();
            setLoading(false);
        })();
    }, [load]);

    const refresh = async () => {
        setRefreshing(true);
        await load(null, false);
        setRefreshing(false);
    };

    const loadMore = async () => {
        if (loading || refreshing || loadingMore || !hasMore || !nextCursor) return;
        setLoadingMore(true);
        await load(nextCursor, true);
        setLoadingMore(false);
    };

    const unblock = async (id: string) => {
        if (!id || unblockingId) return;
        setUnblockingId(id);
        try {
            const res = await usersService.unblock(id);
            if (res.success) {
                queryClient.removeQueries({ queryKey: queryKeys.profile.detail(id), exact: true });
                setItems((current) => {
                    const nextItems = current.filter((item) => String(item.id || item._id) !== String(id));
                    queryClient.setQueryData(queryKeys.activities.list('blocked'), { items: nextItems, nextCursor });
                    return nextItems;
                });
                setSelectedProfile((current: any) => (String(current?.id || current?._id) === String(id) ? null : current));
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
            <AppBackTitleBar title={t('blocked_users', 'Blocked users')} fallbackHref="/settings-security" showMenu />
            {loading ? (
                <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
                    <ActivityIndicator color={primary} />
                </View>
            ) : <FlatList
                data={items}
                keyExtractor={(item) => String(item.id || item._id)}
                numColumns={2}
                columnWrapperStyle={{ gap: scale(10) }}
                style={{ flex: 1 }}
                contentContainerStyle={{ paddingHorizontal: scale(14), paddingTop: scale(18), paddingBottom: scale(110), flexGrow: 1 }}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={primary} />}
                onEndReached={loadMore}
                onEndReachedThreshold={0.35}
                ListFooterComponent={loadingMore ? <View style={{ paddingVertical: scale(18) }}><ActivityIndicator color={primary} /></View> : null}
                ListEmptyComponent={<View style={{ paddingTop: scale(90) }}><Text variant="h3" align="center">{t('no_blocked_users', 'No blocked users')}</Text></View>}
                renderItem={({ item }) => (
                    <ProfileListCard
                        item={item}
                        onPress={() => setSelectedProfile(item)}
                        onFavorite={() => unblock(String(item.id || item._id))}
                        favoriteLabel={t('unblock', 'Unblock')}
                        badgeLabel={t('blocked_label', 'Blocked')}
                        actionTone="danger"
                        actionPlacement="overlayPill"
                        actionLoading={unblockingId === String(item.id || item._id)}
                    />
                )}
            />}
            <UserProfileSheet
                visible={Boolean(selectedProfile)}
                userId={String(selectedProfile?.id || selectedProfile?._id || '')}
                initialProfile={selectedProfile}
                onClose={() => setSelectedProfile(null)}
                onBlocked={(id) => {
                    setSelectedProfile(null);
                    setItems((current) => {
                        const nextItems = current.filter((item) => String(item.id || item._id) !== String(id));
                        queryClient.setQueryData(queryKeys.activities.list('blocked'), { items: nextItems, nextCursor });
                        return nextItems;
                    });
                }}
                onUnblocked={(id) => {
                    setSelectedProfile(null);
                    setItems((current) => {
                        const nextItems = current.filter((item) => String(item.id || item._id) !== String(id));
                        queryClient.setQueryData(queryKeys.activities.list('blocked'), { items: nextItems, nextCursor });
                        return nextItems;
                    });
                }}
                onFavoriteChanged={() => undefined}
            />
        </View>
    );
}
