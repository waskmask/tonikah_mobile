import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
    ActivityIndicator,
    AppState,
    Animated,
    FlatList,
    Image as RNImage,
    Modal,
    NativeScrollEvent,
    NativeSyntheticEvent,
    Platform,
    Pressable,
    StyleProp,
    StyleSheet,
    Text as RNText,
    type TextStyle,
    TextInput,
    View,
    type ViewToken,
    ViewStyle,
} from 'react-native';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system/legacy';
import * as Clipboard from 'expo-clipboard';
import {
    requestRecordingPermissionsAsync,
    useAudioPlayer,
    useAudioPlayerStatus,
} from 'expo-audio';
import { WaveformRecorderView, type WaveformRecorderCompleteEvent, type WaveformRecorderState, type WaveformRecorderViewRef } from 'react-native-waveform-recorder';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { Bell, BellOff, Camera, Check, CheckCheck, Copy, Download, Flag, Image as ImageIcon, Mic, MoreVertical, Pause, Play, Reply, Trash2, Undo2, X, XCircle } from '@/components/ui/icons/PhosphorCompat';
import { CaretDoubleDown, CaretLeft, CaretRight, PaperPlaneTilt } from 'phosphor-react-native';
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
import { useChatScrollAnchor } from '@/hooks/useChatScrollAnchor';
import { clearAllCachedMessages, loadCachedMessages, saveCachedMessages } from '@/lib/chatCache';
import { useConversationKeyboardMode } from '@/hooks/useConversationKeyboardMode';
import { BRAND_PRIMARY } from '@/constants/Colors';
import { PressableScale } from '@/components/ui/PressableScale';
import { ChatDoodleBackground } from '@/components/chat/ChatDoodleBackground';
import { KeyboardController } from 'react-native-keyboard-controller';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import BottomSheet, { BottomSheetBackdrop, BottomSheetBackdropProps, BottomSheetView } from '@gorhom/bottom-sheet';
import Reanimated, {
    Easing,
    FadeInDown,
    type SharedValue,
    ZoomIn,
    ZoomOut,
    useAnimatedStyle,
    useSharedValue,
    withRepeat,
    withSpring,
    withTiming,
} from 'react-native-reanimated';
import { useChatSocket } from '@/hooks/useChatSocket';
import { scale } from '@/hooks/useResponsive';
import { Typography } from '@/constants/typography';
import { cacheChatMedia, clearChatMediaCache, deleteCachedChatMediaForMessage, getCachedChatMedia, pinCachedChatMedia, storeLocalChatMedia, unpinCachedChatMedia } from '@/lib/chatMediaCache';
import { claimChatAudioPlayback, createChatAudioPlaybackOwner, releaseChatAudioPlayback } from '@/lib/chatAudioPlayback';
import { waveformPeaks } from '@/lib/chatWaveform';
import { translateChatText } from '@/lib/chatDisplay';
import { ImageAttachmentComposer } from '@/components/chat/ImageAttachmentComposer';
import { GalleryCropModal } from '@/components/app/GalleryCropModal';
import { GalleryRevealControl } from '@/components/chat/GalleryRevealControl';
import { ChatKeyboardAvoider, ChatComposerBar } from '@/components/chat/ChatKeyboardFooter';
import { ViewOnceIcon } from '@/components/chat/ViewOnceIcon';
import { UnreadBadge } from '@/components/ui/UnreadBadge';
import { ConfirmSheet } from '@/components/ui/ConfirmSheet';
import { UserProfileSheet } from '@/components/profile/UserProfileSheet';
import { ReportSheet, type ReportTarget } from '@/components/profile/ReportSheet';
import { profileId } from '@/lib/exploreProfile';
import { routeParam } from '@/lib/routeParams';
import { QualifiedPhotoRequiredNotice } from '@/components/app/QualifiedPhotoRequiredNotice';
import { EmailVerificationRequiredBanner } from '@/components/app/EmailVerificationRequiredBanner';
import { useMessagingAccessExpiry, useMessagingEligibilityStatus } from '@/hooks/useCurrentUserStatus';
import { useConnectivity } from '@/hooks/useConnectivity';
import { MessagingMembershipGate } from '@/components/membership/MessagingMembershipGate';
import { canOpenMessaging } from '@/lib/messagingAccess';
import { queryClient } from '@/lib/queryClient';
import { queryKeys } from '@/lib/queryKeys';
import { applyAcceptedConversation, applyConversationStateById, loadCachedInbox, markCachedConversationRead, type CachedInbox } from '@/lib/chatInboxCache';
import { CURRENT_USER_STATUS_QUERY_KEY, type CurrentUserStatus } from '@/hooks/useCurrentUserStatus';
import {
    enqueueOfflineTextMessage,
    flushOfflineMessageQueue,
    queuedMessagesForConversation,
    subscribeOfflineMessageQueue,
} from '@/lib/offlineMessageQueue';

const PRIMARY = BRAND_PRIMARY;
const CHAT_ONE_LINE_BUBBLE_SCROLL_THRESHOLD = scale(69);
const QUICK_REACTIONS = ['👍', '❤️', '😂', '😮', '😢', '🙏'];
const UNSEND_WINDOW_MIN = 15;
const VOICE_WAVE_BAR_COUNT = 64;
const VOICE_MESSAGE_WAVE_BAR_COUNT = 32;
const MAX_VOICE_RECORDING_SECONDS = 60;
const MAX_CHAT_IMAGE_BYTES = 10 * 1024 * 1024;
type ListItem =
    | { kind: 'date'; id: string; label: string }
    | { kind: 'message'; id: string; message: ChatMessage };

type PendingImageAttachment = {
    uri: string;
    name: string;
    type: string;
    clientMessageId: string;
};

