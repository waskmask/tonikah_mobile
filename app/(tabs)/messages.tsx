import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
import { Archive, Bell, BellOff, Check, CreditCard, MessageCircle, Search, Send, UserRoundPlus, X } from 'lucide-react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Text } from '@/components/ui/Text';
import { UnreadBadge } from '@/components/ui/UnreadBadge';
import { Skeleton } from '@/components/ui/Skeleton';
import { EmptyState } from '@/components/ui/EmptyState';
import {
    chatService,
    Conversation,
    ConversationOtherUser,
    ConversationTab,
    normalizeConversation,
} from '@/lib/chatService';
import { apiMessage, profileAvatarImage, t } from '@/lib/profileDisplay';
import { PROFILE_PLACEHOLDER_IMAGE } from '@/lib/profileAssets';
import { translateChatText } from '@/lib/chatDisplay';
import { useTheme } from '@/hooks/useTheme';
import { useColors } from '@/hooks/useColors';
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
import { queryClient } from '@/lib/queryClient';
import { queryKeys } from '@/lib/queryKeys';
import { NavigationTypeTokens } from '@/constants/uiTokens';
import { useAuthStore } from '@/store/authStore';
import { useConnectivity } from '@/hooks/useConnectivity';
import { CachedInbox, loadCachedInbox, saveCachedInbox } from '@/lib/chatInboxCache';
import { MessagingMembershipGate } from '@/components/membership/MessagingMembershipGate';
import { useMessagingEligibilityStatus } from '@/hooks/useCurrentUserStatus';
import { canOpenMessaging, shouldShowMembershipPromo } from '@/lib/messagingAccess';
import { useEmailVerificationGuard } from '@/hooks/useEmailVerificationGuard';

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
            recipientId: String(other.id || other._id || ''),
            name: otherName(conversation),
            avatar: profileAvatarImage(other),
            online: other.recently_active ? '1' : '0',
            accountDeleted: other.account_deleted ? '1' : '0',
            state: conversation.state,
            requestRole: conversation.requestRole || '',
        },
    } as any);
}

