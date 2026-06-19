import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, RefreshControl, View } from 'react-native';
import { Text } from '@/components/ui/Text';
import { ProfileListCard } from '@/components/app/ProfileListCard';
import { UserProfileSheet } from '@/components/profile/UserProfileSheet';
import { usersService } from '@/lib/usersService';
import { apiMessage, t } from '@/lib/profileDisplay';
import { useTheme } from '@/hooks/useTheme';
import { scale } from '@/hooks/useResponsive';
import { useToast } from '@/hooks/useToast';

export default function FavouritedScreen() {
    const { isDark } = useTheme();
    const toast = useToast();
    const [items, setItems] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [selectedProfile, setSelectedProfile] = useState<any | null>(null);

    const load = useCallback(async () => {
        const res = await usersService.favorites({ limit: 30 });
        if (res.success) setItems(res.items || []);
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
        await load();
        setRefreshing(false);
    };

    const remove = async (id: string) => {
        const res = await usersService.unfavorite(id);
        if (res.success) {
            setItems((current) => current.filter((item) => String(item.id || item._id) !== String(id)));
            toast.show(t('unfavorited', 'Removed from Saved'), 'success', 2500);
        } else {
            toast.show(apiMessage(res.message), 'error');
        }
    };

    if (loading) {
        return <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: isDark ? '#0F172A' : '#F8FAFC' }}><ActivityIndicator color="#F34B6F" /></View>;
    }

    return (
        <View style={{ flex: 1, backgroundColor: isDark ? '#0F172A' : '#F8FAFC' }}>
            <FlatList
                data={items}
                keyExtractor={(item) => String(item.id || item._id)}
                numColumns={2}
                columnWrapperStyle={{ gap: scale(10) }}
                style={{ flex: 1 }}
                contentContainerStyle={{ paddingHorizontal: scale(14), paddingTop: scale(18), paddingBottom: scale(110), flexGrow: 1 }}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor="#F34B6F" />}
                ListHeaderComponent={<Text variant="h2" style={{ marginBottom: scale(14) }}>{t('favourited', 'Favourited')}</Text>}
                ListEmptyComponent={<View style={{ paddingTop: scale(90) }}><Text variant="h3" align="center">{t('no_favourites', 'No favourites yet')}</Text></View>}
                renderItem={({ item }) => (
                    <ProfileListCard
                        item={item}
                        onPress={() => setSelectedProfile(item)}
                        onFavorite={() => remove(String(item.id || item._id))}
                        favoriteLabel={t('unfavorite', 'Unfavorite')}
                        actionTone="neutral"
                    />
                )}
            />
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
