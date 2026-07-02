import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Animated,
    FlatList,
    Image as RNImage,
    Modal,
    NativeScrollEvent,
    NativeSyntheticEvent,
    PanResponder,
    Platform,
    Pressable,
    StyleProp,
    StyleSheet,
    Text as RNText,
    TextInput,
    View,
    ViewStyle,
} from 'react-native';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import * as Clipboard from 'expo-clipboard';
import {
    RecordingPresets,
    requestRecordingPermissionsAsync,
    setAudioModeAsync,
    useAudioPlayer,
    useAudioPlayerStatus,
    useAudioRecorder,
    useAudioRecorderState,
} from 'expo-audio';
import { router, useLocalSearchParams } from 'expo-router';
import { ArrowLeft, Bell, BellOff, Check, CheckCheck, ChevronDown, Copy, Download, Image as ImageIcon, Mic, MoreVertical, Pause, Play, Reply, Send, Square, Trash2, Undo2, X, XCircle } from 'lucide-react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Text } from '@/components/ui/Text';
import {
    chatService,
    ChatMessage,
    Conversation,
    ConversationOtherUser,
    MessageMedia,
    normalizeConversation,
} from '@/lib/chatService';
import { apiMessage, profileImage, t } from '@/lib/profileDisplay';
import { PROFILE_PLACEHOLDER_IMAGE } from '@/lib/profileAssets';
import { useAuthStore } from '@/store/authStore';
import { useEmailVerificationGuard } from '@/hooks/useEmailVerificationGuard';
import { useTheme } from '@/hooks/useTheme';
import { useColors } from '@/hooks/useColors';
import { useLanguage } from '@/hooks/useLanguage';
import { useToast } from '@/hooks/useToast';
import { useHaptics } from '@/hooks/useHaptics';
import { useChatScrollAnchor, CHAT_NEAR_BOTTOM_THRESHOLD } from '@/hooks/useChatScrollAnchor';
import { loadCachedMessages, saveCachedMessages } from '@/lib/chatCache';
import { useConversationKeyboardMode } from '@/hooks/useConversationKeyboardMode';
import { KeyboardController } from 'react-native-keyboard-controller';
import Reanimated, {
    FadeInDown,
    ZoomIn,
    ZoomOut,
    useAnimatedStyle,
    useSharedValue,
    withSpring,
    withTiming,
} from 'react-native-reanimated';
import { useChatSocket } from '@/hooks/useChatSocket';
import { scale } from '@/hooks/useResponsive';
import { Typography } from '@/constants/typography';
import { cacheChatMedia, deleteCachedChatMediaForMessage, getCachedChatMedia } from '@/lib/chatMediaCache';
import { translateChatText } from '@/lib/chatDisplay';
import { ImageAttachmentComposer } from '@/components/chat/ImageAttachmentComposer';
import { ChatKeyboardAvoider, ChatComposerBar } from '@/components/chat/ChatKeyboardFooter';
import { ViewOnceIcon } from '@/components/chat/ViewOnceIcon';
import { UnreadBadge } from '@/components/ui/UnreadBadge';
import { UserProfileSheet } from '@/components/profile/UserProfileSheet';
import { profileId } from '@/lib/exploreProfile';
import { routeParam } from '@/lib/routeParams';

const PRIMARY = '#F34B6F';
const QUICK_REACTIONS = ['👍', '❤️', '😂', '😮', '😢', '🙏'];
const UNSEND_WINDOW_MIN = 15;
const VOICE_WAVE_BAR_COUNT = 28;
const MAX_VOICE_RECORDING_SECONDS = 60;
type ListItem =
    | { kind: 'date'; id: string; label: string }
    | { kind: 'message'; id: string; message: ChatMessage };

type PendingImageAttachment = {
    uri: string;
    name: string;
    type: string;
};

function messageId(message: ChatMessage) {
    return String(message.id || message._id || message.tempId || '');
}

function messageText(message: ChatMessage) {
    return message.content || message.text || '';
}

function makeWaveform(count = VOICE_WAVE_BAR_COUNT) {
    return Array.from({ length: count }, (_, index) => {
        const wave = Math.abs(Math.sin(index * 0.72)) * 0.68;
        const pulse = Math.abs(Math.cos(index * 0.31)) * 0.28;
        return Math.max(0.18, Math.min(1, wave + pulse));
    });
}

function formatMessageTime(value?: string | null) {
    if (!value) return '';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function dateLabel(value?: string | null) {
    if (!value) return '';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    const today = new Date();
    const yesterday = new Date();
    yesterday.setDate(today.getDate() - 1);
    const dayKey = date.toDateString();
    if (dayKey === today.toDateString()) return t('chat:today', 'Today');
    if (dayKey === yesterday.toDateString()) return t('chat:yesterday', 'Yesterday');
    return date.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });
}

function peerName(conversation: Conversation | null, fallback?: string) {
    const other = (conversation?.otherUser || {}) as ConversationOtherUser;
    if (other.account_deleted) return t('chat:account_deleted', 'Account deleted');
    return other.profileName || other.username || fallback || t('chat:messages', 'Messages');
}

function normalizeMessage(raw: any): ChatMessage {
    return {
        ...raw,
        id: String(raw?.id || raw?._id || raw?.tempId || ''),
        conversationId: String(raw?.conversationId || ''),
        type: raw?.type || 'text',
        sender: String(raw?.sender || raw?.senderId || ''),
        reactions: raw?.reactions || [],
        createdAt: raw?.createdAt || new Date().toISOString(),
    };
}

function replyPreview(message?: ChatMessage | string | null) {
    if (!message) return '';
    if (typeof message === 'string') return '';
    if (message.unsent) return translateChatText('message_unsent', 'Message unsent');
    if (message.type === 'text') return messageText(message).slice(0, 100);
    if (message.type === 'image') return translateChatText(message.media?.viewOnce ? 'view_once_photo' : 'photo', 'Photo');
    if (message.type === 'voice') return translateChatText('voice_message', 'Voice message');
    return message.content || message.type;
}

function canUnsendMessage(message: ChatMessage, userId: string) {
    if (!message?.id || !userId || message.unsent || message.type === 'system') return false;
    if (String(message.sender) !== String(userId)) return false;
    const created = new Date(message.createdAt).getTime();
    if (Number.isNaN(created)) return false;
    return Date.now() - created < UNSEND_WINDOW_MIN * 60 * 1000;
}

function reactionEmoji(value: any) {
    if (typeof value?.emoji === 'string') return value.emoji;
    if (typeof value?.reaction === 'string') return value.reaction;
    if (typeof value === 'string') return value;
    return '';
}

function buildItems(messages: ChatMessage[]): ListItem[] {
    const ordered = [...messages].sort((a, b) => String(a.createdAt).localeCompare(String(b.createdAt)));
    const out: ListItem[] = [];
    let lastDay = '';
    ordered.forEach((message) => {
        const date = new Date(message.createdAt);
        const day = Number.isNaN(date.getTime()) ? '' : date.toDateString();
        if (day && day !== lastDay) {
            out.push({ kind: 'date', id: `date-${day}`, label: dateLabel(message.createdAt) });
            lastDay = day;
        }
        out.push({ kind: 'message', id: messageId(message), message });
    });
    return out;
}

