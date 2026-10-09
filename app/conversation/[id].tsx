import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
    ActivityIndicator,
    AppState,
    BackHandler,
    FlatList,
    Image as RNImage,
    Keyboard,
    type LayoutChangeEvent,
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
import { LinearGradient } from 'expo-linear-gradient';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import * as FileSystem from 'expo-file-system/legacy';
import * as Clipboard from 'expo-clipboard';
import {
    requestRecordingPermissionsAsync,
    useAudioPlayer,
    useAudioPlayerStatus,
} from 'expo-audio';
import { WaveformRecorderView, type WaveformRecorderCompleteEvent, type WaveformRecorderState, type WaveformRecorderViewRef } from 'react-native-waveform-recorder';
import { router, useFocusEffect, useIsFocused, useLocalSearchParams } from 'expo-router';
import { Bell, BellOff, Camera, Check, CheckCheck, Clock3, Download, Mic, MoreVertical, Pause, Play, RefreshCw, Reply, Trash2, X, XCircle } from '@/components/ui/icons/PhosphorCompat';
import { CaretDoubleDown, CaretLeft, CaretRight, Paperclip, PaperPlaneTilt } from 'phosphor-react-native';
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
import { ChatImageLightbox, type ChatImagePreview } from '@/components/chat/ChatImageLightbox';
import { BUBBLE_TAIL_WIDTH, ImageTailMask, SolidBubbleTail } from '@/components/chat/MessageBubbleTail';
import { MessageContextOverlay, type MessageContextAction } from '@/components/chat/MessageContextOverlay';
import { MessageDeleteDialog } from '@/components/chat/MessageDeleteDialog';
import type { MessageAnchor } from '@/lib/messageContextLayout';
import { KeyboardController } from 'react-native-keyboard-controller';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Reanimated, {
    Easing,
    FadeInDown,
    type SharedValue,
    ZoomIn,
    ZoomOut,
    runOnJS,
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
import { claimChatAudioPlayback, createChatAudioPlaybackOwner, isChatAudioPlaybackOwner, releaseChatAudioPlayback, stopChatAudioPlaybackForMessage } from '@/lib/chatAudioPlayback';
import { mergeChatMessageMedia } from '@/lib/chatMessageMedia';
import { chatImageLayout } from '@/lib/chatImageLayout';
import { waveformPeaks } from '@/lib/chatWaveform';
import { translateChatText } from '@/lib/chatDisplay';
import { ImageAttachmentComposer } from '@/components/chat/ImageAttachmentComposer';
import { GalleryRevealControl } from '@/components/chat/GalleryRevealControl';
import { ChatKeyboardAvoider, ChatKeyboardViewport, ChatStickyComposer, ChatComposerBar } from '@/components/chat/ChatKeyboardFooter';
import { ViewOnceIcon } from '@/components/chat/ViewOnceIcon';
import { UnreadBadge } from '@/components/ui/UnreadBadge';
import { ConfirmSheet } from '@/components/ui/ConfirmSheet';
import { UserProfileSheet } from '@/components/profile/UserProfileSheet';
import { ReportSheet, type ReportTarget } from '@/components/profile/ReportSheet';
import { profileId } from '@/lib/exploreProfile';
import { routeParam } from '@/lib/routeParams';
import { QualifiedPhotoRequiredNotice } from '@/components/app/QualifiedPhotoRequiredNotice';
import { EmailVerificationModal } from '@/components/app/EmailVerificationModal';
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
    width?: number;
    height?: number;
    size?: number;
};

type PendingMediaSend = {
    clientMessageId: string;
    reply: ChatMessage | null;
    uploadedMedia?: MessageMedia;
} & (
    | { type: 'image'; attachment: PendingImageAttachment; caption: string; viewOnce: boolean }
    | { type: 'voice'; uri: string; duration: number; waveform: number[] }
);

async function prepareChatImageUpload(attachment: PendingImageAttachment) {
    const sourceInfo = await FileSystem.getInfoAsync(attachment.uri).catch(() => null);
    const sourceSize = attachment.size || (sourceInfo?.exists ? sourceInfo.size : 0) || 0;
    if (attachment.type === 'image/webp' && (!attachment.width || attachment.width <= 1200)) {
        return { uri: attachment.uri, name: attachment.name, type: attachment.type, size: sourceSize, temporaryUri: null };
    }

    const resized = await ImageManipulator.manipulateAsync(
        attachment.uri,
        attachment.width && attachment.width > 1200 ? [{ resize: { width: 1200 } }] : [],
        { compress: 0.8, format: ImageManipulator.SaveFormat.WEBP },
    );
    const outputInfo = await FileSystem.getInfoAsync(resized.uri);
    const outputSize = outputInfo.exists ? outputInfo.size || 0 : 0;
    if (!outputSize || outputSize > MAX_CHAT_IMAGE_BYTES) {
        void FileSystem.deleteAsync(resized.uri, { idempotent: true }).catch(() => undefined);
        throw new Error('image_too_large');
    }
    return { uri: resized.uri, name: 'chat-photo.webp', type: 'image/webp', size: outputSize, temporaryUri: resized.uri };
}

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

function sendFailureText(reason?: string) {
    switch (reason) {
        case 'upload_timeout':
            return t('chat:upload_timeout', 'Upload timed out. Check your connection and retry.');
        case 'image_too_large':
            return t('chat:image_too_large', 'Choose an image smaller than 10 MB.');
        case 'voice_too_long':
            return t('chat:voice_too_long', 'Voice note is too long. Record a shorter one.');
        case 'invalid_media':
        case 'media_required':
        case 'missing_file':
            return t('chat:invalid_media_send', 'This media could not be sent. Choose or record it again.');
        case 'conversation_not_active':
            return t('chat:conversation_not_active_send', 'This conversation is no longer active.');
        case 'message_not_allowed':
            return t('chat:message_not_allowed_send', 'You cannot send messages in this conversation.');
        case 'active_chat_limit_reached':
            return t('chat:active_chat_limit_reached', 'Your active chat limit is full.');
        case 'sender_chat_limit_reached':
            return t('chat:sender_chat_limit_reached', 'Their active chat limit is full.');
        case 'pending_requests_limit':
            return t('chat:pending_requests_limit_send', 'You have reached the pending message request limit.');
        case 'request_already_pending':
            return t('chat:request_already_sent', 'Message request already sent.');
        case 'conversation_already_active':
            return t('chat:conversation_already_active_send', 'This conversation is already active.');
        case 'request_expired':
            return t('chat:request_expired', 'This request has expired.');
        case 'account_deleted':
            return t('chat:account_deleted_message_disabled', 'This account has been deleted. You can no longer send messages.');
        case 'MEMBERSHIP_REQUIRED':
            return t('chat:membership_required_desc', 'Activate membership to open and use conversations.');
        case 'QUALIFIED_PHOTO_REQUIRED':
            return t('qualified_photo_required', 'An approved profile photo is required to send messages.');
        case 'offline_queue_full':
            return t('chat:offline_queue_full', 'Offline queue is full. Reconnect before sending more messages.');
        default:
            return apiMessage(reason || 'server_error_default');
    }
}

