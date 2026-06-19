import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, RefreshControl, View } from 'react-native';
import { Text } from '@/components/ui/Text';
import { ProfileListCard } from '@/components/app/ProfileListCard';
import { UserProfileSheet } from '@/components/profile/UserProfileSheet';
import { usersService } from '@/lib/usersService';
import { t } from '@/lib/profileDisplay';
import { useTheme } from '@/hooks/useTheme';
import { scale } from '@/hooks/useResponsive';

type Mode = 'visitors' | 'visited';

export default function ActivitiesScreen() {
    const { isDark } = useTheme();
    const [mode, setMode] = useState<Mode>('visitors');
    const [items, setItems] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [selectedProfile, setSelectedProfile] = useState<any | null>(null);

    const load = useCallback(async () => {
        const res = mode === 'visitors'
            ? await usersService.visitors({ limit: 30 })
            : await usersService.visited({ limit: 30 });
        if (res.success) setItems(res.items || []);
    }, [mode]);

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

    return (
        <View style={{ flex: 1, backgroundColor: isDark ? '#0F172A' : '#F8FAFC' }}>
            <View style={{ paddingHorizontal: scale(14), paddingTop: scale(18), paddingBottom: 0 }}>
                <Text variant="h2">{t('activities', 'Activities')}</Text>
                <View style={{ flexDirection: 'row', gap: scale(8), marginVertical: scale(14) }}>
                    {(['visitors', 'visited'] as Mode[]).map((value) => (
                        <Pressable
                            key={value}
                            onPress={() => setMode(value)}
                            style={{
                                flex: 1,
                                paddingVertical: scale(10),
                                borderRadius: scale(999),
                                alignItems: 'center',
                                backgroundColor: mode === value ? '#F34B6F' : isDark ? '#111827' : '#FFFFFF',
                            }}
                        >
                            <Text variant="body-sm" style={{ color: mode === value ? '#FFFFFF' : undefined }}>
                                {value === 'visitors' ? t('visitors', 'Visitors') : t('visited', 'Visited')}
                            </Text>
                        </Pressable>
                    ))}
                </View>
            </View>
            {loading ? (
                <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}><ActivityIndicator color="#F34B6F" /></View>
            ) : (
                <FlatList
                    data={items}
                    keyExtractor={(item) => String(item.id || item._id)}
                    numColumns={2}
                    columnWrapperStyle={{ gap: scale(10) }}
                    contentContainerStyle={{ paddingHorizontal: scale(14), paddingTop: 0, paddingBottom: scale(110), flexGrow: 1 }}
                    refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor="#F34B6F" />}
                    ListEmptyComponent={<View style={{ paddingTop: scale(90) }}><Text variant="h3" align="center">{t('not_set', 'Not set')}</Text></View>}
                    renderItem={({ item }) => (
                        <ProfileListCard item={item} onPress={() => setSelectedProfile(item)} />
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
                    setItems((current) => current.map((item) => String(item.id || item._id) === String(id) ? { ...item, is_favorited: favorited } : item));
                }}
            />
        </View>
    );
}
