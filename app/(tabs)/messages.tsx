import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    FlatList,
    Pressable,
    RefreshControl,
    StyleSheet,
    TextInput,
    View,
} from 'react-native';
import { Image } from 'expo-image';
import { router, useFocusEffect } from 'expo-router';
import { Archive, Bell, BellOff, Check, MessageCircle, Search, Send, UserRoundPlus, X } from 'lucide-react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Text } from '@/components/ui/Text';
import {
    chatService,
    Conversation,
    ConversationOtherUser,
    ConversationTab,
    normalizeConversation,
} from '@/lib/chatService';
import { apiMessage, profileImage, t } from '@/lib/profileDisplay';
import { PROFILE_PLACEHOLDER_IMAGE } from '@/lib/profileAssets';
import { translateChatText } from '@/lib/chatDisplay';
import { useTheme } from '@/hooks/useTheme';
import { useLanguage } from '@/hooks/useLanguage';
import { useChatSocket } from '@/hooks/useChatSocket';
import { scale } from '@/hooks/useResponsive';
import { Typography } from '@/constants/typography';
import { useToast } from '@/hooks/useToast';
import {
    enablePushNotifications,
    markPushBannerShownToday,
    openPushNotificationSettings,
    shouldShowPushBannerToday,
} from '@/lib/pushNotifications';

const PRIMARY = '#F34B6F';
const TABS: Array<{ key: ConversationTab; labelKey: string; fallback: string; Icon: any }> = [
    { key: 'chats', labelKey: 'chat:tab_chats', fallback: 'Chats', Icon: MessageCircle },
    { key: 'requests', labelKey: 'chat:tab_requests', fallback: 'Requests', Icon: UserRoundPlus },
    { key: 'sent', labelKey: 'chat:tab_sent', fallback: 'Sent', Icon: Send },
    { key: 'closed', labelKey: 'chat:tab_closed', fallback: 'Closed', Icon: Archive },
];

function formatRelative(date?: string | null) {
    if (!date) return '';
    const value = new Date(date);
    if (Number.isNaN(value.getTime())) return '';
    const diff = Date.now() - value.getTime();
    const minute = 60_000;
    const hour = minute * 60;
    const day = hour * 24;
    if (diff < minute) return t('chat:just_now', 'Now');
    if (diff < hour) return t('chat:minutes_ago', '{{count}}m ago', { count: Math.max(1, Math.floor(diff / minute)) });
    if (diff < day) return t('chat:hours_ago', '{{count}}h ago', { count: Math.floor(diff / hour) });
    if (diff < day * 7) return t('chat:days_ago', '{{count}}d ago', { count: Math.floor(diff / day) });
    return value.toLocaleDateString();
}

function otherName(conversation: Conversation) {
    const other = (conversation.otherUser || {}) as ConversationOtherUser;
    if (other.account_deleted) return t('chat:account_deleted', 'Account deleted');
    return other.profileName || other.username || t('not_set', 'Not set');
}

function openConversation(conversation: Conversation) {
    const other = (conversation.otherUser || {}) as ConversationOtherUser;
    router.push({
        pathname: '/conversation/[id]',
        params: {
            id: conversation.id,
            name: otherName(conversation),
            avatar: profileImage(other),
            online: other.recently_active ? '1' : '0',
            state: conversation.state,
            requestRole: conversation.requestRole || '',
        },
    } as any);
}