function newMediaMessageId() {
    return `media-${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;
}

function messageId(message: ChatMessage) {
    return String(message.id || message._id || message.tempId || '');
}

function messageText(message: ChatMessage) {
    return message.content || message.text || '';
}

const RTL_STRONG_CHARACTER = /[\u05D0-\u05EA\u05F0-\u05F2\u0620-\u063F\u0641-\u064A\u066E-\u066F\u0671-\u06D3\u06D5\u06EE-\u06EF\u06FA-\u06FC\u06FF\uFB1D-\uFDFD\uFE70-\uFEFC]/;
const LTR_STRONG_CHARACTER = /[A-Za-z\u00C0-\u00D6\u00D8-\u00F6\u00F8-\u02AF\u0370-\u052F]/;

function directionalTextStyle(value: string): Pick<TextStyle, 'textAlign' | 'writingDirection'> {
    for (const character of value) {
        if (RTL_STRONG_CHARACTER.test(character)) {
            return { textAlign: 'right', writingDirection: 'rtl' };
        }
        if (LTR_STRONG_CHARACTER.test(character)) {
            return { textAlign: 'left', writingDirection: 'ltr' };
        }
    }
    return { textAlign: 'left', writingDirection: 'ltr' };
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

function conversationFromInbox(inbox: CachedInbox | null | undefined, conversationId: string) {
    if (!inbox || !conversationId || conversationId === 'new') return null;
    return inbox.conversations.find((item) => item.id === conversationId)
        || inbox.requests.find((item) => item.id === conversationId)
        || inbox.sent.find((item) => item.id === conversationId)
        || null;
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
    const eligibility = useMessagingEligibilityStatus();
    useMessagingAccessExpiry();
    const emailVerified = eligibility.data
        ? eligibility.emailVerified
        : Boolean(user?.email_verified ?? user?.emailVerified);
    const emailBlocked = !eligibility.isLoading && !emailVerified;
    const membershipBlocked = emailVerified
        && eligibility.messagingAccess?.required === true
        && !canOpenMessaging(eligibility.messagingAccess);
    const membershipAccessUnavailable = !eligibility.isLoading
        && !emailBlocked
        && eligibility.isError
        && !eligibility.messagingAccess;
    const showPhotoGate =
        !eligibility.isLoading &&
        !eligibility.isError &&
        !eligibility.hasQualifiedPhoto;
    const reconcilePhotoEligibility = (response?: unknown) => {
        const code = (response as { code?: string } | undefined)?.code;
        if (code === 'QUALIFIED_PHOTO_REQUIRED') {
            void eligibility.refetch();
        }
    };
    const reconcileMembershipEligibility = (response?: unknown) => {
        const data = response as { code?: string; messagingAccess?: CurrentUserStatus['messagingAccess']; trialOffer?: CurrentUserStatus['trialOffer'] } | undefined;
        if (data?.code !== 'MEMBERSHIP_REQUIRED') return false;
        queryClient.setQueryData<CurrentUserStatus>(CURRENT_USER_STATUS_QUERY_KEY, (current) => ({
            ...(current || {}),
            messagingAccess: data.messagingAccess,
            trialOffer: data.trialOffer,
        }));
        return true;
    };
    const { isDark } = useTheme();
    const palette = useColors();
    const { currentLanguage, isRTL } = useLanguage();
    const { status: connectivityStatus, isOffline } = useConnectivity();
    const toast = useToast();
    const { lightImpact } = useHaptics();
    const insets = useSafeAreaInsets();
    useConversationKeyboardMode();
    const inputFontFamily = currentLanguage === 'ar' ? Typography.font.arabic.regular : Typography.font.body.regular;
    const listRef = useRef<FlatList<ListItem>>(null);
    const { isNearBottomRef } = useChatScrollAnchor<ListItem>();
    const initialPositionPendingRef = useRef(true);
    const initialFreshPositionPendingRef = useRef(true);
    const pendingAutoScrollRef = useRef(false);
    const freshMessagesLoadedRef = useRef(false);
    const readInFlightRef = useRef(false);
    const incomingGenerationRef = useRef(0);
    const activeReadIdRef = useRef(id);
    activeReadIdRef.current = id;
    const screenFocusedRef = useRef(false);
    const viewableMessageIdsRef = useRef<Set<string>>(new Set());
    const latestIncomingIdRef = useRef<string | null>(null);
    const tryMarkVisibleUnreadRef = useRef<() => void>(() => undefined);
    const receivedAwayIdsRef = useRef<Set<string>>(new Set());
    const knownMessageIdsRef = useRef<Set<string>>(new Set());
    // Holds the live socket API so scroll/seen helpers stay referentially stable
    // (the socket object is recreated on render).
    const socketRef = useRef<{
        markSeen: (id?: string | null) => void;
        sendTyping: (recipientId?: string | null) => void;
        stopTyping: (recipientId?: string | null) => void;
    } | null>(null);
    // True when messages arrived from the peer while the user was scrolled up;
    // we defer marking them seen until they're actually brought into view.
    const pendingSeenRef = useRef(false);
    const [conversation, setConversation] = useState<Conversation | null>(() => (
        conversationFromInbox(queryClient.getQueryData<CachedInbox>(queryKeys.chat.inbox), id)
    ));
    const acceptedConversationRef = useRef<string | null>(null);
    const acceptedRefConversationId = useRef<string | null>(null);
    const [metadataUnavailable, setMetadataUnavailable] = useState(false);
    const [items, setItems] = useState<ChatMessage[]>([]);
    const [nextCursor, setNextCursor] = useState<string | null>(null);
    const [content, setContent] = useState('');
    const [loading, setLoading] = useState(id !== 'new');
    const [loadingMore, setLoadingMore] = useState(false);
    const [sending, setSending] = useState(false);
    const [uploadingMedia, setUploadingMedia] = useState(false);
    const [recordingBusy, setRecordingBusy] = useState(false);
    const [voicePanelOpen, setVoicePanelOpen] = useState(false);
    const [voicePreview, setVoicePreview] = useState<{ uri: string; duration: number; clientMessageId: string } | null>(null);
    const voiceUploadedMediaRef = useRef<{ id: string; media: MessageMedia } | null>(null);
    const voiceCopyGenerationRef = useRef(0);
    const imageUploadedMediaRef = useRef<{ id: string; viewOnce: boolean; media: MessageMedia } | null>(null);
    const mediaSendLockRef = useRef(false);
    const [voiceWaveform, setVoiceWaveform] = useState<number[]>([]);
    const [voiceSendFailed, setVoiceSendFailed] = useState(false);
    const sendAfterFinalizeRef = useRef(false);
    const [voiceSending, setVoiceSending] = useState(false);
    const [requestBusy, setRequestBusy] = useState(false);
    const [viewOnce, setViewOnce] = useState<{ url: string; messageId: string; seconds: number } | null>(null);
    const [viewOnceLoadingId, setViewOnceLoadingId] = useState<string | null>(null);
    const [imagePreview, setImagePreview] = useState<string | null>(null);
    const [imageAttachment, setImageAttachment] = useState<PendingImageAttachment | null>(null);
    const originalImageAttachmentRef = useRef<PendingImageAttachment | null>(null);
    const [cropOpen, setCropOpen] = useState(false);
    const [imageCaption, setImageCaption] = useState('');
    const [imageViewOnce, setImageViewOnce] = useState(false);
    const [menuOpen, setMenuOpen] = useState(false);
    const [menuBusy, setMenuBusy] = useState(false);
    const [conversationConfirmation, setConversationConfirmation] = useState<'end' | 'delete' | null>(null);
    const [messagesReady, setMessagesReady] = useState(false);
    const [showScrollDown, setShowScrollDown] = useState(false);
    const [unseenWhileAway, setUnseenWhileAway] = useState(0);
    const [chatFooterHeight, setChatFooterHeight] = useState(scale(72));
    const [profileSheetOpen, setProfileSheetOpen] = useState(false);
    const [selectedMessage, setSelectedMessage] = useState<ChatMessage | null>(null);
    const [reportTarget, setReportTarget] = useState<ReportTarget | null>(null);
    const [messageActionBusy, setMessageActionBusy] = useState(false);
    const [replyTo, setReplyTo] = useState<ChatMessage | null>(null);
    const prevNewestMessageIdRef = useRef('');
    const [peerTyping, setPeerTyping] = useState(false);
    const peerTypingClearRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const typingActiveRef = useRef(false);
    const typingStopTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const previousConnectivityRef = useRef(connectivityStatus);

    const colors = useMemo(() => ({
        bg: palette.brand.bg.surface,
        body: palette.brand.bg.primary,
        card: palette.chrome.common.card,
        surface: palette.chrome.common.cardAlt,
        text: palette.chrome.common.textStrong,
        muted: palette.brand.text.subtitle,
        subtle: palette.brand.text.muted,
        border: palette.brand.bg.border,
        primary: palette.chrome.primary,
        primaryEnd: palette.chrome.primaryEnd,
        primaryTint: palette.chrome.common.primaryTint,
        bubbleMine: palette.chrome.common.bubbleMine,
        bubbleMineText: palette.chrome.common.bubbleMineText,
        bubbleMineMuted: palette.chrome.common.bubbleMineMuted,
        bubbleMineBorder: palette.chrome.common.bubbleMineBorder,
        bubbleMineInset: palette.chrome.common.bubbleMineInset,
        primaryRing: palette.chrome.common.primaryRing,
        inverse: palette.chrome.common.inverseText,
        danger: palette.brand.accent.error,
        success: palette.chrome.common.successStrong,
        waveMuted: palette.chrome.common.iconNeutral,
        blueAction: palette.chrome.common.blueAction,
        seenTick: palette.chrome.common.seenTick,
    }), [palette]);

    // Preserves the swipe-back/slide animation when we arrived from messages;
    // falls back to replace for deep-link / push-notification entries with no history.
    const goBackToMessages = useCallback(() => {
        if (router.canGoBack()) router.back();
        else router.replace('/(tabs)/messages' as any);
    }, []);

    // Inverted list: the newest message lives at offset 0 (the visual bottom),
    // so "scroll to latest" is just a jump to offset 0 — instant and reliable.
    // When the keyboard opens, the inverted list keeps the bottom pinned as the
    // container shrinks, so no extra scroll-on-keyboard handling is needed.
    const scrollToBottom = useCallback((animated = false) => {
        listRef.current?.scrollToOffset({ offset: 0, animated });
    }, []);

    const markConversationSeen = useCallback(async () => {
        if (!id || id === 'new' || !pendingSeenRef.current || readInFlightRef.current) return;
        readInFlightRef.current = true;
        const incomingGeneration = incomingGenerationRef.current;
        const unreadBefore = Number(conversation?.unreadCount || 0);
        const totalBefore = queryClient.getQueryData<number>(queryKeys.chat.unreadCount);
        try {
            const response = await chatService.markRead(id);
            if (!response.success) return;
            if (activeReadIdRef.current !== id) return;
            if (incomingGeneration !== incomingGenerationRef.current) return;
            pendingSeenRef.current = false;
            receivedAwayIdsRef.current.clear();
            setUnseenWhileAway(0);
            setConversation((current) => current ? { ...current, unreadCount: 0 } : current);
            const clearedCount = markCachedConversationRead(id, unreadBefore, String(user?._id || user?.id || ''));
            if (typeof totalBefore === 'number' && clearedCount > 0
                && queryClient.getQueryData(queryKeys.chat.unreadCount) === totalBefore) {
                queryClient.setQueryData(queryKeys.chat.unreadCount, Math.max(0, totalBefore - clearedCount));
            }
        } catch {
            // Leave the unread state intact; the next visible event can retry.
        } finally {
            readInFlightRef.current = false;
            if (incomingGeneration !== incomingGenerationRef.current) {
                requestAnimationFrame(() => tryMarkVisibleUnreadRef.current());
            }
        }
    }, [conversation?.unreadCount, id, user?._id, user?.id]);

    const tryMarkVisibleUnread = useCallback(() => {
        const latestIncomingId = latestIncomingIdRef.current;
        if (!screenFocusedRef.current || AppState.currentState !== 'active'
            || !freshMessagesLoadedRef.current || !pendingSeenRef.current
            || !latestIncomingId || !viewableMessageIdsRef.current.has(latestIncomingId)) return;
        void markConversationSeen();
    }, [markConversationSeen]);
    tryMarkVisibleUnreadRef.current = tryMarkVisibleUnread;

    const viewabilityConfigRef = useRef({ itemVisiblePercentThreshold: 60, minimumViewTime: 100 });
    const onViewableItemsChangedRef = useRef(({ viewableItems }: { viewableItems: ViewToken[] }) => {
        viewableMessageIdsRef.current = new Set(viewableItems
            .filter((token) => token.item?.kind === 'message')
            .map((token) => token.item.id));
        tryMarkVisibleUnreadRef.current();
    });

    const load = useCallback(async (mode: 'replace' | 'append' = 'replace') => {
        if (!id || id === 'new' || emailBlocked || membershipBlocked || membershipAccessUnavailable) return;
        const cursor = mode === 'append' ? nextCursor : null;
        const [metaRes, messageRes] = await Promise.all([
            mode === 'replace' ? chatService.conversation(id) : Promise.resolve(null),
            chatService.messages(id, { cursor }),
        ]);
        if (metaRes?.success) {
            const latest = normalizeConversation(metaRes.data || metaRes);
            if (mode === 'replace' && latest.unreadCount > 0) pendingSeenRef.current = true;
            setConversation(acceptedConversationRef.current === latest.id && latest.state === 'request_pending'
                ? { ...latest, state: 'active', requestRole: null }
                : latest);
            setMetadataUnavailable(false);
        } else if (mode === 'replace') {
            setMetadataUnavailable(true);
        }
        if (messageRes.success) {
            const nextItems = (messageRes.items || []).map(normalizeMessage);
            if (mode === 'replace') freshMessagesLoadedRef.current = true;
            setItems((current) => {
                if (mode === 'append') return [...current, ...nextItems];
                const localMessages = current.filter(
                    (message) => message.type === 'text' && message.tempId && (message.failed || message.queued),
                );
                return [...nextItems, ...localMessages];
            });
            setNextCursor(messageRes.nextCursor || null);
        } else if (messageRes.code === 'MEMBERSHIP_REQUIRED') {
            void eligibility.refetch();
        } else if (messageRes.message !== 'network_error') {
            toast.show(apiMessage(messageRes.message), 'error', 3500);
        }
    }, [eligibility, emailBlocked, id, membershipAccessUnavailable, membershipBlocked, nextCursor]);

    useEffect(() => {
        if (!membershipBlocked) return;
        const userId = String(user?._id || user?.id || '');
        setItems([]);
        setConversation(null);
        queryClient.removeQueries({ queryKey: queryKeys.chat.inbox });
        void Promise.all([clearAllCachedMessages(userId), clearChatMediaCache()]);
    }, [membershipBlocked, user?._id, user?.id]);

    useEffect(() => {
        const previous = previousConnectivityRef.current;
        previousConnectivityRef.current = connectivityStatus;
        if (previous === 'offline' && connectivityStatus === 'online') {
            void load('replace');
        }
    }, [connectivityStatus, load]);

    const refreshCurrentConversation = useCallback(() => {
        if (!id || id === 'new') return;
        void load('replace');
    }, [id, load]);

    const handleSocketMessage = useCallback((message: ChatMessage) => {
        const next = normalizeMessage(message);
        if (!next.id || knownMessageIdsRef.current.has(next.id)) return;
        knownMessageIdsRef.current.add(next.id);
        setItems((current) => {
            if (current.some((item) => item.id === next.id)) return current;
            // Mark this incoming message to play the enter animation.
            animateIdsRef.current.add(next.id);
            return [...current, next];
        });
        if (!id || id === 'new') return;
        const myId = String(user?._id || user?.id || '');
        const fromPeer = String(next.sender || '') !== myId;
        const wasNearBottom = isNearBottomRef.current;
        if (wasNearBottom) pendingAutoScrollRef.current = true;
        // Only mark seen if the user is viewing the bottom (message is visible).
        // If they're scrolled up, defer until they scroll back down and surface a
        // count on the scroll-to-bottom button instead.
        if (fromPeer) {
            incomingGenerationRef.current += 1;
            pendingSeenRef.current = true;
            setConversation((current) => current ? { ...current, unreadCount: current.unreadCount + 1 } : current);
            if (!wasNearBottom && !receivedAwayIdsRef.current.has(next.id)) {
                receivedAwayIdsRef.current.add(next.id);
                setUnseenWhileAway(receivedAwayIdsRef.current.size);
            }
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

    const handleSocketTyping = useCallback(() => {
        setPeerTyping(true);
        if (peerTypingClearRef.current) clearTimeout(peerTypingClearRef.current);
        // Safety net: hide the indicator if the peer's stop event never arrives.
        peerTypingClearRef.current = setTimeout(() => setPeerTyping(false), 6000);
    }, []);

    const handleSocketStopTyping = useCallback(() => {
        if (peerTypingClearRef.current) clearTimeout(peerTypingClearRef.current);
        setPeerTyping(false);
    }, []);

    const socket = useChatSocket({
        conversationId: id !== 'new' ? id : null,
        enabled: Boolean(
            user
            && id
            && id !== 'new'
            && !eligibility.isLoading
            && !emailBlocked
            && !membershipBlocked
            && !membershipAccessUnavailable
        ),
        onMessage: handleSocketMessage,
        onMessageUnsent: handleSocketUnsent,
        onMessageUpdated: handleSocketMessageUpdated,
        onConversationChanged: refreshCurrentConversation,
        onRequestAccepted: (payload) => {
            if (String(payload?.conversationId || '') !== id) return;
            acceptedConversationRef.current = id;
            setConversation((current) => current ? { ...current, state: 'active', requestRole: null } : current);
            setMetadataUnavailable(false);
        },
        onConversationState: (payload) => {
            if (String(payload?.conversationId || '') !== id) return;
            if (payload.state === 'ended' || payload.state === 'declined' || payload.state === 'blocked') {
                acceptedConversationRef.current = null;
                setConversation((current) => current ? { ...current, state: payload.state } : current);
            }
        },
        onSeen: handleSocketSeen,
        onDelivered: handleSocketDelivered,
        onViewOnceViewed: handleViewOnceViewed,
        onTyping: handleSocketTyping,
        onStopTyping: handleSocketStopTyping,
    });

    useEffect(() => {
        socketRef.current = socket;
    });

    useEffect(() => {
        let cancelled = false;
        // Reset per-conversation state up front so we never flash the previous
        // chat's messages or reuse its pagination cursor when switching chats.
        setItems([]);
        if (acceptedRefConversationId.current !== id) {
            acceptedConversationRef.current = null;
            acceptedRefConversationId.current = id;
        }
        setNextCursor(null);
        setShowScrollDown(false);
        setUnseenWhileAway(0);
        pendingSeenRef.current = Boolean(queryClient.getQueryData<CachedInbox>(queryKeys.chat.inbox)?.conversations
            .find((item) => item.id === id)?.unreadCount);
        freshMessagesLoadedRef.current = false;
        initialPositionPendingRef.current = true;
        initialFreshPositionPendingRef.current = true;
        pendingAutoScrollRef.current = false;
        viewableMessageIdsRef.current.clear();
        receivedAwayIdsRef.current.clear();
        knownMessageIdsRef.current.clear();
        isNearBottomRef.current = true;
        (async () => {
            if (eligibility.isLoading) return;
            if (emailBlocked || membershipBlocked || membershipAccessUnavailable) {
                setLoading(false);
                setMessagesReady(false);
                return;
            }
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
            const [cached, queued, cachedInbox] = userId
                ? await Promise.all([
                    loadCachedMessages(userId, id),
                    queuedMessagesForConversation(userId, id),
                    loadCachedInbox(userId),
                ])
                : [null, [], null];
            if (!cancelled) {
                const cachedConversation = conversationFromInbox(cachedInbox, id);
                if (cachedConversation) setConversation((current) => current || cachedConversation);
            }
            if (!cancelled && ((cached && cached.length) || queued.length)) {
                const queuedMessages: ChatMessage[] = queued.map((item) => ({
                    id: item.tempId,
                    tempId: item.tempId,
                    clientMessageId: item.tempId,
                    conversationId: item.conversationId,
                    sender: userId,
                    type: 'text',
                    content: item.content,
                    replyTo: item.replyTo || null,
                    createdAt: item.createdAt,
                    reactions: [],
                    pending: true,
                    queued: true,
                }));
                setItems([...(cached || []), ...queuedMessages]);
                setMessagesReady(true);
                setLoading(false);
            }
            // 2) Background refresh: pull the latest from the server and reconcile.
            await load('replace');
            if (cancelled) return;
            setLoading(false);
            setMessagesReady(true);
        })();
        return () => {
            cancelled = true;
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [eligibility.isLoading, emailBlocked, id, membershipAccessUnavailable, membershipBlocked, user?._id, user?.id]);

    // Persist the newest slice locally so the next open is instant.
    useEffect(() => {
        if (!id || id === 'new' || !messagesReady || emailBlocked || membershipBlocked || membershipAccessUnavailable) return;
        const userId = String(user?._id || user?.id || '');
        void saveCachedMessages(userId, id, items);
    }, [items, emailBlocked, id, membershipAccessUnavailable, membershipBlocked, messagesReady, user?._id, user?.id]);

    // Warm only the newest few received voice notes. This keeps the first tap
    // immediate without turning conversation opening into an unbounded download.
    useEffect(() => {
        if (!messagesReady || isOffline || !id || id === 'new') return;
        const userId = String(user?._id || user?.id || '');
        const recentVoiceNotes = items
            .filter((message) => message.type === 'voice'
                && !message.unsent
                && message.media?.url
                && String(message.sender) !== userId)
            .sort((a, b) => String(a.createdAt).localeCompare(String(b.createdAt)))
            .slice(-3);
        void Promise.all(recentVoiceNotes.map((message) => cacheChatMedia({
            userId,
            conversationId: id,
            messageId: message.id,
            media: message.media,
            kind: 'voice',
        }).catch(() => null)));
    }, [id, isOffline, items, messagesReady, user?._id, user?.id]);

    useEffect(() => {
        const userId = String(user?._id || user?.id || '');
        if (!userId || !id || id === 'new') return;
        const unsubscribe = subscribeOfflineMessageQueue((event) => {
            if (event.item.userId !== userId || event.item.conversationId !== id) return;
            if (event.type === 'sent') {
                const normalized = normalizeMessage(event.message);
                setItems((current) => current.map((item) => item.tempId === event.item.tempId ? normalized : item));
                return;
            }
            setItems((current) => current.map((item) => item.tempId === event.item.tempId
                ? { ...item, pending: false, queued: false, failed: true }
                : item));
            const errorMessage = event.error === 'offline_message_expired'
                ? t('chat:offline_message_expired', 'Queued message expired. Tap to retry.')
                : apiMessage(event.error || 'message_failed');
            toast.show(errorMessage, 'error', 3500);
        });
        if (!isOffline) void flushOfflineMessageQueue(userId);
        return unsubscribe;
    }, [id, isOffline, toast, user?._id, user?.id]);

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
    latestIncomingIdRef.current = [...listItems].reverse().find((item) =>
        item.kind === 'message' && !item.message.pending && !item.message.unsent
        && item.message.type !== 'system'
        && String(item.message.sender) !== String(user?._id || user?.id || '')
    )?.id || null;
    const newestMessageId = invertedItems.find((item) => item.kind === 'message')?.id || '';
    useEffect(() => {
        for (const message of items) knownMessageIdsRef.current.add(message.id);
    }, [items]);

    useFocusEffect(useCallback(() => {
        screenFocusedRef.current = true;
        const frame = requestAnimationFrame(() => tryMarkVisibleUnreadRef.current());
        return () => {
            cancelAnimationFrame(frame);
            screenFocusedRef.current = false;
        };
    }, []));

    useEffect(() => {
        if (!messagesReady || invertedItems.length === 0) return;
        const frame = requestAnimationFrame(() => {
            if (initialPositionPendingRef.current) {
                initialPositionPendingRef.current = false;
                scrollToBottom(false);
            }
            if (freshMessagesLoadedRef.current && initialFreshPositionPendingRef.current) {
                initialFreshPositionPendingRef.current = false;
                scrollToBottom(false);
            }
            tryMarkVisibleUnreadRef.current();
        });
        return () => cancelAnimationFrame(frame);
    }, [conversation?.unreadCount, invertedItems, messagesReady, scrollToBottom]);

    useEffect(() => {
        const subscription = AppState.addEventListener('change', (state) => {
            if (state === 'active') requestAnimationFrame(() => tryMarkVisibleUnreadRef.current());
        });
        return () => subscription.remove();
    }, []);
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
        const previousId = prevNewestMessageIdRef.current;
        prevNewestMessageIdRef.current = newestMessageId;
        if (!messagesReady || loadingMore) {
            return;
        }
        if (newestMessageId && newestMessageId !== previousId
            && (pendingAutoScrollRef.current || isNearBottomRef.current)) {
            pendingAutoScrollRef.current = false;
            scrollToBottom(true);
        }
    }, [newestMessageId, loadingMore, messagesReady, scrollToBottom, isNearBottomRef]);

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
        } else if (!reconcileMembershipEligibility(res)) {
            toast.show(apiMessage(res.message || 'photo_expired'), 'error', 3500);
        }
        setViewOnceLoadingId(null);
    }, [viewOnceLoadingId]);

    const beginReply = useCallback((message: ChatMessage) => {
        setReplyTo(message);
        setSelectedMessage(null);
    }, []);

    const retryFailedMessage = useCallback(async (message: ChatMessage) => {
        if (!message.failed || message.pending || message.type !== 'text') return;
        if (isOffline) {
            toast.show(t('network_error', 'No internet connection. Please check and try again.'), 'info', 3000);
            return;
        }
        const body = messageText(message).trim();
        if (!body) return;

        setItems((current) => current.map((item) => messageId(item) === messageId(message)
            ? { ...item, failed: false, pending: true }
            : item));

        const replyId = typeof message.replyTo === 'string' ? message.replyTo : message.replyTo?.id;
        const res = await chatService.send({
            conversationId: id !== 'new' ? id : undefined,
            recipientId: id === 'new' ? recipientId : undefined,
            content: body,
            type: 'text',
            replyTo: replyId || undefined,
            clientMessageId: message.tempId,
        });

        if (res.success && res.message) {
            const normalized = normalizeMessage(res.message);
            setItems((current) => current.map((item) => messageId(item) === messageId(message) ? normalized : item));
            if (id === 'new' && res.conversationId) {
                router.replace(`/conversation/${res.conversationId}` as any);
            }
            return;
        }

        if (reconcileMembershipEligibility(res)) return;
        reconcilePhotoEligibility(res);
        if (res.errorMessage === 'network_error' && id !== 'new' && message.tempId) {
            try {
                await enqueueOfflineTextMessage({
                    tempId: message.tempId,
                    userId: String(user?._id || user?.id || ''),
                    conversationId: id,
                    content: body,
                    replyTo: replyId || undefined,
                    createdAt: message.createdAt,
                });
                setItems((current) => current.map((item) => messageId(item) === messageId(message)
                    ? { ...item, pending: true, queued: true, failed: false }
                    : item));
                toast.show(t('chat:message_queued', 'Message queued. It will send when you are online.'), 'info', 3000);
                return;
            } catch {
                // Fall through to the manual retry state when the bounded queue is full.
            }
        }
        setItems((current) => current.map((item) => messageId(item) === messageId(message)
            ? { ...item, pending: false, queued: false, failed: true }
            : item));
        toast.show(t('chat:message_failed', 'Message failed to send. Tap to retry.'), 'error', 3500);
    }, [id, isOffline, recipientId, toast, user?._id, user?.id]);

    const renderMessageItem = useCallback(({ item, index }: { item: ListItem; index: number }) => {
        if (item.kind === 'date') {
            return (
                <View style={styles.dateWrap}>
                    <Text variant="caption" className="font-body-bold" style={[styles.dateLabel, { backgroundColor: colors.surface, color: colors.muted }]}>
                        {item.label}
                    </Text>
                </View>
            );
        }
        const message = item.message;
        const mine = String(message.sender) === String(user?._id || user?.id);
        const animateIn = animateIdsRef.current.has(item.id);
        const adjacentItem = invertedItems[index + 1];
        const sameSenderAsAdjacent = message.type !== 'system'
            && adjacentItem?.kind === 'message'
            && adjacentItem.message.type !== 'system'
            && String(adjacentItem.message.sender) === String(message.sender);
        return (
            <MessageBubble
                message={message}
                mine={mine}
                rowGap={sameSenderAsAdjacent ? 3 : 10}
                uiDirection={isRTL ? 'rtl' : 'ltr'}
                colors={colors}
                userId={String(user?._id || user?.id || '')}
                animateIn={animateIn}
                onOpenImage={setImagePreview}
                onOpenViewOnce={openViewOnce}
                viewOnceLoading={viewOnceLoadingId === message.id}
                onOpenMenu={(target) => {
                    void lightImpact();
                    setSelectedMessage(target);
                }}
                onRetry={retryFailedMessage}
                onSwipeReply={beginReply}
                onReplyClick={handleReplyJump}
            />
        );
    }, [colors, user?._id, user?.id, isRTL, openViewOnce, viewOnceLoadingId, beginReply, handleReplyJump, retryFailedMessage, lightImpact, invertedItems]);
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
    const isRequest = activeConversation?.state === 'request_pending' && Boolean(activeConversation.requestRole);
    const isSentRequest = isRequest && activeConversation?.requestRole === 'sent';
    const isEnded = activeConversation?.state === 'ended';
    const canCompose = !peerDeleted && (id === 'new' || activeConversation?.state === 'active');

    const handleListScroll = useCallback((event: NativeSyntheticEvent<NativeScrollEvent>) => {
        // Inverted list: offset near 0 means we're pinned to the newest message.
        const { contentOffset } = event.nativeEvent;
        const y = contentOffset.y;
        const nearBottom = y <= CHAT_ONE_LINE_BUBBLE_SCROLL_THRESHOLD;
        isNearBottomRef.current = nearBottom;
        setShowScrollDown(!nearBottom);
        if (nearBottom) tryMarkVisibleUnreadRef.current();
    }, [isNearBottomRef]);

    const loadMore = async () => {
        if (!nextCursor || loadingMore || id === 'new') return;
        setLoadingMore(true);
        await load('append');
        setLoadingMore(false);
    };

    const emitStopTyping = useCallback(() => {
        if (typingStopTimerRef.current) {
            clearTimeout(typingStopTimerRef.current);
            typingStopTimerRef.current = null;
        }
        if (typingActiveRef.current) {
            typingActiveRef.current = false;
            socketRef.current?.stopTyping(peerId);
        }
    }, [peerId]);

    const handleComposerChange = (value: string) => {
        setContent(value.slice(0, 5000));
        if (!peerId || id === 'new') return;
        if (!typingActiveRef.current) {
            typingActiveRef.current = true;
            socketRef.current?.sendTyping(peerId);
        }
        if (typingStopTimerRef.current) clearTimeout(typingStopTimerRef.current);
        typingStopTimerRef.current = setTimeout(() => {
            typingActiveRef.current = false;
            socketRef.current?.stopTyping(peerId);
        }, 2500);
    };

    // Reset typing state when leaving or switching conversations.
    useEffect(() => {
        return () => {
            if (typingStopTimerRef.current) clearTimeout(typingStopTimerRef.current);
            if (peerTypingClearRef.current) clearTimeout(peerTypingClearRef.current);
            typingActiveRef.current = false;
            setPeerTyping(false);
        };
    }, [id]);

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
            toast.show(t('message_empty', 'Please enter a message before sending.'), 'info', 2500);
            return;
        }
        const tempId = `tmp_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
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
            clientMessageId: tempId,
        };

        if (isOffline && id === 'new') {
            toast.show(t('chat:offline_new_conversation', 'Connect to the internet to start a new conversation.'), 'info', 3500);
            return;
        }

        if (isOffline) {
            try {
                await enqueueOfflineTextMessage({
                    tempId,
                    userId: String(user?._id || user?.id || ''),
                    conversationId: id,
                    content: body,
                    replyTo: reply?.id,
                    createdAt: temp.createdAt,
                });
            } catch {
                toast.show(t('chat:offline_queue_full', 'Offline queue is full. Reconnect before sending more messages.'), 'error', 3500);
                return;
            }
            lightImpact();
            animateIdsRef.current.add(tempId);
            setItems((current) => [...current, { ...temp, queued: true }]);
            setContent('');
            emitStopTyping();
            setReplyTo(null);
            scrollToBottom(true);
            toast.show(t('chat:message_queued', 'Message queued. It will send when you are online.'), 'info', 3000);
            return;
        }
        lightImpact();
        setSending(true);
        animateIdsRef.current.add(tempId);
        setItems((current) => [...current, temp]);
        setContent('');
        emitStopTyping();
        setReplyTo(null);
        scrollToBottom(true);

        const res = await chatService.send({
            conversationId: id !== 'new' ? id : undefined,
            recipientId: id === 'new' ? recipientId : undefined,
            content: body,
            type: 'text',
            replyTo: reply?.id || undefined,
            clientMessageId: tempId,
        });

        if (res.success && res.message) {
            const normalized = normalizeMessage(res.message);
            setItems((current) => current.map((item) => item.tempId === tempId ? normalized : item));
            if (id === 'new' && res.conversationId) {
                router.replace(`/conversation/${res.conversationId}` as any);
            }
        } else {
            if (reconcileMembershipEligibility(res)) {
                setItems((current) => current.filter((item) => item.tempId !== tempId));
                setSending(false);
                return;
            }
            reconcilePhotoEligibility(res);
            if (res.errorMessage === 'network_error' && id !== 'new') {
                try {
                    await enqueueOfflineTextMessage({
                        tempId,
                        userId: String(user?._id || user?.id || ''),
                        conversationId: id,
                        content: body,
                        replyTo: reply?.id,
                        createdAt: temp.createdAt,
                    });
                    setItems((current) => current.map((item) => item.tempId === tempId ? { ...item, queued: true } : item));
                    toast.show(t('chat:message_queued', 'Message queued. It will send when you are online.'), 'info', 3000);
                } catch {
                    setItems((current) => current.map((item) => item.tempId === tempId ? { ...item, pending: false, failed: true } : item));
                    toast.show(t('chat:message_failed', 'Message failed to send. Tap to retry.'), 'error', 3500);
                }
            } else {
                setItems((current) => current.map((item) => item.tempId === tempId ? { ...item, pending: false, failed: true } : item));
                toast.show(apiMessage(res.errorMessage || 'message_failed'), 'error', 3500);
            }
        }
        setSending(false);
    };

    const sendMediaMessage = async (
        type: 'image' | 'voice',
        media: MessageMedia,
        mediaContent = '',
        clientMessageId?: string,
        localMediaUri?: string,
    ): Promise<ChatMessage | null> => {
        const reply = replyTo;
        const trimmedContent = mediaContent.trim();
        const res = await chatService.send({
            conversationId: id !== 'new' ? id : undefined,
            recipientId: id === 'new' ? recipientId : undefined,
            type,
            content: trimmedContent || undefined,
            media,
            replyTo: reply?.id || undefined,
            clientMessageId,
        });

        if (res.success && res.message) {
            setReplyTo((current) => current?.id === reply?.id ? null : current);
            let normalized = normalizeMessage(res.message);
            if (type === 'voice') {
                normalized = {
                    ...normalized,
                    media: { ...media, ...(normalized.media || {}) },
                };
            }
            if (type === 'voice' && localMediaUri && normalized.id) {
                const cached = await storeLocalChatMedia({
                    sourceUri: localMediaUri,
                    userId: String(user?._id || user?.id || ''),
                    conversationId: normalized.conversationId || id,
                    messageId: normalized.id,
                    media: normalized.media,
                    kind: 'voice',
                }).catch(() => null);
                if (cached?.uri) {
                    normalized = {
                        ...normalized,
                        media: { ...(normalized.media || media), localUri: cached.uri },
                    };
                }
            }
            if (normalized.id) animateIdsRef.current.add(normalized.id);
            setItems((current) => current.some((item) => item.id === normalized.id) ? current : [...current, normalized]);
            if (id === 'new' && res.conversationId) {
                router.replace(`/conversation/${res.conversationId}` as any);
            }
            scrollToBottom(true);
            return normalized;
        }

        if (reconcileMembershipEligibility(res)) return null;
        reconcilePhotoEligibility(res);
        toast.show(apiMessage(res.errorMessage || 'message_failed'), 'error');
        return null;
    };

    const closeImageAttachment = () => {
        if (uploadingMedia) return;
        imageUploadedMediaRef.current = null;
        originalImageAttachmentRef.current = null;
        setImageAttachment(null);
        setImageCaption('');
        setImageViewOnce(false);
    };

    const canAttachMedia = () => {
        if (!requireVerified('chat')) return false;
        if (isOffline) {
            toast.show(t('network_error', 'No internet connection. Please check and try again.'), 'info', 3000);
            return false;
        }
        if (!canCompose) {
            toast.show(peerDeleted
                ? t('chat:account_deleted_message_disabled', 'This account has been deleted. You can no longer send messages.')
                : t('chat:accept_request_to_reply', 'Accept the request before replying.'), 'info');
            return false;
        }
        if (id === 'new') {
            toast.show(t('send_text_first', 'Send a text message first, then attach media.'), 'info');
            return false;
        }
        return true;
    };

    const stageImageAsset = (asset: ImagePicker.ImagePickerAsset) => {
        if (asset.fileSize && asset.fileSize > MAX_CHAT_IMAGE_BYTES) {
            toast.show(t('chat:image_too_large', 'Choose an image smaller than 10 MB.'), 'error');
            return;
        }
        imageUploadedMediaRef.current = null;
        const attachment = {
            uri: asset.uri,
            name: asset.fileName || `chat-photo-${Date.now()}.jpg`,
            type: asset.mimeType || 'image/jpeg',
            clientMessageId: newMediaMessageId(),
        };
        originalImageAttachmentRef.current = attachment;
        setImageAttachment(attachment);
        setImageCaption('');
        setImageViewOnce(false);
    };

    const pickAndUploadImage = async () => {
        if (!canAttachMedia()) return;

        // Close the keyboard before opening the picker so that, after sending,
        // the composer returns to rest and the new image isn't hidden behind it.
        KeyboardController.dismiss();

        try {
            const result = await ImagePicker.launchImageLibraryAsync({
                mediaTypes: ['images'],
                quality: 0.9,
                allowsEditing: false,
                exif: false,
            });
            if (result.canceled || !result.assets[0]) return;
            stageImageAsset(result.assets[0]);
        } catch {
            toast.show(t('chat:attachment_failed', 'Could not open photos. Please try again.'), 'error');
        }
    };

    const captureAndAttachPhoto = async () => {
        if (!canAttachMedia()) return;

        KeyboardController.dismiss();

        try {
            const permission = await ImagePicker.requestCameraPermissionsAsync();
            if (!permission.granted) {
                toast.show(t('camera_permission_required', 'Camera permission is required.'), 'error');
                return;
            }

            const result = await ImagePicker.launchCameraAsync({
                mediaTypes: ['images'],
                quality: 0.9,
                allowsEditing: false,
                exif: false,
            });
            if (result.canceled || !result.assets[0]) return;
            stageImageAsset(result.assets[0]);
        } catch {
            toast.show(t('chat:camera_failed', 'Could not open camera. Please try again.'), 'error');
        }
    };

    const sendImageAttachment = async () => {
        if (!imageAttachment || uploadingMedia || mediaSendLockRef.current || id === 'new') return;
        if (isOffline) {
            toast.show(t('network_error', 'No internet connection. Please check and try again.'), 'info', 3000);
            return;
        }
        if (!canCompose) {
            toast.show(peerDeleted
                ? t('chat:account_deleted_message_disabled', 'This account has been deleted. You can no longer send messages.')
                : t('chat:accept_request_to_reply', 'Accept the request before replying.'), 'info');
            return;
        }
        mediaSendLockRef.current = true;
        setUploadingMedia(true);
        try {
            let media = imageUploadedMediaRef.current?.id === imageAttachment.clientMessageId
                && imageUploadedMediaRef.current.viewOnce === imageViewOnce
                ? imageUploadedMediaRef.current.media : null;
            if (!media) {
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
                if (!uploadRes.success || !uploadRes.media) {
                    if (reconcileMembershipEligibility(uploadRes)) return;
                    reconcilePhotoEligibility(uploadRes);
                    toast.show(apiMessage(uploadRes.message || 'upload_failed'), 'error');
                    return;
                }
                media = uploadRes.media;
                imageUploadedMediaRef.current = { id: imageAttachment.clientMessageId, viewOnce: imageViewOnce, media };
            }
            if (await sendMediaMessage('image', media, imageCaption, imageAttachment.clientMessageId)) {
                imageUploadedMediaRef.current = null;
                originalImageAttachmentRef.current = null;
                setImageAttachment(null);
                setImageCaption('');
                setImageViewOnce(false);
            }
        } catch {
            toast.show(t('chat:message_failed', 'Message failed to send. Tap to retry.'), 'error');
        } finally {
            setUploadingMedia(false);
            mediaSendLockRef.current = false;
        }
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
        if (voicePanelOpen || recordingBusy) return;
        voiceCopyGenerationRef.current += 1;
        setRecordingBusy(true);
        voiceUploadedMediaRef.current = null;
        setVoicePreview(null);
        setVoiceWaveform([]);
        setVoiceSendFailed(false);
        try {
            const permission = await requestRecordingPermissionsAsync();
            if (!permission.granted) {
                toast.show(t('microphone_permission_required', 'Microphone permission is required.'), 'error');
                return;
            }
            setVoicePanelOpen(true);
        } catch {
            toast.show(t('recording_failed', 'Could not start recording.'), 'error');
        } finally {
            setRecordingBusy(false);
        }
    };

    const finishVoiceRecording = async (result: WaveformRecorderCompleteEvent) => {
        if (!result.uri || result.durationMs < 1000) {
            sendAfterFinalizeRef.current = false;
            setRecordingBusy(false);
            toast.show(t('recording_too_short', 'Recording is too short.'), 'warning');
            setVoicePanelOpen(false);
            return;
        }
        const generation = voiceCopyGenerationRef.current;
        const clientMessageId = newMediaMessageId();
        const copiedUri = `${FileSystem.cacheDirectory || FileSystem.documentDirectory || ''}${clientMessageId}.m4a`;
        try {
            if (!FileSystem.cacheDirectory && !FileSystem.documentDirectory) throw new Error('file_system_unavailable');
            await FileSystem.copyAsync({ from: result.uri, to: copiedUri });
            const copiedFile = await FileSystem.getInfoAsync(copiedUri);
            if (!copiedFile.exists || !copiedFile.size) throw new Error('empty_recording');
            if (generation !== voiceCopyGenerationRef.current) {
                void FileSystem.deleteAsync(copiedUri, { idempotent: true }).catch(() => undefined);
                return;
            }
            setVoicePreview({ uri: copiedUri, duration: Math.min(MAX_VOICE_RECORDING_SECONDS, Math.round(result.durationMs / 1000)), clientMessageId });
            setVoiceWaveform(result.samples.slice(0, VOICE_WAVE_BAR_COUNT));
        } catch (error) {
            console.warn('[chat] voice-copy-failed', error);
            void FileSystem.deleteAsync(copiedUri, { idempotent: true }).catch(() => undefined);
            sendAfterFinalizeRef.current = false;
            setVoicePanelOpen(false);
            toast.show(t('recording_failed', 'Could not save recording.'), 'error');
        } finally {
            if (generation === voiceCopyGenerationRef.current) setRecordingBusy(false);
        }
    };

    const discardVoiceRecording = () => {
        if (voiceSending) return;
        voiceCopyGenerationRef.current += 1;
        sendAfterFinalizeRef.current = false;
        voiceUploadedMediaRef.current = null;
        if (voicePreview?.uri) void FileSystem.deleteAsync(voicePreview.uri, { idempotent: true }).catch(() => undefined);
        setVoicePanelOpen(false);
        setVoicePreview(null);
        setVoiceWaveform([]);
        setVoiceSendFailed(false);
        setRecordingBusy(false);
    };

    const sendVoicePreview = async () => {
        if (voiceSending || mediaSendLockRef.current || id === 'new') return;
        if (!voicePreview) return;
        if (isOffline) {
            toast.show(t('network_error', 'No internet connection. Please check and try again.'), 'info', 3000);
            return;
        }
        if (!canCompose) {
            toast.show(peerDeleted
                ? t('chat:account_deleted_message_disabled', 'This account has been deleted. You can no longer send messages.')
                : t('chat:accept_request_to_reply', 'Accept the request before replying.'), 'info');
            return;
        }
        mediaSendLockRef.current = true;
        setVoiceSending(true);
        setVoiceSendFailed(false);
        try {
            let media = voiceUploadedMediaRef.current?.id === voicePreview.clientMessageId
                ? voiceUploadedMediaRef.current.media : null;
            if (!media) {
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
                if (!uploadRes.success || !uploadRes.media) {
                    console.warn('[chat] voice-upload-failed', { status: uploadRes.status, error: uploadRes.error, message: uploadRes.message });
                    if (reconcileMembershipEligibility(uploadRes)) return;
                    reconcilePhotoEligibility(uploadRes);
                    toast.show(apiMessage(uploadRes.message || 'upload_failed'), 'error');
                    setVoiceSendFailed(true);
                    return;
                }
                media = {
                    ...uploadRes.media,
                    waveform: waveformPeaks(voiceWaveform, VOICE_WAVE_BAR_COUNT),
                };
                voiceUploadedMediaRef.current = { id: voicePreview.clientMessageId, media };
            }
            const sentMessage = await sendMediaMessage('voice', media, '', voicePreview.clientMessageId, voicePreview.uri);
            if (sentMessage) {
                voiceUploadedMediaRef.current = null;
                if (sentMessage.media?.localUri && sentMessage.media.localUri !== voicePreview.uri) {
                    void FileSystem.deleteAsync(voicePreview.uri, { idempotent: true }).catch(() => undefined);
                }
                setVoicePanelOpen(false);
                setVoicePreview(null);
                setVoiceWaveform([]);
            } else {
                setVoiceSendFailed(true);
            }
        } catch {
            toast.show(t('recording_failed', 'Could not save recording.'), 'error');
            setVoiceSendFailed(true);
        } finally {
            setVoiceSending(false);
            mediaSendLockRef.current = false;
        }
    };

    useEffect(() => {
        if (!voicePreview || !sendAfterFinalizeRef.current) return;
        sendAfterFinalizeRef.current = false;
        void sendVoicePreview();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [voicePreview]);

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
        if (reconcileMembershipEligibility(res)) return;
        if (!res.success) {
            toast.show(apiMessage(res.message), 'error', 3500);
            return;
        }
        if (action === 'accept') {
            acceptedConversationRef.current = target.id;
            applyAcceptedConversation(target);
            setConversation((current) => current ? { ...current, state: 'active', requestRole: null } : {
                ...target,
                state: 'active',
                requestRole: null,
            });
            void load('replace');
        }
        else {
            applyConversationStateById(target.id, 'declined');
            goBackToMessages();
        }
    };

    const toggleMute = async () => {
        if (!conversation || menuBusy) return;
        const nextMuted = !conversation.muted;
        setMenuBusy(true);
        const res = await chatService.mute(conversation.id, nextMuted);
        setMenuBusy(false);
        if (!res.success) {
            toast.show(apiMessage(res.message), 'error', 3500);
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
        setConversationConfirmation('end');
    };

    const deleteConversation = () => {
        if (!conversation || menuBusy) return;
        setConversationConfirmation('delete');
    };

    const confirmConversationAction = async () => {
        if (!conversation || !conversationConfirmation || menuBusy) return;
        const action = conversationConfirmation;
        setMenuBusy(true);
        const res = action === 'end'
            ? await chatService.end(conversation.id)
            : await chatService.deleteConversation(conversation.id);
        setMenuBusy(false);
        if (!res.success) {
            toast.show(apiMessage(res.message), 'error', 3500);
            return;
        }

        setConversationConfirmation(null);
        setMenuOpen(false);
        if (action === 'end') {
            await load('replace');
            return;
        }
        toast.show(translateChatText('chat_hidden', 'Chat hidden'), 'success');
        goBackToMessages();
    };

    const markViewOnceLoaded = async () => {
        if (!viewOnce?.messageId) return;
        const messageId = viewOnce.messageId;
        const result = await chatService.markViewOnceViewed(messageId);
        if (!result.success) return;
        const viewedAt = result.viewedAt || result.data?.viewedAt || new Date().toISOString();
        setItems((current) => current.map((message) => message.id === messageId ? {
            ...message,
            media: { ...(message.media || {}), viewedAt },
        } : message));
    };

    const closeMessageMenu = () => {
        if (messageActionBusy) return;
        setSelectedMessage(null);
    };

    const renderMessageMenuBackdrop = useCallback((props: BottomSheetBackdropProps) => (
        <BottomSheetBackdrop
            {...props}
            appearsOnIndex={0}
            disappearsOnIndex={-1}
            opacity={0.38}
            pressBehavior={messageActionBusy ? 'none' : 'close'}
        />
    ), [messageActionBusy]);

    const copySelectedMessage = async () => {
        if (!selectedMessage || messageActionBusy) return;
        const text = messageText(selectedMessage).trim();
        if (!text) return;
        await Clipboard.setStringAsync(text);
        toast.show(translateChatText('copied', 'Copied'), 'success');
        setSelectedMessage(null);
    };

    const reportSelectedMessage = () => {
        if (!selectedMessage || messageActionBusy || !requireVerified('report')) return;
        const currentUserId = String(user?._id || user?.id || '');
        if (!selectedMessage.id || selectedMessage.sender === currentUserId || selectedMessage.type === 'system' || selectedMessage.unsent) return;

        const message = selectedMessage;
        setSelectedMessage(null);
        setReportTarget({
            type: 'ChatMessage',
            userId: String(message.sender),
            messageId: message.id,
            messageType: message.type,
            messagePreview: message.type === 'text'
                ? messageText(message).trim()
                : message.type === 'image'
                    ? translateChatText(message.media?.viewOnce ? 'view_once_photo' : 'photo', 'Photo')
                    : message.type === 'voice'
                        ? translateChatText('voice_message', 'Voice message')
                        : message.content || translateChatText('message', 'Message'),
            messageMediaUrl: message.type === 'image'
                ? message.media?.thumbnail || message.media?.url
                : undefined,
        });
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

    if (eligibility.isLoading) {
        return (
            <SafeAreaView style={[styles.screen, { backgroundColor: colors.bg }]} edges={['top']}>
                <View style={styles.center}>
                    <ActivityIndicator color={colors.primary} />
                </View>
            </SafeAreaView>
        );
    }

    if (emailBlocked) {
        return (
            <SafeAreaView style={[styles.screen, { backgroundColor: colors.bg }]} edges={['top']}>
                <View style={[styles.header, { backgroundColor: colors.bg, borderBottomColor: colors.border }]}>
                    <Pressable onPress={goBackToMessages} style={styles.headerIcon}>
                        {isRTL ? <CaretRight size={24} color={colors.text} weight="bold" /> : <CaretLeft size={24} color={colors.text} weight="bold" />}
                    </Pressable>
                </View>
                <View style={styles.gateContent}>
                    <EmailVerificationRequiredBanner
                        email={eligibility.email || user?.email}
                        title={t('verify_email_full_chat_title', 'Verify your email to use full chat')}
                        message={t('verify_email_full_chat_message', 'Please verify your email before opening conversations or sending messages.')}
                    />
                </View>
            </SafeAreaView>
        );
    }

    if (membershipAccessUnavailable) {
        return (
            <SafeAreaView style={[styles.screen, { backgroundColor: colors.bg }]} edges={['top']}>
                <View style={[styles.header, { backgroundColor: colors.bg, borderBottomColor: colors.border }]}>
                    <Pressable onPress={goBackToMessages} style={styles.headerIcon}>
                        {isRTL ? <CaretRight size={24} color={colors.text} weight="bold" /> : <CaretLeft size={24} color={colors.text} weight="bold" />}
                    </Pressable>
                </View>
                <View style={styles.center}>
                    <Text variant="body" className="font-body-semi" style={{ color: colors.muted, textAlign: 'center' }}>
                        {t('chat:connection_error', 'Connection error. Retrying...')}
                    </Text>
                </View>
            </SafeAreaView>
        );
    }

    if (membershipBlocked) {
        return (
            <SafeAreaView style={[styles.screen, { backgroundColor: colors.bg }]} edges={['top']}>
                <MessagingMembershipGate
                    visible
                    trialOffer={eligibility.trialOffer}
                    onClose={goBackToMessages}
                />
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={[styles.screen, { backgroundColor: colors.body }]} edges={['top']}>
            <View style={styles.screen}>
                <View style={[
                    styles.header,
                    {
                        backgroundColor: colors.bg,
                        borderBottomColor: colors.border,
                        flexDirection: isRTL ? 'row-reverse' : 'row',
                    },
                ]}>
                    <Pressable onPress={goBackToMessages} style={styles.headerIcon}>
                        {(isRTL ? <CaretRight size={scale(23)} color={colors.text} weight="bold" /> : <CaretLeft size={scale(23)} color={colors.text} weight="bold" />)}
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
                        <View
                            pointerEvents="box-none"
                            style={[styles.headerProfileContent, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}
                        >
                            <View pointerEvents="none" style={[styles.headerAvatar, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                                {avatar ? (
                                    <Image source={{ uri: avatar }} style={StyleSheet.absoluteFill} contentFit="cover" />
                                ) : (
                                    <Image source={PROFILE_PLACEHOLDER_IMAGE} style={StyleSheet.absoluteFill} contentFit="cover" />
                                )}
                            </View>
                            <View pointerEvents="none" style={[styles.headerText, { direction: isRTL ? 'rtl' : 'ltr' }]}>
                                <RNText numberOfLines={2} style={[styles.headerNameText, { color: colors.text, textAlign: isRTL ? 'right' : 'left' }]}>
                                    {peerName({ ...(activeConversation || {}), otherUser: headerOther } as Conversation, name)}
                                </RNText>
                                {(activeConversation || name) && (
                                    <RNText numberOfLines={1} style={[styles.headerStatusText, { color: colors.muted, textAlign: isRTL ? 'right' : 'left' }]}>
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
                    {conversation?.state === 'active' && !headerOther.account_deleted && id && id !== 'new' ? (
                        <GalleryRevealControl
                            conversationId={id}
                            otherName={peerName({ ...(activeConversation || {}), otherUser: headerOther } as Conversation, name)}
                            status={conversation.galleryReveal}
                            onChanged={refreshCurrentConversation}
                        />
                    ) : null}
                    <Pressable
                        onPress={() => setMenuOpen(true)}
                        style={styles.headerIcon}
                    >
                        <MoreVertical size={scale(21)} color={colors.text} strokeWidth={2.7} />
                    </Pressable>
                </View>

                <ChatKeyboardAvoider>
                <ChatDoodleBackground
                    color={palette.chrome.common.iconNeutral}
                    opacity={isDark ? 0.11 : 0.09}
                />
                <View style={styles.messageListWrap}>
                    <FlatList
                        key={id}
                        ref={listRef}
                        style={{ flex: 1 }}
                        inverted={invertedItems.length > 0}
                        keyboardShouldPersistTaps="handled"
                        keyboardDismissMode="interactive"
                        scrollEventThrottle={16}
                        onScroll={handleListScroll}
                        onScrollBeginDrag={() => {
                            initialFreshPositionPendingRef.current = false;
                            pendingAutoScrollRef.current = false;
                        }}
                        onViewableItemsChanged={onViewableItemsChangedRef.current}
                        viewabilityConfig={viewabilityConfigRef.current}
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
                        ListHeaderComponent={peerTyping ? <TypingIndicatorBubble colors={colors} /> : null}
                        ListEmptyComponent={
                            <View style={styles.empty}>
                                {loading || !messagesReady ? (
                                    <ActivityIndicator color={colors.primary} />
                                ) : (
                                    <Text variant="body" className="font-body-bold" align="center" style={{ color: colors.text }}>
                                        {t('no_messages_yet', 'No messages yet')}
                                    </Text>
                                )}
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
                        }}
                    />
                </View>

                <ChatComposerBar
                    backgroundColor="transparent"
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

                {id !== 'new' && !activeConversation && !peerDeleted && !emailBlocked && !membershipBlocked && !membershipAccessUnavailable && (
                    metadataUnavailable ? (
                        <View style={[styles.endedBar, { backgroundColor: colors.card }]}>
                            <Pressable accessibilityRole="button" onPress={() => void load('replace')}>
                                <Text variant="body-sm" align="center" style={{ color: colors.primary }}>
                                    {t('btn_try_again', 'Try again')}
                                </Text>
                            </Pressable>
                        </View>
                    ) : (
                        <View style={styles.composer} pointerEvents="none">
                            <View style={[styles.composerRow, { opacity: 0.62 }]}>
                                <View style={[styles.inputPill, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                                    <View style={styles.pillIcon}>
                                        <Camera size={scale(21)} color={colors.muted} strokeWidth={2.2} />
                                    </View>
                                    <TextInput
                                        editable={false}
                                        placeholder={t('chat:message_placeholder', 'Type a message...')}
                                        placeholderTextColor={colors.subtle}
                                        style={[styles.input, { color: colors.text, fontFamily: inputFontFamily, textAlign: isRTL ? 'right' : 'left' }]}
                                    />
                                    <View style={styles.pillIcon}>
                                        <ImageIcon size={scale(21)} color={colors.muted} strokeWidth={2.2} />
                                    </View>
                                </View>
                                <View style={[styles.send, { backgroundColor: colors.primary }]}>
                                    <Mic size={scale(21)} color={colors.inverse} strokeWidth={2.2} />
                                </View>
                            </View>
                        </View>
                    )
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

                {canCompose && !isEnded && showPhotoGate && (
                    <QualifiedPhotoRequiredNotice />
                )}

                {canCompose && !isEnded && !showPhotoGate && (
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
                                duration={voicePreview?.duration || 0}
                                previewUri={voicePreview?.uri || null}
                                recordingBusy={recordingBusy}
                                sending={voiceSending}
                                sendFailed={voiceSendFailed}
                                waveform={voiceWaveform}
                                onComplete={finishVoiceRecording}
                                onError={() => {
                                    sendAfterFinalizeRef.current = false;
                                    setRecordingBusy(false);
                                    setVoicePanelOpen(false);
                                    toast.show(t('recording_failed', 'Could not save recording.'), 'error');
                                }}
                                onDiscard={discardVoiceRecording}
                                onSendPreview={sendVoicePreview}
                                onFinalizeForSend={() => { sendAfterFinalizeRef.current = true; setRecordingBusy(true); }}
                            />
                        ) : (
                            <View style={styles.composerRow}>
                                <View style={[styles.inputPill, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                                    <PressableScale
                                        onPress={captureAndAttachPhoto}
                                        disabled={isOffline || uploadingMedia || recordingBusy || voiceSending}
                                        accessibilityLabel={translateChatText('camera', 'Camera')}
                                        style={styles.pillIcon}
                                    >
                                        <Camera size={scale(21)} color={colors.muted} strokeWidth={2.2} />
                                    </PressableScale>
                                    <TextInput
                                        value={content}
                                        onChangeText={handleComposerChange}
                                        onFocus={() => {
                                            if (isNearBottomRef.current) {
                                                scrollToBottom(false);
                                            }
                                        }}
                                        placeholder={t('chat:message_placeholder', 'Type a message...')}
                                        placeholderTextColor={colors.subtle}
                                        style={[styles.input, { color: colors.text, fontFamily: inputFontFamily, textAlign: isRTL ? 'right' : 'left' }]}
                                        multiline
                                    />
                                    {!content.length && (
                                        <View style={styles.pillIconCluster}>
                                            <PressableScale
                                                onPress={pickAndUploadImage}
                                                disabled={isOffline || uploadingMedia || recordingBusy || voiceSending}
                                                accessibilityLabel={translateChatText('attach_photo', 'Attach photo')}
                                                style={styles.pillIcon}
                                            >
                                                {uploadingMedia ? <ActivityIndicator color={colors.primary} size="small" /> : <ImageIcon size={scale(21)} color={colors.muted} strokeWidth={2.2} />}
                                            </PressableScale>
                                        </View>
                                    )}
                                </View>
                                <PressableScale
                                    onPress={content.length ? send : startRecording}
                                    disabled={content.length
                                        ? !content.trim() || sending
                                        : isOffline || recordingBusy || voiceSending}
                                    accessibilityLabel={content.length
                                        ? translateChatText('send', 'Send')
                                        : translateChatText('voice_message', 'Voice message')}
                                    accessibilityState={{ disabled: content.length ? !content.trim() || sending : isOffline || recordingBusy || voiceSending }}
                                    style={[styles.send, { backgroundColor: colors.primary }]}
                                >
                                    {content.length
                                        ? sending
                                            ? <ActivityIndicator color={colors.inverse} />
                                            : <PaperPlaneTilt size={scale(22)} color={content.trim() ? colors.inverse : colors.muted} weight="fill" />
                                        : recordingBusy
                                            ? <ActivityIndicator color={colors.inverse} />
                                            : <Mic size={scale(21)} color={colors.inverse} strokeWidth={2.2} />}
                                </PressableScale>
                            </View>
                        )}
                    </View>
                )}
                </ChatComposerBar>
                </ChatKeyboardAvoider>
            </View>

            <ImageAttachmentComposer
                visible={!!imageAttachment && !cropOpen}
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
                onToggleViewOnce={() => {
                    if (uploadingMedia) return;
                    void lightImpact();
                    setImageViewOnce((value) => !value);
                }}
                onClose={closeImageAttachment}
                onSend={sendImageAttachment}
                onCrop={() => { KeyboardController.dismiss(); setCropOpen(true); }}
                onReset={originalImageAttachmentRef.current && imageAttachment?.uri !== originalImageAttachmentRef.current.uri
                    ? () => {
                        imageUploadedMediaRef.current = null;
                        setImageAttachment({ ...originalImageAttachmentRef.current!, clientMessageId: newMediaMessageId() });
                    }
                    : undefined}
                cropLabel={t('chat:crop', 'Crop')}
                resetLabel={t('chat:reset_image', 'Reset')}
            />
            <GalleryCropModal
                visible={cropOpen}
                imageUri={originalImageAttachmentRef.current?.uri || ''}
                isDark={isDark}
                uploading={false}
                labels={{
                    title: t('chat:crop', 'Crop'),
                    subtitle: t('chat:crop_hint', 'Move and zoom the image to frame it.'),
                    preparing: t('chat:crop_preparing', 'Preparing image...'),
                    upload: t('chat:crop_done', 'Done'),
                    rotate: t('chat:rotate_image', 'Rotate'),
                }}
                ratioOptions={[
                    { label: t('chat:original_ratio', 'Original'), value: 'original' },
                    { label: '1:1', value: 1 },
                    { label: '4:3', value: 4 / 3 },
                    { label: '3:4', value: 3 / 4 },
                    { label: '16:9', value: 16 / 9 },
                    { label: '9:16', value: 9 / 16 },
                ]}
                resetLabel={t('chat:reset_image', 'Reset')}
                onClose={() => setCropOpen(false)}
                onUpload={async (uri) => {
                    imageUploadedMediaRef.current = null;
                    setImageAttachment((current) => current ? { ...current, uri, name: `chat-crop-${Date.now()}.jpg`, type: 'image/jpeg', clientMessageId: newMediaMessageId() } : null);
                    setCropOpen(false);
                }}
                onError={() => toast.show(t('chat:crop_failed', 'Could not crop this image.'), 'error')}
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
                            <Text
                                variant="body-sm"
                                className="font-body-bold"
                                style={[styles.conversationMenuTitle, { color: colors.text, textAlign: isRTL ? 'right' : 'left' }]}
                            >
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

            <Modal
                visible={!!selectedMessage}
                transparent
                animationType="none"
                statusBarTranslucent
                navigationBarTranslucent
                hardwareAccelerated
                onRequestClose={closeMessageMenu}
            >
                <GestureHandlerRootView style={styles.messageMenuLayer}>
                    {!!selectedMessage && (() => {
                        const actionCount = 2
                            + (messageText(selectedMessage).trim() ? 1 : 0)
                            + (String(selectedMessage.sender) !== String(user?._id || user?.id || '') && selectedMessage.type !== 'system' && !selectedMessage.unsent ? 1 : 0)
                            + (canUnsendMessage(selectedMessage, String(user?._id || user?.id || '')) ? 1 : 0);
                        const sheetHeight = scale(86 + actionCount * 52) + insets.bottom;
                        return (
                        <BottomSheet
                            index={0}
                            snapPoints={[sheetHeight]}
                            enableDynamicSizing={false}
                            enablePanDownToClose={!messageActionBusy}
                            onClose={closeMessageMenu}
                            backdropComponent={renderMessageMenuBackdrop}
                            backgroundStyle={{ backgroundColor: colors.card }}
                            handleIndicatorStyle={{ backgroundColor: colors.muted }}
                        >
                        <BottomSheetView style={[styles.messageMenuSheet, { paddingBottom: insets.bottom + scale(10) }]}>
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
                            {String(selectedMessage.sender) !== String(user?._id || user?.id || '') && selectedMessage.type !== 'system' && !selectedMessage.unsent ? (
                                <MessageActionItem
                                    icon={Flag}
                                    label={translateChatText('report_message', 'Report message')}
                                    color={colors.danger}
                                    danger
                                    disabled={messageActionBusy}
                                    onPress={reportSelectedMessage}
                                />
                            ) : null}
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
                        </BottomSheetView>
                        </BottomSheet>
                        );
                    })()}
                </GestureHandlerRootView>
            </Modal>
            <UserProfileSheet
                visible={profileSheetOpen && Boolean(peerId)}
                userId={peerId}
                initialProfile={profileSheetProfile}
                onClose={() => setProfileSheetOpen(false)}
            />
            <ReportSheet
                target={reportTarget}
                onClose={() => setReportTarget(null)}
                onBlocked={() => {
                    setReportTarget(null);
                    goBackToMessages();
                }}
            />
            <ConfirmSheet
                visible={conversationConfirmation !== null}
                onClose={() => setConversationConfirmation(null)}
                onConfirm={() => void confirmConversationAction()}
                title={conversationConfirmation === 'delete'
                    ? translateChatText('delete_chat', 'Delete chat')
                    : translateChatText('end_conversation', 'End conversation')}
                message={conversationConfirmation === 'delete'
                    ? translateChatText('delete_chat_confirm', 'Delete this chat for me?')
                    : translateChatText('end_conversation_confirm', 'End this conversation?')}
                confirmLabel={conversationConfirmation === 'delete'
                    ? translateChatText('delete_chat', 'Delete chat')
                    : translateChatText('end_conversation', 'End conversation')}
                cancelLabel={t('cancel', 'Cancel')}
                confirmLoading={menuBusy}
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
    previewUri,
    recordingBusy,
    sending,
    sendFailed,
    waveform,
    onComplete,
    onError,
    onDiscard,
    onSendPreview,
    onFinalizeForSend,
}: {
    colors: Record<string, string>;
    duration: number;
    previewUri: string | null;
    recordingBusy: boolean;
    sending: boolean;
    sendFailed: boolean;
    waveform: number[];
    onComplete: (result: WaveformRecorderCompleteEvent) => void;
    onError: () => void;
    onDiscard: () => void;
    onSendPreview: () => void;
    onFinalizeForSend: () => void;
}) {
    const playbackOwnerRef = useRef(createChatAudioPlaybackOwner('native-recorder-preview'));
    const previewPlayingRef = useRef(false);
    const recorderRef = useRef<WaveformRecorderViewRef>(null);
    const startedRef = useRef(false);
    const discardedRef = useRef(false);
    const finalizingRef = useRef(false);
    const previewRequestedRef = useRef(false);
    const stateRef = useRef<WaveformRecorderState>('idle');
    const [nativeState, setNativeState] = useState<WaveformRecorderState>('idle');
    const [elapsedMs, setElapsedMs] = useState(0);
    const [previewPlaying, setPreviewPlaying] = useState(false);
    const [waveWidth, setWaveWidth] = useState(0);
    const [playbackFraction, setPlaybackFraction] = useState(0);
    const recordedMsRef = useRef(0);
    const recordingStartedAtRef = useRef<number | null>(null);
    const disabled = recordingBusy || sending;
    const isPreviewing = nativeState === 'preview';
    const isPaused = nativeState === 'paused';

    const pauseNativePreview = useCallback(() => {
        if (!previewPlayingRef.current) return;
        previewPlayingRef.current = false;
        recorderRef.current?.togglePreviewPlayback();
        setPreviewPlaying(false);
    }, []);

    useEffect(() => () => {
        releaseChatAudioPlayback(playbackOwnerRef.current);
        pauseNativePreview();
    }, [pauseNativePreview]);

    useEffect(() => {
        if (nativeState !== 'recording') return;
        const timer = setInterval(() => {
            setElapsedMs(Math.min(MAX_VOICE_RECORDING_SECONDS * 1000, recordedMsRef.current + Date.now() - (recordingStartedAtRef.current || Date.now())));
        }, 100);
        return () => clearInterval(timer);
    }, [nativeState]);

    useEffect(() => {
        const subscription = AppState.addEventListener('change', (next) => {
            if (next !== 'active' && stateRef.current === 'recording') {
                previewRequestedRef.current = false;
                recorderRef.current?.pause();
            } else if (next === 'active' && stateRef.current === 'paused') {
                previewRequestedRef.current = true;
                recorderRef.current?.enterPreview();
            }
        });
        return () => subscription.remove();
    }, []);

    const handleStateChange = (event: { state: WaveformRecorderState; durationMs: number }) => {
        stateRef.current = event.state;
        setNativeState(event.state);
        recordedMsRef.current = event.durationMs;
        recordingStartedAtRef.current = event.state === 'recording' ? Date.now() : null;
        setElapsedMs(event.durationMs);
        if (event.state !== 'preview') {
            releaseChatAudioPlayback(playbackOwnerRef.current);
            previewPlayingRef.current = false;
            setPreviewPlaying(false);
            setPlaybackFraction(0);
        }
        if (event.state === 'paused' && previewRequestedRef.current) {
            previewRequestedRef.current = false;
            requestAnimationFrame(() => {
                if (!finalizingRef.current && stateRef.current === 'paused') recorderRef.current?.enterPreview();
            });
        }
    };

    const handlePauseResume = () => {
        if (disabled || previewUri) return;
        if (nativeState === 'recording') {
            previewRequestedRef.current = true;
            recorderRef.current?.pause();
        } else if (nativeState === 'preview' || nativeState === 'paused') {
            previewRequestedRef.current = false;
            recorderRef.current?.resume();
        }
    };

    const handleDiscard = () => {
        if (disabled) return;
        discardedRef.current = true;
        finalizingRef.current = true;
        if (previewUri) {
            onDiscard();
            return;
        }
        recorderRef.current?.cancel();
        requestAnimationFrame(onDiscard);
    };

    const handleSend = () => {
        if (disabled) return;
        if (previewUri) {
            onSendPreview();
            return;
        }
        if (nativeState !== 'recording' && nativeState !== 'paused' && nativeState !== 'preview') return;
        finalizingRef.current = true;
        onFinalizeForSend();
        recorderRef.current?.stop();
    };

    return (
        <View style={[styles.voiceRecorderPanel, { backgroundColor: colors.card }]}>
            <View style={styles.voiceRecorderHeader}>
                {previewUri ? (
                    <VoicePreviewPlayer uri={previewUri} duration={duration} colors={colors} waveform={waveform} />
                ) : (
                    <>
                        {isPreviewing ? (
                            <Pressable accessibilityRole="button" accessibilityLabel={previewPlaying ? t('chat:voice_pause', 'Pause') : t('chat:voice_play', 'Play')} onPress={() => {
                                if (previewPlayingRef.current) {
                                    releaseChatAudioPlayback(playbackOwnerRef.current);
                                } else {
                                    claimChatAudioPlayback(playbackOwnerRef.current, pauseNativePreview);
                                }
                                recorderRef.current?.togglePreviewPlayback();
                                previewPlayingRef.current = !previewPlayingRef.current;
                                setPreviewPlaying(previewPlayingRef.current);
                            }} style={styles.voiceRecorderPreviewPlay}>
                                {previewPlaying ? <Pause size={scale(20)} color={colors.text} /> : <Play size={scale(20)} color={colors.text} />}
                            </Pressable>
                        ) : isPaused ? <View style={styles.voiceRecorderPreviewPlay}><ActivityIndicator color={colors.muted} size="small" /></View>
                            : <Text style={[styles.voiceRecorderTimeText, { color: colors.text }]}>{formatDuration(Math.floor(elapsedMs / 1000))}</Text>}
                        <View style={styles.voiceRecorderWaveSlot}>
                            <View style={styles.voiceRecorderNativeWaveHost} onLayout={(event) => setWaveWidth(event.nativeEvent.layout.width)}>
                            <WaveformRecorderView
                                ref={recorderRef}
                                style={styles.voiceRecorderNativeWave}
                                output={{ format: 'm4a', channels: 1, bitrate: 128000 }}
                                maxDurationMs={MAX_VOICE_RECORDING_SECONDS * 1000}
                                playedBarColor={colors.muted}
                                unplayedBarColor={colors.waveMuted}
                                barWidth={scale(3)}
                                barGap={scale(2)}
                                barRadius={scale(2)}
                                showBackground={false}
                                showTime={false}
                                showPlayButton={false}
                                enablePreview
                                enableContinueRecording
                                onLayout={() => {
                                    if (startedRef.current) return;
                                    startedRef.current = true;
                                    recorderRef.current?.start();
                                }}
                                onStateChange={handleStateChange}
                                onPlaybackTimeUpdate={({ positionMs, durationMs }) => {
                                    if (durationMs > 0) setPlaybackFraction(Math.max(0, Math.min(1, positionMs / durationMs)));
                                    if (durationMs > 0 && positionMs >= durationMs - 100) {
                                        previewPlayingRef.current = false;
                                        setPreviewPlaying(false);
                                        releaseChatAudioPlayback(playbackOwnerRef.current);
                                    }
                                }}
                                onSeek={({ positionMs }) => {
                                    if (elapsedMs > 0) setPlaybackFraction(Math.max(0, Math.min(1, positionMs / elapsedMs)));
                                }}
                                onComplete={(result) => { if (!discardedRef.current) onComplete(result); }}
                                onError={() => { if (!discardedRef.current) onError(); }}
                                onPermissionDenied={onError}
                            />
                            {isPreviewing ? <View pointerEvents="none" style={[styles.voiceRecorderScrubDot, { backgroundColor: colors.primary, left: Math.max(0, Math.min(waveWidth - scale(10), playbackFraction * waveWidth - scale(5))) }]} /> : null}
                            </View>
                        </View>
                        {isPreviewing || isPaused ? <Text style={[styles.voiceRecorderTimeText, { color: colors.text }]}>{formatDuration(Math.floor(elapsedMs / 1000))}</Text> : null}
                    </>
                )}
            </View>

            <View style={styles.voiceRecorderActions}>
                <Pressable accessibilityRole="button" accessibilityLabel={t('chat:voice_discard', 'Discard')} onPress={handleDiscard} disabled={disabled} style={[styles.voiceRecorderIconAction, { backgroundColor: colors.surface }]}>
                    <Trash2 size={scale(20)} color={colors.danger} />
                </Pressable>
                {previewUri ? (
                    <View style={[styles.voiceRecorderCentral, { backgroundColor: colors.surface }]}>
                        <Text variant="caption" style={{ color: sendFailed ? colors.danger : colors.muted }}>
                            {sendFailed ? t('chat:voice_retry', 'Ready to retry') : t('chat:voice_ready', 'Ready to send')}
                        </Text>
                    </View>
                ) : (
                    <Pressable accessibilityRole="button" accessibilityLabel={isPreviewing || isPaused ? t('chat:voice_resume', 'Resume') : t('chat:voice_pause', 'Pause')} onPress={handlePauseResume} disabled={disabled || nativeState === 'idle' || isPaused} style={[styles.voiceRecorderCentral, { backgroundColor: colors.surface }]}>
                        {isPreviewing || isPaused ? <Mic size={scale(19)} color={colors.text} /> : <Pause size={scale(18)} color={colors.text} />}
                        <Text variant="body-sm" className="font-body-bold" style={{ color: colors.text }}>
                            {isPreviewing || isPaused ? t('chat:voice_resume', 'Resume') : t('chat:voice_pause', 'Pause')}
                        </Text>
                    </Pressable>
                )}
                <Pressable accessibilityRole="button" accessibilityLabel={sendFailed ? t('chat:voice_retry', 'Retry') : t('chat:send', 'Send')} onPress={handleSend} disabled={disabled || (!previewUri && nativeState === 'idle')} style={[styles.voiceRecorderIconAction, { backgroundColor: colors.primary }]}>
                    {sending || recordingBusy ? <ActivityIndicator color={colors.inverse} size="small" /> : <PaperPlaneTilt size={scale(20)} color={colors.inverse} weight="fill" />}
                </Pressable>
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
    const playbackOwnerRef = useRef(createChatAudioPlaybackOwner('voice-preview'));
    const player = useAudioPlayer(uri, { updateInterval: 250 });
    const status = useAudioPlayerStatus(player);
    const progress = status.duration > 0 ? Math.min(1, status.currentTime / status.duration) : 0;
    const [trackWidth, setTrackWidth] = useState(0);
    const [scrubProgress, setScrubProgress] = useState<number | null>(null);
    const shownProgress = scrubProgress ?? progress;
    const samples = waveform.length ? waveform : Array.from({ length: 32 }, () => 0.08);
    const fractionAt = (x: number) => trackWidth > 0 ? Math.max(0, Math.min(1, x / trackWidth)) : 0;
    const pauseThisPlayer = useCallback(() => {
        try {
            player.pause();
        } catch {
            // Native player may already be releasing during navigation.
        }
    }, [player]);

    useEffect(() => {
        if (status.didJustFinish) releaseChatAudioPlayback(playbackOwnerRef.current);
    }, [status.didJustFinish]);

    useEffect(() => () => {
        releaseChatAudioPlayback(playbackOwnerRef.current);
        pauseThisPlayer();
    }, [pauseThisPlayer]);

    const toggle = async () => {
        try {
            if (status.playing) {
                await player.pause();
                releaseChatAudioPlayback(playbackOwnerRef.current);
                return;
            }
            if (status.didJustFinish) {
                await player.seekTo(0).catch(() => undefined);
            }
            claimChatAudioPlayback(playbackOwnerRef.current, pauseThisPlayer);
            await player.play();
        } catch {
            toast.show(translateChatText('media_playback_failed', 'Could not play this voice note. Please try again.'), 'error');
        }
    };

    return (
        <View style={styles.voiceRecorderPreview}>
            <Pressable accessibilityRole="button" accessibilityLabel={status.playing ? t('chat:voice_pause', 'Pause') : t('chat:voice_play', 'Play')} onPress={toggle} style={styles.voiceRecorderPreviewPlay}>
                {status.playing
                    ? <Pause size={scale(20)} color={colors.text} fill={colors.text} />
                    : <Play size={scale(20)} color={colors.text} fill={colors.text} />}
            </Pressable>
            <View
                style={styles.voiceRecorderPreviewTrack}
                onLayout={(event) => setTrackWidth(event.nativeEvent.layout.width)}
                onStartShouldSetResponder={() => true}
                onMoveShouldSetResponder={() => true}
                onResponderGrant={(event) => setScrubProgress(fractionAt(event.nativeEvent.locationX))}
                onResponderMove={(event) => setScrubProgress(fractionAt(event.nativeEvent.locationX))}
                onResponderRelease={(event) => {
                    const fraction = fractionAt(event.nativeEvent.locationX);
                    const seekDuration = status.duration || duration;
                    if (seekDuration > 0) {
                        void player.seekTo(fraction * seekDuration)
                            .catch(() => toast.show(translateChatText('media_playback_failed', 'Could not play this voice note. Please try again.'), 'error'))
                            .finally(() => setScrubProgress(null));
                    } else {
                        setScrubProgress(null);
                    }
                }}
                onResponderTerminate={() => setScrubProgress(null)}
                accessibilityRole="adjustable"
                accessibilityLabel={t('chat:voice_seek', 'Voice playback position')}
                accessibilityValue={{ min: 0, max: 100, now: Math.round(shownProgress * 100) }}
                accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
                onAccessibilityAction={(event) => {
                    const step = event.nativeEvent.actionName === 'increment' ? 0.1 : -0.1;
                    const seekDuration = status.duration || duration;
                    if (seekDuration > 0) void player.seekTo(Math.max(0, Math.min(1, progress + step)) * seekDuration).catch(() => undefined);
                }}
            >
                <View pointerEvents="none" style={styles.voiceRecorderPreviewWave}>
                    {samples.map((value, index) => (
                        <View
                            key={`preview-wave-${index}`}
                            style={[
                                styles.waveBar,
                                {
                                    height: scale(5 + value * 31),
                                    backgroundColor: index < shownProgress * samples.length ? colors.muted : colors.waveMuted,
                                },
                            ]}
                        />
                    ))}
                </View>
                <View pointerEvents="none" style={[styles.voiceRecorderScrubDot, { backgroundColor: colors.primary, left: Math.max(0, shownProgress * trackWidth - scale(5)) }]} />
            </View>
            <Text style={[styles.voiceRecorderTimeText, { color: colors.text }]}>
                {formatDuration(Math.max(0, Math.round(status.duration || duration)))}
            </Text>
        </View>
    );
}

// Pressable that springs down slightly while pressed (used for composer buttons
// and image bubbles) for a tactile micro-interaction.
// Three pulsing dots shown at the visual bottom of the (inverted) list while
// the peer is typing.
function TypingDot({ progress, index, color }: { progress: SharedValue<number>; index: number; color: string }) {
    const liftDistance = scale(3);
    const animated = useAnimatedStyle(() => {
        const phase = (progress.value + index / 3) % 1;
        const lift = phase < 0.5 ? phase * 2 : (1 - phase) * 2;
        return {
            opacity: 0.35 + lift * 0.65,
            transform: [{ translateY: -lift * liftDistance }],
        };
    });
    return <Reanimated.View style={[styles.typingDot, { backgroundColor: color }, animated]} />;
}

function TypingIndicatorBubble({ colors }: { colors: Record<string, string> }) {
    const progress = useSharedValue(0);
    useEffect(() => {
        progress.value = withRepeat(withTiming(1, { duration: 900, easing: Easing.linear }), -1, false);
        return () => { progress.value = 0; };
    }, [progress]);
    return (
        <Reanimated.View entering={ZoomIn.duration(140)} exiting={ZoomOut.duration(120)} style={styles.typingRow}>
            <View style={[styles.typingBubble, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                {[0, 1, 2].map((index) => (
                    <TypingDot key={index} progress={progress} index={index} color={colors.muted} />
                ))}
            </View>
        </Reanimated.View>
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
                <CaretDoubleDown size={scale(22)} color={colors.muted} weight="bold" />
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

function MessageTimeMeta({
    message,
    mine,
    colors,
    style,
}: {
    message: ChatMessage;
    mine: boolean;
    colors: Record<string, string>;
    style?: StyleProp<ViewStyle>;
}) {
    const metaColor = mine ? colors.bubbleMineMuted : colors.muted;
    return (
        <View style={style}>
            <Text variant="caption" style={{ color: metaColor, fontSize: scale(10), lineHeight: scale(12) }}>
                {formatMessageTime(message.createdAt)}
            </Text>
            {mine && !message.pending && (
                message.seenAt
                    ? <CheckCheck size={scale(12)} color={colors.seenTick} />
                    : message.deliveredAt
                        ? <CheckCheck size={scale(12)} color={metaColor} />
                        : <Check size={scale(12)} color={metaColor} />
            )}
            {mine && message.pending && (
                <Text variant="caption" style={{ color: metaColor, fontSize: scale(9), lineHeight: scale(11) }}>
                    {message.queued ? t('chat:queued', 'Queued') : t('chat:sending', 'Sending...')}
                </Text>
            )}
            {message.failed && (
                <Text variant="caption" className="font-body-bold" style={{ color: colors.danger }}>
                    {translateChatText('tap_to_retry', 'Tap to retry')}
                </Text>
            )}
        </View>
    );
}

function TextMessageWithInlineMeta({
    content,
    message,
    mine,
    colors,
    textColor,
}: {
    content: string;
    message: ChatMessage;
    mine: boolean;
    colors: Record<string, string>;
    textColor: string;
}) {
    const [layoutMode, setLayoutMode] = useState<'reserved' | 'natural' | 'stacked'>('reserved');
    const [contentWidth, setContentWidth] = useState(0);
    // Figure spaces reserve the metadata width without relying on nested text
    // transparency, which Android does not consistently honor.
    const reserve = `\u00A0${'\u2007'.repeat(mine ? 11 : 9)}`;
    const metadataWidth = scale(mine ? 72 : 56);
    return (
        <View
            style={[styles.textMessageWithMeta, layoutMode === 'stacked' && styles.textMessageMetaStacked]}
            onLayout={(event) => {
                const width = event.nativeEvent.layout.width;
                setContentWidth((current) => Math.abs(current - width) < 0.5 ? current : width);
            }}
        >
            <Text
                variant="body"
                style={[styles.messageText, { color: textColor }, directionalTextStyle(content)]}
                onTextLayout={(event) => {
                    const lines = event.nativeEvent.lines;
                    if (layoutMode === 'reserved' && lines.length > 1) {
                        setLayoutMode('natural');
                        return;
                    }
                    if (layoutMode === 'natural' && contentWidth > 0 && lines.length > 0) {
                        const lastLine = lines[lines.length - 1];
                        if (lastLine.width + metadataWidth > contentWidth) setLayoutMode('stacked');
                    }
                }}
            >
                {content}
                {layoutMode === 'reserved' && <RNText style={styles.inlineMetaReserve}>{reserve}</RNText>}
            </Text>
            <MessageTimeMeta message={message} mine={mine} colors={colors} style={styles.inlineTimeRow} />
        </View>
    );
}

function MessageBubbleComponent({
    message,
    mine,
    rowGap,
    uiDirection,
    colors,
    userId,
    animateIn,
    onOpenImage,
    onOpenViewOnce,
    viewOnceLoading,
    onOpenMenu,
    onRetry,
    onSwipeReply,
    onReplyClick,
}: {
    message: ChatMessage;
    mine: boolean;
    rowGap: number;
    uiDirection: 'ltr' | 'rtl';
    colors: Record<string, string>;
    userId: string;
    animateIn: boolean;
    onOpenImage: (url: string) => void;
    onOpenViewOnce: (message: ChatMessage) => void;
    viewOnceLoading: boolean;
    onOpenMenu: (message: ChatMessage) => void;
    onRetry: (message: ChatMessage) => void;
    onSwipeReply: (message: ChatMessage) => void;
    onReplyClick: (messageId: string) => void;
}) {
    const content = messageText(message);

    if (message.type === 'system') {
        const systemContent = String(message.content || '').trim().toLowerCase().replace(/\s+/g, '_');
        const isGalleryAccessSystem = systemContent === 'gallery_access_granted' || systemContent === 'gallery_access_revoked';
        if (isGalleryAccessSystem) {
            // Centered privacy-safe pill with a camera emoji; the "revealed" pill
            // opens the owner's profile so the viewer can see the photos.
            const canOpenGalleryOwner = systemContent === 'gallery_access_granted'
                && message.sender
                && message.sender !== '000000000000000000000000';
            return (
                <View style={styles.systemWrap}>
                    <Pressable
                        disabled={!canOpenGalleryOwner}
                        onPress={() => {
                            if (!canOpenGalleryOwner) return;
                            if (mine) router.push('/(tabs)/profile');
                            else router.push(`/user/${message.sender}`);
                        }}
                        style={[styles.systemPillRow, { backgroundColor: colors.surface }]}
                    >
                        <Text variant="caption" className="font-body-semi" style={{ color: colors.muted }}>
                            {'\u{1F4F7} '}{translateChatText(systemContent, systemContent === 'gallery_access_granted' ? 'Photos revealed' : 'Photo access ended')}
                        </Text>
                    </Pressable>
                </View>
            );
        }
        return (
            <View style={styles.systemWrap}>
                <Text variant="caption" className="font-body-semi" style={[styles.systemText, { backgroundColor: colors.surface, color: colors.muted }]}>
                    {translateChatText(message.content || 'request_accepted', 'Request accepted')}
                </Text>
            </View>
        );
    }

    if (message.unsent) {
        const unsentLabel = translateChatText('message_unsent', 'Message unsent');
        return (
            <View style={[styles.bubbleRow, { marginBottom: rowGap }, mine ? styles.bubbleRight : styles.bubbleLeft]}>
                <View style={[styles.unsentBubble, { borderColor: colors.border, direction: uiDirection }]}>
                    <Text variant="body-sm" style={[{ color: colors.muted, fontStyle: 'italic' }, directionalTextStyle(unsentLabel)]}>
                        {unsentLabel}
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
    const quotedText = replyPreview(replyTo);
    const reactions = message.reactions || [];
    const messageTextColor = mine ? colors.bubbleMineText : colors.text;
    const messageMetaColor = mine ? colors.bubbleMineMuted : colors.muted;
    const useInlineTextMeta = message.type === 'text' && !!content && !message.pending && !message.failed;
    const swipeX = useRef(new Animated.Value(0)).current;
    const resetSwipe = useCallback(() => {
        Animated.spring(swipeX, {
            toValue: 0,
            useNativeDriver: true,
            tension: 120,
            friction: 14,
        }).start();
    }, [swipeX]);
    const bubbleGesture = useMemo(() => {
        const swipe = Gesture.Pan()
            .activeOffsetX(scale(12))
            .failOffsetY([-scale(12), scale(12)])
            .runOnJS(true)
            .onUpdate((event) => {
            const nextX = Math.max(0, Math.min(scale(72), event.translationX));
            swipeX.setValue(nextX);
            })
            .onEnd((event) => {
                if (event.translationX >= scale(56)) onSwipeReply(message);
            })
            .onFinalize(resetSwipe);
        const longPress = Gesture.LongPress()
            .enabled(!message.failed)
            .minDuration(360)
            .maxDistance(scale(18))
            .runOnJS(true)
            .onStart(() => onOpenMenu(message));
        return Gesture.Race(swipe, longPress);
    }, [message, onOpenMenu, onSwipeReply, resetSwipe, swipeX]);
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
            style={[
                styles.bubbleRow,
                { marginBottom: rowGap + (reactions.length > 0 ? 4 : 0) },
                mine ? styles.bubbleRight : styles.bubbleLeft,
            ]}
            entering={animateIn ? FadeInDown.duration(240) : undefined}
        >
            <View style={[styles.swipeReplyWrap, { direction: uiDirection }]}>
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
                <GestureDetector gesture={bubbleGesture}>
                <Animated.View style={[styles.swipeReplyBubble, { transform: [{ translateX: swipeX }] }]}>
                    <Pressable
                        onPress={message.failed ? () => onRetry(message) : undefined}
                        accessibilityRole={message.failed ? 'button' : undefined}
                        accessibilityLabel={message.failed ? translateChatText('tap_to_retry', 'Tap to retry') : undefined}
                    >
                        <View style={[
                            styles.bubble,
                            mine ? styles.mineBubble : styles.theirBubble,
                            {
                                backgroundColor: mine ? colors.bubbleMine : colors.surface,
                                borderColor: mine ? colors.bubbleMineBorder : colors.border,
                                shadowColor: '#1A130D',
                                shadowOpacity: mine ? 0.04 : 0.08,
                                shadowRadius: scale(3),
                                shadowOffset: { width: 0, height: 0 },
                                elevation: mine ? 0 : 1,
                            },
                        ]}>
                            {replyTo && (
                                <Pressable
                                    onPress={() => onReplyClick(replyTo.id)}
                                    style={[styles.replyQuote, { backgroundColor: mine ? colors.bubbleMineInset : colors.surface, borderLeftColor: colors.primary }]}
                                >
                                    <Text variant="caption" className="font-body-bold" style={{ color: colors.primary }}>
                                        {t('chat:reply', 'Reply')}
                                    </Text>
                                    <Text variant="caption" numberOfLines={2} style={[{ color: messageMetaColor }, directionalTextStyle(quotedText)]}>
                                        {quotedText}
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
                            style={[styles.viewOnceButton, { backgroundColor: mine ? colors.bubbleMineInset : colors.surface }]}
                        >
                            <View style={styles.viewOnceIconBadge}>
                                {viewOnceLoading
                                    ? <ActivityIndicator color={colors.primary} size="small" />
                                    : <ViewOnceIcon size={scale(28)} color={colors.primary} active={true} />}
                            </View>
                            <View style={styles.viewOnceTextWrap}>
                                <Text variant="body-sm" className="font-body-bold" numberOfLines={1} style={{ color: messageTextColor }}>
                                    {translateChatText('view_once_photo', 'View once photo')}
                                </Text>
                                <Text variant="caption" numberOfLines={1} style={{ color: messageMetaColor }}>
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
                        <VoiceMessage
                            message={message}
                            media={media}
                            mine={mine}
                            colors={colors}
                            userId={userId}
                            onLongPress={() => onOpenMenu(message)}
                        />
                    )}

                    {!!content && (
                        useInlineTextMeta ? (
                            <TextMessageWithInlineMeta
                                content={content}
                                message={message}
                                mine={mine}
                                colors={colors}
                                textColor={messageTextColor}
                            />
                        ) : (
                            <Text variant="body" style={[styles.messageText, { color: messageTextColor }, directionalTextStyle(content)]}>
                                {content}
                            </Text>
                        )
                    )}

                            {!useInlineTextMeta && (
                                <MessageTimeMeta message={message} mine={mine} colors={colors} style={styles.timeRow} />
                            )}
                        </View>
                    </Pressable>
                </Animated.View>
                </GestureDetector>
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
    onLongPress,
}: {
    message: ChatMessage;
    media?: MessageMedia | null;
    mine: boolean;
    colors: Record<string, string>;
    userId: string;
    onLongPress: () => void;
}) {
    const toast = useToast();
    const playbackOwnerRef = useRef(createChatAudioPlaybackOwner(`voice-message:${message.id}`));
    const [downloading, setDownloading] = useState(false);
    const sourceUriRef = useRef<string | null>(null);
    const pendingPlayRef = useRef(false);
    const pendingSeekRef = useRef<number | null>(null);
    const recoveryAttemptedRef = useRef(false);
    const suppressNextPressRef = useRef(false);
    const [trackWidth, setTrackWidth] = useState(0);
    const [scrubProgress, setScrubProgress] = useState<number | null>(null);
    const player = useAudioPlayer(null, { updateInterval: 100 });
    const status = useAudioPlayerStatus(player);
    const progress = status.duration > 0 ? Math.min(1, status.currentTime / status.duration) : 0;
    const shownProgress = scrubProgress ?? progress;
    const effectiveDuration = status.duration || media?.duration || 0;
    const displaySeconds = Math.max(0, Math.round(scrubProgress !== null
        ? scrubProgress * effectiveDuration
        : status.playing ? status.currentTime : effectiveDuration || status.currentTime || 0));
    const waveform = useMemo(() => {
        const real = waveformPeaks(media?.waveform || [], VOICE_MESSAGE_WAVE_BAR_COUNT);
        return real.length ? real : Array.from({ length: VOICE_MESSAGE_WAVE_BAR_COUNT }, () => 0.22);
    }, [media?.waveform]);

    const pauseThisPlayer = useCallback(() => {
        try {
            player.pause();
        } catch {
            // The hook owns native player disposal during fast navigation.
        }
    }, [player]);

    const replaceSource = useCallback((uri: string, playWhenReady: boolean) => {
        if (sourceUriRef.current === uri) {
            pendingPlayRef.current = pendingPlayRef.current || playWhenReady;
            return;
        }
        unpinCachedChatMedia(sourceUriRef.current);
        sourceUriRef.current = uri;
        pinCachedChatMedia(uri);
        pendingPlayRef.current = playWhenReady;
        player.replace(uri);
    }, [player]);

    useEffect(() => {
        let disposed = false;
        (async () => {
            if (media?.localUri) {
                const local = await FileSystem.getInfoAsync(media.localUri).catch(() => null);
                if (!disposed && !pendingPlayRef.current && !sourceUriRef.current && local?.exists) {
                    replaceSource(media.localUri, false);
                    return;
                }
            }
            const cached = await getCachedChatMedia({
                userId,
                conversationId: message.conversationId,
                messageId: message.id,
                media,
                kind: 'voice',
            }).catch(() => null);
            if (!disposed && !pendingPlayRef.current && !sourceUriRef.current && cached?.cached) replaceSource(cached.uri, false);
        })();
        return () => {
            disposed = true;
        };
    }, [media?.key, media?.localUri, media?.mime, media?.url, message.conversationId, message.id, replaceSource, userId]);

    useEffect(() => {
        if (!sourceUriRef.current || !status.isLoaded) return;
        const seekFraction = pendingSeekRef.current;
        const shouldPlay = pendingPlayRef.current;
        if (seekFraction === null && !shouldPlay) return;
        pendingSeekRef.current = null;
        pendingPlayRef.current = false;
        void (async () => {
            try {
                const duration = status.duration || media?.duration || 0;
                if (seekFraction !== null && duration > 0) await player.seekTo(seekFraction * duration);
                if (shouldPlay) {
                    claimChatAudioPlayback(playbackOwnerRef.current, pauseThisPlayer);
                    player.play();
                }
            } catch {
                releaseChatAudioPlayback(playbackOwnerRef.current);
                toast.show(translateChatText('media_playback_failed', 'Could not play this voice note. Please try again.'), 'error');
            }
        })();
    }, [media?.duration, message.id, pauseThisPlayer, player, status.duration, status.isLoaded, toast]);

    useEffect(() => {
        if (status.didJustFinish) releaseChatAudioPlayback(playbackOwnerRef.current);
    }, [status.didJustFinish]);

    useEffect(() => {
        if (!status.error || !sourceUriRef.current) return;
        if (recoveryAttemptedRef.current) {
            pendingPlayRef.current = false;
            releaseChatAudioPlayback(playbackOwnerRef.current);
            toast.show(translateChatText('media_playback_failed', 'Could not play this voice note. Please try again.'), 'error');
            return;
        }

        recoveryAttemptedRef.current = true;
        pendingPlayRef.current = true;
        setDownloading(true);
        void (async () => {
            await deleteCachedChatMediaForMessage({
                userId,
                conversationId: message.conversationId,
                messageId: message.id,
            });
            const cached = await cacheChatMedia({
                userId,
                conversationId: message.conversationId,
                messageId: message.id,
                media: { ...media, localUri: undefined },
                kind: 'voice',
            });
            replaceSource(cached.uri, true);
        })().catch(() => {
            pendingPlayRef.current = false;
            toast.show(translateChatText('media_download_failed', 'Could not download media. Please try again.'), 'error');
        }).finally(() => setDownloading(false));
    }, [media, message.conversationId, message.id, replaceSource, status.error, toast, userId]);

    useEffect(() => () => {
        pendingPlayRef.current = false;
        pendingSeekRef.current = null;
        releaseChatAudioPlayback(playbackOwnerRef.current);
        pauseThisPlayer();
        unpinCachedChatMedia(sourceUriRef.current);
    }, [pauseThisPlayer]);

    const toggle = async () => {
        if (suppressNextPressRef.current) {
            suppressNextPressRef.current = false;
            return;
        }
        if (downloading) return;
        try {
            if (status.playing) {
                player.pause();
                releaseChatAudioPlayback(playbackOwnerRef.current);
                return;
            }

            if (status.didJustFinish) {
                await player.seekTo(0).catch(() => undefined);
            }

            if (sourceUriRef.current && status.isLoaded) {
                claimChatAudioPlayback(playbackOwnerRef.current, pauseThisPlayer);
                player.play();
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
            recoveryAttemptedRef.current = false;
            replaceSource(cached.uri, true);
        } catch {
            toast.show(translateChatText('media_download_failed', 'Could not download media. Please try again.'), 'error');
        } finally {
            setDownloading(false);
        }
    };

    const fractionAt = (x: number) => trackWidth > 0 ? Math.max(0, Math.min(1, x / trackWidth)) : 0;
    const seekToFraction = async (fraction: number) => {
        if (downloading) return;
        const duration = status.duration || media?.duration || 0;
        if (sourceUriRef.current && status.isLoaded && duration > 0) {
            await player.seekTo(fraction * duration);
            return;
        }
        pendingSeekRef.current = fraction;
        setDownloading(true);
        try {
            const cached = await cacheChatMedia({
                userId,
                conversationId: message.conversationId,
                messageId: message.id,
                media,
                kind: 'voice',
            });
            recoveryAttemptedRef.current = false;
            replaceSource(cached.uri, false);
        } catch {
            pendingSeekRef.current = null;
            toast.show(translateChatText('media_download_failed', 'Could not download media. Please try again.'), 'error');
        } finally {
            setDownloading(false);
        }
    };

    return (
        <View style={styles.voiceWrap}>
            <View style={styles.voicePlaybackControl}>
                <Pressable
                    onPress={toggle}
                    onLongPress={() => {
                        suppressNextPressRef.current = true;
                        onLongPress();
                    }}
                    delayLongPress={360}
                    disabled={downloading}
                    accessibilityRole="button"
                    accessibilityLabel={status.playing
                        ? translateChatText('voice_pause', 'Pause')
                        : translateChatText('voice_play', 'Play')}
                    style={styles.voicePlayButton}
                >
                    {downloading || status.isBuffering
                        ? <ActivityIndicator color={colors.inverse} size="small" />
                        : status.playing
                            ? <Pause size={scale(14)} color={colors.inverse} fill={colors.inverse} />
                            : <Play size={scale(14)} color={colors.inverse} fill={colors.inverse} />}
                </Pressable>
                <View
                    style={styles.voiceProgressTrack}
                    onLayout={(event) => setTrackWidth(event.nativeEvent.layout.width)}
                    onStartShouldSetResponder={() => true}
                    onMoveShouldSetResponder={() => true}
                    onResponderGrant={(event) => setScrubProgress(fractionAt(event.nativeEvent.locationX))}
                    onResponderMove={(event) => setScrubProgress(fractionAt(event.nativeEvent.locationX))}
                    onResponderRelease={(event) => {
                        const fraction = fractionAt(event.nativeEvent.locationX);
                        void seekToFraction(fraction)
                            .catch(() => toast.show(translateChatText('media_playback_failed', 'Could not play this voice note. Please try again.'), 'error'))
                            .finally(() => setScrubProgress(null));
                    }}
                    onResponderTerminate={() => setScrubProgress(null)}
                    accessibilityRole="adjustable"
                    accessibilityLabel={translateChatText('voice_seek', 'Voice playback position')}
                    accessibilityValue={{ min: 0, max: 100, now: Math.round(shownProgress * 100) }}
                    accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
                    onAccessibilityAction={(event) => {
                        const step = event.nativeEvent.actionName === 'increment' ? 0.1 : -0.1;
                        void seekToFraction(Math.max(0, Math.min(1, progress + step))).catch(() => undefined);
                    }}
                >
                    <View pointerEvents="none" style={styles.wave}>
                        {waveform.map((amplitude, index) => (
                            <View
                                key={`voice-${message.id}-${index}`}
                                style={[
                                    styles.waveBar,
                                    {
                                        height: scale(7 + amplitude * 21),
                                        backgroundColor: index < shownProgress * waveform.length
                                            ? colors.primary
                                            : mine ? colors.bubbleMineMuted : colors.waveMuted,
                                    },
                                ]}
                            />
                        ))}
                    </View>
                    <View
                        pointerEvents="none"
                        style={[
                            styles.voiceMessageScrubDot,
                            { backgroundColor: colors.primary, left: Math.max(0, shownProgress * trackWidth - scale(4)) },
                        ]}
                    />
                </View>
            </View>
            <View style={styles.voiceDurationRow}>
                <Text variant="caption" className="font-body-semi" numberOfLines={1} style={[styles.voiceDuration, { color: mine ? colors.bubbleMineMuted : colors.muted }]}>
                    {formatDuration(displaySeconds)}
                </Text>
            </View>
        </View>
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
        width: scale(36),
        height: scale(36),
        borderRadius: scale(18),
        borderWidth: StyleSheet.hairlineWidth,
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: '#000000',
        shadowOpacity: 0.08,
        shadowRadius: scale(3),
        shadowOffset: { width: 0, height: 1 },
        elevation: 2,
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
    gateContent: { flex: 1, justifyContent: 'center', paddingHorizontal: scale(16) },
    header: {
        minHeight: scale(56),
        flexDirection: 'row',
        direction: 'ltr',
        alignItems: 'stretch',
        // 5.5 + 9.5 (arrow inset inside its 40pt circle) = 15dp edge→glyph
        paddingHorizontal: scale(5.5),
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
        // Sized to its content (avatar + name + status) so taps outside the
        // section don't open the profile; shrinks when header actions need room
        flexShrink: 1,
        minWidth: 0,
        alignSelf: 'stretch',
        justifyContent: 'center',
        paddingVertical: scale(2),
        paddingHorizontal: scale(4),
    },
    headerProfileContent: {
        flexDirection: 'row',
        alignItems: 'center',
        alignSelf: 'stretch',
        minWidth: 0,
        gap: scale(8),
    },
    headerAvatar: {
        width: scale(40),
        height: scale(40),
        borderRadius: scale(20),
        borderWidth: StyleSheet.hairlineWidth,
        overflow: 'hidden',
    },
    headerText: { flexShrink: 1, minWidth: 0, justifyContent: 'center' },
    headerNameText: { fontSize: scale(15), lineHeight: scale(18), fontWeight: '700', includeFontPadding: false, textAlignVertical: 'center' },
    headerStatusText: { marginTop: scale(2), fontSize: scale(12), lineHeight: scale(14), fontWeight: '400', includeFontPadding: false },
    headerSpacer: { flex: 1, minWidth: 0, alignSelf: 'stretch' },
    empty: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingBottom: scale(80) },
    dateWrap: { alignItems: 'center', marginVertical: scale(8) },
    dateLabel: { paddingHorizontal: scale(12), paddingVertical: scale(5), borderRadius: scale(14), overflow: 'hidden', textTransform: 'uppercase' },
    bubbleRow: { width: '100%', direction: 'ltr' },
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
    textMessageWithMeta: { position: 'relative' },
    textMessageMetaStacked: { paddingBottom: scale(17) },
    inlineMetaReserve: { fontSize: scale(10), lineHeight: scale(12) },
    inlineTimeRow: { position: 'absolute', right: 0, bottom: 0, flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: scale(4), minHeight: scale(14) },
    timeRow: { alignSelf: 'flex-end', flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: scale(4), marginTop: scale(6), minHeight: scale(14) },
    systemWrap: { alignItems: 'center', marginVertical: scale(7) },
    systemText: { paddingHorizontal: scale(12), paddingVertical: scale(5), borderRadius: scale(14), overflow: 'hidden' },
    systemPillRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: scale(12), paddingVertical: scale(5), borderRadius: scale(14), overflow: 'hidden' },
    unsentBubble: { borderWidth: StyleSheet.hairlineWidth, borderStyle: 'dashed', borderRadius: scale(14), paddingHorizontal: scale(12), paddingVertical: scale(8) },
    mediaWrap: { overflow: 'hidden', borderRadius: scale(9), marginBottom: scale(5), backgroundColor: '#E8E1D6' },
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
        borderColor: 'rgba(160, 160, 168,0.24)',
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
        backgroundColor: 'rgba(16, 16, 17,0.70)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    voiceWrap: { width: '100%', minWidth: scale(230), borderRadius: scale(12), paddingVertical: scale(2), flexDirection: 'row', alignItems: 'center', gap: scale(8), marginBottom: scale(2) },
    voicePlaybackControl: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: scale(8) },
    voicePlayButton: {
        width: scale(32),
        height: scale(32),
        borderRadius: scale(16),
        backgroundColor: PRIMARY,
        alignItems: 'center',
        justifyContent: 'center',
    },
    voiceProgressTrack: { flex: 1, minWidth: scale(90), height: scale(32), justifyContent: 'center', position: 'relative' },
    wave: { flex: 1, height: scale(30), flexDirection: 'row', alignItems: 'center', gap: scale(1.5) },
    waveBar: { flex: 1, maxWidth: scale(4), borderRadius: scale(2) },
    voiceMessageScrubDot: {
        position: 'absolute',
        top: '50%',
        width: scale(8),
        height: scale(8),
        marginTop: -scale(4),
        borderRadius: scale(4),
    },
    voiceDurationRow: { minWidth: scale(36), flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end' },
    voiceDuration: { minWidth: scale(28), textAlign: 'right', fontSize: scale(11), lineHeight: scale(14) },
    requestBar: { alignItems: 'center', justifyContent: 'center', paddingHorizontal: scale(14), paddingTop: scale(10) },
    requestHint: { marginBottom: scale(9), fontSize: scale(12), lineHeight: scale(15) },
    requestActions: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: scale(10) },
    requestButton: { minWidth: scale(110), height: scale(36), borderRadius: scale(18), paddingHorizontal: scale(16), flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: scale(6) },
    requestPrimary: { backgroundColor: PRIMARY },
    requestNeutral: { backgroundColor: '#FFFFFF', borderWidth: StyleSheet.hairlineWidth, borderColor: '#D8CFC2' },
    disabledButton: { opacity: 0.62 },
    endedBar: { padding: scale(13) },
    composer: {},
    typingRow: { paddingVertical: scale(4), alignItems: 'flex-start' },
    typingBubble: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: scale(5),
        paddingHorizontal: scale(14),
        paddingVertical: scale(12),
        borderRadius: scale(16),
        borderBottomLeftRadius: scale(5),
        borderWidth: StyleSheet.hairlineWidth,
    },
    typingDot: { width: scale(7), height: scale(7), borderRadius: scale(4) },
    // Equal top/bottom padding so the input sits centered in the bar
    composerRow: { flexDirection: 'row', alignItems: 'flex-end', gap: scale(8), paddingHorizontal: scale(12), paddingVertical: scale(8) },
    inputPill: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'flex-end',
        minHeight: scale(44),
        borderRadius: scale(22),
        borderWidth: StyleSheet.hairlineWidth,
        paddingHorizontal: scale(4),
    },
    pillIcon: {
        width: scale(38),
        height: scale(44),
        alignItems: 'center',
        justifyContent: 'center',
    },
    pillIconCluster: { flexDirection: 'row', alignItems: 'flex-end' },
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
        minHeight: scale(44),
        maxHeight: scale(120),
        paddingHorizontal: scale(6),
        // Equal vertical padding keeps text centered in the pill
        paddingTop: scale(12),
        paddingBottom: scale(12),
        fontSize: scale(14),
        lineHeight: scale(19),
    },
    send: {
        width: scale(44),
        height: scale(44),
        borderRadius: scale(22),
        alignItems: 'center',
        justifyContent: 'center',
    },
    voiceRecorderPanel: { gap: scale(13), paddingHorizontal: scale(14), paddingTop: scale(13), paddingBottom: scale(10), borderTopLeftRadius: scale(18), borderTopRightRadius: scale(18) },
    voiceRecorderHeader: { height: scale(44), flexDirection: 'row', alignItems: 'center', gap: scale(11) },
    voiceRecorderTimeText: { minWidth: scale(42), fontSize: scale(16), lineHeight: scale(22), fontVariant: ['tabular-nums'] },
    voiceRecorderWaveSlot: { flex: 1, minWidth: 0, justifyContent: 'center' },
    voiceRecorderIconAction: { width: scale(44), height: scale(44), borderRadius: scale(22), alignItems: 'center', justifyContent: 'center' },
    voiceRecorderCentral: { flex: 1, height: scale(44), borderRadius: scale(22), flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: scale(8) },
    voiceRecorderNativeWaveHost: { height: scale(40), width: '100%', justifyContent: 'center' },
    voiceRecorderNativeWave: { height: scale(40), width: '100%' },
    voiceRecorderPreview: {
        flex: 1,
        height: scale(44),
        flexDirection: 'row',
        alignItems: 'center',
        gap: scale(11),
    },
    voiceRecorderPreviewPlay: {
        width: scale(32),
        height: scale(44),
        alignItems: 'center',
        justifyContent: 'center',
    },
    voiceRecorderPreviewTrack: { flex: 1, minWidth: 0, height: scale(44), justifyContent: 'center' },
    voiceRecorderPreviewWave: { height: scale(40), flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: scale(1) },
    voiceRecorderScrubDot: { position: 'absolute', width: scale(10), height: scale(10), borderRadius: scale(5), top: scale(17) },
    voiceRecorderActions: { height: scale(44), flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: scale(10) },
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
        backgroundColor: 'rgba(16, 16, 17,0.28)',
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
        paddingStart: scale(16),
        paddingEnd: scale(52),
        justifyContent: 'center',
        borderBottomWidth: StyleSheet.hairlineWidth,
    },
    conversationMenuTitle: {
        alignSelf: 'stretch',
    },
    menuClose: {
        position: 'absolute',
        end: scale(8),
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
        backgroundColor: 'rgba(160, 160, 168,0.12)',
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
    messageMenuSheet: {
        flex: 1,
        paddingHorizontal: scale(12),
        gap: scale(2),
    },
    quickReactionRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        borderRadius: scale(22),
        paddingHorizontal: scale(5),
        paddingVertical: scale(5),
        marginBottom: scale(8),
        backgroundColor: 'rgba(160, 160, 168,0.12)',
    },
    quickReactionButton: {
        width: scale(42),
        height: scale(38),
        borderRadius: scale(19),
        alignItems: 'center',
        justifyContent: 'center',
    },
    quickReactionPressed: { backgroundColor: 'rgba(160, 160, 168,0.18)' },
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
    messageActionPressed: { backgroundColor: 'rgba(160, 160, 168,0.12)' },
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
        bottom: -scale(12),
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
