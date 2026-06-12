import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, RefreshControl, View } from 'react-native';
import { Text } from '@/components/ui/Text';
import { ProfileListCard } from '@/components/app/ProfileListCard';
import { usersService } from '@/lib/usersService';
import { apiMessage, t } from '@/lib/profileDisplay';
import { useTheme } from '@/hooks/useTheme';
import { scale } from '@/hooks/useResponsive';

export default function BlockedUsersScreen() {
    const { isDark } = useTheme();
    const [items, setItems] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    const load = useCallback(async () => {
        const res = await usersService.blocked({ limit: 30 });
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

    const unblock = async (id: string) => {
        const res = await usersService.unblock(id);
        if (res.success) setItems((current) => current.filter((item) => item.id !== id));
        else Alert.alert(t('error', 'Error'), apiMessage(res.message));
    };

    if (loading) return <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: isDark ? '#0F172A' : '#F8FAFC' }}><ActivityIndicator color="#F34B6F" /></View>;

    return (
        <FlatList
            data={items}
            keyExtractor={(item) => item.id}
            style={{ flex: 1, backgroundColor: isDark ? '#0F172A' : '#F8FAFC' }}
            contentContainerStyle={{ paddingHorizontal: scale(14), paddingTop: scale(18), paddingBottom: scale(110), flexGrow: 1 }}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor="#F34B6F" />}
            ListHeaderComponent={<Text variant="h2" style={{ marginBottom: scale(14) }}>{t('blocked_users', 'Blocked users')}</Text>}
            ListEmptyComponent={<View style={{ paddingTop: scale(90) }}><Text variant="h3" align="center">{t('not_set', 'Not set')}</Text></View>}
            renderItem={({ item }) => (
                <ProfileListCard item={item} onPress={() => undefined} onFavorite={() => unblock(item.id)} favoriteLabel={t('unblock', 'Unblock')} />
            )}
        />
    );
}
