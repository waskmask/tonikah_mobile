import React, { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, RefreshControl, View } from 'react-native';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { Text } from '@/components/ui/Text';
import { chatService } from '@/lib/chatService';
import { profileImage, t } from '@/lib/profileDisplay';
import { PROFILE_PLACEHOLDER_IMAGE } from '@/lib/profileAssets';
import { useTheme } from '@/hooks/useTheme';
import { scale } from '@/hooks/useResponsive';

export default function MessagesScreen() {
    const { isDark } = useTheme();
    const [items, setItems] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    const load = async () => {
        const res = await chatService.conversations();
        if (res.success) setItems(res.items || []);
    };

    useEffect(() => {
        (async () => {
            setLoading(true);
            await load();
            setLoading(false);
        })();
    }, []);

    const refresh = async () => {
        setRefreshing(true);
        await load();
        setRefreshing(false);
    };

    if (loading) return <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: isDark ? '#0F172A' : '#F8FAFC' }}><ActivityIndicator color="#F34B6F" /></View>;

    return (
        <FlatList
            data={items}
            keyExtractor={(item) => item.id}
            style={{ flex: 1, backgroundColor: isDark ? '#0F172A' : '#F8FAFC' }}
            contentContainerStyle={{ paddingHorizontal: scale(14), paddingTop: scale(18), paddingBottom: scale(110), flexGrow: 1 }}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor="#F34B6F" />}
            ListHeaderComponent={<Text variant="h2" style={{ marginBottom: scale(14) }}>{t('messages', 'Messages')}</Text>}
            ListEmptyComponent={<View style={{ paddingTop: scale(90) }}><Text variant="h3" align="center">{t('no_messages', 'No messages yet')}</Text></View>}
            renderItem={({ item }) => {
                const other = item.otherUser || {};
                const avatar = profileImage(other);
                return (
                    <Pressable
                        onPress={() => router.push(`/conversation/${item.id}` as any)}
                        style={{ flexDirection: 'row', gap: scale(12), padding: scale(12), borderRadius: scale(16), marginBottom: scale(10), backgroundColor: isDark ? '#111827' : '#FFFFFF' }}
                    >
                        <View style={{ width: scale(54), height: scale(54), borderRadius: scale(27), overflow: 'hidden', backgroundColor: isDark ? '#1E293B' : '#E2E8F0' }}>
                            <Image source={avatar ? { uri: avatar } : PROFILE_PLACEHOLDER_IMAGE} style={{ flex: 1 }} contentFit="cover" />
                        </View>
                        <View style={{ flex: 1 }}>
                            <Text variant="body" className="font-body-semi">{other.profileName || other.username || t('not_set', 'Not set')}</Text>
                            <Text variant="body-sm" numberOfLines={1} style={{ color: isDark ? '#94A3B8' : '#64748B', marginTop: scale(3) }}>
                                {item.lastMessagePreview || t('message', 'Message')}
                            </Text>
                        </View>
                        {item.unreadCount ? (
                            <View style={{ minWidth: scale(24), height: scale(24), borderRadius: scale(12), backgroundColor: '#F34B6F', alignItems: 'center', justifyContent: 'center' }}>
                                <Text variant="caption" style={{ color: '#FFFFFF' }}>{item.unreadCount}</Text>
                            </View>
                        ) : null}
                    </Pressable>
                );
            }}
        />
    );
}
