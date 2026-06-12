import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, RefreshControl, View } from 'react-native';
import { router } from 'expo-router';
import { Text } from '@/components/ui/Text';
import { ProfileListCard } from '@/components/app/ProfileListCard';
import { usersService } from '@/lib/usersService';
import { apiMessage, t } from '@/lib/profileDisplay';
import { useTheme } from '@/hooks/useTheme';
import { scale } from '@/hooks/useResponsive';

export default function FavouritedScreen() {
    const { isDark } = useTheme();
    const [items, setItems] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

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
        if (res.success) setItems((current) => current.filter((item) => item.id !== id));
        else Alert.alert(t('error', 'Error'), apiMessage(res.message));
    };

    if (loading) {
        return <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: isDark ? '#0F172A' : '#F8FAFC' }}><ActivityIndicator color="#F34B6F" /></View>;
    }

    return (
        <FlatList
            data={items}
            keyExtractor={(item) => item.id}
            style={{ flex: 1, backgroundColor: isDark ? '#0F172A' : '#F8FAFC' }}
            contentContainerStyle={{ paddingHorizontal: scale(14), paddingTop: scale(18), paddingBottom: scale(110), flexGrow: 1 }}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor="#F34B6F" />}
            ListHeaderComponent={<Text variant="h2" style={{ marginBottom: scale(14) }}>{t('favourited', 'Favourited')}</Text>}
            ListEmptyComponent={<View style={{ paddingTop: scale(90) }}><Text variant="h3" align="center">{t('no_favourites', 'No favourites yet')}</Text></View>}
            renderItem={({ item }) => (
                <ProfileListCard
                    item={item}
                    onPress={() => router.push(`/user/${item.id}` as any)}
                    onFavorite={() => remove(item.id)}
                    favoriteLabel={t('unfavorite', 'Unfavorite')}
                />
            )}
        />
    );
}