export default function MessagesScreen() {
    const { isDark } = useTheme();
    const { currentLanguage, isRTL } = useLanguage();
    const toast = useToast();
    const inputFontFamily = currentLanguage === 'ar' ? Typography.font.arabic.regular : Typography.font.body.regular;
    const [activeTab, setActiveTab] = useState<ConversationTab>('chats');
    const [conversations, setConversations] = useState<Conversation[]>([]);
    const [requests, setRequests] = useState<Conversation[]>([]);
    const [sent, setSent] = useState<Conversation[]>([]);
    const [nextCursor, setNextCursor] = useState<string | null>(null);
    const [slots, setSlots] = useState<{ used?: number; total?: number } | null>(null);
    const [search, setSearch] = useState('');
    const [loading, setLoading] = useState(true);
    const [loadingMore, setLoadingMore] = useState(false);
    const [refreshing, setRefreshing] = useState(false);
    const [notificationBannerVisible, setNotificationBannerVisible] = useState(false);
    const [notificationBannerBusy, setNotificationBannerBusy] = useState(false);

    const colors = {
        bg: isDark ? '#0F172A' : '#FFFFFF',
        card: isDark ? '#111827' : '#FFFFFF',
        text: isDark ? '#E2E8F0' : '#17211D',
        muted: isDark ? '#94A3B8' : '#64748B',
        border: isDark ? '#1F2937' : '#E2E8F0',
        input: isDark ? '#1E293B' : '#F1F5F9',
    };

    const load = useCallback(async (mode: 'replace' | 'append' = 'replace') => {
        const cursor = mode === 'append' ? nextCursor : null;
        const [conversationRes, requestRes, sentRes, slotsRes] = await Promise.all([
            chatService.conversations({ cursor, limit: 30 }),
            mode === 'replace' ? chatService.incomingRequests() : Promise.resolve(null),
            mode === 'replace' ? chatService.sentRequests() : Promise.resolve(null),
            mode === 'replace' ? chatService.slots() : Promise.resolve(null),
        ]);

        if (conversationRes.success) {
            const nextItems = (conversationRes.items || []).map((item) => normalizeConversation(item));
            setConversations((current) => mode === 'append' ? [...current, ...nextItems] : nextItems);
            setNextCursor(conversationRes.nextCursor || null);
        }
        if (requestRes?.success) {
            setRequests((requestRes.items || []).map((item) => normalizeConversation(item, 'incoming')));
        }
        if (sentRes?.success) {
            setSent((sentRes.items || []).map((item) => normalizeConversation(item, 'sent')));
        }
        if (slotsRes?.success) {
            setSlots({ used: slotsRes.used ?? slotsRes.data?.used, total: slotsRes.total ?? slotsRes.data?.total });
        }
    }, [nextCursor]);

    const refreshFromSocket = useCallback(() => {
        void load('replace');
    }, [load]);

    useChatSocket({
        enabled: true,
        onMessage: refreshFromSocket,
        onConversationChanged: refreshFromSocket,
        onMessageUnsent: refreshFromSocket,
        onMessageUpdated: refreshFromSocket,
        onUnread: refreshFromSocket,
    });

    useEffect(() => {
        (async () => {
            setLoading(true);
            await load('replace');
            setLoading(false);
        })();
    }, []);

    useFocusEffect(
        useCallback(() => {
            let active = true;
            shouldShowPushBannerToday().then(async (show) => {
                if (!active || !show) return;
                setNotificationBannerVisible(true);
                await markPushBannerShownToday();
            }).catch(() => { });
            return () => {
                active = false;
            };
        }, [])
    );

    const enableNotificationsFromBanner = async () => {
        setNotificationBannerBusy(true);
        try {
            const res = await enablePushNotifications();
            if (res.success) {
                setNotificationBannerVisible(false);
                toast.show(t('chat:notifications_enabled', 'Notifications enabled.'), 'success', 2500);
            } else if (res.message === 'push_permission_denied') {
                toast.show(t('chat:notifications_blocked', 'Notifications are blocked. Enable them in device settings.'), 'warning', 4000);
                await openPushNotificationSettings();
                setNotificationBannerVisible(false);
            } else {
                toast.show(t('chat:notifications_not_available', 'Notifications are not available yet.'), 'warning', 3500);
            }
        } finally {
            setNotificationBannerBusy(false);
        }
    };

    const refresh = async () => {
        setRefreshing(true);
        await load('replace');
        setRefreshing(false);
    };

    const loadMore = async () => {
        if (!nextCursor || loadingMore || activeTab !== 'chats') return;
        setLoadingMore(true);
        await load('append');
        setLoadingMore(false);
    };

    const filteredItems = useMemo(() => {
        const q = search.trim().toLowerCase();
        const base =
            activeTab === 'requests'
                ? requests
                : activeTab === 'sent'
                    ? sent
                    : conversations.filter((item) => activeTab === 'closed' ? item.state === 'ended' : item.state === 'active');
        if (!q) return base;
        return base.filter((item) => otherName(item).toLowerCase().includes(q));
    }, [activeTab, conversations, requests, search, sent]);

    const runRequestAction = async (conversation: Conversation, action: 'accept' | 'decline' | 'withdraw') => {
        const res = action === 'accept'
            ? await chatService.accept(conversation.id)
            : action === 'decline'
                ? await chatService.decline(conversation.id)
                : await chatService.withdraw(conversation.id);
        if (!res.success) {
            Alert.alert(t('error', 'Error'), apiMessage(res.message));
            return;
        }
        await load('replace');
        if (action === 'accept') {
            setActiveTab('chats');
            openConversation(conversation);
        }
    };

    if (loading) {
        return (
            <SafeAreaView style={[styles.screen, { backgroundColor: colors.bg }]} edges={['top']}>
                <View style={styles.center}>
                    <ActivityIndicator color={PRIMARY} />
                </View>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={[styles.screen, { backgroundColor: colors.bg }]} edges={['top']}>
            <View style={[styles.tabs, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
                {TABS.map(({ key, labelKey, fallback, Icon }) => {
                    const active = key === activeTab;
                    const badge = key === 'requests' ? requests.length : key === 'sent' ? sent.length : 0;
                    return (
                        <Pressable key={key} onPress={() => setActiveTab(key)} style={styles.tab}>
                            <View style={styles.tabIconWrap}>
                                <Icon size={scale(17)} color={active ? PRIMARY : colors.text} strokeWidth={active ? 2.5 : 2.1} fill={active && key === 'chats' ? PRIMARY : 'transparent'} />
                                {badge > 0 && (
                                    <View style={styles.badgeSmall}>
                                        <Text variant="caption" className="font-body-bold" style={styles.badgeSmallText}>
                                            {badge > 9 ? '9+' : badge}
                                        </Text>
                                    </View>
                                )}
                            </View>
                            <Text
                                variant="caption"
                                numberOfLines={1}
                                className={active ? 'font-body-bold' : 'font-body-semi'}
                                style={{ color: active ? PRIMARY : colors.text, fontSize: scale(9.5), lineHeight: scale(11) }}
                            >
                                {t(labelKey, fallback)}
                            </Text>
                            {active && <View style={styles.activeLine} />}
                        </Pressable>
                    );
                })}
            </View>

            <View style={styles.searchWrap}>
                <View style={[styles.searchBox, { backgroundColor: colors.input }]}>
                    <Search size={scale(16)} color={colors.muted} />
                    <TextInput
                        value={search}
                        onChangeText={setSearch}
                        placeholder={t('chat:search_placeholder', 'Search messages...')}
                        placeholderTextColor={isDark ? '#64748B' : '#94A3B8'}
                        style={[styles.searchInput, { color: colors.text, fontFamily: inputFontFamily, textAlign: isRTL ? 'right' : 'left' }]}
                    />
                </View>
            </View>

            {notificationBannerVisible && (
                <View style={[styles.notificationBanner, { backgroundColor: isDark ? '#172033' : '#FFF1F5', borderColor: isDark ? '#334155' : '#FEC9D5' }]}>
                    <View style={styles.notificationBannerIcon}>
                        <Bell size={scale(15)} color={PRIMARY} strokeWidth={2.5} />
                    </View>
                    <View style={styles.notificationBannerText}>
                        <Text variant="caption" className="font-body-bold" style={{ color: colors.text }}>
                            {t('chat:notification_banner_title', 'Enable notifications')}
                        </Text>
                        <Text variant="caption" style={{ color: colors.muted, marginTop: scale(2) }}>
                            {t('chat:notification_banner_desc', 'Get alerts when a message or request arrives.')}
                        </Text>
                    </View>
                    <Pressable disabled={notificationBannerBusy} onPress={enableNotificationsFromBanner} style={styles.notificationBannerAction}>
                        <Text variant="caption" className="font-body-bold" style={{ color: PRIMARY }}>
                            {t('chat:notification_banner_enable', 'Enable')}
                        </Text>
                    </Pressable>
                    <Pressable onPress={() => setNotificationBannerVisible(false)} hitSlop={10} style={styles.notificationBannerClose}>
                        <X size={scale(14)} color={colors.muted} />
                    </Pressable>
                </View>
            )}

            {slots?.total ? (
                <View style={styles.slotsRow}>
                    <View style={styles.onlineDot} />
                    <Text variant="caption" className="font-body-semi" style={{ color: colors.muted }}>
                        {`${slots.used || 0}/${slots.total} ${t('chat:active_conversations', 'active conversations')}`}
                    </Text>
                </View>
            ) : null}

            <FlatList
                data={filteredItems}
                keyExtractor={(item) => item.id}
                style={{ flex: 1 }}
                contentContainerStyle={{ paddingBottom: scale(110), flexGrow: 1 }}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={PRIMARY} />}
                onEndReached={loadMore}
                onEndReachedThreshold={0.45}
                ListEmptyComponent={
                    <View style={styles.empty}>
                        <Text variant="body" className="font-body-bold" align="center" style={{ color: colors.text }}>
                            {activeTab === 'requests'
                                ? t('chat:no_requests_title', 'No new requests')
                                : activeTab === 'sent'
                                    ? t('chat:no_sent_requests_title', 'No sent requests')
                                    : activeTab === 'closed'
                                        ? t('chat:no_closed_title', 'No closed chats')
                                        : t('chat:no_chats_title', 'No active chats')}
                        </Text>
                        <Text variant="body-sm" align="center" style={{ color: colors.muted, marginTop: scale(6) }}>
                            {activeTab === 'requests'
                                ? t('chat:no_requests_desc', 'Incoming chat requests appear here.')
                                : activeTab === 'sent'
                                    ? t('chat:no_sent_requests_desc', 'Requests you sent are listed here.')
                                    : activeTab === 'closed'
                                        ? t('chat:no_closed_desc', 'Ended conversations show up here.')
                                        : t('chat:no_chats_desc', 'Your conversations will appear here.')}
                        </Text>
                    </View>
                }
                ListFooterComponent={loadingMore ? <ActivityIndicator color={PRIMARY} style={{ paddingVertical: scale(16) }} /> : null}
                renderItem={({ item }) => (
                    <ConversationRow
                        conversation={item}
                        variant={activeTab}
                        colors={colors}
                        onPress={() => openConversation(item)}
                        onAccept={() => runRequestAction(item, 'accept')}
                        onDecline={() => runRequestAction(item, 'decline')}
                        onWithdraw={() => runRequestAction(item, 'withdraw')}
                    />
                )}
            />
        </SafeAreaView>
    );
}

function ConversationRow({
    conversation,
    variant,
    colors,
    onPress,
    onAccept,
    onDecline,
    onWithdraw,
}: {
    conversation: Conversation;
    variant: ConversationTab;
    colors: Record<string, string>;
    onPress: () => void;
    onAccept: () => void;
    onDecline: () => void;
    onWithdraw: () => void;
}) {
    const other = (conversation.otherUser || {}) as ConversationOtherUser;
    const avatar = profileImage(other);
    const initial = otherName(conversation).trim().charAt(0).toUpperCase() || '?';
    const isRequest = variant === 'requests' || variant === 'sent';
    const preview = translateChatText(conversation.lastMessagePreview || (variant === 'requests' ? 'sent_you_a_message' : ''));

    return (
        <View style={[styles.rowWrap, { borderBottomColor: colors.border }]}>
            <Pressable onPress={onPress} style={styles.row}>
                <View style={[styles.avatar, { backgroundColor: colors.input }]}>
                    {avatar ? (
                        <Image source={{ uri: avatar }} style={StyleSheet.absoluteFill} contentFit="cover" />
                    ) : (
                        <Text variant="body" className="font-body-bold" style={{ color: colors.muted }}>
                            {initial}
                        </Text>
                    )}
                    {!avatar && <Image source={PROFILE_PLACEHOLDER_IMAGE} style={[StyleSheet.absoluteFill, { opacity: 0 }]} />}
                </View>

                <View style={styles.rowBody}>
                    <View style={styles.rowTop}>
                        <Text
                            variant="body-sm"
                            numberOfLines={1}
                            className="font-body-bold"
                            style={[styles.name, { color: colors.text }, other.account_deleted && styles.deletedName]}
                        >
                            {otherName(conversation)}
                        </Text>
                        {!!conversation.lastMessageAt && (
                            <Text
                                variant="caption"
                                className="font-body-semi"
                                style={{ color: conversation.unreadCount > 0 ? PRIMARY : colors.muted }}
                            >
                                {formatRelative(conversation.lastMessageAt)}
                            </Text>
                        )}
                    </View>
                    {variant === 'requests' && (
                        <Text variant="caption" className="font-body-medium" style={{ color: colors.muted, marginTop: scale(2) }}>
                            {t('chat:sent_you_a_message', 'sent you a message')}
                        </Text>
                    )}
                    <View style={styles.previewRow}>
                        <Text variant="body-sm" numberOfLines={isRequest ? 2 : 1} style={[styles.preview, { color: colors.muted }]}>
                            {preview || t('chat:messages', 'Message')}
                        </Text>
                        <View style={styles.rowMeta}>
                            {conversation.muted && <BellOff size={scale(14)} color={colors.muted} />}
                            {variant === 'sent' && <Check size={scale(14)} color={colors.muted} strokeWidth={2.5} />}
                            {conversation.unreadCount > 0 && (
                                <View style={styles.unreadBadge}>
                                    <Text variant="caption" className="font-body-bold" style={styles.unreadText}>
                                        {conversation.unreadCount > 99 ? '99+' : conversation.unreadCount}
                                    </Text>
                                </View>
                            )}
                        </View>
                    </View>
                </View>
            </Pressable>
            {variant === 'requests' && (
                <View style={styles.actions}>
                    <ActionPill label={t('chat:accept', 'Accept')} icon={Check} tone="primary" onPress={onAccept} />
                    <ActionPill label={t('chat:decline', 'Decline')} icon={X} tone="neutral" onPress={onDecline} />
                </View>
            )}
            {variant === 'sent' && (
                <View style={styles.actions}>
                    <ActionPill label={t('chat:withdraw', 'Withdraw')} icon={X} tone="neutral" onPress={onWithdraw} />
                </View>
            )}
        </View>
    );
}

function ActionPill({ label, icon: Icon, tone, onPress }: { label: string; icon: any; tone: 'primary' | 'neutral'; onPress: () => void }) {
    const primary = tone === 'primary';
    return (
        <Pressable onPress={onPress} style={[styles.actionPill, primary ? styles.actionPrimary : styles.actionNeutral]}>
            <Icon size={scale(12)} color={primary ? '#FFFFFF' : '#475569'} strokeWidth={2.8} />
            <Text variant="caption" className="font-body-bold" style={{ color: primary ? '#FFFFFF' : '#475569' }}>
                {label}
            </Text>
        </Pressable>
    );
}

const styles = StyleSheet.create({
    screen: { flex: 1 },
    center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    header: {
        height: scale(48),
        justifyContent: 'center',
        alignItems: 'center',
        borderBottomWidth: StyleSheet.hairlineWidth,
    },
    headerTitle: { fontSize: scale(14), lineHeight: scale(18) },
    tabs: {
        flexDirection: 'row',
        borderBottomWidth: StyleSheet.hairlineWidth,
        paddingHorizontal: scale(12),
    },
    tab: {
        flex: 1,
        minHeight: scale(48),
        alignItems: 'center',
        justifyContent: 'center',
        gap: scale(1),
        position: 'relative',
    },
    tabIconWrap: {
        position: 'relative',
        width: scale(24),
        height: scale(20),
        alignItems: 'center',
        justifyContent: 'center',
    },
    badgeSmall: {
        position: 'absolute',
        top: 0,
        right: 0,
        minWidth: scale(12),
        height: scale(12),
        borderRadius: scale(6),
        paddingHorizontal: scale(2),
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: PRIMARY,
        borderWidth: scale(1.5),
        borderColor: '#FFFFFF',
    },
    badgeSmallText: { color: '#FFFFFF', fontSize: scale(7), lineHeight: scale(8) },
    activeLine: {
        position: 'absolute',
        left: scale(12),
        right: scale(12),
        bottom: 0,
        height: scale(2.5),
        borderRadius: scale(2),
        backgroundColor: PRIMARY,
    },
    searchWrap: { paddingHorizontal: scale(18), paddingTop: scale(14), paddingBottom: scale(10) },
    searchBox: {
        minHeight: scale(42),
        borderRadius: scale(21),
        paddingHorizontal: scale(14),
        flexDirection: 'row',
        alignItems: 'center',
        gap: scale(10),
    },
    searchInput: { flex: 1, fontSize: scale(14), paddingVertical: 0 },
    slotsRow: { flexDirection: 'row', alignItems: 'center', gap: scale(7), paddingHorizontal: scale(18), paddingBottom: scale(14) },
    notificationBanner: {
        marginHorizontal: scale(18),
        marginBottom: scale(12),
        borderWidth: StyleSheet.hairlineWidth,
        borderRadius: scale(12),
        paddingVertical: scale(9),
        paddingHorizontal: scale(10),
        flexDirection: 'row',
        alignItems: 'center',
        gap: scale(9),
    },
    notificationBannerIcon: {
        width: scale(28),
        height: scale(28),
        borderRadius: scale(14),
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#FFFFFF',
    },
    notificationBannerText: { flex: 1, minWidth: 0 },
    notificationBannerAction: { minHeight: scale(28), justifyContent: 'center', paddingHorizontal: scale(4) },
    notificationBannerClose: { minHeight: scale(28), justifyContent: 'center' },
    onlineDot: { width: scale(8), height: scale(8), borderRadius: scale(4), backgroundColor: '#22C55E' },
    empty: { flex: 1, paddingHorizontal: scale(30), paddingTop: scale(110), alignItems: 'center' },
    rowWrap: { borderBottomWidth: StyleSheet.hairlineWidth },
    row: { flexDirection: 'row', alignItems: 'center', gap: scale(12), paddingHorizontal: scale(14), paddingVertical: scale(12) },
    avatar: { width: scale(48), height: scale(48), borderRadius: scale(24), overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
    rowBody: { flex: 1, minWidth: 0 },
    rowTop: { flexDirection: 'row', alignItems: 'center', gap: scale(8) },
    name: { flex: 1, fontSize: scale(15), lineHeight: scale(19) },
    deletedName: { textDecorationLine: 'line-through', opacity: 0.65 },
    previewRow: { flexDirection: 'row', alignItems: 'center', gap: scale(8), marginTop: scale(3) },
    preview: { flex: 1, fontSize: scale(13), lineHeight: scale(17) },
    rowMeta: { flexDirection: 'row', alignItems: 'center', gap: scale(5) },
    unreadBadge: {
        minWidth: scale(20),
        height: scale(20),
        borderRadius: scale(10),
        paddingHorizontal: scale(5),
        backgroundColor: PRIMARY,
        alignItems: 'center',
        justifyContent: 'center',
    },
    unreadText: { color: '#FFFFFF', fontSize: scale(10), lineHeight: scale(12) },
    actions: { flexDirection: 'row', alignItems: 'center', gap: scale(8), paddingLeft: scale(74), paddingBottom: scale(12) },
    actionPill: { height: scale(28), borderRadius: scale(14), paddingHorizontal: scale(12), flexDirection: 'row', alignItems: 'center', gap: scale(5) },
    actionPrimary: { backgroundColor: PRIMARY },
    actionNeutral: { backgroundColor: '#FFFFFF', borderWidth: StyleSheet.hairlineWidth, borderColor: '#CBD5E1' },
});