function sendFailureReason(response: { code?: string; errorMessage?: string; message?: unknown; error?: string }) {
    if (response.code === 'MEMBERSHIP_REQUIRED' || response.code === 'QUALIFIED_PHOTO_REQUIRED') return response.code;
    if (response.error === 'upload_timeout') return 'upload_timeout';
    return response.errorMessage || (typeof response.message === 'string' ? response.message : undefined)
        || response.code || 'server_error_default';
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
    if (!message?.id || !userId || message.unsent || message.type === 'system' || message.pending || message.failed || message.queued) return false;
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
    const isFocused = useIsFocused();
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
    const { lightImpact, selection } = useHaptics();
    const insets = useSafeAreaInsets();
    useConversationKeyboardMode();
    const inputFontFamily = currentLanguage === 'ar' ? Typography.font.arabic.regular : Typography.font.body.regular;
    const listRef = useRef<FlatList<ListItem>>(null);
    const { isNearBottomRef } = useChatScrollAnchor<ListItem>();
    const initialPositionPendingRef = useRef(true);
    const initialFreshPositionPendingRef = useRef(true);
    const pendingAutoScrollRef = useRef(false);
    const ownSendScrollMessageIdRef = useRef<string | null>(null);
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
    const earlyDeliveryReceiptsRef = useRef(new Map<string, string>());
    const withDeliveryReceipt = useCallback((message: ChatMessage): ChatMessage => {
        const deliveredAt = earlyDeliveryReceiptsRef.current.get(message.id);
        return deliveredAt && !message.deliveredAt ? { ...message, deliveredAt } : message;
    }, []);
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
    const [recordingBusy, setRecordingBusy] = useState(false);
    const [voicePanelOpen, setVoicePanelOpen] = useState(false);
    const [voicePreview, setVoicePreview] = useState<{ uri: string; duration: number; clientMessageId: string } | null>(null);
    const voiceCopyGenerationRef = useRef(0);
    const mediaSendLockRef = useRef(false);
    const mediaSendJobsRef = useRef(new Map<string, PendingMediaSend>());
    const textRetryInFlightRef = useRef(new Set<string>());
    const retryMediaMessageRef = useRef<(message: ChatMessage) => void>(() => undefined);
    const [voiceWaveform, setVoiceWaveform] = useState<number[]>([]);
    const [voiceSendFailed, setVoiceSendFailed] = useState(false);
    const sendAfterFinalizeRef = useRef(false);
    const [requestBusy, setRequestBusy] = useState(false);
    const [viewOnce, setViewOnce] = useState<{ url: string; messageId: string; seconds: number } | null>(null);
    const [viewOnceLoadingId, setViewOnceLoadingId] = useState<string | null>(null);
    const [imagePreview, setImagePreview] = useState<ChatImagePreview | null>(null);
    const handleImageCached = useCallback((uri: string) => {
        const messageId = imagePreview?.messageId;
        if (!messageId) return;
        setItems((current) => current.map((item) => item.id === messageId && item.media?.localUri !== uri
            ? { ...item, media: { ...(item.media || {}), localUri: uri } }
            : item));
    }, [imagePreview?.messageId]);
    const [imageAttachment, setImageAttachment] = useState<PendingImageAttachment | null>(null);
    const originalImageAttachmentRef = useRef<PendingImageAttachment | null>(null);
    const [imageCaption, setImageCaption] = useState('');
    const [imageViewOnce, setImageViewOnce] = useState(false);
    const [menuOpen, setMenuOpen] = useState(false);
    const [menuBusy, setMenuBusy] = useState(false);
    const [conversationConfirmation, setConversationConfirmation] = useState<'end' | 'delete' | null>(null);
    const [messagesReady, setMessagesReady] = useState(false);
    const [showScrollDown, setShowScrollDown] = useState(false);
    const [unseenWhileAway, setUnseenWhileAway] = useState(0);
    const [messageAreaWidth, setMessageAreaWidth] = useState(0);
    const [composerHeight, setComposerHeight] = useState(scale(56));
    const screenContentRef = useRef<View>(null);
    const screenOriginRef = useRef({ x: 0, y: insets.top });
    const [menuViewport, setMenuViewport] = useState({ width: 0, height: 0 });
    const [chatHeaderHeight, setChatHeaderHeight] = useState(scale(56));
    const [selectedAnchor, setSelectedAnchor] = useState<MessageAnchor | null>(null);
    const [profileSheetOpen, setProfileSheetOpen] = useState(false);
    const [selectedMessageId, setSelectedMessageId] = useState<string | null>(null);
    const selectedMessage = items.find((message) => message.id === selectedMessageId) || null;
    const setSelectedMessage = (message: ChatMessage | null) => {
        setSelectedMessageId(message?.id || null);
        if (!message) setSelectedAnchor(null);
    };
    const [reportTarget, setReportTarget] = useState<ReportTarget | null>(null);
    const [messageActionBusy, setMessageActionBusy] = useState(false);
    const [deleteTarget, setDeleteTarget] = useState<ChatMessage | null>(null);
    const [deleteAction, setDeleteAction] = useState<'delete' | 'unsend' | null>(null);
    const [deleteError, setDeleteError] = useState('');
    const [replyTo, setReplyTo] = useState<ChatMessage | null>(null);
    const prevNewestMessageIdRef = useRef('');
    const [peerTyping, setPeerTyping] = useState(false);
    const peerTypingClearRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const typingActiveRef = useRef(false);
    const typingStopTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const previousConnectivityRef = useRef(connectivityStatus);

    useEffect(() => {
        if (selectedMessageId && !selectedMessage) setSelectedMessageId(null);
    }, [selectedMessageId, selectedMessage]);

    useEffect(() => {
        if (!selectedMessageId) return;
        const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
            if (!messageActionBusy) setSelectedMessage(null);
            return true;
        });
        return () => subscription.remove();
    }, [messageActionBusy, selectedMessageId]);

    const colors = useMemo(() => ({
        bg: palette.brand.bg.surface,
        body: isDark ? palette.brand.bg.primary : '#F7F7F7',
        card: palette.chrome.common.card,
        surface: palette.chrome.common.cardAlt,
        text: palette.chrome.common.textStrong,
        composerIcon: palette.chrome.common.textMuted,
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
        shadow: palette.chrome.common.shadow,
        blueAction: palette.chrome.common.blueAction,
        seenTick: palette.chrome.common.seenTick,
    }), [isDark, palette]);

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
            const nextItems = (messageRes.items || []).map((raw) => withDeliveryReceipt(normalizeMessage(raw)));
            if (mode === 'replace') freshMessagesLoadedRef.current = true;
            setItems((current) => {
                if (mode === 'append') return [...current, ...nextItems.map(withDeliveryReceipt)];
                const serverClientIds = new Set(nextItems.map((message) => message.clientMessageId).filter(Boolean));
                const localMessages = current.filter((message) => message.tempId
                    && !serverClientIds.has(message.clientMessageId || message.tempId)
                    && ((message.type === 'text' && (message.pending || message.failed || message.queued))
                        || ((message.type === 'image' || message.type === 'voice') && (message.pending || message.failed))));
                const previousById = new Map(current.map((message) => [message.id, message]));
                return [
                    ...nextItems.map((message) => {
                        const previous = previousById.get(message.id);
                        return withDeliveryReceipt(previous ? mergeChatMessageMedia(previous, message) : message);
                    }),
                    ...localMessages,
                ];
            });
            setNextCursor(messageRes.nextCursor || null);
        } else if (messageRes.code === 'MEMBERSHIP_REQUIRED') {
            void eligibility.refetch();
        } else if (messageRes.message !== 'network_error') {
            toast.show(apiMessage(messageRes.message), 'error', 3500);
        }
    }, [eligibility, emailBlocked, id, membershipAccessUnavailable, membershipBlocked, nextCursor, withDeliveryReceipt]);

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
            if (next.clientMessageId && current.some((item) => item.clientMessageId === next.clientMessageId)) {
                return [...current.filter((item) => item.clientMessageId !== next.clientMessageId), next];
            }
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
        stopChatAudioPlaybackForMessage(incomingMessageId);
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
            return mergeChatMessageMedia(message, {
                ...message,
                ...(nextMessage || {}),
                reactions: payload?.reactions || nextMessage?.reactions || message.reactions || [],
            });
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
        const messageId = String(payload.messageId);
        earlyDeliveryReceiptsRef.current.set(messageId, payload.deliveredAt);
        if (earlyDeliveryReceiptsRef.current.size > 100) {
            const oldestId = earlyDeliveryReceiptsRef.current.keys().next().value;
            if (oldestId) earlyDeliveryReceiptsRef.current.delete(oldestId);
        }
        setItems((current) => current.map((message) => message.id === messageId
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
        onMessageDeleted: (messageId) => {
            if (messageId) setItems((current) => current.filter((message) => message.id !== messageId));
        },
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

    const wasConnectedRef = useRef(socket.connected);
    const missedSocketEventsRef = useRef(false);
    useEffect(() => {
        if (!socket.connected) {
            if (wasConnectedRef.current) missedSocketEventsRef.current = true;
            wasConnectedRef.current = false;
            return;
        }
        wasConnectedRef.current = true;
        if (missedSocketEventsRef.current && messagesReady && id && id !== 'new') {
            missedSocketEventsRef.current = false;
            void load('replace');
        }
    }, [socket.connected, messagesReady, id]);

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
        ownSendScrollMessageIdRef.current = null;
        viewableMessageIdsRef.current.clear();
        receivedAwayIdsRef.current.clear();
        knownMessageIdsRef.current.clear();
        earlyDeliveryReceiptsRef.current.clear();
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
                const normalized = withDeliveryReceipt(normalizeMessage(event.message));
                setItems((current) => current.map((item) => item.tempId === event.item.tempId
                    ? withDeliveryReceipt(normalized) : item));
                return;
            }
            setItems((current) => current.map((item) => item.tempId === event.item.tempId
                ? { ...item, pending: false, queued: false, failed: true, failureReason: event.error || 'server_error_default' }
                : item));
            const errorMessage = event.error === 'offline_message_expired'
                ? t('chat:offline_message_expired', 'Queued message expired. Tap to retry.')
                : apiMessage(event.error || 'message_failed');
            toast.show(errorMessage, 'error', 3500);
        });
        return unsubscribe;
    }, [id, toast, user?._id, user?.id, withDeliveryReceipt]);

    useEffect(() => {
        const userId = String(user?._id || user?.id || '');
        if (!isOffline && userId && id && id !== 'new') void flushOfflineMessageQueue(userId);
    }, [id, isOffline, user?._id, user?.id]);

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
    const messagesById = useMemo(() => new Map(items.map((message) => [message.id, message])), [items]);
    // Inverted FlatList renders index 0 at the visual bottom, so the newest
    // message must come first. buildItems keeps date headers above each group;
    // reversing preserves that ordering once the list is flipped.
    const invertedItems = useMemo(() => [...listItems].reverse(), [listItems]);
    const selectedIndex = selectedMessage ? invertedItems.findIndex((item) => item.kind === 'message' && item.message.id === selectedMessage.id) : -1;
    const selectedAdjacent = selectedIndex > 0 ? invertedItems[selectedIndex - 1] : null;
    const selectedHasTail = !!selectedMessage && (selectedAdjacent?.kind !== 'message'
        || selectedAdjacent.message.type === 'system'
        || String(selectedAdjacent.message.sender) !== String(selectedMessage.sender));
    const selectedImageOnlyTail = selectedHasTail && selectedMessage?.type === 'image'
        && !!selectedMessage.media?.url && !selectedMessage.media?.viewOnce
        && !messageText(selectedMessage).trim() && !selectedMessage.replyTo;
    latestIncomingIdRef.current = [...listItems].reverse().find((item) =>
        item.kind === 'message' && !item.message.pending && !item.message.unsent
        && item.message.type !== 'system'
        && String(item.message.sender) !== String(user?._id || user?.id || '')
    )?.id || null;
    const newestMessageId = invertedItems.find((item) => item.kind === 'message')?.id || '';
    const newestMessage = invertedItems.find((item) => item.kind === 'message');
    const ownSendIsNewest = Boolean(ownSendScrollMessageIdRef.current && newestMessage?.kind === 'message'
        && (newestMessage.message.id === ownSendScrollMessageIdRef.current
            || newestMessage.message.clientMessageId === ownSendScrollMessageIdRef.current));
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

    const refetchEligibility = eligibility.refetch;
    useFocusEffect(useCallback(() => {
        void refetchEligibility();
    }, [refetchEligibility]));

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
            && (ownSendIsNewest || pendingAutoScrollRef.current || isNearBottomRef.current)) {
            pendingAutoScrollRef.current = false;
            scrollToBottom(!ownSendIsNewest);
        }
    }, [newestMessageId, ownSendIsNewest, loadingMore, messagesReady, scrollToBottom, isNearBottomRef]);

    const handleReplyJump = useCallback((replyId: string) => {
        const index = invertedItemsRef.current.findIndex((entry) => entry.kind === 'message' && entry.message.id === replyId);
        if (index >= 0) {
            ownSendScrollMessageIdRef.current = null;
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
        if (!message.failed || message.pending) return;
        if (isOffline) {
            toast.show(sendFailureText('network_error'), 'info', 3000);
            return;
        }
        if (message.type === 'image' || message.type === 'voice') {
            if (mediaSendLockRef.current) return;
            if (message.failureReason) toast.show(sendFailureText(message.failureReason), 'info', 2500);
            retryMediaMessageRef.current(message);
            return;
        }
        if (message.type !== 'text') return;
        const body = messageText(message).trim();
        if (!body) return;
        const retryId = message.tempId || message.id;
        if (textRetryInFlightRef.current.has(retryId)) return;
        textRetryInFlightRef.current.add(retryId);
        if (message.failureReason) toast.show(sendFailureText(message.failureReason), 'info', 2500);

        try {
            setItems((current) => current.map((item) => messageId(item) === messageId(message)
                ? { ...item, failed: false, pending: true, failureReason: undefined }
                : item));

            const replyId = typeof message.replyTo === 'string' ? message.replyTo : message.replyTo?.id;
            const res = await chatService.send({
                conversationId: id !== 'new' ? id : undefined,
                recipientId: id === 'new' ? recipientId : undefined,
                content: body,
                type: 'text',
                replyTo: replyId || undefined,
                clientMessageId: message.tempId,
            }).catch(() => ({ success: false, errorMessage: 'network_error' } as Awaited<ReturnType<typeof chatService.send>>));

            if (res.success && res.message) {
                const normalized = normalizeMessage(res.message);
                setItems((current) => current.map((item) => messageId(item) === messageId(message)
                    ? { ...normalized, replyTo: typeof item.replyTo === 'object' && item.replyTo ? item.replyTo : normalized.replyTo }
                    : item));
                if (id === 'new' && res.conversationId) {
                    router.replace(`/conversation/${res.conversationId}` as any);
                }
                return;
            }

            reconcileMembershipEligibility(res);
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
                        ? { ...item, pending: true, queued: true, failed: false, failureReason: undefined }
                        : item));
                    toast.show(t('chat:message_queued', 'Message queued. It will send when you are online.'), 'info', 3000);
                    return;
                } catch {
                    const failureReason = 'offline_queue_full';
                    setItems((current) => current.map((item) => messageId(item) === messageId(message)
                        ? { ...item, pending: false, queued: false, failed: true, failureReason }
                        : item));
                    toast.show(sendFailureText(failureReason), 'error', 3500);
                    return;
                }
            }
            const failureReason = sendFailureReason(res);
            setItems((current) => current.map((item) => messageId(item) === messageId(message)
                ? { ...item, pending: false, queued: false, failed: true, failureReason }
                : item));
            toast.show(sendFailureText(failureReason), 'error', 3500);
        } finally {
            textRetryInFlightRef.current.delete(retryId);
        }
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
        const replyId = typeof message.replyTo === 'string' ? message.replyTo : message.replyTo?.id;
        const replyTarget = replyId
            ? messagesById.get(replyId)
                || (typeof message.replyTo === 'object' ? message.replyTo : null)
                || {
                    id: replyId,
                    conversationId: message.conversationId,
                    sender: '',
                    type: 'text' as const,
                    content: t('chat:message_placeholder', 'Message...'),
                    createdAt: message.createdAt,
                }
            : null;
        const mine = String(message.sender) === String(user?._id || user?.id);
        const animateIn = animateIdsRef.current.has(item.id);
        const adjacentItem = invertedItems[index - 1];
        const hasAdjacentMessage = message.type !== 'system'
            && adjacentItem?.kind === 'message'
            && adjacentItem.message.type !== 'system';
        const sameSenderAsAdjacent = message.type !== 'system'
            && adjacentItem?.kind === 'message'
            && adjacentItem.message.type !== 'system'
            && String(adjacentItem.message.sender) === String(message.sender);
        return (
            <MessageBubble
                message={message}
                replyTarget={replyTarget}
                mine={mine}
                showTail={!sameSenderAsAdjacent}
                rowGap={hasAdjacentMessage ? (sameSenderAsAdjacent ? 3 : 10) : 0}
                messageAreaWidth={messageAreaWidth}
                maxTextWidth={Math.max(0, (messageAreaWidth - scale(24)) * 0.78 - scale(24) - 2 * StyleSheet.hairlineWidth)}
                uiDirection={isRTL ? 'rtl' : 'ltr'}
                colors={colors}
                userId={String(user?._id || user?.id || '')}
                animateIn={animateIn}
                onOpenImage={setImagePreview}
                onOpenViewOnce={openViewOnce}
                viewOnceLoading={viewOnceLoadingId === message.id}
                onOpenMenu={(target, windowAnchor) => {
                    void lightImpact();
                    const root = screenOriginRef.current;
                    setSelectedAnchor({
                        x: windowAnchor.x - root.x,
                        y: windowAnchor.y - root.y,
                        width: windowAnchor.width,
                        height: windowAnchor.height,
                    });
                    setSelectedMessage(target);
                }}
                onRetry={retryFailedMessage}
                onSwipeReply={beginReply}
                onReplyClick={handleReplyJump}
            />
        );
    }, [colors, user?._id, user?.id, isRTL, openViewOnce, viewOnceLoadingId, beginReply, handleReplyJump, retryFailedMessage, lightImpact, invertedItems, messageAreaWidth, messagesById]);
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
        if (ownSendScrollMessageIdRef.current && ownSendIsNewest) {
            isNearBottomRef.current = true;
            setShowScrollDown(false);
            return;
        }
        const nearBottom = y <= CHAT_ONE_LINE_BUBBLE_SCROLL_THRESHOLD;
        isNearBottomRef.current = nearBottom;
        setShowScrollDown(!nearBottom);
        if (nearBottom) tryMarkVisibleUnreadRef.current();
    }, [isNearBottomRef, ownSendIsNewest]);

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
            ownSendScrollMessageIdRef.current = tempId;
            setItems((current) => [...current, { ...temp, queued: true }]);
            setContent('');
            emitStopTyping();
            setReplyTo(null);
            toast.show(t('chat:message_queued', 'Message queued. It will send when you are online.'), 'info', 3000);
            return;
        }
        lightImpact();
        setSending(true);
        isNearBottomRef.current = true;
        setShowScrollDown(false);
        animateIdsRef.current.add(tempId);
        ownSendScrollMessageIdRef.current = tempId;
        setItems((current) => [...current, temp]);
        setContent('');
        emitStopTyping();
        setReplyTo(null);

        const res = await chatService.send({
            conversationId: id !== 'new' ? id : undefined,
            recipientId: id === 'new' ? recipientId : undefined,
            content: body,
            type: 'text',
            replyTo: reply?.id || undefined,
            clientMessageId: tempId,
        }).catch(() => ({ success: false, errorMessage: 'network_error' } as Awaited<ReturnType<typeof chatService.send>>));

        if (res.success && res.message) {
            const normalized = withDeliveryReceipt(normalizeMessage(res.message));
            setItems((current) => current.map((item) => item.tempId === tempId
                ? { ...withDeliveryReceipt(normalized), replyTo: reply || normalized.replyTo }
                : item));
            if (id === 'new' && res.conversationId) {
                router.replace(`/conversation/${res.conversationId}` as any);
            }
        } else {
            if (reconcileMembershipEligibility(res)) {
                setItems((current) => current.map((item) => item.tempId === tempId
                    ? { ...item, pending: false, failed: true, failureReason: 'MEMBERSHIP_REQUIRED' }
                    : item));
                toast.show(sendFailureText('MEMBERSHIP_REQUIRED'), 'error', 3500);
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
                    setItems((current) => current.map((item) => item.tempId === tempId
                        ? { ...item, pending: false, failed: true, failureReason: 'offline_queue_full' } : item));
                    toast.show(sendFailureText('offline_queue_full'), 'error', 3500);
                }
            } else {
                const failureReason = sendFailureReason(res);
                setItems((current) => current.map((item) => item.tempId === tempId
                    ? { ...item, pending: false, failed: true, failureReason } : item));
                toast.show(sendFailureText(failureReason), 'error', 3500);
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
        reply: ChatMessage | null = replyTo,
    ): Promise<ChatMessage | null> => {
        const trimmedContent = mediaContent.trim();
        const commitStartedAt = Date.now();
        const res = await chatService.send({
            conversationId: id !== 'new' ? id : undefined,
            recipientId: id === 'new' ? recipientId : undefined,
            type,
            content: trimmedContent || undefined,
            media,
            replyTo: reply?.id || undefined,
            clientMessageId,
        }).catch(() => ({ success: false, errorMessage: 'network_error' } as Awaited<ReturnType<typeof chatService.send>>));
        if (__DEV__) console.info('[chat-media] commit', { type, durationMs: Date.now() - commitStartedAt, success: res.success });

        if (res.success && res.message) {
            setReplyTo((current) => current?.id === reply?.id ? null : current);
            let normalized = withDeliveryReceipt(normalizeMessage(res.message));
            if (type === 'voice') normalized = mergeChatMessageMedia({ ...normalized, media }, normalized);
            if (localMediaUri && !media.viewOnce) {
                normalized = { ...normalized, media: { ...(normalized.media || media), localUri: localMediaUri } };
            }
            const serverMessage = normalized;
            setItems((current) => {
                const existing = current.find((item) => item.id === serverMessage.id);
                const next = withDeliveryReceipt(existing ? mergeChatMessageMedia(existing, serverMessage) : serverMessage);
                return [
                    ...current.filter((item) => item.id !== serverMessage.id
                        && (!clientMessageId || (item.tempId !== clientMessageId && item.clientMessageId !== clientMessageId))),
                    next,
                ];
            });
            if (localMediaUri && normalized.id && !media.viewOnce) {
                const cached = await storeLocalChatMedia({
                    sourceUri: localMediaUri,
                    userId: String(user?._id || user?.id || ''),
                    conversationId: normalized.conversationId || id,
                    messageId: normalized.id,
                    media: normalized.media,
                    kind: type,
                }).catch(() => null);
                if (cached?.uri) {
                    normalized = {
                        ...normalized,
                        media: { ...(normalized.media || media), localUri: cached.uri },
                    };
                    setItems((current) => current.map((item) => item.id === normalized.id
                        ? { ...item, media: { ...(item.media || media), localUri: cached.uri } }
                        : item));
                } else if (type === 'image') {
                    normalized = {
                        ...normalized,
                        media: { ...(normalized.media || media), localUri: undefined },
                    };
                    setItems((current) => current.map((item) => item.id === normalized.id
                        ? { ...item, media: { ...(item.media || media), localUri: undefined } }
                        : item));
                }
            }
            if (id === 'new' && res.conversationId) {
                router.replace(`/conversation/${res.conversationId}` as any);
            }
            return normalized;
        }

        reconcileMembershipEligibility(res);
        reconcilePhotoEligibility(res);
        const failureReason = sendFailureReason(res);
        setItems((current) => current.map((item) => item.tempId === clientMessageId
            ? { ...item, pending: false, failed: true, failureReason }
            : item));
        toast.show(sendFailureText(failureReason), 'error', 3500);
        return null;
    };

    const runMediaSend = async (job: PendingMediaSend) => {
        if (mediaSendLockRef.current) return;
        mediaSendLockRef.current = true;
        setItems((current) => current.map((item) => item.tempId === job.clientMessageId
            ? { ...item, pending: true, failed: false, failureReason: undefined } : item));

        let temporaryUri: string | null = null;
        let localUri = job.type === 'voice' ? job.uri : job.attachment.uri;
        try {
            let media = job.uploadedMedia;
            if (!media || job.type === 'image') {
                const formData = new FormData();
                if (job.type === 'image') {
                    const prepareStartedAt = Date.now();
                    const prepared = await prepareChatImageUpload(job.attachment);
                    temporaryUri = prepared.temporaryUri;
                    localUri = prepared.uri;
                    if (!media) {
                        formData.append('file', { uri: prepared.uri, name: prepared.name, type: prepared.type } as any);
                        formData.append('viewOnce', job.viewOnce ? 'true' : 'false');
                    }
                    if (__DEV__) console.info('[chat-media] prepare', {
                        type: 'image', bytes: prepared.size, durationMs: Date.now() - prepareStartedAt,
                    });
                } else {
                    formData.append('file', {
                        uri: job.uri,
                        name: `voice-${Date.now()}.m4a`,
                        type: Platform.OS === 'ios' ? 'audio/m4a' : 'audio/mp4',
                    } as any);
                    formData.append('duration', String(Math.min(MAX_VOICE_RECORDING_SECONDS, job.duration)));
                }
                if (!media) {
                    formData.append('conversationId', id);
                    formData.append('type', job.type);
                    const uploadStartedAt = Date.now();
                    const uploadRes = await chatService.uploadMedia(formData)
                        .catch(() => ({ success: false, message: 'network_error' } as Awaited<ReturnType<typeof chatService.uploadMedia>>));
                    if (__DEV__) console.info('[chat-media] upload', {
                        type: job.type, durationMs: Date.now() - uploadStartedAt, success: uploadRes.success,
                    });
                    if (!uploadRes.success || !uploadRes.media) {
                        reconcileMembershipEligibility(uploadRes);
                        reconcilePhotoEligibility(uploadRes);
                        const failureReason = sendFailureReason(uploadRes);
                        setItems((current) => current.map((item) => item.tempId === job.clientMessageId
                            ? { ...item, pending: false, failed: true, failureReason } : item));
                        toast.show(sendFailureText(failureReason), 'error', 3500);
                        return;
                    }
                    media = job.type === 'voice'
                        ? { ...uploadRes.media, waveform: waveformPeaks(job.waveform, VOICE_WAVE_BAR_COUNT) }
                        : uploadRes.media;
                    job.uploadedMedia = media;
                }
            }

            const sent = await sendMediaMessage(
                job.type,
                media,
                job.type === 'image' ? job.caption : '',
                job.clientMessageId,
                localUri,
                job.reply,
            );
            if (sent) {
                mediaSendJobsRef.current.delete(job.clientMessageId);
                if (job.type === 'voice' && sent.media?.localUri && sent.media.localUri !== job.uri) {
                    void FileSystem.deleteAsync(job.uri, { idempotent: true }).catch(() => undefined);
                }
            } else {
                setItems((current) => current.map((item) => item.tempId === job.clientMessageId
                    ? { ...item, pending: false, failed: true } : item));
            }
        } catch (error) {
            console.warn('[chat-media] send-failed', { type: job.type, error });
            const rawReason = error instanceof Error ? error.message : String(error || '');
            const failureReason = rawReason === 'image_too_large' ? rawReason : 'server_error_default';
            toast.show(sendFailureText(failureReason), 'error', 3500);
            setItems((current) => current.map((item) => item.tempId === job.clientMessageId
                ? { ...item, pending: false, failed: true, failureReason } : item));
        } finally {
            if (temporaryUri) void FileSystem.deleteAsync(temporaryUri, { idempotent: true }).catch(() => undefined);
            mediaSendLockRef.current = false;
        }
    };

    const beginMediaSend = (job: PendingMediaSend) => {
        mediaSendJobsRef.current.set(job.clientMessageId, job);
        ownSendScrollMessageIdRef.current = job.clientMessageId;
        const localUri = job.type === 'image' ? job.attachment.uri : job.uri;
        const pending: ChatMessage = {
            id: job.clientMessageId,
            tempId: job.clientMessageId,
            clientMessageId: job.clientMessageId,
            conversationId: id,
            sender: String(user?._id || user?.id || ''),
            type: job.type,
            content: job.type === 'image' ? job.caption : undefined,
            media: job.type === 'image'
                ? { url: localUri, localUri, width: job.attachment.width, height: job.attachment.height, viewOnce: job.viewOnce }
                : { url: localUri, localUri, duration: job.duration, waveform: job.waveform },
            replyTo: job.reply,
            createdAt: new Date().toISOString(),
            reactions: [],
            pending: !isOffline,
            failed: isOffline,
            failureReason: isOffline ? 'network_error' : undefined,
        };
        setItems((current) => [...current, pending]);
        if (isOffline) {
            toast.show(sendFailureText('network_error'), 'error', 3500);
            return;
        }
        void runMediaSend(job);
    };

    retryMediaMessageRef.current = (message) => {
        const job = mediaSendJobsRef.current.get(message.tempId || message.clientMessageId || message.id);
        if (!job) {
            toast.show(sendFailureText('invalid_media'), 'error', 3500);
            return;
        }
        if (mediaSendLockRef.current) {
            toast.show(t('chat:sending', 'Sending...'), 'info', 2000);
            return;
        }
        void runMediaSend(job);
    };

    const closeImageAttachment = () => {
        originalImageAttachmentRef.current = null;
        setImageAttachment(null);
        setImageCaption('');
        setImageViewOnce(false);
    };

    const canAttachMedia = () => {
        if (!requireVerified('chat')) return false;
        if (mediaSendLockRef.current) {
            toast.show(t('chat:sending', 'Sending...'), 'info', 2000);
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
        const attachment = {
            uri: asset.uri,
            name: asset.fileName || `chat-photo-${Date.now()}.jpg`,
            type: asset.mimeType || 'image/jpeg',
            clientMessageId: newMediaMessageId(),
            width: asset.width,
            height: asset.height,
            size: asset.fileSize,
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
        if (!imageAttachment || id === 'new') return;
        if (mediaSendLockRef.current) {
            toast.show(t('chat:sending', 'Sending...'), 'info', 2000);
            return;
        }
        if (!canCompose) {
            toast.show(peerDeleted
                ? t('chat:account_deleted_message_disabled', 'This account has been deleted. You can no longer send messages.')
                : t('chat:accept_request_to_reply', 'Accept the request before replying.'), 'info');
            return;
        }
        const job: PendingMediaSend = {
            type: 'image',
            clientMessageId: imageAttachment.clientMessageId,
            attachment: imageAttachment,
            caption: imageCaption,
            viewOnce: imageViewOnce,
            reply: replyTo,
        };
        originalImageAttachmentRef.current = null;
        setImageAttachment(null);
        setImageCaption('');
        setImageViewOnce(false);
        beginMediaSend(job);
    };

    const startRecording = async () => {
        if (!requireVerified('chat')) return;
        if (mediaSendLockRef.current) {
            toast.show(t('chat:sending', 'Sending...'), 'info', 2000);
            return;
        }
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
        voiceCopyGenerationRef.current += 1;
        sendAfterFinalizeRef.current = false;
        if (voicePreview?.uri) void FileSystem.deleteAsync(voicePreview.uri, { idempotent: true }).catch(() => undefined);
        setVoicePanelOpen(false);
        setVoicePreview(null);
        setVoiceWaveform([]);
        setVoiceSendFailed(false);
        setRecordingBusy(false);
    };

    const sendVoicePreview = async () => {
        if (mediaSendLockRef.current || id === 'new') return;
        if (!voicePreview) return;
        if (!canCompose) {
            toast.show(peerDeleted
                ? t('chat:account_deleted_message_disabled', 'This account has been deleted. You can no longer send messages.')
                : t('chat:accept_request_to_reply', 'Accept the request before replying.'), 'info');
            return;
        }
        setVoiceSendFailed(false);
        const job: PendingMediaSend = {
            type: 'voice',
            clientMessageId: voicePreview.clientMessageId,
            uri: voicePreview.uri,
            duration: voicePreview.duration,
            waveform: voiceWaveform,
            reply: replyTo,
        };
        setVoicePanelOpen(false);
        setVoicePreview(null);
        setVoiceWaveform([]);
        beginMediaSend(job);
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

    const runMessageDelete = async (message: ChatMessage, action: 'delete' | 'unsend', fromDialog: boolean) => {
        if (messageActionBusy) return;
        if (action === 'unsend' && !canUnsendMessage(message, String(user?._id || user?.id || ''))) {
            setDeleteError(t('chat:unsend_window_expired', 'The unsend window has expired.'));
            return;
        }
        setMessageActionBusy(true);
        setDeleteAction(action);
        setDeleteError('');
        try {
            const res = action === 'unsend' ? await chatService.unsend(message.id) : await chatService.deleteMessage(message.id);
            if (!res.success) {
                const error = apiMessage(res.message || 'connection_error');
                if (fromDialog) setDeleteError(error);
                else toast.show(error, 'error');
                return;
            }
            stopChatAudioPlaybackForMessage(message.id);
            await deleteCachedChatMediaForMessage({
                userId: String(user?._id || user?.id || ''),
                conversationId: message.conversationId,
                messageId: message.id,
            }).catch(() => undefined);
            setItems((current) => action === 'unsend'
                ? current.map((item) => item.id === message.id
                    ? { ...item, type: 'system', content: 'message_unsent', media: null, unsent: true, unsentAt: new Date().toISOString() }
                    : item)
                : current.filter((item) => item.id !== message.id));
            setDeleteTarget(null);
            setSelectedMessage(null);
        } catch {
            const error = apiMessage('connection_error');
            if (fromDialog) setDeleteError(error);
            else toast.show(error, 'error');
        } finally {
            setMessageActionBusy(false);
            setDeleteAction(null);
        }
    };

    const openMessageDelete = (message: ChatMessage) => {
        if (messageActionBusy) return;
        if (canUnsendMessage(message, String(user?._id || user?.id || ''))) {
            setSelectedMessage(null);
            setDeleteError('');
            setDeleteTarget(message);
        } else {
            void runMessageDelete(message, 'delete', false);
        }
    };

    const messageContextActions: MessageContextAction[] = selectedMessage ? [
        { id: 'reply', label: translateChatText('reply', 'Reply'), onPress: () => beginReply(selectedMessage) },
        ...(messageText(selectedMessage).trim()
            ? [{ id: 'copy' as const, label: translateChatText('copy', 'Copy'), onPress: () => void copySelectedMessage() }]
            : []),
        ...(String(selectedMessage.sender) !== String(user?._id || user?.id || '') && selectedMessage.type !== 'system' && !selectedMessage.unsent
            ? [{ id: 'report' as const, label: translateChatText('report_message', 'Report message'), onPress: reportSelectedMessage, danger: true }]
            : []),
        { id: 'delete', label: canUnsendMessage(selectedMessage, String(user?._id || user?.id || ''))
            ? t('chat:delete', 'Delete')
            : translateChatText('delete_for_me', 'Delete for me'), onPress: () => openMessageDelete(selectedMessage), danger: true },
    ] : [];

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
                <EmailVerificationModal
                    visible={isFocused}
                    onDismiss={goBackToMessages}
                    email={eligibility.email || user?.email}
                    title={t('verify_email_full_chat_title', 'Verify your email to use full chat')}
                    message={t('verify_email_full_chat_message', 'Please verify your email before opening conversations or sending messages.')}
                />
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
        <SafeAreaView style={[styles.screen, { backgroundColor: colors.bg }]} edges={['top']}>
            <View
                ref={screenContentRef}
                style={[styles.screen, { backgroundColor: colors.body }]}
                onLayout={(event) => {
                    const { width, height } = event.nativeEvent.layout;
                    setMenuViewport((current) => current.width === width && current.height === height ? current : { width, height });
                    screenContentRef.current?.measureInWindow((x, y) => {
                        screenOriginRef.current = { x, y };
                    });
                }}
            >
                <View style={[
                    styles.header,
                    {
                        backgroundColor: colors.bg,
                        borderBottomColor: colors.border,
                        flexDirection: isRTL ? 'row-reverse' : 'row',
                    },
                ]} onLayout={(event) => {
                    const height = event.nativeEvent.layout.height;
                    setChatHeaderHeight((current) => current === height ? current : height);
                }}>
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
                <ChatKeyboardViewport composerHeight={composerHeight}>
                <View
                    style={styles.messageListWrap}
                    onLayout={(event) => {
                        const width = event.nativeEvent.layout.width;
                        setMessageAreaWidth((current) => Math.abs(current - width) < 0.5 ? current : width);
                    }}
                >
                    <FlatList
                        key={id}
                        ref={listRef}
                        style={{ flex: 1 }}
                        inverted={invertedItems.length > 0}
                        keyboardShouldPersistTaps="handled"
                        keyboardDismissMode="interactive"
                        scrollEventThrottle={16}
                        onScroll={handleListScroll}
                        onContentSizeChange={() => {
                            if (!ownSendIsNewest) return;
                            const targetId = ownSendScrollMessageIdRef.current;
                            requestAnimationFrame(() => {
                                if (ownSendScrollMessageIdRef.current !== targetId) return;
                                scrollToBottom(false);
                            });
                        }}
                        onScrollBeginDrag={() => {
                            ownSendScrollMessageIdRef.current = null;
                            initialFreshPositionPendingRef.current = false;
                            pendingAutoScrollRef.current = false;
                        }}
                        onViewableItemsChanged={onViewableItemsChangedRef.current}
                        viewabilityConfig={viewabilityConfigRef.current}
                        data={invertedItems}
                        keyExtractor={(item) => item.kind === 'message' && item.message.clientMessageId
                            ? `${item.message.sender}:${item.message.clientMessageId}`
                            : item.id}
                        contentContainerStyle={{
                            paddingHorizontal: scale(12),
                            paddingTop: scale(8),
                            paddingBottom: scale(18),
                            flexGrow: 1,
                        }}
                        onEndReached={loadMore}
                        onEndReachedThreshold={0.2}
                        maintainVisibleContentPosition={{ minIndexForVisible: 0 }}
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
                </ChatKeyboardViewport>

                <ChatStickyComposer>
                <ChatComposerBar
                    backgroundColor="transparent"
                    onContentLayout={(event) => {
                        const height = event.nativeEvent.layout.height;
                        setComposerHeight((current) => Math.abs(current - height) < 1 ? current : height);
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
                                        <Camera size={scale(21)} color={colors.composerIcon} strokeWidth={2.2} />
                                    </View>
                                    <TextInput
                                        editable={false}
                                        placeholder={t('chat:message_placeholder', 'Type a message...')}
                                        placeholderTextColor={colors.subtle}
                                        style={[styles.input, { color: colors.text, fontFamily: inputFontFamily, textAlign: isRTL ? 'right' : 'left' }]}
                                    />
                                    <View style={styles.pillIcon}>
                                        <Paperclip size={scale(21)} color={colors.composerIcon} weight="bold" />
                                    </View>
                                </View>
                                <View style={[styles.send, { backgroundColor: colors.bubbleMine }]}>
                                    <Mic size={scale(21)} color={colors.inverse} weight="fill" />
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
                                <View style={[styles.inputPill, {
                                    backgroundColor: colors.surface,
                                    borderColor: colors.border,
                                    boxShadow: [{
                                        offsetX: 0,
                                        offsetY: 0,
                                        blurRadius: scale(3),
                                        spreadDistance: 0,
                                        color: isDark ? 'rgba(0,0,0,0.20)' : 'rgba(0,0,0,0.10)',
                                    }],
                                }]}>
                                    <PressableScale
                                        onPress={captureAndAttachPhoto}
                                        disabled={recordingBusy}
                                        accessibilityLabel={translateChatText('camera', 'Camera')}
                                        style={styles.pillIcon}
                                    >
                                        <Camera size={scale(21)} color={colors.composerIcon} strokeWidth={2.2} />
                                    </PressableScale>
                                    <TextInput
                                        value={content}
                                        onChangeText={handleComposerChange}
                                        placeholder={t('chat:message_placeholder', 'Type a message...')}
                                        placeholderTextColor={colors.subtle}
                                        style={[styles.input, { color: colors.text, fontFamily: inputFontFamily, textAlign: isRTL ? 'right' : 'left' }]}
                                        multiline
                                    />
                                    {!content.length && (
                                        <View style={styles.pillIconCluster}>
                                            <PressableScale
                                                onPress={pickAndUploadImage}
                                                disabled={recordingBusy}
                                                accessibilityLabel={translateChatText('attach_photo', 'Attach photo')}
                                                style={styles.pillIcon}
                                            >
                                                <Paperclip size={scale(21)} color={colors.composerIcon} weight="bold" />
                                            </PressableScale>
                                        </View>
                                    )}
                                </View>
                                <PressableScale
                                    onPress={content.length ? send : startRecording}
                                    disabled={content.length
                                        ? !content.trim() || sending
                                        : recordingBusy}
                                    accessibilityLabel={content.length
                                        ? translateChatText('send', 'Send')
                                        : translateChatText('voice_message', 'Voice message')}
                                    accessibilityState={{ disabled: content.length ? !content.trim() || sending : recordingBusy }}
                                    style={[styles.send, { backgroundColor: colors.bubbleMine }]}
                                >
                                    {content.length
                                        ? sending
                                            ? <ActivityIndicator color={colors.inverse} />
                                            : <PaperPlaneTilt size={scale(22)} color={content.trim() ? colors.inverse : colors.muted} weight="fill" />
                                        : recordingBusy
                                            ? <ActivityIndicator color={colors.inverse} />
                                            : <Mic size={scale(21)} color={colors.inverse} weight="fill" />}
                                </PressableScale>
                            </View>
                        )}
                    </View>
                )}
                </ChatComposerBar>
                </ChatStickyComposer>
                </ChatKeyboardAvoider>
                {!!selectedMessage && !!selectedAnchor && menuViewport.width > 0 && menuViewport.height > 0 && (
                    <MessageContextOverlay
                        anchor={selectedAnchor}
                        mine={String(selectedMessage.sender) === String(user?._id || user?.id || '')}
                        hasTail={selectedHasTail}
                        imageOnlyTail={selectedImageOnlyTail}
                        viewport={menuViewport}
                        headerHeight={chatHeaderHeight}
                        colors={colors}
                        actions={messageContextActions}
                        busy={messageActionBusy}
                        busyActionId={deleteAction === 'delete' ? 'delete' : undefined}
                        onReact={(emoji) => void reactToSelectedMessage(emoji)}
                        onActionFeedback={selection}
                        onClose={closeMessageMenu}
                    />
                )}
            </View>

            <ImageAttachmentComposer
                visible={!!imageAttachment}
                uri={imageAttachment?.uri ?? null}
                sourceSize={imageAttachment?.width && imageAttachment?.height
                    ? { width: imageAttachment.width, height: imageAttachment.height }
                    : undefined}
                caption={imageCaption}
                viewOnce={imageViewOnce}
                uploading={false}
                colors={colors}
                inputFontFamily={inputFontFamily}
                isRTL={isRTL}
                labels={{
                    captionPlaceholder: translateChatText('caption_placeholder', 'Add a caption (optional)'),
                    closeA11y: translateChatText('close', 'Close'),
                    viewOnceA11y: translateChatText('view_once_toggle', 'View once photo'),
                    sendA11y: translateChatText('send', 'Send'),
                }}
                onChangeCaption={setImageCaption}
                onToggleViewOnce={() => {
                    void lightImpact();
                    setImageViewOnce((value) => !value);
                }}
                onClose={closeImageAttachment}
                onSend={sendImageAttachment}
                onCrop={() => KeyboardController.dismiss()}
                onApplyCrop={({ uri, width, height }) => {
                    setImageAttachment((current) => current ? {
                        ...current,
                        uri,
                        name: `chat-crop-${Date.now()}.webp`,
                        type: 'image/webp',
                        width,
                        height,
                        size: undefined,
                        clientMessageId: newMediaMessageId(),
                    } : null);
                }}
                onCropError={() => toast.show(t('chat:crop_failed', 'Could not crop this image.'), 'error')}
                onReset={originalImageAttachmentRef.current && imageAttachment?.uri !== originalImageAttachmentRef.current.uri
                    ? () => {
                        setImageAttachment({ ...originalImageAttachmentRef.current!, clientMessageId: newMediaMessageId() });
                    }
                    : undefined}
                cropLabel={t('chat:crop', 'Crop')}
                resetLabel={t('chat:reset_image', 'Reset')}
                cancelLabel={t('cancel', 'Cancel')}
                rotateLabel={t('chat:rotate_image', 'Rotate')}
                doneLabel={t('chat:crop_done', 'Done')}
            />

            {imagePreview && (
                <ChatImageLightbox
                    preview={imagePreview}
                    onClose={() => setImagePreview(null)}
                    onCached={handleImageCached}
                />
            )}

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
            <MessageDeleteDialog
                visible={deleteTarget !== null}
                title={t('chat:delete_or_unsend_message', 'Delete or unsend this message')}
                deleteLabel={translateChatText('delete_for_me', 'Delete for me')}
                unsendLabel={deleteTarget?.type === 'image'
                    ? t('chat:unsend_image', 'Unsend image')
                    : deleteTarget?.type === 'voice'
                        ? t('chat:unsend_audio', 'Unsend audio')
                        : t('chat:unsend_text', 'Unsend message')}
                cancelLabel={t('cancel', 'Cancel')}
                busyChoice={deleteTarget ? deleteAction : null}
                error={deleteError}
                colors={colors}
                onDelete={() => { if (deleteTarget) void runMessageDelete(deleteTarget, 'delete', true); }}
                onUnsend={() => { if (deleteTarget) void runMessageDelete(deleteTarget, 'unsend', true); }}
                onClose={() => {
                    if (messageActionBusy) return;
                    setDeleteTarget(null);
                    setDeleteError('');
                }}
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

function VoiceRecorderPanel({
    colors,
    duration,
    previewUri,
    recordingBusy,
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
    const disabled = recordingBusy;
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
                    {recordingBusy ? <ActivityIndicator color={colors.inverse} size="small" /> : <PaperPlaneTilt size={scale(20)} color={colors.inverse} weight="fill" />}
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
                <CaretDoubleDown size={scale(16)} color={colors.muted} weight="bold" />
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
    onLayout,
}: {
    message: ChatMessage;
    mine: boolean;
    colors: Record<string, string>;
    style?: StyleProp<ViewStyle>;
    onLayout?: (event: LayoutChangeEvent) => void;
}) {
    const metaColor = mine ? colors.bubbleMineMuted : colors.muted;
    const statusIconSize = scale(14);
    return (
        <View style={style} onLayout={onLayout}>
            <Text variant="caption" style={{ color: metaColor, fontSize: scale(10), lineHeight: scale(12) }}>
                {formatMessageTime(message.createdAt)}
            </Text>
            {mine && !message.pending && !message.failed && (
                <View style={[styles.messageStatusIcon, { width: statusIconSize, height: statusIconSize }]}>
                    {message.seenAt
                        ? <CheckCheck size={statusIconSize} color={colors.seenTick} />
                        : message.deliveredAt
                            ? <CheckCheck size={statusIconSize} color={metaColor} />
                            : <Check size={statusIconSize} color={metaColor} />}
                </View>
            )}
            {mine && message.pending && (
                <View
                    style={[styles.messageStatusIcon, { width: statusIconSize, height: statusIconSize }]}
                    accessible
                    accessibilityLabel={message.queued ? t('chat:queued', 'Queued') : t('chat:sending', 'Sending...')}
                >
                    <Clock3 size={statusIconSize} color={metaColor} />
                </View>
            )}
            {message.failed && (
                <RefreshCw size={statusIconSize} color={colors.danger} />
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
    maxTextWidth,
}: {
    content: string;
    message: ChatMessage;
    mine: boolean;
    colors: Record<string, string>;
    textColor: string;
    maxTextWidth: number;
}) {
    const { currentLanguage } = useLanguage();
    const [multiline, setMultiline] = useState(content.includes('\n'));
    const [contentWidth, setContentWidth] = useState(0);
    const [lastLineWidth, setLastLineWidth] = useState(0);
    const [metaWidth, setMetaWidth] = useState(0);
    const direction = directionalTextStyle(content);
    const textStyle = [
        {
            fontFamily: currentLanguage === 'ar' ? Typography.font.arabic.regular : Typography.font.body.regular,
            fontSize: Typography.size.base,
            lineHeight: Typography.lineHeight.base,
            letterSpacing: 0,
        },
        styles.messageText,
        { color: textColor },
        direction,
    ];
    const inlineMetaFits = contentWidth > 0 && metaWidth > 0 && lastLineWidth + metaWidth + 5 <= contentWidth;

    if (multiline) {
        return (
            <View
                style={[styles.multilineTextWithMeta, { maxWidth: maxTextWidth || undefined }]}
                onLayout={(event) => {
                    const width = event.nativeEvent.layout.width;
                    setContentWidth((current) => Math.abs(current - width) < 0.5 ? current : width);
                }}
            >
                <RNText
                    style={textStyle}
                    onTextLayout={(event) => {
                        const width = event.nativeEvent.lines.at(-1)?.width || 0;
                        setLastLineWidth((current) => Math.abs(current - width) < 0.5 ? current : width);
                    }}
                >
                    {content}
                </RNText>
                <MessageTimeMeta
                    message={message}
                    mine={mine}
                    colors={colors}
                    style={inlineMetaFits ? styles.inlineTimeRow : styles.timeRow}
                    onLayout={(event) => {
                        const width = event.nativeEvent.layout.width;
                        setMetaWidth((current) => Math.abs(current - width) < 0.5 ? current : width);
                    }}
                />
            </View>
        );
    }

    return (
        <View style={[styles.textMessageWithMeta, { maxWidth: maxTextWidth || undefined }]}>
            <RNText
                style={[textStyle, styles.textMessageBody]}
                onTextLayout={(event) => {
                    if (event.nativeEvent.lines.length > 1) setMultiline(true);
                }}
            >
                {content}
            </RNText>
            <MessageTimeMeta message={message} mine={mine} colors={colors} style={styles.textInlineMeta} />
        </View>
    );
}

function MessageBubbleComponent({
    message,
    replyTarget,
    mine,
    showTail,
    rowGap,
    messageAreaWidth,
    maxTextWidth,
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
    replyTarget: ChatMessage | null;
    mine: boolean;
    showTail: boolean;
    rowGap: number;
    messageAreaWidth: number;
    maxTextWidth: number;
    uiDirection: 'ltr' | 'rtl';
    colors: Record<string, string>;
    userId: string;
    animateIn: boolean;
    onOpenImage: (preview: ChatImagePreview) => void;
    onOpenViewOnce: (message: ChatMessage) => void;
    viewOnceLoading: boolean;
    onOpenMenu: (message: ChatMessage, anchor: MessageAnchor) => void;
    onRetry: (message: ChatMessage) => void;
    onSwipeReply: (message: ChatMessage) => void;
    onReplyClick: (messageId: string) => void;
}) {
    const content = messageText(message);

    const media = message.media as MessageMedia | null | undefined;
    const [observedImageSize, setObservedImageSize] = useState<{ messageId: string; width: number; height: number } | null>(null);
    const hasNormalImage = message.type === 'image' && media?.url && !media.viewOnce;
    const hasViewOnce = message.type === 'image' && media?.viewOnce;
    const hasVoice = message.type === 'voice';
    const replyTo = replyTarget;
    const imageHasDetails = !!(content.trim() || replyTo);
    const imageOnlyTail = Boolean(showTail && hasNormalImage && !imageHasDetails);
    const imageSize = observedImageSize?.messageId === message.id ? observedImageSize : null;
    const imageLayout = chatImageLayout(
        media?.width || imageSize?.width,
        media?.height || imageSize?.height,
        messageAreaWidth > 0 ? Math.max(0, messageAreaWidth - scale(24)) : scale(220),
    );
    const quotedText = replyPreview(replyTo);
    const reactions = message.reactions || [];
    const messageTextColor = mine ? colors.bubbleMineText : colors.text;
    const messageMetaColor = mine ? colors.bubbleMineMuted : colors.muted;
    const useInlineTextMeta = message.type === 'text' && !!content;
    const bubblePressRef = useRef<View>(null);
    const openContext = () => {
        if (message.failed || message.pending) return;
        bubblePressRef.current?.measureInWindow((x, y, width, height) => {
            onOpenMenu(message, { x, y, width, height });
        });
    };
    const swipeX = useSharedValue(0);
    const swipeLimit = scale(72);
    const replyThreshold = scale(56);
    const replyHintTranslateY = -scale(17);
    const swipeStyle = useAnimatedStyle(() => ({
        transform: [{ translateX: swipeX.value }],
    }));
    const replyHintStyle = useAnimatedStyle(() => ({
        opacity: Math.min(1, Math.max(0, swipeX.value / replyThreshold)),
        transform: [{ translateY: replyHintTranslateY }, { scale: 0.78 + Math.min(1, swipeX.value / replyThreshold) * 0.22 }],
    }));
    const bubbleGesture = useMemo(() => {
        const swipe = Gesture.Pan()
            .enabled(!hasVoice)
            .activeOffsetX(16)
            .failOffsetY([-10, 10])
            .onUpdate((event) => {
                swipeX.value = Math.max(0, Math.min(swipeLimit, event.translationX));
            })
            .onEnd((event) => {
                if (event.translationX >= replyThreshold) runOnJS(onSwipeReply)(message);
            })
            .onFinalize(() => {
                if (swipeX.value > 0) swipeX.value = withSpring(0, { damping: 20, stiffness: 270 });
            });
        return swipe;
    }, [hasVoice, message, onSwipeReply, replyThreshold, swipeLimit, swipeX]);

    if (message.type === 'system') {
        const systemContent = String(message.content || '').trim().toLowerCase().replace(/\s+/g, '_');
        const isGalleryAccessSystem = systemContent === 'gallery_access_granted' || systemContent === 'gallery_access_revoked';
        if (isGalleryAccessSystem) {
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

    return (
        <Reanimated.View
            style={[
                styles.bubbleRow,
                { marginBottom: rowGap },
                mine ? styles.bubbleRight : styles.bubbleLeft,
            ]}
            entering={animateIn ? FadeInDown.duration(240) : undefined}
        >
            <View style={[styles.swipeReplyWrap, { direction: uiDirection }, hasNormalImage && { width: imageLayout.width }]}>
                <Reanimated.View
                    style={[
                        styles.swipeReplyHint,
                        mine ? styles.swipeReplyHintMine : styles.swipeReplyHintTheir,
                        replyHintStyle,
                    ]}
                >
                    <Reply size={scale(17)} color={colors.primary} strokeWidth={2.6} />
                </Reanimated.View>
                <GestureDetector gesture={bubbleGesture}>
                <Reanimated.View style={[styles.swipeReplyBubble, swipeStyle]}>
                    <Pressable
                        ref={bubblePressRef}
                        style={showTail && !imageOnlyTail && {
                            paddingLeft: mine ? 0 : BUBBLE_TAIL_WIDTH,
                            paddingRight: mine ? BUBBLE_TAIL_WIDTH : 0,
                        }}
                        onLongPress={openContext}
                        delayLongPress={280}
                        onPress={message.failed ? () => onRetry(message) : undefined}
                        accessibilityRole={message.failed ? 'button' : undefined}
                        accessibilityLabel={message.failed ? translateChatText('tap_to_retry', 'Tap to retry') : undefined}
                    >
                        {showTail && !imageOnlyTail && (
                            <SolidBubbleTail mine={mine} color={mine ? colors.bubbleMine : colors.surface}
                                borderColor={mine ? colors.bubbleMineBorder : colors.border} />
                        )}
                        <ImageTailMask enabled={imageOnlyTail} width={imageLayout.width} height={imageLayout.height} mine={mine}>
                        <View style={[
                            styles.bubble,
                            showTail && (mine ? styles.mineBubble : styles.theirBubble),
                            hasNormalImage && styles.imageBubble,
                            {
                                backgroundColor: hasNormalImage && !imageHasDetails ? 'transparent' : mine ? colors.bubbleMine : colors.surface,
                                borderColor: mine ? colors.bubbleMineBorder : colors.border,
                                shadowColor: colors.shadow,
                                shadowOpacity: hasNormalImage && !imageHasDetails ? 0 : mine ? 0.04 : 0.08,
                                shadowRadius: scale(3),
                                shadowOffset: { width: 0, height: 0 },
                                elevation: hasNormalImage || mine ? 0 : 1,
                            },
                            showTail && !imageOnlyTail && {
                                backgroundColor: 'transparent', borderColor: 'transparent',
                                shadowOpacity: 0, elevation: 0,
                            },
                        ]}>
                            {replyTo && !hasNormalImage && (
                                <Pressable
                                    onPress={() => onReplyClick(replyTo.id)}
                                    onLongPress={openContext}
                                    delayLongPress={280}
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
                        <>
                        <View pointerEvents={message.pending || message.failed ? 'none' : 'auto'}>
                            <CachedImageMessage
                                message={message}
                                media={media}
                                userId={userId}
                                onOpenImage={onOpenImage}
                                frameWidth={imageLayout.width}
                                frameHeight={imageLayout.height}
                                crop={imageLayout.crop}
                                onLongPress={openContext}
                                onImageSize={(width, height) => {
                                    if (media.width && media.height) return;
                                    setObservedImageSize((current) => current?.messageId === message.id
                                        && current.width === width && current.height === height
                                        ? current
                                        : { messageId: message.id, width, height });
                                }}
                            />
                        </View>
                        {imageHasDetails ? (
                            <View style={styles.imageCaptionBody}>
                                {replyTo && (
                                    <Pressable
                                        onPress={() => onReplyClick(replyTo.id)}
                                        onLongPress={openContext}
                                        delayLongPress={280}
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
                                {!!content ? (
                                    <TextMessageWithInlineMeta
                                        content={content}
                                        message={message}
                                        mine={mine}
                                        colors={colors}
                                        textColor={messageTextColor}
                                        maxTextWidth={imageLayout.width - scale(24)}
                                    />
                                ) : (
                                    <MessageTimeMeta message={message} mine={mine} colors={colors} style={styles.timeRow} />
                                )}
                            </View>
                        ) : (
                            <View pointerEvents="none" style={styles.imageMetaOverlay}>
                                <LinearGradient
                                    pointerEvents="none"
                                    colors={['rgba(0,0,0,0)', 'rgba(0,0,0,0.64)']}
                                    style={styles.imageTimeShade}
                                />
                                <MessageTimeMeta
                                    message={message}
                                    mine={mine}
                                    colors={{ ...colors, bubbleMineMuted: '#FFFFFF', muted: '#FFFFFF' }}
                                    style={styles.imageTimeRow}
                                />
                            </View>
                        )}
                        </>
                    )}

                    {hasViewOnce && (
                        <Pressable
                            onPress={() => !mine && !media?.viewedAt && onOpenViewOnce(message)}
                            onLongPress={openContext}
                            delayLongPress={280}
                            disabled={viewOnceLoading}
                            pointerEvents={message.failed ? 'none' : 'auto'}
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
                        <View pointerEvents={message.failed ? 'none' : 'auto'}>
                            <VoiceMessage
                                message={message}
                                media={media}
                                mine={mine}
                                colors={colors}
                                userId={userId}
                                onLongPress={openContext}
                            />
                        </View>
                    )}

                    {!hasNormalImage && !!content && (
                        useInlineTextMeta ? (
                            <TextMessageWithInlineMeta
                                content={content}
                                message={message}
                                mine={mine}
                                colors={colors}
                                textColor={messageTextColor}
                                maxTextWidth={maxTextWidth}
                            />
                        ) : (
                            <Text variant="body" style={[styles.messageText, { color: messageTextColor }, directionalTextStyle(content)]}>
                                {content}
                            </Text>
                        )
                    )}

                            {!hasNormalImage && !useInlineTextMeta && (
                                <MessageTimeMeta message={message} mine={mine} colors={colors} style={styles.timeRow} />
                            )}
                        </View>
                        </ImageTailMask>
                    </Pressable>
                </Reanimated.View>
                </GestureDetector>
                {message.failed && (
                    <Pressable
                        onPress={() => onRetry(message)}
                        accessibilityRole="button"
                        accessibilityLabel={translateChatText('tap_to_retry', 'Tap to retry')}
                        style={[styles.messageRetryHint, mine ? styles.messageRetryHintMine : styles.messageRetryHintTheirs]}
                    >
                        <Text variant="caption" className="font-body-bold" style={{ color: colors.danger }}>
                            {translateChatText('tap_to_retry', 'Tap to retry')}
                        </Text>
                    </Pressable>
                )}
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
    frameWidth,
    frameHeight,
    crop,
    onLongPress,
    onImageSize,
}: {
    message: ChatMessage;
    media: MessageMedia;
    userId: string;
    onOpenImage: (preview: ChatImagePreview) => void;
    frameWidth: number;
    frameHeight: number;
    crop: boolean;
    onLongPress: () => void;
    onImageSize: (width: number, height: number) => void;
}) {
    const palette = useColors();
    const [displayUri, setDisplayUri] = useState(media.localUri || media.thumbnail || media.url || '');
    const [cachedUri, setCachedUri] = useState<string | null>(media.localUri || null);

    useEffect(() => {
        setDisplayUri(media.localUri || media.thumbnail || media.url || '');
        setCachedUri(media.localUri || null);
    }, [media.localUri, media.thumbnail, media.url]);

    useEffect(() => {
        if (message.pending || message.failed || media.localUri) return;
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
    }, [media, message.conversationId, message.id, message.pending, message.failed, userId]);

    const open = () => onOpenImage({
        userId,
        conversationId: message.conversationId,
        messageId: message.id,
        media,
        initialUri: cachedUri || displayUri,
    });

    return (
        <Pressable onPress={open} onLongPress={onLongPress} delayLongPress={280} style={[styles.mediaWrap, { width: frameWidth, height: frameHeight }]} accessibilityRole="button" accessibilityLabel={translateChatText('tap_to_open', 'Tap to open')}>
            <Image
                source={{ uri: displayUri }}
                style={styles.mediaImage}
                contentFit={crop ? 'cover' : 'contain'}
                blurRadius={cachedUri || message.pending ? 0 : 8}
                transition={150}
                onLoad={(event) => {
                    if (event.source.width && event.source.height) onImageSize(event.source.width, event.source.height);
                }}
            />
            {!message.pending && !message.failed && !cachedUri && (
                <View pointerEvents="none" style={styles.mediaDownloadOverlay}>
                    <Download size={scale(18)} color={palette.chrome.common.inverseText} />
                </View>
            )}
        </Pressable>
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
    const disposedRef = useRef(false);
    const sourceRequestRef = useRef(0);
    const pendingPlayRef = useRef(false);
    const pendingSeekRef = useRef<number | null>(null);
    const recoveryAttemptedRef = useRef(false);
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
        return waveformPeaks(media?.waveform || [], VOICE_MESSAGE_WAVE_BAR_COUNT);
    }, [media?.waveform]);

    const pauseThisPlayer = useCallback(() => {
        try {
            player.pause();
        } catch {
            // The hook owns native player disposal during fast navigation.
        }
    }, [player]);

    const replaceSource = useCallback((uri: string, playWhenReady: boolean, force = false) => {
        if (disposedRef.current) return;
        if (!force && sourceUriRef.current === uri) {
            pendingPlayRef.current = pendingPlayRef.current || playWhenReady;
            return;
        }
        unpinCachedChatMedia(sourceUriRef.current);
        sourceUriRef.current = uri;
        pinCachedChatMedia(uri);
        pendingPlayRef.current = playWhenReady;
        player.replace(uri);
    }, [player]);

    const resolveSource = async () => {
        if (media?.localUri) {
            const local = await FileSystem.getInfoAsync(media.localUri).catch(() => null);
            if (local?.exists) return { uri: media.localUri };
        }
        return cacheChatMedia({
            userId,
            conversationId: message.conversationId,
            messageId: message.id,
            media,
            kind: 'voice',
        });
    };

    useEffect(() => {
        if (disposedRef.current || !sourceUriRef.current || !status.isLoaded) return;
        const seekFraction = pendingSeekRef.current;
        const shouldPlay = pendingPlayRef.current;
        if (seekFraction === null && !shouldPlay) return;
        pendingSeekRef.current = null;
        pendingPlayRef.current = false;
        void (async () => {
            try {
                const duration = status.duration || media?.duration || 0;
                if (seekFraction !== null && duration > 0) await player.seekTo(seekFraction * duration);
                if (disposedRef.current) return;
                if (shouldPlay && isChatAudioPlaybackOwner(playbackOwnerRef.current)) {
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
        if (disposedRef.current || !status.error || !sourceUriRef.current) return;
        if (recoveryAttemptedRef.current) {
            pendingPlayRef.current = false;
            releaseChatAudioPlayback(playbackOwnerRef.current);
            toast.show(translateChatText('media_playback_failed', 'Could not play this voice note. Please try again.'), 'error');
            return;
        }

        recoveryAttemptedRef.current = true;
        const shouldResume = isChatAudioPlaybackOwner(playbackOwnerRef.current);
        pendingPlayRef.current = shouldResume;
        const request = ++sourceRequestRef.current;
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
            if (disposedRef.current || request !== sourceRequestRef.current) return;
            replaceSource(cached.uri, shouldResume, true);
        })().catch(() => {
            if (disposedRef.current || request !== sourceRequestRef.current) return;
            pendingPlayRef.current = false;
            releaseChatAudioPlayback(playbackOwnerRef.current);
            toast.show(translateChatText('media_download_failed', 'Could not download media. Please try again.'), 'error');
        }).finally(() => {
            if (!disposedRef.current && request === sourceRequestRef.current) setDownloading(false);
        });
    }, [media, message.conversationId, message.id, replaceSource, status.error, toast, userId]);

    useEffect(() => {
        disposedRef.current = false;
        return () => {
            disposedRef.current = true;
            sourceRequestRef.current += 1;
            pendingPlayRef.current = false;
            pendingSeekRef.current = null;
            releaseChatAudioPlayback(playbackOwnerRef.current);
            pauseThisPlayer();
            unpinCachedChatMedia(sourceUriRef.current);
        };
    }, [pauseThisPlayer]);

    const toggle = async () => {
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

        claimChatAudioPlayback(playbackOwnerRef.current, pauseThisPlayer);
        const request = ++sourceRequestRef.current;
        setDownloading(true);
        try {
            const cached = await resolveSource();
            if (disposedRef.current || request !== sourceRequestRef.current) return;
            recoveryAttemptedRef.current = false;
            replaceSource(cached.uri, true);
        } catch {
            if (disposedRef.current || request !== sourceRequestRef.current) return;
            releaseChatAudioPlayback(playbackOwnerRef.current);
            toast.show(translateChatText('media_download_failed', 'Could not download media. Please try again.'), 'error');
        } finally {
            if (!disposedRef.current && request === sourceRequestRef.current) setDownloading(false);
        }
    };

    const fractionAt = (x: number) => trackWidth > 0 ? Math.max(0, Math.min(1, x / trackWidth)) : 0;
    const seekToFraction = async (fraction: number) => {
        if (downloading) {
            pendingSeekRef.current = fraction;
            return;
        }
        const duration = status.duration || media?.duration || 0;
        if (sourceUriRef.current && status.isLoaded && duration > 0) {
            await player.seekTo(fraction * duration);
            return;
        }
        pendingSeekRef.current = fraction;
        const request = ++sourceRequestRef.current;
        setDownloading(true);
        try {
            const cached = await resolveSource();
            if (disposedRef.current || request !== sourceRequestRef.current) return;
            recoveryAttemptedRef.current = false;
            replaceSource(cached.uri, false);
        } catch {
            if (disposedRef.current || request !== sourceRequestRef.current) return;
            pendingSeekRef.current = null;
            toast.show(translateChatText('media_download_failed', 'Could not download media. Please try again.'), 'error');
        } finally {
            if (!disposedRef.current && request === sourceRequestRef.current) setDownloading(false);
        }
    };

    return (
        <View style={styles.voiceWrap}>
            <View style={styles.voicePlaybackControl}>
                <Pressable
                    onPress={toggle}
                    onLongPress={onLongPress}
                    delayLongPress={280}
                    disabled={downloading}
                    accessibilityRole="button"
                    accessibilityLabel={status.playing
                        ? translateChatText('voice_pause', 'Pause')
                        : translateChatText('voice_play', 'Play')}
                    style={styles.voicePlayButton}
                >
                    {/* iOS reports buffering even when the player has no source. */}
                    {downloading || (sourceUriRef.current !== null && !status.error && status.isBuffering
                        && (status.playing || pendingPlayRef.current || pendingSeekRef.current !== null))
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
                        {waveform.length === 0 && (
                            <View style={[styles.waveUnavailable, { backgroundColor: mine ? colors.bubbleMineMuted : colors.waveMuted }]} />
                        )}
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
        width: scale(32),
        height: scale(32),
        borderRadius: scale(16),
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
    imageBubble: { minWidth: 0, paddingHorizontal: 0, paddingTop: 0, paddingBottom: 0, borderWidth: 0, overflow: 'hidden' },
    imageCaptionBody: { paddingHorizontal: scale(12), paddingTop: scale(8), paddingBottom: scale(7) },
    imageMetaOverlay: { position: 'absolute', left: 0, right: 0, bottom: 0, height: scale(56) },
    imageTimeShade: { position: 'absolute', left: 0, right: 0, bottom: 0, height: scale(56) },
    imageTimeRow: { position: 'absolute', right: scale(8), bottom: scale(8), flexDirection: 'row', alignItems: 'center', gap: scale(4) },
    mineBubble: { borderBottomRightRadius: 0 },
    theirBubble: { borderBottomLeftRadius: 0 },
    messageText: { fontSize: scale(15), lineHeight: scale(20) },
    textMessageWithMeta: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' },
    multilineTextWithMeta: { width: '100%' },
    textMessageBody: { flexShrink: 1, minWidth: 0 },
    textInlineMeta: { flexShrink: 0, flexDirection: 'row', alignItems: 'center', gap: scale(4), marginTop: 3, marginLeft: 5, minHeight: scale(14) },
    messageStatusIcon: { flexShrink: 0, alignItems: 'center', justifyContent: 'center' },
    messageRetryHint: { marginTop: scale(3), maxWidth: '100%' },
    messageRetryHintMine: { alignSelf: 'flex-end' },
    messageRetryHintTheirs: { alignSelf: 'flex-start' },
    inlineTimeRow: { position: 'absolute', right: 0, bottom: 0, flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: scale(4), minHeight: scale(14) },
    timeRow: { alignSelf: 'flex-end', flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: scale(4), marginTop: 3, minHeight: scale(14) },
    systemWrap: { alignItems: 'center', marginVertical: scale(7) },
    systemText: { paddingHorizontal: scale(12), paddingVertical: scale(5), borderRadius: scale(14), overflow: 'hidden' },
    systemPillRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: scale(12), paddingVertical: scale(5), borderRadius: scale(14), overflow: 'hidden' },
    unsentBubble: { borderWidth: StyleSheet.hairlineWidth, borderStyle: 'dashed', borderRadius: scale(14), paddingHorizontal: scale(12), paddingVertical: scale(8) },
    mediaWrap: { overflow: 'hidden', backgroundColor: '#E8E1D6' },
    mediaImage: { width: '100%', height: '100%' },
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
        top: '50%',
        left: '50%',
        marginTop: -scale(21),
        marginLeft: -scale(21),
        width: scale(42),
        height: scale(42),
        borderRadius: scale(21),
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
    waveUnavailable: { height: 2, width: '100%', borderRadius: 1 },
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
        minHeight: scale(40),
        borderRadius: scale(20),
        borderWidth: StyleSheet.hairlineWidth,
        paddingHorizontal: scale(4),
    },
    pillIcon: {
        width: scale(38),
        height: scale(40),
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
        minHeight: scale(40),
        maxHeight: scale(120),
        paddingHorizontal: scale(6),
        // Equal vertical padding keeps text centered in the pill
        paddingTop: scale(10),
        paddingBottom: scale(10),
        fontSize: scale(14),
        lineHeight: scale(19),
    },
    send: {
        width: scale(40),
        height: scale(40),
        borderRadius: scale(20),
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
    replyQuote: {
        borderLeftWidth: scale(3),
        borderRadius: scale(8),
        paddingHorizontal: scale(8),
        paddingVertical: scale(6),
        marginBottom: scale(7),
    },
    reactionWrap: {
        marginLeft: scale(10),
        marginTop: -scale(8),
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
