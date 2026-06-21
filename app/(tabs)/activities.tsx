import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { Ban, Eye, Users } from 'lucide-react-native';
import { Text } from '@/components/ui/Text';
import { ProfileListCard } from '@/components/app/ProfileListCard';
import { TabTitleBar } from '@/components/app/TabTitleBar';
import { UserProfileSheet } from '@/components/profile/UserProfileSheet';
import { usersService } from '@/lib/usersService';
import { apiMessage, t } from '@/lib/profileDisplay';
import { useColors } from '@/hooks/useColors';
import { scale } from '@/hooks/useResponsive';
import { useToast } from '@/hooks/useToast';

type Mode = 'visitors' | 'visited' | 'blocked';

const MODES: Array<{ value: Mode; labelKey: string; fallback: string; icon: any }> = [
    { value: 'visitors', labelKey: 'visitors', fallback: 'Visitors', icon: Users },
    { value: 'visited', labelKey: 'visited', fallback: 'Visited', icon: Eye },
    { value: 'blocked', labelKey: 'blocked_users', fallback: 'Blocked users', icon: Ban },
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
    const [items, setItems] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [loadingMore, setLoadingMore] = useState(false);
    const [nextCursor, setNextCursor] = useState<string | null>(null);
    const [hasMore, setHasMore] = useState(false);
    const [selectedProfile, setSelectedProfile] = useState<any | null>(null);
    const [unblockingId, setUnblockingId] = useState<string | null>(null);

    const load = useCallback(async (cursor?: string | null, append = false) => {
        const res = mode === 'visitors'
            ? await usersService.visitors({ limit: 30, cursor })
            : mode === 'visited'
                ? await usersService.visited({ limit: 30, cursor })
                : await usersService.blocked({ limit: 30, cursor });
        if (res.success) {
            setItems((current) => append ? [...current, ...(res.items || [])] : (res.items || []));
            setNextCursor(res.nextCursor || null);
            setHasMore(Boolean(res.nextCursor));
        }
    }, [mode]);

    useEffect(() => {
        if (isModeParam(params.tab)) {
            setMode(normalizeMode(params.tab));
        }
    }, [params.tab]);

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

    const unblock = async (item: any) => {
        const id = String(item.id || item._id);
        if (!id || unblockingId) return;
        setUnblockingId(id);
        try {
            const res = await usersService.unblock(id);
            if (res.success) {
                setItems((current) => current.filter((entry) => String(entry.id || entry._id) !== String(id)));
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
            <TabTitleBar title={t('activities', 'Activities')} showMenu />
            <View style={{ paddingHorizontal: scale(14), paddingTop: scale(18), paddingBottom: 0 }}>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: scale(8), paddingRight: scale(2) }} style={{ marginBottom: scale(12) }}>
                    {MODES.map(({ value, labelKey, fallback, icon: Icon }) => (
                        <Pressable
                            key={value}
                            onPress={() => setMode(value)}
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
                                gap: scale(7),
                                backgroundColor: 'transparent',
                                borderBottomWidth: mode === value ? scale(2) : 0,
                                borderBottomColor: colors.brand.text.body,
                            }}
                        >
                            <Icon size={scale(16)} color={mode === value ? colors.brand.text.body : colors.brand.text.muted} strokeWidth={2} />
                            <Text variant="body-sm" numberOfLines={1} style={{ color: mode === value ? colors.brand.text.body : colors.brand.text.muted, fontWeight: mode === value ? '700' : '500' }}>
                                {t(labelKey, fallback)}
                            </Text>
                        </Pressable>
                    ))}
                </ScrollView>
            </View>
            {loading ? (
                <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}><ActivityIndicator color={primary} /></View>
            ) : (
                <FlatList
                    data={items}
                    keyExtractor={(item) => String(item.id || item._id)}
                    numColumns={2}
                    columnWrapperStyle={{ gap: scale(10) }}
                    contentContainerStyle={{ paddingHorizontal: scale(14), paddingTop: 0, paddingBottom: scale(110), flexGrow: 1 }}
                    refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={primary} />}
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
                onUnblocked={(id) => {
                    if (mode === 'blocked') setItems((current) => current.filter((item) => String(item.id || item._id) !== String(id)));
                }}
                onFavoriteChanged={(id, favorited) => {
                    setItems((current) => current.map((item) => String(item.id || item._id) === String(id) ? { ...item, is_favorited: favorited } : item));
                }}
            />
        </View>
    );
}
