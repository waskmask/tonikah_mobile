import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, RefreshControl, View } from 'react-native';
import { router } from 'expo-router';
import { Heart } from 'lucide-react-native';
import { EmptyState } from '@/components/ui/EmptyState';
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

type CachedProfileList = {
    items: any[];
    nextCursor: string | null;
};

export default function FavouritedScreen() {
    const colors = useColors();
    const primary = colors.chrome.primary;
    const toast = useToast();
    const cachedList = queryClient.getQueryData<CachedProfileList>(queryKeys.favourites.list);
    const [items, setItems] = useState<any[]>(() => cachedList?.items || []);
    const [loading, setLoading] = useState(!cachedList);
    const [refreshing, setRefreshing] = useState(false);
    const [loadingMore, setLoadingMore] = useState(false);
    const [nextCursor, setNextCursor] = useState<string | null>(() => cachedList?.nextCursor || null);
    const [hasMore, setHasMore] = useState(() => Boolean(cachedList?.nextCursor));
    const [selectedProfile, setSelectedProfile] = useState<any | null>(null);
    const [removingId, setRemovingId] = useState<string | null>(null);

    const load = useCallback(async (cursor?: string | null, append = false) => {
        const res = await usersService.favorites({ limit: 30, cursor });
        if (res.success) {
            const responseCursor = res.nextCursor || null;
            setItems((current) => {
                const nextItems = append ? [...current, ...(res.items || [])] : (res.items || []);
                queryClient.setQueryData(queryKeys.favourites.list, {
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

    const remove = async (id: string) => {
        if (removingId) return;
        setRemovingId(id);
        try {
            const res = await usersService.unfavorite(id);
            if (res.success) {
                setItems((current) => {
                    const nextItems = current.filter((item) => String(item.id || item._id) !== String(id));
                    queryClient.setQueryData(queryKeys.favourites.list, { items: nextItems, nextCursor });
                    return nextItems;
                });
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
            <TabTitleBar title={t('favourited', 'Saved')} showMenu />
            {loading ? (
                <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}><ActivityIndicator color={primary} /></View>
            ) : (
                <FlatList
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
                    ListEmptyComponent={
                        <View style={{ paddingTop: scale(70), alignItems: 'center' }}>
                            <EmptyState
                                icon={<Heart size={scale(30)} color={primary} strokeWidth={1.8} />}
                                title={t('no_favourites', 'No favourites yet')}
                                description={t('no_favourites_hint', 'Profiles you save while exploring will appear here.')}
                                actions={[{
                                    label: t('explore', 'Explore'),
                                    onPress: () => router.push('/(tabs)/search'),
                                }]}
                            />
                        </View>
                    }
                    renderItem={({ item }) => (
                        <ProfileListCard
                            item={item}
                            onPress={() => setSelectedProfile(item)}
                            onFavorite={() => remove(String(item.id || item._id))}
                            favoriteLabel={t('remove', 'Remove')}
                            badgeLabel={t('saved', 'Saved')}
                            actionTone="neutral"
                            actionPlacement="overlayIcon"
                            actionLoading={removingId === String(item.id || item._id)}
                        />
                    )}
                />
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
                        queryClient.setQueryData(queryKeys.favourites.list, { items: nextItems, nextCursor });
                        return nextItems;
                    });
                }}
                onFavoriteChanged={(id, favorited) => {
                    if (!favorited) {
                        setItems((current) => {
                            const nextItems = current.filter((item) => String(item.id || item._id) !== String(id));
                            queryClient.setQueryData(queryKeys.favourites.list, { items: nextItems, nextCursor });
                            return nextItems;
                        });
                    }
                }}
            />
        </View>
    );
}