export default function MessagesScreen() {
    const { isDark } = useTheme();
    const palette = useColors();
    const primary = palette.chrome.primary;
    const { currentLanguage, isRTL } = useLanguage();
    const userId = useAuthStore((state) => String(state.user?._id || state.user?.id || ''));
    const { status: connectivityStatus } = useConnectivity();
    const toast = useToast();
    const eligibility = useMessagingEligibilityStatus();
    const { requireVerified } = useEmailVerificationGuard();
    const inputFontFamily = currentLanguage === 'ar' ? Typography.font.arabic.regular : Typography.font.body.regular;
    const cachedInbox = queryClient.getQueryData<CachedInbox>(queryKeys.chat.inbox);
    const [activeTab, setActiveTab] = useState<ConversationTab>('chats');
    const [conversations, setConversations] = useState<Conversation[]>(() => cachedInbox?.conversations || []);
    const [requests, setRequests] = useState<Conversation[]>(() => cachedInbox?.requests || []);
    const [sent, setSent] = useState<Conversation[]>(() => cachedInbox?.sent || []);
    const [nextCursor, setNextCursor] = useState<string | null>(() => cachedInbox?.nextCursor || null);
    const [slots, setSlots] = useState<{ used?: number; total?: number } | null>(() => cachedInbox?.slots || null);
    const [search, setSearch] = useState('');
    const [loading, setLoading] = useState(!cachedInbox);
    const [loadingMore, setLoadingMore] = useState(false);
    const [refreshing, setRefreshing] = useState(false);
    const [notificationBannerVisible, setNotificationBannerVisible] = useState(false);
    const [notificationBannerBusy, setNotificationBannerBusy] = useState(false);
    const [membershipGateVisible, setMembershipGateVisible] = useState(false);
    const [membershipPromoVisible, setMembershipPromoVisible] = useState(false);
    const inboxCacheReadyRef = useRef(false);
    const previousConnectivityRef = useRef(connectivityStatus);

    const colors = {
        // Warm surface so messages matches the unified warm chrome
        bg: palette.brand.bg.surface,
        card: palette.chrome.common.card,
        text: palette.chrome.common.textStrong,
        muted: palette.chrome.common.textSubtle,
        border: palette.brand.bg.border,
        body: palette.brand.bg.primary,
        divider: palette.brand.bg.borderStrong,
        input: palette.chrome.common.card,
        avatarBg: palette.chrome.common.cardAlt,
        primary,
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
            const responseCursor = conversationRes.nextCursor || null;
            setConversations((current) => {
                const nextConversations = mode === 'append' ? [...current, ...nextItems] : nextItems;
                queryClient.setQueryData<CachedInbox>(queryKeys.chat.inbox, (cached) => ({
                    conversations: nextConversations,
                    requests: cached?.requests || requests,
                    sent: cached?.sent || sent,
                    nextCursor: responseCursor,
                    slots: cached ? cached.slots : slots,
                }));
                return nextConversations;
            });
            setNextCursor(responseCursor);
        }
        if (requestRes?.success) {
            const nextRequests = (requestRes.items || []).map((item) => normalizeConversation(item, 'incoming'));
            setRequests(nextRequests);
            queryClient.setQueryData<CachedInbox>(queryKeys.chat.inbox, (cached) => ({
                conversations: cached?.conversations || conversations,
                requests: nextRequests,
                sent: cached?.sent || sent,
                nextCursor: cached ? cached.nextCursor : nextCursor,
                slots: cached ? cached.slots : slots,
            }));
        }
        if (sentRes?.success) {
            const nextSent = (sentRes.items || []).map((item) => normalizeConversation(item, 'sent'));
            setSent(nextSent);
            queryClient.setQueryData<CachedInbox>(queryKeys.chat.inbox, (cached) => ({
                conversations: cached?.conversations || conversations,
                requests: cached?.requests || requests,
                sent: nextSent,
                nextCursor: cached ? cached.nextCursor : nextCursor,
                slots: cached ? cached.slots : slots,
            }));
        }
        if (slotsRes?.success) {
            const nextSlots = { used: slotsRes.used ?? slotsRes.data?.used, total: slotsRes.total ?? slotsRes.data?.total };
            setSlots(nextSlots);
            queryClient.setQueryData<CachedInbox>(queryKeys.chat.inbox, (cached) => ({
                conversations: cached?.conversations || conversations,
                requests: cached?.requests || requests,
                sent: cached?.sent || sent,
                nextCursor: cached ? cached.nextCursor : nextCursor,
                slots: nextSlots,
            }));
        }
    }, [conversations, nextCursor, requests, sent, slots]);

    const refreshConversationList = useCallback(async () => {
        const response = await chatService.conversations({ cursor: null, limit: 30 });
        if (!response.success) return;
        const nextConversations = (response.items || []).map((item) => normalizeConversation(item));
        const responseCursor = response.nextCursor || null;
        setConversations(nextConversations);
        setNextCursor(responseCursor);
        queryClient.setQueryData<CachedInbox>(queryKeys.chat.inbox, (cached) => ({
            conversations: nextConversations,
            requests: cached?.requests || requests,
            sent: cached?.sent || sent,
            nextCursor: responseCursor,
            slots: cached ? cached.slots : slots,
        }));
    }, [requests, sent, slots]);

    // Socket callbacks stay stable while their implementation follows current state.
    const refreshConversationListRef = useRef(refreshConversationList);
    const socketRefreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    useEffect(() => {
        refreshConversationListRef.current = refreshConversationList;
    });

    const refreshFromSocket = useCallback(() => {
        if (socketRefreshTimerRef.current) clearTimeout(socketRefreshTimerRef.current);
        socketRefreshTimerRef.current = setTimeout(() => {
            void refreshConversationListRef.current();
        }, 300);
    }, []);

    useEffect(() => () => {
        if (socketRefreshTimerRef.current) clearTimeout(socketRefreshTimerRef.current);
    }, []);

    useChatSocket({
        enabled: true,
        onConversationChanged: refreshFromSocket,
    });

    useEffect(() => {
        let active = true;
        (async () => {
            const persisted = !cachedInbox ? await loadCachedInbox(userId) : null;
            if (!active) return;
            if (persisted) {
                setConversations(persisted.conversations);
                setRequests(persisted.requests);
                setSent(persisted.sent);
                setNextCursor(persisted.nextCursor);
                setSlots(persisted.slots);
                queryClient.setQueryData(queryKeys.chat.inbox, persisted);
                setLoading(false);
            }
            inboxCacheReadyRef.current = true;
            await load('replace');
            if (active) setLoading(false);
        })();
        return () => {
            active = false;
        };
        // Initial hydration deliberately runs once for the restored account.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useEffect(() => {
        if (!inboxCacheReadyRef.current || !userId) return;
        void saveCachedInbox(userId, { conversations, requests, sent, nextCursor, slots });
    }, [conversations, nextCursor, requests, sent, slots, userId]);

    useEffect(() => {
        const previous = previousConnectivityRef.current;
        previousConnectivityRef.current = connectivityStatus;
        if (previous === 'offline' && connectivityStatus === 'online') {
            void load('replace');
        }
    }, [connectivityStatus, load]);

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

    useEffect(() => {
        if (!userId || eligibility.isLoading || eligibility.messagingAccess?.allowed !== false) return;
        shouldShowMembershipPromo(userId).then(setMembershipPromoVisible).catch(() => {});
    }, [eligibility.isLoading, eligibility.messagingAccess?.allowed, userId]);

    const requireConversationAccess = useCallback(async () => {
        if (!requireVerified('chat')) return false;
        if (canOpenMessaging(eligibility.messagingAccess)) return true;
        const refreshed = await eligibility.refetch();
        if (canOpenMessaging(refreshed.data?.messagingAccess)) return true;
        setMembershipGateVisible(true);
        return false;
    }, [eligibility, requireVerified]);

    const handleOpenConversation = useCallback(async (conversation: Conversation) => {
        if (await requireConversationAccess()) openConversation(conversation);
    }, [requireConversationAccess]);

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
        if (conversation.otherUser?.account_deleted) {
            toast.show(t('chat:account_deleted_request_removed', 'This request is no longer available because the account was deleted.'), 'info');
            await load('replace');
            return;
        }
        if (action === 'accept' && !(await requireConversationAccess())) return;
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
            await handleOpenConversation(conversation);
        }
    };

    if (loading) {
        return (
            <SafeAreaView style={[styles.screen, { backgroundColor: colors.bg }]} edges={['top']}>
                <View style={{ flex: 1, backgroundColor: colors.body, paddingHorizontal: scale(14), paddingTop: scale(16) }}>
                    {[0, 1, 2, 3, 4, 5].map((index) => (
                        <View key={index} style={{ flexDirection: 'row', alignItems: 'center', gap: scale(12), paddingVertical: scale(12) }}>
                            <Skeleton width={scale(48)} height={scale(48)} borderRadius={scale(24)} />
                            <View style={{ flex: 1, gap: scale(8) }}>
                                <Skeleton width="55%" height={scale(13)} />
                                <Skeleton width="80%" height={scale(11)} />
                            </View>
                        </View>
                    ))}
                </View>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={[styles.screen, { backgroundColor: colors.bg }]} edges={['top']}>
            <View style={[styles.tabs, { backgroundColor: colors.bg, borderBottomColor: colors.border }]}>
                {TABS.map(({ key, labelKey, fallback, Icon }) => {
                    const active = key === activeTab;
                    const badge = key === 'requests' ? requests.length : key === 'sent' ? sent.length : 0;
                    return (
                        <Pressable key={key} onPress={() => setActiveTab(key)} style={styles.tab}>
                            <View style={styles.tabIconWrap}>
                                <Icon size={scale(17)} color={active ? primary : colors.text} strokeWidth={active ? 2.5 : 2.1} fill={active && key === 'chats' ? primary : 'transparent'} />
                                <UnreadBadge
                                    count={badge}
                                    variant="sm"
                                    borderColor={colors.bg}
                                    style={styles.tabBadge}
                                />
                            </View>
                            <Text
                                variant="caption"
                                numberOfLines={1}
                                className={active ? 'font-body-bold' : 'font-body-semi'}
                                style={{ color: active ? primary : colors.text, ...NavigationTypeTokens.compactTabLabel }}
                            >
                                {t(labelKey, fallback)}
                            </Text>
                            {active && <View style={[styles.activeLine, { backgroundColor: primary }]} />}
                        </Pressable>
                    );
                })}
            </View>

            <View style={{ flex: 1, backgroundColor: colors.body }}>
            <View style={styles.searchWrap}>
                <View style={[styles.searchBox, { backgroundColor: colors.input, borderWidth: 1, borderColor: colors.border }]}>
                    <Search size={scale(16)} color={colors.muted} />
                    <TextInput
                        value={search}
                        onChangeText={setSearch}
                        placeholder={t('chat:search_placeholder', 'Search messages...')}
                        placeholderTextColor={palette.brand.text.muted}
                        style={[styles.searchInput, { color: colors.text, fontFamily: inputFontFamily, textAlign: isRTL ? 'right' : 'left' }]}
                    />
                </View>
            </View>

            {notificationBannerVisible && (
                <View style={[styles.notificationBanner, { backgroundColor: palette.chrome.common.primaryTint, borderColor: palette.chrome.common.primaryRing }]}>
                    <View style={[styles.notificationBannerIcon, { backgroundColor: palette.chrome.common.card }]}>
                        <Bell size={scale(15)} color={primary} strokeWidth={2.5} />
                    </View>
                    <View style={styles.notificationBannerText}>
                        <Text variant="caption" className="font-body-bold" style={{ color: colors.text }}>
                            {t('chat:notification_banner_title', 'Enable notifications')}
                        </Text>
                        <Text variant="caption" style={{ color: colors.muted, marginTop: scale(2) }}>
                            {t('chat:notification_banner_desc', 'Get alerts when a message or request arrives.')}
                        </Text>
                    </View>
                    <Pressable disabled={notificationBannerBusy} onPress={enableNotificationsFromBanner} hitSlop={8} style={styles.notificationBannerAction}>
                        <Text variant="caption" className="font-body-bold" style={{ color: primary }}>
                            {t('chat:notification_banner_enable', 'Enable')}
                        </Text>
                    </Pressable>
                    <Pressable onPress={() => setNotificationBannerVisible(false)} hitSlop={10} style={styles.notificationBannerClose}>
                        <X size={scale(14)} color={colors.muted} />
                    </Pressable>
                </View>
            )}

            {membershipPromoVisible && eligibility.messagingAccess?.allowed === false && (
                <View style={[styles.notificationBanner, { backgroundColor: palette.chrome.common.primaryTint, borderColor: palette.chrome.common.primaryRing }]}>
                    <View style={[styles.notificationBannerIcon, { backgroundColor: palette.chrome.common.card }]}>
                        <CreditCard size={scale(15)} color={primary} strokeWidth={2.4} />
                    </View>
                    <View style={styles.notificationBannerText}>
                        <Text variant="caption" className="font-body-bold" style={{ color: colors.text }}>
                            {eligibility.trialOffer?.available
                                ? t('chat:membership_trial_promo', 'Start your {{days}}-day free trial', { days: eligibility.trialOffer.durationDays })
                                : t('chat:membership_promo', 'Activate membership to open conversations')}
                        </Text>
                    </View>
                    <Pressable onPress={() => router.push('/(tabs)/memberships')} hitSlop={8} style={styles.notificationBannerAction}>
                        <Text variant="caption" className="font-body-bold" style={{ color: primary }}>{t('chat:view', 'View')}</Text>
                    </Pressable>
                    <Pressable onPress={() => setMembershipPromoVisible(false)} hitSlop={10} style={styles.notificationBannerClose}>
                        <X size={scale(14)} color={colors.muted} />
                    </Pressable>
                </View>
            )}

            {slots?.total ? (
                <View style={styles.slotsRow}>
                    <View style={[styles.onlineDot, { backgroundColor: palette.chrome.common.successStrong }]} />
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
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={primary} />}
                onEndReached={loadMore}
                onEndReachedThreshold={0.45}
                ListEmptyComponent={
                    <View style={styles.empty}>
                        <EmptyState
                            icon={(() => {
                                const Icon = activeTab === 'requests'
                                    ? UserRoundPlus
                                    : activeTab === 'sent'
                                        ? Send
                                        : activeTab === 'closed'
                                            ? Archive
                                            : MessageCircle;
                                return <Icon size={scale(30)} color={primary} strokeWidth={1.8} />;
                            })()}
                            title={activeTab === 'requests'
                                ? t('chat:no_requests_title', 'No new requests')
                                : activeTab === 'sent'
                                    ? t('chat:no_sent_requests_title', 'No sent requests')
                                    : activeTab === 'closed'
                                        ? t('chat:no_closed_title', 'No closed chats')
                                        : t('chat:no_chats_title', 'No active chats')}
                            description={activeTab === 'requests'
                                ? t('chat:no_requests_desc', 'Incoming chat requests appear here.')
                                : activeTab === 'sent'
                                    ? t('chat:no_sent_requests_desc', 'Requests you sent are listed here.')
                                    : activeTab === 'closed'
                                        ? t('chat:no_closed_desc', 'Ended conversations show up here.')
                                        : t('chat:no_chats_desc', 'Your conversations will appear here.')}
                            actions={activeTab === 'chats' ? [{
                                label: t('explore', 'Explore'),
                                onPress: () => router.push('/(tabs)/search'),
                            }] : undefined}
                        />
                    </View>
                }
                ListFooterComponent={loadingMore ? <ActivityIndicator color={primary} style={{ paddingVertical: scale(16) }} /> : null}
                renderItem={({ item }) => (
                    <ConversationRow
                        conversation={item}
                        variant={activeTab}
                        colors={colors}
                        onPress={() => void handleOpenConversation(item)}
                        onAccept={() => runRequestAction(item, 'accept')}
                        onDecline={() => runRequestAction(item, 'decline')}
                        onWithdraw={() => runRequestAction(item, 'withdraw')}
                    />
                )}
            />
            </View>
            <MessagingMembershipGate
                visible={membershipGateVisible}
                trialOffer={eligibility.trialOffer}
                onClose={() => setMembershipGateVisible(false)}
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
    const primary = useColors().chrome.primary;
    const other = (conversation.otherUser || {}) as ConversationOtherUser;
    const avatar = profileAvatarImage(other);
    const initial = otherName(conversation).trim().charAt(0).toUpperCase() || '?';
    const isRequest = variant === 'requests' || variant === 'sent';
    const isDeleted = !!other.account_deleted;
    const preview = translateChatText(conversation.lastMessagePreview || (variant === 'requests' ? 'sent_you_a_message' : ''));

    return (
        <View style={[styles.rowWrap, { borderBottomColor: colors.divider }]}>
            <Pressable onPress={onPress} style={styles.row}>
                <View style={[styles.avatar, { backgroundColor: colors.avatarBg }]}>
                    {avatar ? (
                        <Image
                            source={{ uri: avatar }}
                            recyclingKey={conversation.id}
                            style={StyleSheet.absoluteFill}
                            contentFit="cover"
                        />
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
                                style={{ color: conversation.unreadCount > 0 ? colors.primary : colors.muted }}
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
                            <UnreadBadge count={conversation.unreadCount} variant="lg" />
                        </View>
                    </View>
                </View>
            </Pressable>
            {variant === 'requests' && !isDeleted && (
                <View style={styles.actions}>
                    <ActionPill label={t('chat:accept', 'Accept')} icon={Check} tone="primary" onPress={onAccept} />
                    <ActionPill label={t('chat:decline', 'Decline')} icon={X} tone="neutral" onPress={onDecline} />
                </View>
            )}
            {variant === 'sent' && !isDeleted && (
                <View style={styles.actions}>
                    <ActionPill label={t('chat:withdraw', 'Withdraw')} icon={X} tone="neutral" onPress={onWithdraw} />
                </View>
            )}
        </View>
    );
}

function ActionPill({ label, icon: Icon, tone, onPress }: { label: string; icon: any; tone: 'primary' | 'neutral'; onPress: () => void }) {
    const palette = useColors();
    const isPrimary = tone === 'primary';
    return (
        <Pressable
            onPress={onPress}
            style={[
                styles.actionPill,
                isPrimary
                    ? { backgroundColor: palette.chrome.primary }
                    : { backgroundColor: palette.chrome.common.card, borderWidth: StyleSheet.hairlineWidth, borderColor: palette.brand.bg.border },
            ]}
        >
            <Icon size={scale(12)} color={isPrimary ? palette.chrome.common.inverseText : palette.chrome.header.icon} strokeWidth={2.8} />
            <Text variant="caption" className="font-body-bold" style={{ color: isPrimary ? palette.chrome.common.inverseText : palette.chrome.header.icon }}>
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
    tabBadge: {
        position: 'absolute',
        top: -scale(2),
        right: -scale(8),
    },
    activeLine: {
        position: 'absolute',
        left: scale(12),
        right: scale(12),
        bottom: 0,
        height: scale(2.5),
        borderRadius: scale(2),
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
    },
    notificationBannerText: { flex: 1, minWidth: 0 },
    notificationBannerAction: { minHeight: scale(28), justifyContent: 'center', paddingHorizontal: scale(4) },
    notificationBannerClose: { minHeight: scale(28), justifyContent: 'center' },
    onlineDot: { width: scale(8), height: scale(8), borderRadius: scale(4) },
    empty: { flex: 1, paddingTop: scale(80), alignItems: 'center' },
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
    actions: { flexDirection: 'row', alignItems: 'center', gap: scale(8), paddingLeft: scale(74), paddingBottom: scale(12) },
    actionPill: { height: scale(28), borderRadius: scale(14), paddingHorizontal: scale(12), flexDirection: 'row', alignItems: 'center', gap: scale(5) },
});
