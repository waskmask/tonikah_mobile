import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, RefreshControl, View } from 'react-native';
import { Text } from '@/components/ui/Text';
import { ProfileListCard } from '@/components/app/ProfileListCard';
import { TabTitleBar } from '@/components/app/TabTitleBar';
import { UserProfileSheet } from '@/components/profile/UserProfileSheet';
import { usersService } from '@/lib/usersService';
import { apiMessage, t } from '@/lib/profileDisplay';
import { useColors } from '@/hooks/useColors';
import { scale } from '@/hooks/useResponsive';
import { useToast } from '@/hooks/useToast';

export default function FavouritedScreen() {
    const colors = useColors();
    const primary = colors.chrome.primary;
    const toast = useToast();
    const [items, setItems] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [loadingMore, setLoadingMore] = useState(false);
    const [nextCursor, setNextCursor] = useState<string | null>(null);
    const [hasMore, setHasMore] = useState(false);
    const [selectedProfile, setSelectedProfile] = useState<any | null>(null);
    const [removingId, setRemovingId] = useState<string | null>(null);

    const load = useCallback(async (cursor?: string | null, append = false) => {
        const res = await usersService.favorites({ limit: 30, cursor });
        if (res.success) {
            setItems((current) => append ? [...current, ...(res.items || [])] : (res.items || []));
            setNextCursor(res.nextCursor || null);
            setHasMore(Boolean(res.nextCursor));
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
                setItems((current) => current.filter((item) => String(item.id || item._id) !== String(id)));
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
                        <View style={{ paddingTop: scale(60), paddingHorizontal: scale(24) }}>
                            <Text variant="h3" align="center">{t('no_favourites', 'No favourites yet')}</Text>
                            <Text variant="body-sm" align="center" style={{ color: colors.brand.text.subtitle, marginTop: scale(8) }}>
                                {t('no_favourites_hint', 'Profiles you save while exploring will appear here.')}
                            </Text>
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
                    setItems((current) => current.filter((item) => String(item.id || item._id) !== String(id)));
                }}
                onFavoriteChanged={(id, favorited) => {
                    if (!favorited) setItems((current) => current.filter((item) => String(item.id || item._id) !== String(id)));
                }}
            />
        </View>
    );
}