export default function ConversationScreen() {
    const params = useLocalSearchParams<{ id: string; recipientId?: string; name?: string; avatar?: string; online?: string; accountDeleted?: string; state?: string; requestRole?: string }>();
    const id = routeParam(params.id);
    const recipientId = routeParam(params.recipientId);
    const name = routeParam(params.name);
    const routeAvatar = routeParam(params.avatar);
    const online = routeParam(params.online);
    const accountDeleted = routeParam(params.accountDeleted);
    const routeState = routeParam(params.state);
    const routeRequestRole = routeParam(params.requestRole);
    const { user } = useAuthStore();
    const { requireVerified } = useEmailVerificationGuard();
    const { isDark } = useTheme();
    const palette = useColors();
    const { currentLanguage, isRTL } = useLanguage();
    const toast = useToast();
    const { lightImpact } = useHaptics();
    const insets = useSafeAreaInsets();
    useConversationKeyboardMode();
    const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
    const recorderState = useAudioRecorderState(recorder, 250);
    const inputFontFamily = currentLanguage === 'ar' ? Typography.font.arabic.regular : Typography.font.body.regular;
    const listRef = useRef<FlatList<ListItem>>(null);
    const { isNearBottomRef } = useChatScrollAnchor<ListItem>();
    // Holds the live socket API so scroll/seen helpers stay referentially stable
    // (the socket object is recreated on render).
    const socketRef = useRef<{ markSeen: (id?: string | null) => void } | null>(null);
    // True when messages arrived from the peer while the user was scrolled up;
    // we defer marking them seen until they're actually brought into view.
    const pendingSeenRef = useRef(false);
    const [conversation, setConversation] = useState<Conversation | null>(null);
    const [items, setItems] = useState<ChatMessage[]>([]);
    const [nextCursor, setNextCursor] = useState<string | null>(null);
    const [content, setContent] = useState('');
    const [loading, setLoading] = useState(id !== 'new');
    const [loadingMore, setLoadingMore] = useState(false);
    const [sending, setSending] = useState(false);
    const [uploadingMedia, setUploadingMedia] = useState(false);
    const [recordingBusy, setRecordingBusy] = useState(false);
    const [voicePanelOpen, setVoicePanelOpen] = useState(false);
    const [voicePreview, setVoicePreview] = useState<{ uri: string; duration: number } | null>(null);
    const [voiceWaveform, setVoiceWaveform] = useState<number[]>([]);
    const [voiceSending, setVoiceSending] = useState(false);
    const [requestBusy, setRequestBusy] = useState(false);
    const [viewOnce, setViewOnce] = useState<{ url: string; messageId: string; seconds: number } | null>(null);
    const [viewOnceLoadingId, setViewOnceLoadingId] = useState<string | null>(null);
    const [imagePreview, setImagePreview] = useState<string | null>(null);
    const [imageAttachment, setImageAttachment] = useState<PendingImageAttachment | null>(null);
    const [imageCaption, setImageCaption] = useState('');
    const [imageViewOnce, setImageViewOnce] = useState(false);
    const [menuOpen, setMenuOpen] = useState(false);
    const [menuBusy, setMenuBusy] = useState(false);
    const [messagesReady, setMessagesReady] = useState(false);
    const [showScrollDown, setShowScrollDown] = useState(false);
    const [unseenWhileAway, setUnseenWhileAway] = useState(0);
    const [chatFooterHeight, setChatFooterHeight] = useState(scale(72));
    const [profileSheetOpen, setProfileSheetOpen] = useState(false);
    const [selectedMessage, setSelectedMessage] = useState<ChatMessage | null>(null);
    const [messageActionBusy, setMessageActionBusy] = useState(false);
    const [replyTo, setReplyTo] = useState<ChatMessage | null>(null);
    const prevListLengthRef = useRef(0);

    const colors = useMemo(() => ({
        bg: palette.brand.bg.surface,
        card: palette.chrome.common.card,
        surface: palette.chrome.common.cardAlt,
        text: palette.chrome.common.textStrong,
        muted: palette.brand.text.subtitle,
        subtle: palette.brand.text.muted,
        border: palette.brand.bg.border,
        primary: palette.chrome.primary,
        primaryEnd: palette.chrome.primaryEnd,
        primaryTint: palette.chrome.common.primaryTint,
        primaryRing: palette.chrome.common.primaryRing,
        inverse: palette.chrome.common.inverseText,
        danger: palette.brand.accent.error,
        success: palette.chrome.common.successStrong,
        waveMuted: palette.brand.bg.border,
        blueAction: palette.chrome.common.blueAction,
    }), [palette]);

    // Inverted list: the newest message lives at offset 0 (the visual bottom),
    // so "scroll to latest" is just a jump to offset 0 — instant and reliable.
    // When the keyboard opens, the inverted list keeps the bottom pinned as the
    // container shrinks, so no extra scroll-on-keyboard handling is needed.
    const scrollToBottom = useCallback((animated = false) => {
        listRef.current?.scrollToOffset({ offset: 0, animated });
    }, []);

    // Flush "seen" once the newest messages are actually in view. Clears the
    // deferred-unseen state and the scroll-down badge.
    const markConversationSeen = useCallback(() => {
        pendingSeenRef.current = false;
        setUnseenWhileAway(0);
        if (id && id !== 'new') {
            void chatService.markRead(id);
            socketRef.current?.markSeen(id);
        }
    }, [id]);

    useEffect(() => {
        if (!voicePanelOpen || !recorderState.isRecording) return;
        const timer = setInterval(() => {
            setVoiceWaveform((current) => {
                const nextValue = Math.max(0.18, Math.min(1, 0.22 + Math.random() * 0.78));
                const next = [...current, nextValue];
                return next.slice(-VOICE_WAVE_BAR_COUNT);
            });
        }, 120);
        return () => clearInterval(timer);
    }, [recorderState.isRecording, voicePanelOpen]);

    useEffect(() => {
        if (
            voicePanelOpen &&
            recorderState.isRecording &&
            !recordingBusy &&
            Math.round((recorderState.durationMillis || 0) / 1000) >= MAX_VOICE_RECORDING_SECONDS
        ) {
            void stopRecordingForPreview();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [recorderState.durationMillis, recorderState.isRecording, recordingBusy, voicePanelOpen]);

    const load = useCallback(async (mode: 'replace' | 'append' = 'replace') => {
        if (!id || id === 'new') return;
        const cursor = mode === 'append' ? nextCursor : null;
        const [metaRes, messageRes] = await Promise.all([
            mode === 'replace' ? chatService.conversation(id) : Promise.resolve(null),
            chatService.messages(id, { cursor }),
        ]);
        if (metaRes?.success) {
            setConversation(normalizeConversation(metaRes.data || metaRes));
        }
        if (messageRes.success) {
            const nextItems = (messageRes.items || []).map(normalizeMessage);
            setItems((current) => mode === 'append' ? [...current, ...nextItems] : nextItems);
            setNextCursor(messageRes.nextCursor || null);
        } else {
            Alert.alert(t('error', 'Error'), apiMessage(messageRes.message));
        }
    }, [id, nextCursor]);

    const refreshCurrentConversation = useCallback(() => {
        if (!id || id === 'new') return;
        void load('replace');
    }, [id, load]);

    const handleSocketMessage = useCallback((message: ChatMessage) => {
        setItems((current) => {
            const next = normalizeMessage(message);
            if (!next.id || current.some((item) => item.id === next.id)) return current;
            // Mark this incoming message to play the enter animation.
            animateIdsRef.current.add(next.id);
            return [...current, next];
        });
        if (!id || id === 'new') return;
        const myId = String(user?._id || user?.id || '');
        const fromPeer = String(message?.sender || '') !== myId;
        // Only mark seen if the user is viewing the bottom (message is visible).
        // If they're scrolled up, defer until they scroll back down and surface a
        // count on the scroll-to-bottom button instead.
        if (isNearBottomRef.current) {
            void chatService.markRead(id);
        } else if (fromPeer) {
            pendingSeenRef.current = true;
            setUnseenWhileAway((current) => current + 1);
        }
    }, [id, user?._id, user?.id, isNearBottomRef]);

    const handleSocketUnsent = useCallback((incomingMessageId: string) => {
        if (!incomingMessageId) return;
        void deleteCachedChatMediaForMessage({
            userId: String(user?._id || user?.id || ''),
            conversationId: id,
            messageId: incomingMessageId,
        });
        setItems((current) => current.map((message) => message.id === incomingMessageId
            ? { ...message, unsent: true, content: '', media: null }
            : message));
    }, [id, user?._id, user?.id]);

    const handleSocketMessageUpdated = useCallback((payload: any) => {
        const incomingMessageId = String(payload?.messageId || payload?.id || payload?.message?._id || payload?.message?.id || '');
        if (!incomingMessageId) {
            refreshCurrentConversation();
            return;
        }
        setItems((current) => current.map((message) => {
            if (message.id !== incomingMessageId) return message;
            const nextMessage = payload?.message ? normalizeMessage(payload.message) : null;
            return {
                ...message,
                ...(nextMessage || {}),
                reactions: payload?.reactions || nextMessage?.reactions || message.reactions || [],
            };
        }));
    }, [refreshCurrentConversation]);

    const handleSocketSeen = useCallback((payload: any) => {
        if (!payload?.seenAt) return;
        setItems((current) => current.map((message) => (
            String(message.sender) === String(user?._id || user?.id)
                ? { ...message, seenAt: payload.seenAt }
                : message
        )));
    }, [user?._id, user?.id]);

    const handleSocketDelivered = useCallback((payload: any) => {
        if (!payload?.messageId || !payload?.deliveredAt) return;
        setItems((current) => current.map((message) => message.id === String(payload.messageId)
            ? { ...message, deliveredAt: payload.deliveredAt }
            : message));
    }, []);

    const handleViewOnceViewed = useCallback((payload: any) => {
        if (!payload?.messageId) return;
        setItems((current) => current.map((message) => message.id === String(payload.messageId)
            ? { ...message, media: { ...(message.media || {}), viewedAt: payload.viewedAt || new Date().toISOString() } }
            : message));
    }, []);

    const socket = useChatSocket({
        conversationId: id !== 'new' ? id : null,
        enabled: Boolean(user && id && id !== 'new'),
        onMessage: handleSocketMessage,
        onMessageUnsent: handleSocketUnsent,
        onMessageUpdated: handleSocketMessageUpdated,
        onConversationChanged: refreshCurrentConversation,
        onSeen: handleSocketSeen,
        onDelivered: handleSocketDelivered,
        onViewOnceViewed: handleViewOnceViewed,
    });

    useEffect(() => {
        socketRef.current = socket;
    });

    useEffect(() => {
        let cancelled = false;
        // Reset per-conversation state up front so we never flash the previous
        // chat's messages or reuse its pagination cursor when switching chats.
        setItems([]);
        setNextCursor(null);
        setShowScrollDown(false);
        setUnseenWhileAway(0);
        pendingSeenRef.current = false;
        isNearBottomRef.current = true;
        (async () => {
            if (!id || id === 'new') {
                setLoading(false);
                setMessagesReady(true);
                return;
            }
            setLoading(true);
            setMessagesReady(false);
            const userId = String(user?._id || user?.id || '');
            // 1) Instant open: render cached messages right away (inverted list lands
            //    on the newest message with no scroll, no spinner). Skipped if the
            //    user isn't hydrated yet — the effect re-runs once they are.
            const cached = userId ? await loadCachedMessages(userId, id) : null;
            if (!cancelled && cached && cached.length) {
                setItems(cached);
                setMessagesReady(true);
                setLoading(false);
            }
            // 2) Background refresh: pull the latest from the server and reconcile.
            await load('replace');
            if (cancelled) return;
            setLoading(false);
            setMessagesReady(true);
            await chatService.markRead(id);
            socket.markSeen(id);
        })();
        return () => {
            cancelled = true;
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [id, user?._id, user?.id]);

    // Persist the newest slice locally so the next open is instant.
    useEffect(() => {
        if (!id || id === 'new' || !messagesReady) return;
        const userId = String(user?._id || user?.id || '');
        void saveCachedMessages(userId, id, items);
    }, [items, id, messagesReady, user?._id, user?.id]);

    useEffect(() => {
        if (!viewOnce) return;
        if (viewOnce.seconds <= 0) {
            setViewOnce(null);
            return;
        }
        const timer = setTimeout(() => {
            setViewOnce((current) => current ? { ...current, seconds: current.seconds - 1 } : null);
        }, 1000);
        return () => clearTimeout(timer);
    }, [viewOnce]);

    const listItems = useMemo(() => buildItems(items), [items]);
    // Inverted FlatList renders index 0 at the visual bottom, so the newest
    // message must come first. buildItems keeps date headers above each group;
    // reversing preserves that ordering once the list is flipped.
    const invertedItems = useMemo(() => [...listItems].reverse(), [listItems]);
    // Keep a live ref to the current data so stable callbacks (reply-jump) never
    // read a stale list without having to be recreated on every render.
    const invertedItemsRef = useRef(invertedItems);
    useEffect(() => {
        invertedItemsRef.current = invertedItems;
    });
    // IDs of messages that should play the enter animation. Only freshly sent or
    // received messages are added here, so opening a conversation (bulk load,
    // cache, pagination) never animates — preventing the "whole page dancing"
    // effect. `entering` fires once on mount, so leaving ids in the set is safe.
    const animateIdsRef = useRef<Set<string>>(new Set());

    // Reset the animation memory when switching conversations.
    useEffect(() => {
        animateIdsRef.current = new Set();
    }, [id]);

    useEffect(() => {
        if (!messagesReady || loadingMore) {
            prevListLengthRef.current = listItems.length;
            return;
        }
        if (listItems.length > prevListLengthRef.current && isNearBottomRef.current) {
            scrollToBottom(true);
        }
        prevListLengthRef.current = listItems.length;
    }, [listItems.length, loadingMore, messagesReady, scrollToBottom, isNearBottomRef]);

    const handleReplyJump = useCallback((replyId: string) => {
        const index = invertedItemsRef.current.findIndex((entry) => entry.kind === 'message' && entry.message.id === replyId);
        if (index >= 0) {
            try {
                listRef.current?.scrollToIndex({ index, animated: true, viewPosition: 0.5 });
            } catch {
                // target may be virtualized out of range
            }
        }
    }, []);

    const renderMessageItem = useCallback(({ item }: { item: ListItem }) => {
        if (item.kind === 'date') {
            return (
                <View style={styles.dateWrap}>
                    <Text variant="caption" className="font-body-bold" style={[styles.dateLabel, { backgroundColor: colors.card, color: colors.muted }]}>
                        {item.label}
                    </Text>
                </View>
            );
        }
        const message = item.message;
        const mine = String(message.sender) === String(user?._id || user?.id);
        const animateIn = animateIdsRef.current.has(item.id);
        return (
            <MessageBubble
                message={message}
                mine={mine}
                colors={colors}
                userId={String(user?._id || user?.id || '')}
                animateIn={animateIn}
                onOpenImage={setImagePreview}
                onOpenViewOnce={openViewOnce}
                viewOnceLoading={viewOnceLoadingId === message.id}
                onOpenMenu={setSelectedMessage}
                onSwipeReply={beginReply}
                onReplyClick={handleReplyJump}
            />
        );
    }, [colors, user?._id, user?.id, openViewOnce, viewOnceLoadingId, beginReply, handleReplyJump]);
    const routeConversation = useMemo(() => {
        if (!id || id === 'new' || !routeState) return null;
        return {
            id,
            state: routeState,
            requestRole: routeRequestRole || null,
            lastMessageAt: null,
            lastMessagePreview: '',
            lastMessageSender: null,
            unreadCount: 0,
            otherUser: {
                id: recipientId || '',
                profileName: name || null,
                avatar: routeAvatar || null,
                account_deleted: accountDeleted === '1',
                recently_active: accountDeleted === '1' ? false : online === '1',
            },
        } as Conversation;
    }, [accountDeleted, id, name, online, recipientId, routeAvatar, routeRequestRole, routeState]);
    const activeConversation = conversation || routeConversation;
    const other = (activeConversation?.otherUser || {}) as ConversationOtherUser;
    const headerOther: ConversationOtherUser = {
        ...other,
        profileName: other.profileName || name || null,
        avatar: other.avatar || routeAvatar || null,
        account_deleted: !!other.account_deleted || accountDeleted === '1',
        recently_active: (other.account_deleted || accountDeleted === '1') ? false : (typeof other.recently_active === 'boolean' ? other.recently_active : online === '1'),
    };
    const avatar = profileImage(headerOther);
    const peerId = profileId(headerOther) || String(
        headerOther.id
        || headerOther._id
        || (headerOther as { user_id?: string }).user_id
        || recipientId
        || '',
    );

    const openPeerProfile = () => {
        if (headerOther.account_deleted) return;
        if (!peerId) {
            toast.show(t('profile_unavailable', 'Profile unavailable'), 'info');
            return;
        }
        lightImpact();
        setProfileSheetOpen(true);
    };

    const profileSheetProfile = useMemo(() => ({
        ...headerOther,
        id: peerId,
        _id: peerId,
    }), [headerOther, peerId]);
    const peerDeleted = !!headerOther.account_deleted;
    const isRequest = activeConversation?.state === 'request_pending';
    const isSentRequest = isRequest && activeConversation?.requestRole === 'sent';
    const isEnded = activeConversation?.state === 'ended';
    const canCompose = !peerDeleted && (id === 'new' || activeConversation?.state === 'active');

    const handleListScroll = useCallback((event: NativeSyntheticEvent<NativeScrollEvent>) => {
        // Inverted list: offset near 0 means we're pinned to the newest message.
        const { contentOffset, layoutMeasurement } = event.nativeEvent;
        const y = contentOffset.y;
        const nearBottom = y <= CHAT_NEAR_BOTTOM_THRESHOLD;
        isNearBottomRef.current = nearBottom;
        // Show the jump-to-latest button once scrolled up at least one screen.
        setShowScrollDown(y > layoutMeasurement.height);
        // Back at the bottom: surface any messages that arrived while scrolled up.
        if (nearBottom && pendingSeenRef.current) {
            markConversationSeen();
        }
    }, [isNearBottomRef, markConversationSeen]);

    const loadMore = async () => {
        if (!nextCursor || loadingMore || id === 'new') return;
        setLoadingMore(true);
        await load('append');
        setLoadingMore(false);
    };

    const send = async () => {
        if (!requireVerified('chat')) return;
        if (peerDeleted) {
            toast.show(t('chat:account_deleted_message_disabled', 'This account has been deleted. You can no longer send messages.'), 'info');
            return;
        }
        if (!canCompose) {
            toast.show(t('chat:accept_request_to_reply', 'Accept the request before replying.'), 'info');
            return;
        }
        const body = content.trim();
        if (!body) {
            Alert.alert(t('message_empty', 'Please enter a message before sending.'));
            return;
        }
        lightImpact();
        setSending(true);
        const tempId = `tmp_${Date.now()}`;
        const reply = replyTo;
        const temp: ChatMessage = {
            id: tempId,
            tempId,
            conversationId: id === 'new' ? '' : id,
            sender: String(user?._id || user?.id || 'self'),
            type: 'text',
            content: body,
            replyTo: reply || null,
            createdAt: new Date().toISOString(),
            reactions: [],
            pending: true,
        };
        animateIdsRef.current.add(tempId);
        setItems((current) => [...current, temp]);
        setContent('');
        setReplyTo(null);
        scrollToBottom(true);

        const res = await chatService.send({
            conversationId: id !== 'new' ? id : undefined,
            recipientId: id === 'new' ? recipientId : undefined,
            content: body,
            type: 'text',
            replyTo: reply?.id || undefined,
        });

        if (res.success && res.message) {
            const normalized = normalizeMessage(res.message);
            setItems((current) => current.map((item) => item.tempId === tempId ? normalized : item));
            if (id === 'new' && res.conversationId) {
                router.replace(`/conversation/${res.conversationId}` as any);
            }
        } else {
            setItems((current) => current.map((item) => item.tempId === tempId ? { ...item, pending: false, failed: true } : item));
            Alert.alert(t('error', 'Error'), apiMessage(res.errorMessage || 'message_failed'));
        }
        setSending(false);
    };

    const sendMediaMessage = async (type: 'image' | 'voice', media: MessageMedia, mediaContent = '') => {
        const reply = replyTo;
        const trimmedContent = mediaContent.trim();
        setReplyTo(null);
        const res = await chatService.send({
            conversationId: id !== 'new' ? id : undefined,
            recipientId: id === 'new' ? recipientId : undefined,
            type,
            content: trimmedContent || undefined,
            media,
            replyTo: reply?.id || undefined,
        });

        if (res.success && res.message) {
            const normalized = normalizeMessage(res.message);
            if (normalized.id) animateIdsRef.current.add(normalized.id);
            setItems((current) => current.some((item) => item.id === normalized.id) ? current : [...current, normalized]);
            if (id === 'new' && res.conversationId) {
                router.replace(`/conversation/${res.conversationId}` as any);
            }
            scrollToBottom(true);
            return true;
        }

        toast.show(apiMessage(res.errorMessage || 'message_failed'), 'error');
        return false;
    };

    const closeImageAttachment = () => {
        if (uploadingMedia) return;
        setImageAttachment(null);
        setImageCaption('');
        setImageViewOnce(false);
    };

    const pickAndUploadImage = async () => {
        if (!requireVerified('chat')) return;
        if (!canCompose) {
            toast.show(peerDeleted
                ? t('chat:account_deleted_message_disabled', 'This account has been deleted. You can no longer send messages.')
                : t('chat:accept_request_to_reply', 'Accept the request before replying.'), 'info');
            return;
        }
        if (id === 'new') {
            toast.show(t('send_text_first', 'Send a text message first, then attach media.'), 'info');
            return;
        }

        // Close the keyboard before opening the picker so that, after sending,
        // the composer returns to rest and the new image isn't hidden behind it.
        KeyboardController.dismiss();

        const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (!permission.granted) {
            toast.show(t('photo_permission_required', 'Photo library permission is required.'), 'error');
            return;
        }

        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ['images'],
            quality: 0.9,
            allowsEditing: false,
            exif: false,
        });
        if (result.canceled || !result.assets[0]) return;

        const asset = result.assets[0];
        setImageAttachment({
            uri: asset.uri,
            name: asset.fileName || `chat-photo-${Date.now()}.jpg`,
            type: asset.mimeType || 'image/jpeg',
        });
        setImageCaption('');
        setImageViewOnce(false);
    };

    const sendImageAttachment = async () => {
        if (!imageAttachment || uploadingMedia || id === 'new') return;
        if (!canCompose) {
            toast.show(peerDeleted
                ? t('chat:account_deleted_message_disabled', 'This account has been deleted. You can no longer send messages.')
                : t('chat:accept_request_to_reply', 'Accept the request before replying.'), 'info');
            return;
        }
        setUploadingMedia(true);
        const formData = new FormData();
        formData.append('file', {
            uri: imageAttachment.uri,
            name: imageAttachment.name,
            type: imageAttachment.type,
        } as any);
        formData.append('conversationId', id);
        formData.append('type', 'image');
        formData.append('viewOnce', imageViewOnce ? 'true' : 'false');

        const uploadRes = await chatService.uploadMedia(formData);
        if (uploadRes.success && uploadRes.media) {
            const sent = await sendMediaMessage('image', uploadRes.media, imageCaption);
            if (sent) {
                setImageAttachment(null);
                setImageCaption('');
                setImageViewOnce(false);
            }
        } else {
            toast.show(apiMessage(uploadRes.message || 'upload_failed'), 'error');
        }
        setUploadingMedia(false);
    };

    const startRecording = async () => {
        if (!requireVerified('chat')) return;
        if (!canCompose) {
            toast.show(peerDeleted
                ? t('chat:account_deleted_message_disabled', 'This account has been deleted. You can no longer send messages.')
                : t('chat:accept_request_to_reply', 'Accept the request before replying.'), 'info');
            return;
        }
        if (id === 'new') {
            toast.show(t('send_text_first', 'Send a text message first, then attach media.'), 'info');
            return;
        }
        if (recordingBusy || recorderState.isRecording) return;

        setRecordingBusy(true);
        setVoicePreview(null);
        setVoiceWaveform([]);
        setVoicePanelOpen(true);
        const permission = await requestRecordingPermissionsAsync();
        if (!permission.granted) {
            toast.show(t('microphone_permission_required', 'Microphone permission is required.'), 'error');
            setVoicePanelOpen(false);
            setRecordingBusy(false);
            return;
        }

        try {
            await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
            await recorder.prepareToRecordAsync();
            recorder.record({ forDuration: MAX_VOICE_RECORDING_SECONDS });
        } catch {
            toast.show(t('recording_failed', 'Could not start recording.'), 'error');
            setVoicePanelOpen(false);
        } finally {
            setRecordingBusy(false);
        }
    };

    const stopRecordingForPreview = async () => {
        if (!recorderState.isRecording || recordingBusy || id === 'new') return;
        setRecordingBusy(true);
        try {
            await recorder.stop();
            await setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true });
            const recorderStatus = recorder.getStatus();
            const uri = recorder.uri || recorderStatus.url;
            const durationMillis = recorderState.durationMillis || (recorderStatus as any).durationMillis || 0;
            const duration = Math.min(MAX_VOICE_RECORDING_SECONDS, Math.round(durationMillis / 1000));
            if (!uri || duration < 1) {
                toast.show(t('recording_too_short', 'Recording is too short.'), 'warning');
                setVoicePanelOpen(false);
                setVoicePreview(null);
                return;
            }

            setVoicePreview({ uri, duration });
            setVoiceWaveform((current) => current.length ? current : makeWaveform(VOICE_WAVE_BAR_COUNT));
        } catch {
            toast.show(t('recording_failed', 'Could not save recording.'), 'error');
        } finally {
            setRecordingBusy(false);
        }
    };

    const discardVoiceRecording = async () => {
        if (voiceSending) return;
        setRecordingBusy(true);
        try {
            if (recorderState.isRecording) {
                await recorder.stop();
            }
            await setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true });
        } catch {
            // Discard should always close the recorder even if native audio cleanup fails.
        } finally {
            setVoicePanelOpen(false);
            setVoicePreview(null);
            setVoiceWaveform([]);
            setRecordingBusy(false);
        }
    };

    const sendVoicePreview = async () => {
        if (!voicePreview || voiceSending || id === 'new') return;
        if (!canCompose) {
            toast.show(peerDeleted
                ? t('chat:account_deleted_message_disabled', 'This account has been deleted. You can no longer send messages.')
                : t('chat:accept_request_to_reply', 'Accept the request before replying.'), 'info');
            return;
        }
        setVoiceSending(true);
        try {
            const formData = new FormData();
            formData.append('file', {
                uri: voicePreview.uri,
                name: `voice-${Date.now()}.m4a`,
                type: Platform.OS === 'ios' ? 'audio/m4a' : 'audio/mp4',
            } as any);
            formData.append('conversationId', id);
            formData.append('type', 'voice');
            formData.append('duration', String(Math.min(MAX_VOICE_RECORDING_SECONDS, voicePreview.duration)));

            const uploadRes = await chatService.uploadMedia(formData);
            if (uploadRes.success && uploadRes.media) {
                await sendMediaMessage('voice', uploadRes.media);
                setVoicePanelOpen(false);
                setVoicePreview(null);
                setVoiceWaveform([]);
            } else {
                toast.show(apiMessage(uploadRes.message || 'upload_failed'), 'error');
            }
        } catch {
            toast.show(t('recording_failed', 'Could not save recording.'), 'error');
        } finally {
            setVoiceSending(false);
        }
    };

    const requestAction = async (action: 'accept' | 'decline' | 'withdraw') => {
        const target = activeConversation;
        if (!target || requestBusy) return;
        setRequestBusy(true);
        const res = action === 'accept'
            ? await chatService.accept(target.id)
            : action === 'decline'
                ? await chatService.decline(target.id)
                : await chatService.withdraw(target.id);
        setRequestBusy(false);
        if (!res.success) {
            Alert.alert(t('error', 'Error'), apiMessage(res.message));
            return;
        }
        if (action === 'accept') {
            setConversation((current) => current ? { ...current, state: 'active', requestRole: null } : {
                ...target,
                state: 'active',
                requestRole: null,
            });
            await load('replace');
        }
        else router.replace('/(tabs)/messages' as any);
    };

    const toggleMute = async () => {
        if (!conversation || menuBusy) return;
        const nextMuted = !conversation.muted;
        setMenuBusy(true);
        const res = await chatService.mute(conversation.id, nextMuted);
        setMenuBusy(false);
        if (!res.success) {
            Alert.alert(t('error', 'Error'), apiMessage(res.message));
            return;
        }
        setConversation((current) => current ? { ...current, muted: nextMuted } : current);
        setMenuOpen(false);
        toast.show(
            nextMuted
                ? translateChatText('conversation_muted', 'Conversation muted')
                : translateChatText('conversation_unmuted', 'Conversation unmuted'),
            'success',
        );
    };

    const endConversation = () => {
        if (!conversation || menuBusy) return;
        Alert.alert(
            translateChatText('end_conversation', 'End conversation'),
            translateChatText('end_conversation_confirm', 'End this conversation?'),
            [
                { text: t('cancel', 'Cancel'), style: 'cancel' },
                {
                    text: translateChatText('end_conversation', 'End conversation'),
                    style: 'destructive',
                    onPress: async () => {
                        if (!conversation) return;
                        setMenuBusy(true);
                        const res = await chatService.end(conversation.id);
                        setMenuBusy(false);
                        if (!res.success) {
                            Alert.alert(t('error', 'Error'), apiMessage(res.message));
                            return;
                        }
                        setMenuOpen(false);
                        await load('replace');
                    },
                },
            ],
        );
    };

    const deleteConversation = () => {
        if (!conversation || menuBusy) return;
        Alert.alert(
            translateChatText('delete_chat', 'Delete chat'),
            translateChatText('delete_chat_confirm', 'Delete this chat for me?'),
            [
                { text: t('cancel', 'Cancel'), style: 'cancel' },
                {
                    text: translateChatText('delete_chat', 'Delete chat'),
                    style: 'destructive',
                    onPress: async () => {
                        if (!conversation) return;
                        setMenuBusy(true);
                        const res = await chatService.deleteConversation(conversation.id);
                        setMenuBusy(false);
                        if (!res.success) {
                            Alert.alert(t('error', 'Error'), apiMessage(res.message));
                            return;
                        }
                        setMenuOpen(false);
                        toast.show(translateChatText('chat_hidden', 'Chat hidden'), 'success');
                        router.replace('/(tabs)/messages' as any);
                    },
                },
            ],
        );
    };

    const openViewOnce = useCallback(async (message: ChatMessage) => {
        if (viewOnceLoadingId || !message.id) return;
        setViewOnceLoadingId(message.id);
        const res = await chatService.fetchViewOnce(message.id);
        if (res.success && (res.url || res.data?.url)) {
            setViewOnce({
                url: res.url || res.data!.url,
                messageId: message.id,
                seconds: res.expiresIn || res.data?.expiresIn || 30,
            });
        } else {
            Alert.alert(t('error', 'Error'), apiMessage(res.message || 'photo_expired'));
        }
        setViewOnceLoadingId(null);
    }, [viewOnceLoadingId]);

    const markViewOnceLoaded = async () => {
        if (!viewOnce?.messageId) return;
        const messageId = viewOnce.messageId;
        await chatService.markViewOnceViewed(messageId);
        setItems((current) => current.map((message) => message.id === messageId ? {
            ...message,
            media: { ...(message.media || {}), viewedAt: new Date().toISOString() },
        } : message));
    };

    const closeMessageMenu = () => {
        if (messageActionBusy) return;
        setSelectedMessage(null);
    };

    const beginReply = useCallback((message: ChatMessage) => {
        setReplyTo(message);
        setSelectedMessage(null);
    }, []);

    const copySelectedMessage = async () => {
        if (!selectedMessage || messageActionBusy) return;
        const text = messageText(selectedMessage).trim();
        if (!text) return;
        await Clipboard.setStringAsync(text);
        toast.show(translateChatText('copied', 'Copied'), 'success');
        setSelectedMessage(null);
    };

    const reactToSelectedMessage = async (emoji: string) => {
        if (!selectedMessage || messageActionBusy) return;
        setMessageActionBusy(true);
        const res = await chatService.react(selectedMessage.id, emoji);
        setMessageActionBusy(false);
        if (!res.success) {
            toast.show(apiMessage(res.message || 'connection_error'), 'error');
            return;
        }
        setItems((current) => current.map((message) => message.id === selectedMessage.id
            ? { ...message, reactions: res.reactions || res.data?.reactions || [] }
            : message));
        setSelectedMessage(null);
    };

    const deleteSelectedMessage = async () => {
        if (!selectedMessage || messageActionBusy) return;
        setMessageActionBusy(true);
        const message = selectedMessage;
        const res = await chatService.deleteMessage(message.id);
        setMessageActionBusy(false);
        if (!res.success) {
            toast.show(apiMessage(res.message || 'connection_error'), 'error');
            return;
        }
        await deleteCachedChatMediaForMessage({
            userId: String(user?._id || user?.id || ''),
            conversationId: message.conversationId,
            messageId: message.id,
        });
        setItems((current) => current.filter((item) => item.id !== message.id));
        setSelectedMessage(null);
    };

    const unsendSelectedMessage = async () => {
        if (!selectedMessage || messageActionBusy) return;
        setMessageActionBusy(true);
        const message = selectedMessage;
        const res = await chatService.unsend(message.id);
        setMessageActionBusy(false);
        if (!res.success) {
            toast.show(apiMessage(res.message || 'connection_error'), 'error');
            return;
        }
        await deleteCachedChatMediaForMessage({
            userId: String(user?._id || user?.id || ''),
            conversationId: message.conversationId,
            messageId: message.id,
        });
        setItems((current) => current.map((item) => item.id === message.id
            ? { ...item, type: 'system', content: 'message_unsent', media: null, unsent: true, unsentAt: new Date().toISOString() }
            : item));
        setSelectedMessage(null);
    };

    if (loading) {
        return (
            <SafeAreaView style={[styles.screen, { backgroundColor: colors.bg }]} edges={['top']}>
                <View style={styles.center}>
                    <ActivityIndicator color={colors.primary} />
                </View>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={[styles.screen, { backgroundColor: colors.bg }]} edges={['top']}>
            <View style={styles.screen}>
                <View style={[styles.header, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
                    <Pressable onPress={() => router.replace('/(tabs)/messages' as any)} style={styles.headerIcon}>
                        <ArrowLeft size={scale(21)} color={colors.text} strokeWidth={2.7} />
                    </Pressable>
                    <Pressable
                        disabled={headerOther.account_deleted}
                        onPress={openPeerProfile}
                        accessibilityRole="button"
                        accessibilityLabel={peerName({ ...(activeConversation || {}), otherUser: headerOther } as Conversation, name)}
                        hitSlop={{ top: 4, bottom: 4, left: 2, right: 2 }}
                        style={({ pressed }) => [
                            styles.headerProfileTarget,
                            pressed && !headerOther.account_deleted && { opacity: 0.72 },
                        ]}
                    >
                        <View pointerEvents="box-none" style={styles.headerProfileContent}>
                            <View pointerEvents="none" style={[styles.headerAvatar, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                                {avatar ? (
                                    <Image source={{ uri: avatar }} style={StyleSheet.absoluteFill} contentFit="cover" />
                                ) : (
                                    <Image source={PROFILE_PLACEHOLDER_IMAGE} style={StyleSheet.absoluteFill} contentFit="cover" />
                                )}
                            </View>
                            <View pointerEvents="none" style={styles.headerText}>
                                <RNText numberOfLines={1} style={[styles.headerNameText, { color: colors.text }]}>
                                    {peerName({ ...(activeConversation || {}), otherUser: headerOther } as Conversation, name)}
                                </RNText>
                                {(activeConversation || name) && (
                                    <RNText numberOfLines={1} style={[styles.headerStatusText, { color: colors.muted }]}>
                                        {headerOther.account_deleted
                                            ? t('chat:account_deleted', 'Account deleted')
                                            : headerOther.recently_active
                                                ? t('chat:online', 'Online')
                                                : t('chat:offline', 'Offline')}
                                    </RNText>
                                )}
                            </View>
                        </View>
                    </Pressable>
                    <View style={styles.headerSpacer} pointerEvents="none" />
                    <Pressable
                        onPress={() => setMenuOpen(true)}
                        style={styles.headerIcon}
                    >
                        <MoreVertical size={scale(21)} color={colors.text} strokeWidth={2.7} />
                    </Pressable>
                </View>

                <ChatKeyboardAvoider>
                <View style={styles.messageListWrap}>
                    <FlatList
                        ref={listRef}
                        style={{ flex: 1 }}
                        inverted={invertedItems.length > 0}
                        keyboardShouldPersistTaps="handled"
                        keyboardDismissMode="interactive"
                        scrollEventThrottle={16}
                        onScroll={handleListScroll}
                        data={invertedItems}
                        keyExtractor={(item) => item.id}
                        contentContainerStyle={{
                            paddingHorizontal: scale(12),
                            paddingTop: scale(8),
                            paddingBottom: scale(18),
                            flexGrow: 1,
                        }}
                        onEndReached={loadMore}
                        onEndReachedThreshold={0.2}
                        maintainVisibleContentPosition={{ minIndexForVisible: 1 }}
                        removeClippedSubviews={Platform.OS === 'android'}
                        initialNumToRender={12}
                        maxToRenderPerBatch={10}
                        windowSize={11}
                        updateCellsBatchingPeriod={50}
                        onScrollToIndexFailed={(info) => {
                            requestAnimationFrame(() => {
                                try {
                                    listRef.current?.scrollToIndex({ index: info.index, animated: true, viewPosition: 0.5 });
                                } catch {
                                    listRef.current?.scrollToOffset({ offset: 0, animated: true });
                                }
                            });
                        }}
                        ListFooterComponent={loadingMore ? <ActivityIndicator color={colors.primary} style={{ paddingVertical: scale(10) }} /> : null}
                        ListEmptyComponent={
                            <View style={styles.empty}>
                                <Text variant="body" className="font-body-bold" align="center" style={{ color: colors.text }}>
                                    {t('no_messages_yet', 'No messages yet')}
                                </Text>
                            </View>
                        }
                        renderItem={renderMessageItem}
                    />
                    <ChatScrollDownButton
                        visible={showScrollDown}
                        unreadCount={unseenWhileAway}
                        colors={colors}
                        label={t('chat:scroll_to_latest', 'Scroll to latest')}
                        onPress={() => {
                            scrollToBottom(true);
                            setShowScrollDown(false);
                            markConversationSeen();
                        }}
                    />
                </View>

                <ChatComposerBar
                    backgroundColor={colors.card}
                    borderTopColor={colors.border}
                    onLayout={(event) => {
                        const nextHeight = event.nativeEvent.layout.height;
                        if (nextHeight > 0 && Math.abs(nextHeight - chatFooterHeight) > 1) {
                            setChatFooterHeight(nextHeight);
                        }
                    }}
                >
                {isRequest && activeConversation && !peerDeleted && (
                    <View style={[styles.requestBar, { backgroundColor: colors.card }]}>
                        <Text variant="caption" className="font-body-semi" align="center" style={[styles.requestHint, { color: colors.muted }]}>
                            {isSentRequest
                                ? t('chat:waiting_for_request_acceptance', 'Waiting for this request to be accepted.')
                                : t('chat:accept_request_to_reply', 'Accept the request before replying.')}
                        </Text>
                        <View style={styles.requestActions}>
                        {isSentRequest ? (
                            <Pressable disabled={requestBusy} onPress={() => requestAction('withdraw')} style={[styles.requestButton, styles.requestNeutral, { backgroundColor: colors.card, borderColor: colors.border }, requestBusy && styles.disabledButton]}>
                                <X size={scale(14)} color={colors.muted} />
                                <Text variant="caption" className="font-body-bold" style={{ color: colors.muted }}>{t('chat:withdraw', 'Withdraw')}</Text>
                            </Pressable>
                        ) : (
                            <>
                                <Pressable disabled={requestBusy} onPress={() => requestAction('accept')} style={[styles.requestButton, { backgroundColor: colors.primary }, requestBusy && styles.disabledButton]}>
                                    {requestBusy ? <ActivityIndicator color={colors.inverse} size="small" /> : <Check size={scale(14)} color={colors.inverse} />}
                                    <Text variant="caption" className="font-body-bold" style={{ color: colors.inverse }}>{t('chat:accept', 'Accept')}</Text>
                                </Pressable>
                                <Pressable disabled={requestBusy} onPress={() => requestAction('decline')} style={[styles.requestButton, styles.requestNeutral, { backgroundColor: colors.card, borderColor: colors.border }, requestBusy && styles.disabledButton]}>
                                    <X size={scale(14)} color={colors.muted} />
                                    <Text variant="caption" className="font-body-bold" style={{ color: colors.muted }}>{t('chat:decline', 'Decline')}</Text>
                                </Pressable>
                            </>
                        )}
                        </View>
                    </View>
                )}

                {peerDeleted && (
                    <View style={[styles.endedBar, { backgroundColor: colors.card }]}>
                        <Text variant="body-sm" className="font-body-semi" align="center" style={{ color: colors.muted }}>
                            {t('chat:account_deleted_message_disabled', 'This account has been deleted. You can no longer send messages.')}
                        </Text>
                    </View>
                )}

                {isEnded && (
                    <View style={[styles.endedBar, { backgroundColor: colors.card }]}>
                        <Text variant="body-sm" className="font-body-semi" align="center" style={{ color: colors.muted }}>
                            {translateChatText('conversation_ended', 'Conversation ended')}
                        </Text>
                    </View>
                )}

                {canCompose && !isEnded && (
                    <View style={styles.composer}>
                        {replyTo && (
                            <View style={[styles.replyComposerBar, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
                                <View style={[styles.replyComposerQuote, { borderLeftColor: colors.primary }]}>
                                    <Text variant="caption" className="font-body-bold" style={{ color: colors.primary }}>
                                        {t('chat:reply', 'Reply')}
                                    </Text>
                                    <Text variant="caption" numberOfLines={2} style={{ color: colors.muted }}>
                                        {replyPreview(replyTo)}
                                    </Text>
                                </View>
                                <Pressable onPress={() => setReplyTo(null)} style={styles.replyComposerClose}>
                                    <X size={scale(14)} color={colors.muted} strokeWidth={2.5} />
                                </Pressable>
                            </View>
                        )}
                        {voicePanelOpen ? (
                            <VoiceRecorderPanel
                                colors={colors}
                                duration={voicePreview?.duration || Math.min(MAX_VOICE_RECORDING_SECONDS, Math.round((recorderState.durationMillis || 0) / 1000))}
                                isRecording={recorderState.isRecording}
                                previewUri={voicePreview?.uri || null}
                                recordingBusy={recordingBusy}
                                sending={voiceSending}
                                waveform={voiceWaveform}
                                onDiscard={discardVoiceRecording}
                                onSend={sendVoicePreview}
                                onStop={stopRecordingForPreview}
                            />
                        ) : (
                            <View style={styles.composerRow}>
                                <PressableScale
                                    onPress={pickAndUploadImage}
                                    disabled={uploadingMedia || recordingBusy || voiceSending}
                                    style={[styles.toolButton, { backgroundColor: colors.surface, borderColor: colors.border }]}
                                >
                                    {uploadingMedia ? <ActivityIndicator color={colors.primary} /> : <ImageIcon size={scale(20)} color={colors.muted} />}
                                </PressableScale>
                                <TextInput
                                    value={content}
                                    onChangeText={(value) => setContent(value.slice(0, 5000))}
                                    onFocus={() => {
                                        if (isNearBottomRef.current) {
                                            scrollToBottom(false);
                                        }
                                    }}
                                    placeholder={t('chat:message_placeholder', 'Type a message...')}
                                    placeholderTextColor={colors.subtle}
                                    style={[styles.input, { color: colors.text, backgroundColor: colors.surface, borderColor: colors.border, fontFamily: inputFontFamily, textAlign: isRTL ? 'right' : 'left' }]}
                                    multiline
                                />
                                {content.trim() ? (
                                    <PressableScale onPress={send} disabled={sending} style={[styles.send, { backgroundColor: colors.primary }]}>
                                        {sending ? <ActivityIndicator color={colors.inverse} /> : <Send size={scale(18)} color={colors.inverse} />}
                                    </PressableScale>
                                ) : (
                                    <PressableScale
                                        onPress={startRecording}
                                        disabled={recordingBusy || voiceSending}
                                        style={[styles.toolButton, { backgroundColor: colors.surface, borderColor: colors.border }]}
                                    >
                                        {recordingBusy ? <ActivityIndicator color={colors.primary} /> : <Mic size={scale(20)} color={colors.muted} />}
                                    </PressableScale>
                                )}
                            </View>
                        )}
                    </View>
                )}
                </ChatComposerBar>
                </ChatKeyboardAvoider>
            </View>

            <ImageAttachmentComposer
                visible={!!imageAttachment}
                uri={imageAttachment?.uri ?? null}
                caption={imageCaption}
                viewOnce={imageViewOnce}
                uploading={uploadingMedia}
                colors={colors}
                inputFontFamily={inputFontFamily}
                isRTL={isRTL}
                labels={{
                    captionPlaceholder: translateChatText('caption_placeholder', 'Add a caption (optional)'),
                    closeA11y: translateChatText('close', 'Close'),
                    viewOnceA11y: translateChatText('view_once_toggle', 'View once photo'),
                    sendA11y: uploadingMedia
                        ? translateChatText('sending', 'Sending...')
                        : translateChatText('send', 'Send'),
                }}
                onChangeCaption={setImageCaption}
                onToggleViewOnce={() => !uploadingMedia && setImageViewOnce((value) => !value)}
                onClose={closeImageAttachment}
                onSend={sendImageAttachment}
            />

            <Modal visible={!!imagePreview} transparent animationType="fade" onRequestClose={() => setImagePreview(null)}>
                <View style={styles.previewModal}>
                    <Pressable style={[styles.modalClose, { top: insets.top + scale(14) }]} onPress={() => setImagePreview(null)}>
                        <X size={scale(22)} color="#FFFFFF" />
                    </Pressable>
                    {!!imagePreview && <RNImage source={{ uri: imagePreview }} style={styles.previewImage} resizeMode="contain" />}
                </View>
            </Modal>

            <Modal visible={!!viewOnce} transparent animationType="fade" onRequestClose={() => setViewOnce(null)}>
                <View style={styles.previewModal}>
                    <Pressable style={[styles.modalClose, { top: insets.top + scale(14) }]} onPress={() => setViewOnce(null)}>
                        <X size={scale(22)} color="#FFFFFF" />
                    </Pressable>
                    {!!viewOnce && (
                        <View style={[styles.countdown, { top: insets.top + scale(18) }]}>
                            <Text variant="caption" className="font-body-bold" style={{ color: '#FFFFFF' }}>{viewOnce.seconds}s</Text>
                        </View>
                    )}
                    {!!viewOnce?.url && (
                        <RNImage
                            source={{ uri: viewOnce.url }}
                            style={styles.previewImage}
                            resizeMode="contain"
                            onLoad={markViewOnceLoaded}
                        />
                    )}
                </View>
            </Modal>

            <Modal visible={menuOpen} transparent animationType="fade" onRequestClose={() => !menuBusy && setMenuOpen(false)}>
                <View style={styles.menuLayer} pointerEvents="box-none">
                    <Pressable style={styles.menuBackdrop} onPress={() => !menuBusy && setMenuOpen(false)} />
                    <View
                        style={[
                            styles.conversationMenu,
                            {
                                top: insets.top + scale(58),
                                backgroundColor: colors.card,
                                borderColor: colors.border,
                            },
                        ]}
                    >
                        <View style={[styles.conversationMenuHeader, { borderBottomColor: colors.border }]}>
                            <Text variant="body-sm" className="font-body-bold" style={{ color: colors.text }}>
                                {translateChatText('more_options', 'More options')}
                            </Text>
                            <Pressable onPress={() => !menuBusy && setMenuOpen(false)} style={styles.menuClose}>
                                <X size={scale(18)} color={colors.text} strokeWidth={2.6} />
                            </Pressable>
                        </View>
                        <View style={styles.conversationMenuLinks}>
                            <ConversationMenuItem
                                icon={conversation?.muted ? Bell : BellOff}
                                label={conversation?.muted
                                    ? translateChatText('unmute_conversation', 'Unmute notifications')
                                    : translateChatText('mute_conversation', 'Mute notifications')}
                                color={colors.text}
                                disabled={menuBusy}
                                onPress={toggleMute}
                            />
                            <ConversationMenuItem
                                icon={XCircle}
                                label={translateChatText('end_conversation', 'End conversation')}
                                color={colors.danger}
                                danger
                                disabled={menuBusy}
                                onPress={endConversation}
                            />
                            <ConversationMenuItem
                                icon={Trash2}
                                label={translateChatText('delete_chat', 'Delete chat')}
                                color={colors.danger}
                                danger
                                disabled={menuBusy}
                                onPress={deleteConversation}
                            />
                        </View>
                    </View>
                </View>
            </Modal>

            <Modal visible={!!selectedMessage} transparent animationType="fade" onRequestClose={closeMessageMenu}>
                <View style={styles.messageMenuLayer}>
                    <Pressable style={styles.messageMenuBackdrop} onPress={closeMessageMenu} />
                    {!!selectedMessage && (
                        <View style={[styles.messageMenuSheet, { backgroundColor: colors.card, paddingBottom: Math.max(insets.bottom + scale(50), scale(50)) }]}>
                            <View style={styles.quickReactionRow}>
                                {QUICK_REACTIONS.map((emoji) => (
                                    <Pressable
                                        key={emoji}
                                        disabled={messageActionBusy}
                                        onPress={() => reactToSelectedMessage(emoji)}
                                        style={({ pressed }) => [styles.quickReactionButton, pressed && styles.quickReactionPressed]}
                                    >
                                        <Text style={styles.quickReactionText}>{emoji}</Text>
                                    </Pressable>
                                ))}
                            </View>
                            <MessageActionItem
                                icon={Reply}
                                label={translateChatText('reply', 'Reply')}
                                color={colors.text}
                                disabled={messageActionBusy}
                                onPress={() => beginReply(selectedMessage)}
                            />
                            {!!messageText(selectedMessage).trim() && (
                                <MessageActionItem
                                    icon={Copy}
                                    label={translateChatText('copy', 'Copy')}
                                    color={colors.text}
                                    disabled={messageActionBusy}
                                    onPress={copySelectedMessage}
                                />
                            )}
                            <MessageActionItem
                                icon={Trash2}
                                label={translateChatText('delete_for_me', 'Delete for me')}
                                color={colors.danger}
                                danger
                                disabled={messageActionBusy}
                                onPress={deleteSelectedMessage}
                            />
                            {canUnsendMessage(selectedMessage, String(user?._id || user?.id || '')) && (
                                <MessageActionItem
                                    icon={Undo2}
                                    label={translateChatText('unsend', 'Unsend')}
                                    color={colors.danger}
                                    danger
                                    disabled={messageActionBusy}
                                    onPress={unsendSelectedMessage}
                                />
                            )}
                        </View>
                    )}
                </View>
            </Modal>
            <UserProfileSheet
                visible={profileSheetOpen && Boolean(peerId)}
                userId={peerId}
                initialProfile={profileSheetProfile}
                onClose={() => setProfileSheetOpen(false)}
            />
        </SafeAreaView>
    );
}

function ConversationMenuItem({
    icon: Icon,
    label,
    color,
    danger,
    disabled,
    onPress,
}: {
    icon: any;
    label: string;
    color: string;
    danger?: boolean;
    disabled?: boolean;
    onPress: () => void;
}) {
    const tint = danger ? color : color;
    return (
        <Pressable disabled={disabled} onPress={onPress} style={({ pressed }) => [styles.conversationMenuItem, pressed && styles.conversationMenuItemPressed, disabled && { opacity: 0.55 }]}>
            <View style={styles.conversationMenuItemRow}>
                <View style={styles.conversationMenuIcon}>
                    <Icon size={scale(18)} color={tint} strokeWidth={2.4} />
                </View>
                <RNText numberOfLines={1} style={[styles.conversationMenuLabel, { color: tint }]}>
                    {label}
                </RNText>
            </View>
        </Pressable>
    );
}

function MessageActionItem({
    icon: Icon,
    label,
    color,
    danger,
    disabled,
    onPress,
}: {
    icon: any;
    label: string;
    color: string;
    danger?: boolean;
    disabled?: boolean;
    onPress: () => void;
}) {
    const tint = danger ? color : color;
    return (
        <Pressable disabled={disabled} onPress={onPress} style={({ pressed }) => [styles.messageActionItem, pressed && styles.messageActionPressed, disabled && { opacity: 0.55 }]}>
            <View style={styles.messageActionItemRow}>
                <View style={styles.messageActionIcon}>
                    <Icon size={scale(18)} color={tint} strokeWidth={2.4} />
                </View>
                <RNText numberOfLines={1} ellipsizeMode="tail" style={[styles.messageActionLabel, { color: tint }]}>
                    {label}
                </RNText>
            </View>
        </Pressable>
    );
}

function VoiceRecorderPanel({
    colors,
    duration,
    isRecording,
    previewUri,
    recordingBusy,
    sending,
    waveform,
    onDiscard,
    onSend,
    onStop,
}: {
    colors: Record<string, string>;
    duration: number;
    isRecording: boolean;
    previewUri: string | null;
    recordingBusy: boolean;
    sending: boolean;
    waveform: number[];
    onDiscard: () => void;
    onSend: () => void;
    onStop: () => void;
}) {
    const bars = waveform.length ? waveform : makeWaveform(VOICE_WAVE_BAR_COUNT);
    const disabled = recordingBusy || sending;

    return (
        <View style={styles.voiceRecorderPanel}>
            <View style={styles.voiceRecorderHeader}>
                <View style={styles.voiceRecorderTimer}>
                    {isRecording && <View style={styles.recordDot} />}
                    <Mic size={scale(15)} color={colors.primary} />
                    <Text variant="caption" className="font-body-bold" style={{ color: colors.text }}>
                        {formatDuration(duration)}
                    </Text>
                </View>
                <Pressable onPress={onDiscard} disabled={disabled} style={styles.voiceRecorderClose}>
                    <X size={scale(17)} color={colors.muted} strokeWidth={2.5} />
                </Pressable>
            </View>

            {previewUri ? (
                <VoicePreviewPlayer uri={previewUri} duration={duration} colors={colors} waveform={bars} />
            ) : (
                <View style={[styles.voiceRecorderWaveSurface, { backgroundColor: colors.surface }]}>
                    {bars.map((value, index) => (
                        <View
                            key={`recording-wave-${index}`}
                            style={[
                                styles.voiceRecorderWaveBar,
                                {
                                    height: scale(7 + value * 30),
                                    backgroundColor: colors.primary,
                                },
                            ]}
                        />
                    ))}
                </View>
            )}

            <View style={styles.voiceRecorderActions}>
                <Pressable onPress={onDiscard} disabled={disabled} style={[styles.voiceRecorderSecondary, { backgroundColor: colors.surface }]}>
                    <Trash2 size={scale(16)} color={colors.text} />
                    <Text variant="caption" className="font-body-bold" style={{ color: colors.text }}>
                        {t('chat:voice_discard', 'Discard')}
                    </Text>
                </Pressable>
                {previewUri ? (
                    <Pressable onPress={onSend} disabled={disabled} style={[styles.voiceRecorderPrimary, disabled && styles.disabledButton]}>
                        {sending ? <ActivityIndicator color={colors.inverse} size="small" /> : <Send size={scale(16)} color={colors.inverse} />}
                        <Text variant="caption" className="font-body-bold" style={styles.voiceRecorderPrimaryText}>
                            {sending ? t('chat:sending', 'Sending') : t('chat:send', 'Send')}
                        </Text>
                    </Pressable>
                ) : (
                    <Pressable onPress={onStop} disabled={disabled || !isRecording} style={[styles.voiceRecorderPrimary, (disabled || !isRecording) && styles.disabledButton]}>
                        {recordingBusy ? <ActivityIndicator color={colors.inverse} size="small" /> : <Square size={scale(15)} color={colors.inverse} fill={colors.inverse} />}
                        <Text variant="caption" className="font-body-bold" style={styles.voiceRecorderPrimaryText}>
                            {t('chat:voice_stop', 'Stop')}
                        </Text>
                    </Pressable>
                )}
            </View>
        </View>
    );
}

function VoicePreviewPlayer({
    uri,
    duration,
    colors,
    waveform,
}: {
    uri: string;
    duration: number;
    colors: Record<string, string>;
    waveform: number[];
}) {
    const toast = useToast();
    const player = useAudioPlayer(uri, { updateInterval: 250 });
    const status = useAudioPlayerStatus(player);
    const progress = status.duration > 0 ? Math.min(1, status.currentTime / status.duration) : 0;
    const displaySeconds = Math.max(0, Math.round(status.playing ? status.currentTime : status.duration || duration || 0));

    const toggle = async () => {
        try {
            if (status.playing) {
                await player.pause();
                return;
            }
            if (status.didJustFinish) {
                await player.seekTo(0).catch(() => undefined);
            }
            await player.play();
        } catch {
            toast.show(translateChatText('media_playback_failed', 'Could not play this voice note. Please try again.'), 'error');
        }
    };

    return (
        <Pressable onPress={toggle} style={[styles.voiceRecorderPreview, { backgroundColor: colors.surface }]}>
            <View style={styles.voiceRecorderPreviewPlay}>
                {status.playing
                    ? <Pause size={scale(14)} color={colors.inverse} fill={colors.inverse} />
                    : <Play size={scale(14)} color={colors.inverse} fill={colors.inverse} />}
            </View>
            <View style={styles.voiceRecorderPreviewTrack}>
                <View style={styles.wave}>
                    {waveform.map((value, index) => (
                        <View
                            key={`preview-wave-${index}`}
                            style={[
                                styles.waveBar,
                                {
                                    height: scale(7 + value * 21),
                                    backgroundColor: progress * waveform.length >= index ? colors.primary : colors.waveMuted,
                                },
                            ]}
                        />
                    ))}
                </View>
            </View>
            <Text variant="caption" className="font-body-semi" numberOfLines={1} style={[styles.voiceDuration, { color: colors.muted }]}>
                {formatDuration(displaySeconds)}
            </Text>
        </Pressable>
    );
}

// Pressable that springs down slightly while pressed (used for composer buttons
// and image bubbles) for a tactile micro-interaction.
function PressableScale({
    children,
    onPress,
    disabled,
    style,
    accessibilityLabel,
    accessibilityRole,
    activeScale = 0.9,
    onLongPress,
    delayLongPress,
}: {
    children: React.ReactNode;
    onPress?: () => void;
    disabled?: boolean;
    style?: StyleProp<ViewStyle>;
    accessibilityLabel?: string;
    accessibilityRole?: 'button' | 'image';
    activeScale?: number;
    onLongPress?: () => void;
    delayLongPress?: number;
}) {
    const scaleValue = useSharedValue(1);
    const animStyle = useAnimatedStyle(() => ({
        transform: [{ scale: scaleValue.value }],
    }));
    return (
        <Pressable
            onPress={onPress}
            onLongPress={onLongPress}
            delayLongPress={delayLongPress}
            disabled={disabled}
            accessibilityLabel={accessibilityLabel}
            accessibilityRole={accessibilityRole}
            onPressIn={() => { scaleValue.value = withSpring(activeScale, { damping: 16, stiffness: 320 }); }}
            onPressOut={() => { scaleValue.value = withSpring(1, { damping: 16, stiffness: 320 }); }}
        >
            <Reanimated.View style={[style, animStyle]}>
                {children}
            </Reanimated.View>
        </Pressable>
    );
}

// Scroll-to-latest button: always mounted, fades + scales in/out so it doesn't
// pop. Driven by the `visible` flag.
function ChatScrollDownButton({
    visible,
    unreadCount,
    colors,
    label,
    onPress,
}: {
    visible: boolean;
    unreadCount: number;
    colors: Record<string, string>;
    label: string;
    onPress: () => void;
}) {
    const progress = useSharedValue(0);
    useEffect(() => {
        progress.value = withTiming(visible ? 1 : 0, { duration: 180 });
    }, [visible, progress]);
    const animStyle = useAnimatedStyle(() => ({
        opacity: progress.value,
        transform: [{ scale: 0.8 + progress.value * 0.2 }],
    }));
    return (
        <Reanimated.View
            pointerEvents={visible ? 'auto' : 'none'}
            style={[styles.scrollDownButton, { backgroundColor: colors.card, borderColor: colors.border }, animStyle]}
        >
            <Pressable
                accessibilityRole="button"
                accessibilityLabel={label}
                onPress={onPress}
                style={styles.scrollDownPress}
            >
                <ChevronDown size={scale(22)} color={colors.text} strokeWidth={2.4} />
                {unreadCount > 0 && (
                    <UnreadBadge
                        count={unreadCount}
                        variant="sm"
                        borderColor={colors.card}
                        style={styles.scrollDownBadge}
                    />
                )}
            </Pressable>
        </Reanimated.View>
    );
}

function MessageBubbleComponent({
    message,
    mine,
    colors,
    userId,
    animateIn,
    onOpenImage,
    onOpenViewOnce,
    viewOnceLoading,
    onOpenMenu,
    onSwipeReply,
    onReplyClick,
}: {
    message: ChatMessage;
    mine: boolean;
    colors: Record<string, string>;
    userId: string;
    animateIn: boolean;
    onOpenImage: (url: string) => void;
    onOpenViewOnce: (message: ChatMessage) => void;
    viewOnceLoading: boolean;
    onOpenMenu: (message: ChatMessage) => void;
    onSwipeReply: (message: ChatMessage) => void;
    onReplyClick: (messageId: string) => void;
}) {
    if (message.type === 'system') {
        return (
            <View style={styles.systemWrap}>
                <Text variant="caption" className="font-body-semi" style={[styles.systemText, { backgroundColor: colors.card, color: colors.muted }]}>
                    {translateChatText(message.content || 'request_accepted', 'Request accepted')}
                </Text>
            </View>
        );
    }

    if (message.unsent) {
        return (
            <View style={[styles.bubbleRow, mine ? styles.bubbleRight : styles.bubbleLeft]}>
                <View style={[styles.unsentBubble, { borderColor: colors.border }]}>
                    <Text variant="body-sm" style={{ color: colors.muted, fontStyle: 'italic' }}>
                        {translateChatText('message_unsent', 'Message unsent')}
                    </Text>
                </View>
            </View>
        );
    }

    const media = message.media as MessageMedia | null | undefined;
    const hasNormalImage = message.type === 'image' && media?.url && !media.viewOnce;
    const hasViewOnce = message.type === 'image' && media?.viewOnce;
    const hasVoice = message.type === 'voice';
    const replyTo = typeof message.replyTo === 'object' && message.replyTo ? message.replyTo : null;
    const reactions = message.reactions || [];
    const swipeX = useRef(new Animated.Value(0)).current;
    const swipeTriggered = useRef(false);
    const resetSwipe = useCallback(() => {
        Animated.spring(swipeX, {
            toValue: 0,
            useNativeDriver: true,
            tension: 120,
            friction: 14,
        }).start();
    }, [swipeX]);
    const panResponder = useMemo(() => PanResponder.create({
        onMoveShouldSetPanResponder: (_, gesture) => (
            gesture.dx > scale(12)
            && Math.abs(gesture.dx) > Math.abs(gesture.dy) * 1.4
        ),
        onPanResponderMove: (_, gesture) => {
            const nextX = Math.max(0, Math.min(scale(72), gesture.dx));
            swipeX.setValue(nextX);
            swipeTriggered.current = nextX >= scale(56);
        },
        onPanResponderRelease: () => {
            if (swipeTriggered.current) {
                onSwipeReply(message);
            }
            swipeTriggered.current = false;
            resetSwipe();
        },
        onPanResponderTerminate: () => {
            swipeTriggered.current = false;
            resetSwipe();
        },
    }), [message, onSwipeReply, resetSwipe, swipeX]);
    const replyHintOpacity = swipeX.interpolate({
        inputRange: [0, scale(14), scale(56)],
        outputRange: [0, 0.35, 1],
        extrapolate: 'clamp',
    });
    const replyHintScale = swipeX.interpolate({
        inputRange: [0, scale(56)],
        outputRange: [0.78, 1],
        extrapolate: 'clamp',
    });

    return (
        <Reanimated.View
            style={[styles.bubbleRow, mine ? styles.bubbleRight : styles.bubbleLeft]}
            entering={animateIn ? FadeInDown.duration(240) : undefined}
        >
            <View style={styles.swipeReplyWrap}>
                <Animated.View
                    style={[
                        styles.swipeReplyHint,
                        mine ? styles.swipeReplyHintMine : styles.swipeReplyHintTheir,
                        {
                            opacity: replyHintOpacity,
                            transform: [{ translateY: -scale(17) }, { scale: replyHintScale }],
                        },
                    ]}
                >
                    <Reply size={scale(17)} color={colors.primary} strokeWidth={2.6} />
                </Animated.View>
                <Animated.View
                    {...panResponder.panHandlers}
                    style={[styles.swipeReplyBubble, { transform: [{ translateX: swipeX }] }]}
                >
                    <Pressable onLongPress={() => onOpenMenu(message)} delayLongPress={420}>
                        <View style={[
                            styles.bubble,
                            mine ? styles.mineBubble : styles.theirBubble,
                            {
                                backgroundColor: mine ? colors.primaryTint : colors.card,
                                borderColor: mine ? colors.primaryRing : colors.border,
                                shadowColor: '#0D1B12',
                                shadowOpacity: mine ? 0.04 : 0.08,
                                shadowRadius: scale(3),
                                shadowOffset: { width: 0, height: 1 },
                                elevation: mine ? 0 : 1,
                            },
                        ]}>
                            {replyTo && (
                                <Pressable
                                    onPress={() => onReplyClick(replyTo.id)}
                                    style={[styles.replyQuote, { backgroundColor: mine ? colors.primaryTint : colors.surface, borderLeftColor: colors.primary }]}
                                >
                                    <Text variant="caption" className="font-body-bold" style={{ color: colors.primary }}>
                                        {t('chat:reply', 'Reply')}
                                    </Text>
                                    <Text variant="caption" numberOfLines={2} style={{ color: colors.muted }}>
                                        {replyPreview(replyTo)}
                                    </Text>
                                </Pressable>
                            )}

                    {hasNormalImage && (
                        <CachedImageMessage
                            message={message}
                            media={media}
                            userId={userId}
                            onOpenImage={onOpenImage}
                        />
                    )}

                    {hasViewOnce && (
                        <Pressable
                            onPress={() => !mine && !media?.viewedAt && onOpenViewOnce(message)}
                            disabled={mine || !!media?.viewedAt || viewOnceLoading}
                            style={[styles.viewOnceButton, { backgroundColor: mine ? colors.primaryTint : colors.surface }]}
                        >
                            <View style={styles.viewOnceIconBadge}>
                                {viewOnceLoading
                                    ? <ActivityIndicator color={colors.primary} size="small" />
                                    : <ViewOnceIcon size={scale(28)} color={colors.primary} active={true} />}
                            </View>
                            <View style={styles.viewOnceTextWrap}>
                                <Text variant="body-sm" className="font-body-bold" numberOfLines={1} style={{ color: colors.text }}>
                                    {translateChatText('view_once_photo', 'View once photo')}
                                </Text>
                                <Text variant="caption" numberOfLines={1} style={{ color: colors.muted }}>
                                    {mine
                                        ? translateChatText('sent', 'Sent')
                                        : media?.viewedAt
                                            ? translateChatText('viewed', 'Viewed')
                                            : translateChatText('tap_to_open', 'Tap to open')}
                                </Text>
                            </View>
                        </Pressable>
                    )}

                    {hasVoice && (
                        <VoiceMessage message={message} media={media} mine={mine} colors={colors} userId={userId} />
                    )}

                    {!!messageText(message) && (
                        <Text variant="body" style={[styles.messageText, { color: colors.text }]}>
                            {messageText(message)}
                        </Text>
                    )}

                            <View style={styles.timeRow}>
                                <Text variant="caption" style={{ color: colors.muted, fontSize: scale(10), lineHeight: scale(12) }}>
                                    {formatMessageTime(message.createdAt)}
                                </Text>
                                {mine && !message.pending && (
                                    message.seenAt
                                        ? <CheckCheck size={scale(12)} color="#38BDF8" />
                                        : message.deliveredAt
                                            ? <CheckCheck size={scale(12)} color={colors.muted} />
                                            : <Check size={scale(12)} color={colors.muted} />
                                )}
                                {mine && message.pending && (
                                    <Text variant="caption" style={{ color: colors.muted, fontSize: scale(9), lineHeight: scale(11) }}>
                                        {t('chat:sending', 'Sending...')}
                                    </Text>
                                )}
                                {message.failed && (
                                    <Text variant="caption" className="font-body-bold" style={{ color: colors.danger }}>!</Text>
                                )}
                            </View>
                        </View>
                    </Pressable>
                </Animated.View>
                {reactions.length > 0 && (
                    <View style={styles.reactionWrap}>
                        {reactions.map((reaction, index) => {
                            const emoji = reactionEmoji(reaction);
                            if (!emoji) return null;
                            return (
                                <Reanimated.View
                                    key={`${reaction.user || 'reaction'}-${emoji}-${index}`}
                                    entering={ZoomIn.springify().damping(14)}
                                    exiting={ZoomOut.duration(150)}
                                    style={[styles.reactionPill, { backgroundColor: colors.card, borderColor: colors.border }]}
                                >
                                    <Text style={styles.reactionText}>{emoji}</Text>
                                </Reanimated.View>
                            );
                        })}
                    </View>
                )}
                </View>
        </Reanimated.View>
    );
}

const MessageBubble = React.memo(MessageBubbleComponent);

function CachedImageMessageComponent({
    message,
    media,
    userId,
    onOpenImage,
}: {
    message: ChatMessage;
    media: MessageMedia;
    userId: string;
    onOpenImage: (url: string) => void;
}) {
    const toast = useToast();
    const palette = useColors();
    const [displayUri, setDisplayUri] = useState(media.thumbnail || media.url || '');
    const [cachedUri, setCachedUri] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        let disposed = false;
        (async () => {
            const cached = await getCachedChatMedia({
                userId,
                conversationId: message.conversationId,
                messageId: message.id,
                media,
                kind: 'image',
            }).catch(() => null);
            if (!disposed && cached?.cached) {
                setDisplayUri(cached.uri);
                setCachedUri(cached.uri);
            }
        })();
        return () => {
            disposed = true;
        };
    }, [media, message.conversationId, message.id, userId]);

    const open = async () => {
        if (cachedUri) {
            onOpenImage(cachedUri);
            return;
        }
        setLoading(true);
        try {
            const cached = await cacheChatMedia({
                userId,
                conversationId: message.conversationId,
                messageId: message.id,
                media,
                kind: 'image',
            });
            setCachedUri(cached.uri);
            setDisplayUri(cached.uri);
            onOpenImage(cached.uri);
        } catch {
            toast.show(translateChatText('media_download_failed', 'Could not download media. Please try again.'), 'error');
        } finally {
            setLoading(false);
        }
    };

    return (
        <PressableScale onPress={open} style={styles.mediaWrap}>
            <Image source={{ uri: displayUri }} style={styles.mediaImage} contentFit="cover" transition={150} />
            {(!cachedUri || loading) && (
                <View style={styles.mediaDownloadOverlay}>
                    {loading ? <ActivityIndicator color={palette.chrome.common.inverseText} /> : <Download size={scale(18)} color={palette.chrome.common.inverseText} />}
                </View>
            )}
        </PressableScale>
    );
}

const CachedImageMessage = React.memo(CachedImageMessageComponent);

function VoiceMessageComponent({
    message,
    media,
    mine,
    colors,
    userId,
}: {
    message: ChatMessage;
    media?: MessageMedia | null;
    mine: boolean;
    colors: Record<string, string>;
    userId: string;
}) {
    const toast = useToast();
    const [audioUri, setAudioUri] = useState<string | null>(null);
    const [downloading, setDownloading] = useState(false);
    const [playAfterLoad, setPlayAfterLoad] = useState(false);
    const player = useAudioPlayer(audioUri, { updateInterval: 250 });
    const status = useAudioPlayerStatus(player);
    const progress = status.duration > 0 ? Math.min(1, status.currentTime / status.duration) : 0;
    const displaySeconds = Math.max(0, Math.round(status.playing ? status.currentTime : status.duration || media?.duration || status.currentTime || 0));

    useEffect(() => {
        let disposed = false;
        (async () => {
            const cached = await getCachedChatMedia({
                userId,
                conversationId: message.conversationId,
                messageId: message.id,
                media,
                kind: 'voice',
            }).catch(() => null);
            if (!disposed && cached?.cached) setAudioUri(cached.uri);
        })();
        return () => {
            disposed = true;
        };
    }, [media, message.conversationId, message.id, userId]);

    useEffect(() => {
        if (playAfterLoad && audioUri && status.isLoaded) {
            try {
                player.play();
            } catch {
                // The native audio object can be released during fast navigation.
            }
            setPlayAfterLoad(false);
        }
    }, [audioUri, playAfterLoad, player, status.isLoaded]);

    const toggle = async () => {
        try {
            if (status.playing) {
                await player.pause();
                return;
            }

            if (status.didJustFinish) {
                await player.seekTo(0).catch(() => undefined);
            }

            if (audioUri && status.isLoaded) {
                await player.play();
                return;
            }
        } catch {
            toast.show(translateChatText('media_playback_failed', 'Could not play this voice note. Please try again.'), 'error');
            return;
        }

        setDownloading(true);
        try {
            const cached = await cacheChatMedia({
                userId,
                conversationId: message.conversationId,
                messageId: message.id,
                media,
                kind: 'voice',
            });
            setAudioUri(cached.uri);
            setPlayAfterLoad(true);
        } catch {
            toast.show(translateChatText('media_download_failed', 'Could not download media. Please try again.'), 'error');
        } finally {
            setDownloading(false);
        }
    };

    return (
        <Pressable onPress={toggle} style={styles.voiceWrap}>
            <View style={styles.voicePlayButton}>
                {downloading || status.isBuffering
                    ? <ActivityIndicator color={colors.inverse} size="small" />
                    : status.playing
                        ? <Pause size={scale(14)} color={colors.inverse} fill={colors.inverse} />
                        : <Play size={scale(14)} color={colors.inverse} fill={colors.inverse} />}
            </View>
            <View style={styles.voiceProgressTrack}>
                <View style={styles.wave}>
                    {Array.from({ length: VOICE_WAVE_BAR_COUNT }).map((_, index) => (
                        <View
                            key={`voice-${message.id}-${index}`}
                            style={[
                                styles.waveBar,
                                {
                                    height: scale(7 + ((index * 5) % 18)),
                                    backgroundColor: progress * VOICE_WAVE_BAR_COUNT >= index ? colors.primary : colors.waveMuted,
                                },
                            ]}
                        />
                    ))}
                </View>
            </View>
            <View style={styles.voiceDurationRow}>
                <Text variant="caption" className="font-body-semi" numberOfLines={1} style={[styles.voiceDuration, { color: colors.muted }]}>
                    {formatDuration(displaySeconds)}
                </Text>
            </View>
        </Pressable>
    );
}

const VoiceMessage = React.memo(VoiceMessageComponent);

function formatDuration(seconds: number) {
    const safe = Math.max(0, Math.round(seconds || 0));
    const m = Math.floor(safe / 60);
    const s = safe % 60;
    return `${m}:${String(s).padStart(2, '0')}`;
}

const styles = StyleSheet.create({
    screen: { flex: 1 },
    messageListWrap: { flex: 1, backgroundColor: 'transparent' },
    scrollDownButton: {
        position: 'absolute',
        right: scale(14),
        bottom: scale(14),
        width: scale(42),
        height: scale(42),
        borderRadius: scale(21),
        borderWidth: StyleSheet.hairlineWidth,
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: '#000000',
        shadowOpacity: 0.18,
        shadowRadius: scale(6),
        shadowOffset: { width: 0, height: 2 },
        elevation: 4,
    },
    scrollDownPress: {
        width: '100%',
        height: '100%',
        alignItems: 'center',
        justifyContent: 'center',
    },
    scrollDownBadge: {
        position: 'absolute',
        top: -scale(4),
        right: -scale(4),
    },
    center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    header: {
        minHeight: scale(56),
        flexDirection: 'row',
        alignItems: 'stretch',
        paddingHorizontal: scale(8),
        paddingVertical: scale(8),
        borderBottomWidth: StyleSheet.hairlineWidth,
    },
    headerIcon: {
        width: scale(40),
        height: scale(40),
        borderRadius: scale(20),
        alignItems: 'center',
        justifyContent: 'center',
        alignSelf: 'center',
    },
    headerProfileTarget: {
        flex: 1,
        maxWidth: '72%',
        minWidth: 0,
        alignSelf: 'stretch',
        justifyContent: 'center',
        paddingVertical: scale(2),
        paddingHorizontal: scale(4),
    },
    headerProfileContent: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        alignSelf: 'stretch',
        minWidth: 0,
        width: '100%',
    },
    headerAvatar: {
        width: scale(40),
        height: scale(40),
        borderRadius: scale(20),
        borderWidth: StyleSheet.hairlineWidth,
        overflow: 'hidden',
        marginRight: scale(12),
    },
    headerText: { flex: 1, minWidth: scale(90), justifyContent: 'center' },
    headerNameText: { fontSize: scale(15), lineHeight: scale(18), fontWeight: '700', includeFontPadding: false, textAlignVertical: 'center' },
    headerStatusText: { marginTop: scale(2), fontSize: scale(12), lineHeight: scale(14), fontWeight: '400', includeFontPadding: false },
    headerSpacer: { flex: 1, minWidth: 0, alignSelf: 'stretch' },
    empty: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingBottom: scale(80) },
    dateWrap: { alignItems: 'center', marginVertical: scale(8) },
    dateLabel: { paddingHorizontal: scale(12), paddingVertical: scale(5), borderRadius: scale(14), overflow: 'hidden', textTransform: 'uppercase' },
    bubbleRow: { width: '100%', marginBottom: scale(14) },
    bubbleLeft: { alignItems: 'flex-start' },
    bubbleRight: { alignItems: 'flex-end' },
    swipeReplyWrap: { position: 'relative', maxWidth: '78%' },
    swipeReplyBubble: { zIndex: 2 },
    swipeReplyHint: {
        position: 'absolute',
        left: scale(16),
        top: '50%',
        width: scale(34),
        height: scale(34),
        borderRadius: scale(17),
        backgroundColor: 'rgba(243,75,111,0.10)',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1,
    },
    swipeReplyHintMine: { left: scale(10) },
    swipeReplyHintTheir: { left: scale(10) },
    bubble: {
        width: '100%',
        minWidth: scale(104),
        borderRadius: scale(14),
        paddingHorizontal: scale(12),
        paddingTop: scale(8),
        paddingBottom: scale(7),
        borderWidth: StyleSheet.hairlineWidth,
    },
    mineBubble: { borderBottomRightRadius: scale(6) },
    theirBubble: { borderBottomLeftRadius: scale(6) },
    messageText: { fontSize: scale(15), lineHeight: scale(20) },
    timeRow: { alignSelf: 'flex-end', flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: scale(4), marginTop: scale(6), minHeight: scale(14) },
    systemWrap: { alignItems: 'center', marginVertical: scale(7) },
    systemText: { paddingHorizontal: scale(12), paddingVertical: scale(5), borderRadius: scale(14), overflow: 'hidden' },
    unsentBubble: { borderWidth: StyleSheet.hairlineWidth, borderStyle: 'dashed', borderRadius: scale(14), paddingHorizontal: scale(12), paddingVertical: scale(8) },
    mediaWrap: { overflow: 'hidden', borderRadius: scale(9), marginBottom: scale(5), backgroundColor: '#E2E8F0' },
    mediaImage: { width: scale(220), height: scale(220) },
    viewOnceButton: {
        minWidth: scale(210),
        minHeight: scale(54),
        borderRadius: scale(14),
        flexDirection: 'row',
        alignItems: 'center',
        gap: scale(10),
        paddingHorizontal: scale(11),
        paddingVertical: scale(8),
        marginBottom: scale(4),
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: 'rgba(148,163,184,0.24)',
    },
    viewOnceIconBadge: {
        width: scale(34),
        height: scale(34),
        borderRadius: scale(17),
        backgroundColor: 'rgba(243,75,111,0.12)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    viewOnceTextWrap: { flex: 1, minWidth: 0, gap: scale(2) },
    mediaDownloadOverlay: {
        position: 'absolute',
        right: scale(8),
        bottom: scale(8),
        width: scale(34),
        height: scale(34),
        borderRadius: scale(17),
        backgroundColor: 'rgba(15,23,42,0.70)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    voiceWrap: { width: '100%', minWidth: scale(230), borderRadius: scale(12), paddingVertical: scale(2), flexDirection: 'row', alignItems: 'center', gap: scale(8), marginBottom: scale(2) },
    voicePlayButton: {
        width: scale(32),
        height: scale(32),
        borderRadius: scale(16),
        backgroundColor: PRIMARY,
        alignItems: 'center',
        justifyContent: 'center',
    },
    voiceProgressTrack: { flex: 1, minWidth: scale(90), height: scale(32), justifyContent: 'center', position: 'relative' },
    wave: { flex: 1, height: scale(30), flexDirection: 'row', alignItems: 'center', gap: scale(2) },
    waveBar: { flex: 1, maxWidth: scale(4), borderRadius: scale(2) },
    voiceDurationRow: { minWidth: scale(36), flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end' },
    voiceDuration: { minWidth: scale(28), textAlign: 'right', fontSize: scale(11), lineHeight: scale(14) },
    requestBar: { alignItems: 'center', justifyContent: 'center', paddingHorizontal: scale(14), paddingTop: scale(10) },
    requestHint: { marginBottom: scale(9), fontSize: scale(12), lineHeight: scale(15) },
    requestActions: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: scale(10) },
    requestButton: { minWidth: scale(110), height: scale(36), borderRadius: scale(18), paddingHorizontal: scale(16), flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: scale(6) },
    requestPrimary: { backgroundColor: PRIMARY },
    requestNeutral: { backgroundColor: '#FFFFFF', borderWidth: StyleSheet.hairlineWidth, borderColor: '#CBD5E1' },
    disabledButton: { opacity: 0.62 },
    endedBar: { padding: scale(13) },
    composer: {},
    composerRow: { flexDirection: 'row', alignItems: 'flex-end', gap: scale(8), paddingHorizontal: scale(8), paddingVertical: scale(8) },
    replyComposerBar: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: scale(8),
        paddingHorizontal: scale(12),
        paddingVertical: scale(8),
        borderBottomWidth: StyleSheet.hairlineWidth,
    },
    replyComposerQuote: {
        flex: 1,
        minWidth: 0,
        borderLeftWidth: scale(3),
        paddingLeft: scale(8),
        gap: scale(2),
    },
    replyComposerClose: { width: scale(28), height: scale(28), borderRadius: scale(14), alignItems: 'center', justifyContent: 'center' },
    toolButton: {
        width: scale(40),
        height: scale(40),
        borderRadius: scale(20),
        borderWidth: StyleSheet.hairlineWidth,
        alignItems: 'center',
        justifyContent: 'center',
    },
    recordingButton: { backgroundColor: PRIMARY },
    input: {
        flex: 1,
        minHeight: scale(40),
        maxHeight: scale(120),
        borderRadius: scale(18),
        borderWidth: StyleSheet.hairlineWidth,
        paddingHorizontal: scale(12),
        paddingTop: scale(9),
        paddingBottom: scale(8),
        fontSize: scale(14),
        lineHeight: scale(18),
    },
    send: {
        width: scale(40),
        height: scale(40),
        borderRadius: scale(20),
        alignItems: 'center',
        justifyContent: 'center',
    },
    voiceRecorderPanel: { gap: scale(9), paddingTop: scale(2) },
    voiceRecorderHeader: { minHeight: scale(32), flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    voiceRecorderTimer: { flexDirection: 'row', alignItems: 'center', gap: scale(6) },
    recordDot: { width: scale(8), height: scale(8), borderRadius: scale(4), backgroundColor: PRIMARY },
    voiceRecorderClose: { width: scale(32), height: scale(32), borderRadius: scale(16), alignItems: 'center', justifyContent: 'center' },
    voiceRecorderWaveSurface: {
        height: scale(46),
        borderRadius: scale(23),
        paddingHorizontal: scale(12),
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: scale(3),
        overflow: 'hidden',
    },
    voiceRecorderWaveBar: { width: scale(3), borderRadius: scale(2) },
    voiceRecorderPreview: {
        height: scale(50),
        borderRadius: scale(25),
        paddingLeft: scale(8),
        paddingRight: scale(12),
        flexDirection: 'row',
        alignItems: 'center',
        gap: scale(9),
    },
    voiceRecorderPreviewPlay: {
        width: scale(34),
        height: scale(34),
        borderRadius: scale(17),
        backgroundColor: PRIMARY,
        alignItems: 'center',
        justifyContent: 'center',
    },
    voiceRecorderPreviewTrack: { flex: 1, height: scale(32), justifyContent: 'center' },
    voiceRecorderActions: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: scale(10) },
    voiceRecorderSecondary: {
        height: scale(40),
        borderRadius: scale(20),
        paddingHorizontal: scale(14),
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: scale(6),
    },
    voiceRecorderPrimary: {
        minWidth: scale(104),
        height: scale(40),
        borderRadius: scale(20),
        paddingHorizontal: scale(16),
        backgroundColor: PRIMARY,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: scale(7),
    },
    voiceRecorderPrimaryText: { color: '#FFFFFF' },
    previewModal: { flex: 1, backgroundColor: 'rgba(0,0,0,0.96)', alignItems: 'center', justifyContent: 'center' },
    modalClose: { position: 'absolute', right: scale(16), zIndex: 5, width: scale(42), height: scale(42), borderRadius: scale(21), backgroundColor: 'rgba(255,255,255,0.12)', alignItems: 'center', justifyContent: 'center' },
    countdown: { position: 'absolute', left: scale(16), zIndex: 5, paddingHorizontal: scale(12), paddingVertical: scale(5), borderRadius: scale(14), backgroundColor: 'rgba(255,255,255,0.12)' },
    previewImage: { width: '92%', height: '82%' },
    menuLayer: {
        position: 'absolute',
        top: 0,
        right: 0,
        bottom: 0,
        left: 0,
        justifyContent: 'flex-start',
    },
    menuBackdrop: {
        position: 'absolute',
        top: 0,
        right: 0,
        bottom: 0,
        left: 0,
        backgroundColor: 'rgba(15,23,42,0.28)',
    },
    conversationMenu: {
        position: 'absolute',
        right: scale(12),
        width: scale(286),
        borderRadius: scale(14),
        borderWidth: StyleSheet.hairlineWidth,
        overflow: 'hidden',
        shadowColor: '#000000',
        shadowOpacity: 0.16,
        shadowRadius: scale(18),
        shadowOffset: { width: 0, height: scale(10) },
        elevation: 12,
    },
    conversationMenuHeader: {
        height: scale(48),
        paddingLeft: scale(16),
        paddingRight: scale(8),
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        borderBottomWidth: StyleSheet.hairlineWidth,
    },
    menuClose: {
        width: scale(36),
        height: scale(36),
        borderRadius: scale(18),
        alignItems: 'center',
        justifyContent: 'center',
    },
    conversationMenuItem: {
        height: scale(52),
        paddingHorizontal: scale(16),
        justifyContent: 'center',
    },
    conversationMenuItemRow: {
        width: '100%',
        flexDirection: 'row',
        alignItems: 'center',
    },
    conversationMenuIcon: {
        width: scale(24),
        height: scale(24),
        marginRight: scale(12),
        alignItems: 'center',
        justifyContent: 'center',
    },
    conversationMenuLabel: {
        flex: 1,
        fontSize: scale(14),
        lineHeight: scale(18),
        fontWeight: '400',
    },
    conversationMenuItemPressed: {
        backgroundColor: 'rgba(148,163,184,0.12)',
    },
    conversationMenuLinks: {
        paddingHorizontal: scale(10),
        paddingTop: scale(8),
        paddingBottom: scale(12),
        gap: scale(14),
    },
    messageMenuLayer: {
        flex: 1,
        justifyContent: 'flex-end',
    },
    messageMenuBackdrop: {
        position: 'absolute',
        top: 0,
        right: 0,
        bottom: 0,
        left: 0,
        backgroundColor: 'rgba(15,23,42,0.35)',
    },
    messageMenuSheet: {
        borderTopLeftRadius: scale(18),
        borderTopRightRadius: scale(18),
        paddingHorizontal: scale(12),
        paddingTop: scale(10),
        gap: scale(14),
        shadowColor: '#000000',
        shadowOpacity: 0.18,
        shadowRadius: scale(20),
        shadowOffset: { width: 0, height: -scale(8) },
        elevation: 18,
    },
    quickReactionRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        borderRadius: scale(22),
        paddingHorizontal: scale(5),
        paddingVertical: scale(5),
        marginBottom: scale(8),
        backgroundColor: 'rgba(148,163,184,0.12)',
    },
    quickReactionButton: {
        width: scale(42),
        height: scale(38),
        borderRadius: scale(19),
        alignItems: 'center',
        justifyContent: 'center',
    },
    quickReactionPressed: { backgroundColor: 'rgba(148,163,184,0.18)' },
    quickReactionText: { fontSize: scale(22), lineHeight: scale(26) },
    messageActionItem: {
        width: '100%',
        minHeight: scale(52),
        paddingHorizontal: scale(14),
        borderRadius: scale(10),
        justifyContent: 'center',
    },
    messageActionItemRow: {
        width: '100%',
        flexDirection: 'row',
        alignItems: 'center',
        gap: scale(12),
    },
    messageActionIcon: {
        width: scale(24),
        height: scale(24),
        alignItems: 'center',
        justifyContent: 'center',
    },
    messageActionLabel: { flexGrow: 1, flexShrink: 1, minWidth: scale(120), fontSize: scale(14), lineHeight: scale(18), fontWeight: '400' },
    messageActionPressed: { backgroundColor: 'rgba(148,163,184,0.12)' },
    replyQuote: {
        borderLeftWidth: scale(3),
        borderRadius: scale(8),
        paddingHorizontal: scale(8),
        paddingVertical: scale(6),
        marginBottom: scale(7),
    },
    reactionWrap: {
        position: 'absolute',
        left: scale(10),
        bottom: -scale(10),
        alignSelf: 'flex-start',
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: scale(2),
        zIndex: 4,
    },
    reactionPill: {
        minWidth: scale(20),
        height: scale(20),
        borderRadius: scale(10),
        paddingHorizontal: scale(2),
        paddingVertical: scale(2),
        borderWidth: StyleSheet.hairlineWidth,
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: '#000000',
        shadowOpacity: 0.08,
        shadowRadius: scale(3),
        shadowOffset: { width: 0, height: scale(1) },
        elevation: 1,
    },
    reactionText: { fontSize: scale(12), lineHeight: scale(13) },
});
