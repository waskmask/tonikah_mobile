import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
    ActivityIndicator,
    Dimensions,
    Modal,
    Platform,
    Pressable,
    RefreshControl,
    ScrollView,
    StyleSheet,
    TextInput,
    View,
} from 'react-native';
import { Gesture, GestureDetector, GestureHandlerRootView, ScrollView as GHScrollView } from 'react-native-gesture-handler';
import Animated, {
    Easing,
    runOnJS,
    useAnimatedStyle,
    useSharedValue,
    withSpring,
    withTiming,
} from 'react-native-reanimated';
import { Image } from 'expo-image';
import { GlassView, isGlassEffectAPIAvailable, isLiquidGlassAvailable } from 'expo-glass-effect';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { requireOptionalNativeModule } from 'expo-modules-core';
import { router } from 'expo-router';
import { PUBLIC_PROFILE_DETAIL_STALE_TIME_MS, queryClient } from '@/lib/queryClient';
import { queryKeys } from '@/lib/queryKeys';
import {
    Baby,
    AlertCircle,
    Ban,
    BookHeart,
    BookOpen,
    BriefcaseBusiness,
    Building2,
    CalendarHeart,
    ChevronLeft,
    ChevronRight,
    Cigarette,
    Compass,
    Flag,
    GraduationCap,
    Gem,
    Languages,
    LampDesk,
    Lock,
    MapPin,
    Mic,
    Moon,
    Pencil,
    Plane,
    Palette,
    Puzzle,
    Quote,
    RefreshCw,
    Ruler,
    ShieldCheck,
    Shirt,
    Signpost,
    Sparkles,
    Users,
    Wine,
    X,
    Banknote,
    Footprints,
} from 'lucide-react-native';
import type { LucideIcon } from 'lucide-react-native';
import { Text } from '@/components/ui/Text';
import { SmallDarkOutlinedButton } from '@/components/ui/SmallDarkOutlinedButton';
import { Divider } from '@/components/ui/Divider';
import { DashedRoundedBorder } from '@/components/ui/DashedRoundedBorder';
import { PartnerPreferencePromptCard } from '@/components/profile/PartnerPreferencePromptCard';
import { Mosque } from '@/components/ui/icons/Mosque';
import { Pram } from '@/components/ui/icons/Pram';
import { ProfileMessage } from '@/components/ui/icons/ProfileMessage';
import { useEmailVerificationGuard } from '@/hooks/useEmailVerificationGuard';
import { useLanguage } from '@/hooks/useLanguage';
import { scale } from '@/hooks/useResponsive';
import { useTheme } from '@/hooks/useTheme';
import { useColors } from '@/hooks/useColors';
import { ToastProvider, useToast } from '@/hooks/useToast';
import { useChatSocket } from '@/hooks/useChatSocket';
import { useKeyboardHeight } from '@/hooks/useKeyboardHeight';
import { isGalleryModerationActive } from '@/hooks/useGalleryModeration';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { usersService } from '@/lib/usersService';
import { profileService } from '@/lib/profileService';
import { chatService, normalizeConversation } from '@/lib/chatService';
import {
    apiMessage,
    cleanProfileMultilineText,
    cleanProfileText,
    displayText,
    listText,
    t,
    translateCountry,
    toKey,
    translateNamespace,
} from '@/lib/profileDisplay';
import {
    bioText,
    flagEmoji,
    formatProfileLocation,
    imageUrl,
    isMembershipActive,
    isVerifiedProfile,
    normalizeGallery,
    profileAge,
    profileId,
    profileName,
} from '@/lib/exploreProfile';
import { PROFILE_PLACEHOLDER_IMAGE } from '@/lib/profileAssets';
import { Typography } from '@/constants/typography';
import { AppMenuButton } from '@/components/app/AppMenuButton';
import { emojiChipItem } from '@/lib/profileEmoji';
import { formatProfileManagerBadge } from '@/lib/profileManager';
import { ProfileManagerBadge } from '@/components/profile/ProfileManagerBadge';
import { getTextDirection, localeTextDirection, localeUsesLatinScript } from '@/lib/textDirection';
import type { TextDirection } from '@/lib/textDirection';
import { moderationCandidateForEditing, pendingModerationCandidate } from '@/lib/textModeration';
import { UnderReviewInfoIcon, UnderReviewPill } from '@/components/app/UnderReviewPill';
import { ProfileSummaryEditor, SummaryField } from '@/components/profile/ProfileSummaryEditor';
import { ReportSheet, ReportTarget } from '@/components/profile/ReportSheet';
import { MessagingMembershipGate } from '@/components/membership/MessagingMembershipGate';
import { useMessagingEligibilityStatus } from '@/hooks/useCurrentUserStatus';
import { canOpenMessaging } from '@/lib/messagingAccess';
import {
    buildMissingImpactGroups,
    calculateWeightedMissingImpacts,
    MISSING_IMPACT_WEIGHTS,
} from '@/lib/profileCompletionImpact';

type Fact = { id?: string; icon: LucideIcon; label: string; value: string; underReview?: boolean; editTarget?: 'company' };
type PendingProfileToast = {
    key: string;
    fallback: string;
    type: 'success' | 'info' | 'warning' | 'error';
    duration?: number;
};

function truncateHeaderName(value: string, max = 11) {
    const trimmed = value.trim();
    return trimmed.length > max ? `${trimmed.slice(0, max)}..` : trimmed;
}

function blendHexColors(foreground: string, background: string, opacity: number) {
    const parse = (color: string) => {
        const hex = color.replace('#', '');
        if (!/^[\da-f]{6}$/i.test(hex)) return null;
        return [0, 2, 4].map((offset) => Number.parseInt(hex.slice(offset, offset + 2), 16));
    };
    const foregroundRgb = parse(foreground);
    const backgroundRgb = parse(background);
    if (!foregroundRgb || !backgroundRgb) return background;
    const channels = foregroundRgb.map((channel, index) =>
        Math.round(channel * opacity + backgroundRgb[index] * (1 - opacity)),
    );
    return `rgb(${channels.join(', ')})`;
}

function approvedPreviewText(value: unknown, moderationMeta: unknown, multiline = false) {
    const clean = multiline ? cleanProfileMultilineText : cleanProfileText;
    const approvedValue = clean(typeof value === 'string' ? value : '');
    const candidate = clean(moderationCandidateForEditing(moderationMeta));
    return candidate && candidate === approvedValue ? '' : approvedValue;
}


export type UserProfileViewProps = {
    userId?: string;
    initialProfile?: any;
    mode?: 'inline' | 'screen' | 'modal';
    showClose?: boolean;
    isOwnProfile?: boolean;
    onEditProfile?: () => void;
    editProfileOpening?: boolean;
    onOpenMenu?: () => void;
    onClose?: () => void;
    onBlocked?: (userId: string) => void;
    onUnblocked?: (userId: string) => void;
    onFavoriteChanged?: (userId: string, favorited: boolean) => void;
    refreshing?: boolean;
    onRefresh?: () => void | Promise<void>;
    onReconcile?: () => void | Promise<void>;
    onProfilePatch?: (patch: Record<string, any>) => void;
    onBottomBarVisibilityChange?: (hidden: boolean) => void;
    previewOnly?: boolean;
    showHeader?: boolean;
    /** Render the owner's cached profile exactly as its approved public view, without fetching it. */
    publicPreview?: boolean;
    /** Public Preview keeps one owner action so Partner Preference can be edited in place. */
    showPartnerPreferenceEdit?: boolean;
};

const SCREEN_WIDTH = Dimensions.get('window').width;
const PROFILE_COMPLETION_IMPACT_GROUPS = buildMissingImpactGroups([{
    rows: Object.keys(MISSING_IMPACT_WEIGHTS).map((completionKey) => ({ completionKey })),
}]);

export function UserProfileView({
    userId,
    initialProfile,
    mode = 'inline',
    showClose = true,
    isOwnProfile = false,
    onEditProfile,
    editProfileOpening = false,
    onOpenMenu,
    onClose,
    onBlocked,
    onUnblocked,
    onFavoriteChanged,
    refreshing = false,
    onRefresh,
    onReconcile,
    onProfilePatch,
    onBottomBarVisibilityChange,
    previewOnly = false,
    showHeader = true,
    publicPreview = false,
    showPartnerPreferenceEdit = false,
}: UserProfileViewProps) {
    const { isDark } = useTheme();
    const colors = useColors();
    const hasNativeHeaderGlass = Platform.OS === 'ios'
        && !!requireOptionalNativeModule('ExpoGlassEffect')
        && isGlassEffectAPIAvailable()
        && isLiquidGlassAvailable();
    const headerActionIconColor = isDark ? '#E5E5E7' : '#201B15';
    const commonColors = colors.chrome.common;
    const toast = useToast();
    const { currentLanguage, isRTL } = useLanguage();
    const { requireVerified } = useEmailVerificationGuard();
    const insets = useSafeAreaInsets();
    const headerTopInset = insets.top;
    const headerRowHeight = scale(48);
    const profileHeaderBottomInset = scale(4);
    const resolvedUserId = userId || profileId(initialProfile);
    const cachedDetail = !isOwnProfile && resolvedUserId
        ? queryClient.getQueryData<any>(queryKeys.profile.detail(resolvedUserId))
        : null;
    const cachedProfile = cachedDetail?.privacy === 'private' ? null : cachedDetail;
    const [loadedProfile, setProfile] = useState<any>(() => cachedProfile || initialProfile || null);
    const [detailReady, setDetailReady] = useState(isOwnProfile || Boolean(cachedProfile));
    const profileRequestRef = useRef(0);
    // The owner profile already has a live parent-owned /me model. Mirroring it
    // into local state caused an extra full render after every parent update.
    const profile = isOwnProfile ? initialProfile || loadedProfile : loadedProfile;
    const showOwnerContent = isOwnProfile && !publicPreview;
    const [loading, setLoading] = useState(Boolean(resolvedUserId && !cachedProfile && !initialProfile));
    const [error, setError] = useState('');
    const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
    const [reportTarget, setReportTarget] = useState<ReportTarget | null>(null);
    const [messageSheetOpen, setMessageSheetOpen] = useState(false);
    const [messageDraft, setMessageDraft] = useState('');
    const [messageChecking, setMessageChecking] = useState(false);
    const [messageSending, setMessageSending] = useState(false);
    const [membershipGateOpen, setMembershipGateOpen] = useState(false);
    const messagingEligibility = useMessagingEligibilityStatus();
    const [locallySentRequestIds, setLocallySentRequestIds] = useState<Set<string>>(() => new Set());
    const [pendingProfileToast, setPendingProfileToast] = useState<PendingProfileToast | null>(null);
    const [blockConfirmOpen, setBlockConfirmOpen] = useState(false);
    const [blockBusy, setBlockBusy] = useState(false);
    const [unblockBusy, setUnblockBusy] = useState(false);
    const [favoriteBusy, setFavoriteBusy] = useState(false);
    const [reportOpening, setReportOpening] = useState(false);
    const [moderatedSummaryField, setModeratedSummaryField] = useState<SummaryField | null>(null);
    const [summaryImpacts, setSummaryImpacts] = useState<Record<string, number>>({});
    const scrollOffsetRef = useRef(0);
    const scrollDirectionDistanceRef = useRef(0);
    const bottomBarHiddenRef = useRef(false);

    const openLightbox = useCallback((photoIndex: number) => {
        if (Platform.OS === 'ios') {
            void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
        }
        setLightboxIndex(photoIndex);
    }, []);

    const load = useCallback(async (force = false) => {
        if (!resolvedUserId) return;
        const requestId = ++profileRequestRef.current;
        const detailKey = queryKeys.profile.detail(resolvedUserId);
        const cached = queryClient.getQueryData<any>(detailKey);
        if (force) queryClient.removeQueries({ queryKey: detailKey, exact: true });
        if (!cached && !initialProfile) setLoading(true);
        setError('');
        try {
            const res = await queryClient.fetchQuery({
                queryKey: detailKey,
                queryFn: async () => {
                    const response = await usersService.detail(resolvedUserId);
                    if (response.success === false) {
                        throw new Error(response.message || 'profile_unavailable');
                    }
                    return response;
                },
                staleTime: cached?.privacy === 'private' || force ? 0 : PUBLIC_PROFILE_DETAIL_STALE_TIME_MS,
                gcTime: 30 * 60_000,
                retry: false,
            });
            if (res.privacy === 'private') {
                queryClient.removeQueries({ queryKey: detailKey, exact: true });
            }
            if (requestId !== profileRequestRef.current) return;
            setProfile(res);
            setDetailReady(true);
        } catch (cause) {
            if (requestId !== profileRequestRef.current) return;
            setError(apiMessage(cause instanceof Error ? cause.message : undefined, 'profile_unavailable'));
        } finally {
            if (requestId === profileRequestRef.current) setLoading(false);
        }
    }, [initialProfile, resolvedUserId]);

    useEffect(() => {
        // Own profile renders from the parent's /me + gallery data (which keeps
        // contentModeration for pending candidates); the public detail endpoint
        // would strip it.
        if (resolvedUserId && !isOwnProfile) void load();
        return () => { profileRequestRef.current += 1; };
    }, [load, resolvedUserId, isOwnProfile]);

    // Private-gallery access belongs to the viewed member. Owner moderation is
    // coordinated once at the app root and reaches this screen via shared data.
    useChatSocket({
        enabled: Boolean(resolvedUserId) && !isOwnProfile,
        onGalleryAccessChanged: (payload: any) => {
            if (!payload?.ownerId || String(payload.ownerId) !== String(resolvedUserId)) return;
            if (payload.grantId) {
                setProfile((current: any) => current ? { ...current, gallery: [], privacy: 'private' } : current);
                setLightboxIndex(null);
            }
            void load(true);
        },
    });

    useEffect(() => {
        if (messageSheetOpen || !pendingProfileToast) return;
        const timer = setTimeout(() => {
            toast.show(
                t(pendingProfileToast.key, pendingProfileToast.fallback),
                pendingProfileToast.type,
                pendingProfileToast.duration || 3000,
            );
            setPendingProfileToast(null);
        }, 420);
        return () => clearTimeout(timer);
    }, [messageSheetOpen, pendingProfileToast, toast]);

    const id = profileId(profile) || resolvedUserId || '';
    const name = profileName(profile) || t('profile', 'Profile');
    const age = profileAge(profile);
    const title = `${name}${age ? `, ${age}` : ''}`;
    const headerTitle = `${truncateHeaderName(name)}${age ? `, ${age}` : ''}`;
    const visibleHeaderTitle = isOwnProfile ? t('my_profile', 'My profile') : headerTitle;
    const localeDirection = localeTextDirection(currentLanguage);
    const nameDirection = getTextDirection(name, localeDirection);
    const visibleHeaderTitleDirection = isOwnProfile ? localeDirection : nameDirection;
    const gallery = normalizeGallery(profile);
    const galleryPrivacy = profile?.privacy || profile?.gallery_privacy || profile?.galleryPrivacy || 'public';
    const isPublicGalleryItem = (item: any) => {
        const status = String(item?.moderationMeta?.status || '').toLowerCase();
        return item?.safe !== false
            && !['queued', 'processing', 'pending_review', 'admin_reviewing', 'rejected'].includes(status)
            && ['approved', ''].includes(status);
    };
    const visibleGallery = publicPreview
        ? gallery.filter(isPublicGalleryItem).map((item: any) => (
            galleryPrivacy === 'private'
                ? {
                    uuid: item?.uuid,
                    safe: item?.safe,
                    moderationMeta: item?.moderationMeta,
                    isPrimary: item?.isPrimary,
                    sort_index: item?.sort_index,
                    urls: { blur: item?.urls?.blur },
                }
                : item
        ))
        : gallery;
    const hasActiveGalleryModeration = showOwnerContent && gallery.some((item: any) =>
        isGalleryModerationActive(item?.moderationMeta?.status),
    );
    // url + uuid pairs so image reports can reference the exact photo
    const photoItems = (() => {
        const fromGallery = visibleGallery
            .map((item: any) => ({
                url: imageUrl(item),
                uuid: String(item?.uuid || ''),
                safe: item?.safe,
                moderationStatus: item?.moderationMeta?.status,
                qualified: !showOwnerContent || isPublicGalleryItem(item),
            }))
            .filter((item: { url: string }) => Boolean(item.url));
        if (fromGallery.length > 0) return fromGallery;
        if (publicPreview) return [];
        const avatar = typeof profile?.avatar === 'string' ? profile.avatar.trim() : '';
        return avatar ? [{ url: avatar, uuid: '', safe: undefined, moderationStatus: undefined, qualified: true }] : [];
    })();
    const photos = photoItems.map((item) => item.url);
    const inlinePhotos = photoItems
        .map((item, index) => ({ item, index }))
        .filter(({ item, index }) => index > 0 && item.qualified)
        .slice(0, 2);
    const secondPhoto = inlinePhotos[0];
    const thirdPhoto = inlinePhotos[1];
    const privateGallery = (!isOwnProfile || publicPreview) && galleryPrivacy === 'private';
    const verified = isVerifiedProfile(profile);
    const activeMembership = isMembershipActive(profile);
    const location = formatProfileLocation(profile);
    const countryFlag = flagEmoji(profile);
    // Owners see their pending moderation candidate (with an "Under review"
    // pill); everyone else keeps seeing only the approved public text.
    const moderationMeta = profile?.contentModeration || {};
    const ownerModerationMeta = showOwnerContent ? moderationMeta : {};
    const headlineCandidate = pendingModerationCandidate(ownerModerationMeta.profileHeadline);
    const bioCandidate = pendingModerationCandidate(ownerModerationMeta.bio);
    const approvedHeadline = publicPreview
        ? approvedPreviewText(profile?.profile_headline, moderationMeta.profileHeadline)
        : cleanProfileText(profile?.profile_headline);
    const approvedBio = publicPreview
        ? approvedPreviewText(profile?.bio, moderationMeta.bio, true)
        : bioText(profile);
    const headline = cleanProfileText(headlineCandidate || approvedHeadline);
    const bio = bioCandidate ? cleanProfileMultilineText(bioCandidate) : approvedBio;
    const headlineDirection = getTextDirection(headline, localeDirection);
    const bioParagraphs = bio ? bio.split(/\n(?:[ \t]*\n)+/) : [];
    // A field is missing only when there is no approved value AND no pending
    // candidate; then the owner gets the real editor inline in About Me.
    const missingSummaryFields: SummaryField[] = showOwnerContent
        ? ([
            ...(!headline ? ['headline'] : []),
            ...(!bio ? ['bio'] : []),
        ] as SummaryField[])
        : [];
    const headlineMissing = missingSummaryFields.includes('headline');
    const bioMissing = missingSummaryFields.includes('bio');

    useEffect(() => {
        if (!showOwnerContent || (!headlineMissing && !bioMissing)) {
            setSummaryImpacts({});
            return;
        }

        let active = true;
        void profileService.fetchProfileCompletion()
            .then((response) => {
                if (!active) return;
                const data = response.completion || response.profileCompletion || response.data;
                const missingKeys = Array.isArray(data?.missingKeys)
                    ? data.missingKeys
                    : Array.isArray(data?.missing)
                        ? data.missing
                        : [];
                setSummaryImpacts(calculateWeightedMissingImpacts(
                    Number(data?.percent ?? data?.percentage ?? 0),
                    missingKeys,
                    PROFILE_COMPLETION_IMPACT_GROUPS,
                ));
            })
            .catch(() => {
                if (active) setSummaryImpacts({});
            });

        return () => {
            active = false;
        };
    }, [bioMissing, headlineMissing, showOwnerContent]);
    const bioDirection = getTextDirection(bio, localeDirection);
    const blocked = profile?.blocked === true;

    const close = useCallback(() => {
        onClose?.();
    }, [onClose]);

    const scrollY = useSharedValue(0);
    const dragY = useSharedValue(0);

    const handleProfileScroll = useCallback((offsetY: number) => {
        const previousOffset = scrollOffsetRef.current;
        scrollOffsetRef.current = offsetY;
        scrollY.value = offsetY;

        if (!onBottomBarVisibilityChange) return;

        if (offsetY <= 4) {
            scrollDirectionDistanceRef.current = 0;
            if (bottomBarHiddenRef.current) {
                bottomBarHiddenRef.current = false;
                onBottomBarVisibilityChange(false);
            }
            return;
        }

        const delta = offsetY - previousOffset;
        if (delta === 0) return;

        const accumulated = scrollDirectionDistanceRef.current;
        const changedDirection = (delta > 0 && accumulated < 0) || (delta < 0 && accumulated > 0);
        scrollDirectionDistanceRef.current = changedDirection ? delta : accumulated + delta;

        if (!bottomBarHiddenRef.current && offsetY >= 48 && delta > 0) {
            bottomBarHiddenRef.current = true;
            scrollDirectionDistanceRef.current = 0;
            onBottomBarVisibilityChange(true);
        } else if (bottomBarHiddenRef.current && scrollDirectionDistanceRef.current <= -16) {
            bottomBarHiddenRef.current = false;
            scrollDirectionDistanceRef.current = 0;
            onBottomBarVisibilityChange(false);
        }
    }, [onBottomBarVisibilityChange, scrollY]);

    useEffect(() => () => {
        onBottomBarVisibilityChange?.(false);
    }, [onBottomBarVisibilityChange]);

    // Swipe-to-dismiss only on the header — wrapping the whole sheet blocks ScrollView on Android.
    const headerDismissGesture = useMemo(() => Gesture.Pan()
        .enabled(mode === 'modal')
        .activeOffsetY(8)
        .failOffsetX([-32, 32])
        .onUpdate((event) => {
            if (scrollY.value <= 1 && event.translationY > 0) {
                dragY.value = event.translationY;
            } else if (event.translationY <= 0) {
                dragY.value = 0;
            }
        })
        .onEnd((event) => {
            if (scrollY.value <= 1 && event.translationY > 64) {
                runOnJS(close)();
            }
            dragY.value = withSpring(0);
        }), [mode, close]);

    const modalSheetStyle = useAnimatedStyle(() => ({
        transform: [{ translateY: mode === 'modal' ? dragY.value : 0 }],
    }));
    const ProfileScrollView = mode === 'screen' ? ScrollView : GHScrollView;

    const startMessage = async () => {
        if (!id || !requireVerified('chat')) return;
        if (messageChecking) return;
        setMessageChecking(true);
        try {
            let access = messagingEligibility.messagingAccess;
            if (!canOpenMessaging(access)) {
                const refreshed = await messagingEligibility.refetch();
                access = refreshed.data?.messagingAccess ?? access;
            }
            if (access?.required === true && !canOpenMessaging(access)) {
                setMembershipGateOpen(true);
                return;
            }
            const status = await chatService.status(id);

            if (!status.success) {
                if (locallySentRequestIds.has(id)) {
                    toast.show(t('chat:request_already_sent', 'Message request already sent.'), 'info', 3000);
                    return;
                }
                toast.show(apiMessage(status.message || 'connection_error'), 'error');
                return;
            }

            if (status.status === 'active' && status.conversationId) {
                router.push({ pathname: '/conversation/[id]', params: { id: status.conversationId, recipientId: id, name } } as any);
                return;
            }

            if (status.status === 'pending') {
                const sent = await chatService.sentRequests();
                if (sent.success) {
                    const alreadySent = (sent.items || [])
                        .map((item) => normalizeConversation(item, 'sent'))
                        .some((item) => {
                            const other = (item.otherUser || {}) as { id?: string; _id?: string };
                            return String(other.id || other._id || '') === String(id);
                        });
                    if (alreadySent) {
                        setLocallySentRequestIds((current) => new Set(current).add(id));
                        setMessageDraft('');
                        toast.show(t('chat:request_already_sent', 'Message request already sent.'), 'info', 3000);
                        return;
                    }
                } else if (locallySentRequestIds.has(id)) {
                    toast.show(t('chat:request_already_sent', 'Message request already sent.'), 'info', 3000);
                    return;
                }
                if (status.conversationId) {
                    router.push({ pathname: '/conversation/[id]', params: { id: status.conversationId, recipientId: id, name, state: 'request_pending', requestRole: 'incoming' } } as any);
                    return;
                }
            }

            if (locallySentRequestIds.has(id)) {
                toast.show(t('chat:request_already_sent', 'Message request already sent.'), 'info', 3000);
                return;
            }

            setMessageSheetOpen(true);
        } catch {
            if (locallySentRequestIds.has(id)) {
                toast.show(t('chat:request_already_sent', 'Message request already sent.'), 'info', 3000);
            } else {
                toast.show(apiMessage('connection_error'), 'error');
            }
        } finally {
            setMessageChecking(false);
        }
    };

    const sendIntroMessage = async () => {
        if (!id || messageSending) return;
        const body = messageDraft.trim();
        if (!body) {
            toast.show(t('message_empty', 'Please enter a message before sending.'), 'warning', 2500);
            return;
        }
        setMessageSending(true);
        try {
            const res = await chatService.send({ recipientId: id, content: body, type: 'text' });
            if (!res.success) {
                if (res.code === 'MEMBERSHIP_REQUIRED') {
                    setMessageSheetOpen(false);
                    void messagingEligibility.refetch();
                    setMembershipGateOpen(true);
                    return;
                }
                if (res.errorMessage === 'request_already_pending') {
                    setMessageDraft('');
                    setLocallySentRequestIds((current) => new Set(current).add(id));
                    setPendingProfileToast({
                        key: 'chat:request_already_sent',
                        fallback: 'Message request already sent.',
                        type: 'info',
                    });
                    setMessageSheetOpen(false);
                    return;
                }
                if (res.errorMessage === 'conversation_already_active' && res.conversationId) {
                    setMessageSheetOpen(false);
                    router.push({ pathname: '/conversation/[id]', params: { id: res.conversationId, recipientId: id, name } } as any);
                    return;
                }
                toast.show(apiMessage(res.errorMessage || 'message_failed'), 'error');
                return;
            }
            setMessageDraft('');
            setLocallySentRequestIds((current) => new Set(current).add(id));
            setPendingProfileToast({
                key: 'chat:msg_request_sent',
                fallback: 'Message request sent!',
                type: 'success',
            });
            setMessageSheetOpen(false);
        } catch {
            toast.show(apiMessage('connection_error'), 'error');
        } finally {
            setMessageSending(false);
        }
    };

    const toggleFavorite = async () => {
        if (!id || favoriteBusy || !requireVerified('profileActions')) return;
        const favorited = Boolean(profile?.is_favorited);
        setFavoriteBusy(true);
        try {
            const res = favorited ? await usersService.unfavorite(id) : await usersService.favorite(id);
            if (res.success) {
                const nextFavorited = !favorited;
                setProfile((current: any) => ({ ...current, is_favorited: nextFavorited }));
                void queryClient.invalidateQueries({ queryKey: queryKeys.profile.detail(id), refetchType: 'none' });
                onFavoriteChanged?.(id, nextFavorited);
                toast.show(
                    nextFavorited ? t('favorited', 'Added to Saved') : t('unfavorited', 'Removed from Saved'),
                    'success',
                    2500,
                );
            } else {
                toast.show(apiMessage(res.message), 'error');
            }
        } catch {
            toast.show(apiMessage('connection_error'), 'error');
        } finally {
            setFavoriteBusy(false);
        }
    };

    const reportProfile = () => {
        if (!id || reportOpening || !requireVerified('report')) return;
        setReportOpening(true);
        setReportTarget({ type: 'User', userId: id });
    };

    const blockUser = () => {
        if (!id || !requireVerified('report')) return;
        setBlockConfirmOpen(true);
    };

    const confirmBlockUser = async () => {
        if (!id || blockBusy) return;
        setBlockBusy(true);
        const res = await usersService.block(id);
        setBlockBusy(false);
        if (res.success) {
            setBlockConfirmOpen(false);
            queryClient.removeQueries({ queryKey: queryKeys.profile.detail(id), exact: true });
            onBlocked?.(id);
            close();
            setTimeout(() => {
                toast.show(t('blocked', 'User has been blocked.'), 'success', 2500);
            }, 360);
        } else {
            toast.show(apiMessage(res.message), 'error');
        }
    };

    const unblockUser = async () => {
        if (!id || unblockBusy) return;
        setUnblockBusy(true);
        try {
            const res = await usersService.unblock(id);
            if (res.success) {
                setProfile((current: any) => ({ ...current, blocked: false }));
                onUnblocked?.(id);
                toast.show(t('unblocked', 'User has been unblocked.'), 'success', 2500);
                void load(true);
            } else {
                toast.show(apiMessage(res.message), 'error');
            }
        } finally {
            setUnblockBusy(false);
        }
    };

    const factsProfile = useMemo(() => publicPreview
        ? {
            ...profile,
            company: approvedPreviewText(profile?.company, moderationMeta.company),
        }
        : profile, [moderationMeta.company, profile, publicPreview]);
    const facts = useMemo(() => buildFacts(factsProfile, showOwnerContent), [factsProfile, showOwnerContent]);
    const storedPartnerPreference = profile?.partner_preference || profile?.partnerPreference || {};
    const partnerPreference = publicPreview
        ? {
            ...storedPartnerPreference,
            about_partner: approvedPreviewText(
                storedPartnerPreference?.about_partner,
                moderationMeta.partnerPreferenceAboutPartner,
                true,
            ),
        }
        : storedPartnerPreference;
    const partnerAboutCandidate = showOwnerContent
        ? pendingModerationCandidate(ownerModerationMeta.partnerPreferenceAboutPartner)
        : '';
    const partnerAbout = cleanProfileMultilineText(
        partnerAboutCandidate || partnerPreference?.about_partner,
    );
    const partnerAboutParagraphs = partnerAbout ? partnerAbout.split(/\n(?:[ \t]*\n)+/) : [];
    const partnerAboutDirection = getTextDirection(partnerAbout, localeDirection);
    const usesLatinLabels = localeUsesLatinScript(currentLanguage);
    const partnerFacts = useMemo(() => buildPartnerFacts(partnerPreference), [partnerPreference]);
    const partnerPreferenceEmpty = !partnerAbout && partnerFacts.length === 0;
    const showPartnerPreference = Boolean(partnerAbout || partnerFacts.length || showPartnerPreferenceEdit);

    if (loading) {
        return (
            <View style={[styles.center, { backgroundColor: colors.brand.bg.surface }]}>
                <ActivityIndicator color={colors.chrome.primary} />
            </View>
        );
    }

    if (error || !profile || blocked) {
        return (
            <View style={[styles.center, { backgroundColor: colors.brand.bg.surface, padding: scale(24) }]}>
                <Text variant="h3" align="center">
                    {blocked ? t('you_blocked_this_user', 'You have blocked this user') : error || t('profile_unavailable', 'Profile unavailable')}
                </Text>
                {blocked ? (
                    <Pressable disabled={unblockBusy} onPress={unblockUser} style={[styles.closeError, { borderColor: colors.chrome.primary, backgroundColor: colors.chrome.primary, opacity: unblockBusy ? 0.72 : 1 }]}>
                        {unblockBusy ? (
                            <ActivityIndicator size="small" color={colors.chrome.common.inverseText} />
                        ) : (
                            <Text style={{ color: colors.chrome.common.inverseText, fontWeight: '700' }}>{t('unblock', 'Unblock')}</Text>
                        )}
                    </Pressable>
                ) : null}
                {showClose ? (
                    <Pressable onPress={close} style={[styles.closeError, { borderColor: colors.brand.bg.border }]}>
                        <Text>{t('close', 'Close')}</Text>
                    </Pressable>
                ) : null}
            </View>
        );
    }

    const ProfileRootComponent = mode === 'modal' ? Animated.View : View;
    const profileRootStyle = mode === 'modal'
        ? [{ flex: 1, backgroundColor: colors.brand.bg.surface }, modalSheetStyle]
        : [{ flex: 1, backgroundColor: colors.brand.bg.surface }];

    const headerBar = (
            <View
                style={[
                    styles.header,
                    isOwnProfile && styles.ownHeader,
                    {
                        paddingTop: headerTopInset,
                        paddingBottom: isOwnProfile ? 0 : profileHeaderBottomInset,
                        minHeight: headerTopInset + headerRowHeight + (isOwnProfile ? 0 : profileHeaderBottomInset),
                        backgroundColor: colors.chrome.header.background,
                        borderBottomColor: colors.brand.bg.border,
                    },
                ]}
                collapsable={false}
            >
                {!isOwnProfile && showClose ? (
                    <Pressable
                        onPress={close}
                        style={[
                            styles.headerButton,
                            styles.headerBackButton,
                        ]}
                        hitSlop={11}
                    >
                        {isRTL
                            ? <ChevronRight size={scale(23)} color={isDark ? '#E5E5E7' : '#201B15'} strokeWidth={2.2} />
                            : <ChevronLeft size={scale(23)} color={isDark ? '#E5E5E7' : '#201B15'} strokeWidth={2.2} />}
                    </Pressable>
                ) : isOwnProfile ? null : <View style={styles.headerButton} />}
                {/* Content-sized title in a flex row hugs the chevron both directions;
                    ‏ (RLM) sets RTL bidi base so age renders left of the name */}
                <View style={styles.headerTitleWrap}>
                    <Text
                        variant="body"
                        className="font-body-semi"
                        numberOfLines={1}
                        style={[
                            styles.headerTitle,
                            {
                                writingDirection: visibleHeaderTitleDirection,
                                ...(visibleHeaderTitleDirection === 'rtl'
                                    ? { fontFamily: Typography.font.arabic.semi, fontWeight: undefined }
                                    : {}),
                            },
                        ]}
                    >
                        {visibleHeaderTitleDirection === 'rtl' ? '\u200F' : '\u200E'}{visibleHeaderTitle}
                    </Text>
                </View>
                {isOwnProfile ? (
                    <View style={styles.ownHeaderActions}>
                        <SmallDarkOutlinedButton
                            onPress={onEditProfile || (() => router.push('/(tabs)/edit-profile'))}
                            label={t('edit_profile', 'Edit profile')}
                            loading={editProfileOpening}
                        />
                        {onOpenMenu ? (
                            <AppMenuButton
                                accessibilityLabel={t('menu', 'Menu')}
                                onPress={onOpenMenu}
                            />
                        ) : null}
                    </View>
                ) : (
                    <Pressable
                        onPress={startMessage}
                        style={styles.profileMessageAction}
                        hitSlop={4}
                        accessibilityRole="button"
                        accessibilityLabel={t('send_message', 'Send message')}
                    >
                        <View
                            pointerEvents="none"
                            style={[
                                styles.profileMessageSurface,
                                { backgroundColor: '#201B15' },
                            ]}
                        />
                        {hasNativeHeaderGlass ? (
                            <GlassView
                                pointerEvents="none"
                                glassEffectStyle="regular"
                                colorScheme={isDark ? 'dark' : 'light'}
                                style={styles.profileMessageGlass}
                            />
                        ) : null}
                        <View pointerEvents="none" style={styles.profileMessageIconCenter}>
                            {messageChecking ? (
                                <ActivityIndicator size="small" color={headerActionIconColor} />
                            ) : (
                                <ProfileMessage
                                    width={scale(20)}
                                    height={scale(18.2)}
                                />
                            )}
                        </View>
                    </Pressable>
                )}
            </View>
    );

    return (
            <ProfileRootComponent style={profileRootStyle}>
            {showHeader ? (
                mode === 'modal' ? (
                    <GestureDetector gesture={headerDismissGesture}>{headerBar}</GestureDetector>
                ) : headerBar
            ) : null}

            <ProfileScrollView
                style={{ flex: 1 }}
                showsVerticalScrollIndicator={false}
                nestedScrollEnabled={mode === 'modal'}
                // iOS: keep the inline summary editor visible above the keyboard
                // (Android resizes the window via adjustResize already)
                automaticallyAdjustKeyboardInsets={isOwnProfile}
                keyboardShouldPersistTaps="handled"
                scrollEventThrottle={16}
                onScroll={(event) => handleProfileScroll(event.nativeEvent.contentOffset.y)}
                refreshControl={onRefresh ? (
                    <RefreshControl
                        refreshing={refreshing}
                        onRefresh={onRefresh}
                        tintColor={colors.chrome.primary}
                        colors={[colors.chrome.primary]}
                        progressBackgroundColor={colors.chrome.header.background}
                    />
                ) : undefined}
                contentContainerStyle={[
                    styles.content,
                    { paddingBottom: 0 },
                ]}
            >
                <ProfileGallery
                    photos={photos}
                    photoItems={photoItems}
                    privateGallery={privateGallery}
                    canOpenPhotos={!privateGallery && !previewOnly}
                    name={name}
                    age={age}
                    nameDirection={nameDirection}
                    appIsRTL={isRTL}
                    location={location}
                    countryFlag={countryFlag}
                    verified={verified}
                    activeMembership={activeMembership}
                    profileManagerLabel={formatProfileManagerBadge(profile?.profile_manager)}
                    onOpenPhoto={openLightbox}
                    isDark={isDark}
                />
                {/* Per-photo "Under review" pills on the gallery images carry the
                    moderation state — no separate banner below the gallery */}

                {!previewOnly && detailReady ? (<>
                {(facts.atAGlance.length > 0 || headline || bio || missingSummaryFields.length > 0) ? (
                    <Section
                        title=""
                        isDark={isDark}
                        hideTitle
                        topPadding={30}
                        bottomPadding={!headline && !bio && missingSummaryFields.length === 0 ? 24 : undefined}
                    >
                        <AtAGlancePills
                            facts={facts.atAGlance}
                            hasFollowingContent={Boolean(headline || bio || missingSummaryFields.length > 0)}
                        />
                        {headline ? (
                            headlineCandidate ? (
                                <Pressable
                                    accessibilityRole="button"
                                    accessibilityLabel={`${t('profile_headline', 'Profile headline')}, ${t('moderation_text_under_review', 'Under review')}`}
                                    onPress={() => setModeratedSummaryField('headline')}
                                    style={({ pressed }) => [styles.moderatedTextPressable, pressed && styles.moderatedTextPressed]}
                                >
                                    <View style={styles.moderatedTextRow}>
                                        <UnderReviewInfoIcon warning style={styles.moderatedTextIcon} />
                                        <Text
                                            variant="h3"
                                            className="font-heading"
                                            style={[
                                                styles.headline,
                                                styles.moderatedText,
                                                {
                                                    textAlign: headlineDirection === 'rtl' ? 'right' : 'left',
                                                    writingDirection: headlineDirection,
                                                    ...(headlineDirection === 'rtl'
                                                        ? { fontFamily: Typography.font.arabic.bold, fontWeight: undefined }
                                                        : {}),
                                                },
                                            ]}
                                        >
                                            {headline}
                                        </Text>
                                        {isRTL ? <ChevronLeft size={scale(19)} color={colors.chrome.common.textMuted} style={styles.moderatedTextChevron} /> : <ChevronRight size={scale(19)} color={colors.chrome.common.textMuted} style={styles.moderatedTextChevron} />}
                                    </View>
                                </Pressable>
                            ) : (
                                <Text
                                    variant="h3"
                                    className="font-heading"
                                    style={[
                                        styles.headline,
                                        {
                                            textAlign: headlineDirection === 'rtl' ? 'right' : 'left',
                                            writingDirection: headlineDirection,
                                            ...(headlineDirection === 'rtl'
                                                ? { fontFamily: Typography.font.arabic.bold, fontWeight: undefined }
                                                : {}),
                                        },
                                    ]}
                                >
                                    {headline}
                                </Text>
                            )
                        ) : missingSummaryFields.includes('headline') ? (
                            <ProfileSummaryEditor
                                profile={profile}
                                fields={missingSummaryFields}
                                variant="card"
                                headlineImpact={summaryImpacts.profile_headline || 0}
                                bioImpact={summaryImpacts.bio || 0}
                                onOptimisticSave={onProfilePatch}
                                onSaved={async () => {
                                    await onRefresh?.();
                                }}
                            />
                        ) : null}
                        {!headline && bio ? (
                            <Text
                                variant="caption"
                                className="font-body-semi"
                                style={[
                                    styles.sectionTitle,
                                    localeUsesLatinScript(currentLanguage) ? styles.latinSectionLabel : styles.naturalLabel,
                                    styles.bioOnlyTitle,
                                    {
                                        color: colors.chrome.common.textStrong,
                                        textAlign: isRTL ? 'right' : 'left',
                                        writingDirection: isRTL ? 'rtl' : 'ltr',
                                    },
                                ]}
                            >
                                {t('bio', 'Bio')}
                            </Text>
                        ) : null}
                        {bio ? (
                            showOwnerContent ? (
                                <Pressable
                                    disabled={!bioCandidate}
                                    accessibilityRole={bioCandidate ? 'button' : undefined}
                                    accessibilityLabel={bioCandidate ? `${t('bio', 'Bio')}, ${t('moderation_text_under_review', 'Under review')}` : undefined}
                                    onPress={() => setModeratedSummaryField('bio')}
                                    style={({ pressed }) => [styles.moderatedTextPressable, pressed && bioCandidate && styles.moderatedTextPressed]}
                                >
                                    <View style={styles.moderatedTextRow}>
                                        {bioCandidate ? <UnderReviewInfoIcon warning style={styles.moderatedTextIcon} /> : null}
                                        <View style={styles.bioParagraphs}>
                                            {bioParagraphs.map((paragraph, index) => (
                                                <Text
                                                    key={index}
                                                    variant="body"
                                                    style={[
                                                        styles.bioText,
                                                        index < bioParagraphs.length - 1 && styles.bioParagraphGap,
                                                        {
                                                            textAlign: bioDirection === 'rtl' ? 'right' : 'left',
                                                            writingDirection: bioDirection,
                                                            fontFamily: bioDirection === 'rtl'
                                                                ? Typography.font.arabic.regular
                                                                : Typography.font.body.regular,
                                                        },
                                                    ]}
                                                >
                                                    {paragraph}
                                                </Text>
                                            ))}
                                        </View>
                                        {bioCandidate ? (isRTL ? <ChevronLeft size={scale(19)} color={colors.chrome.common.textMuted} style={styles.moderatedTextChevron} /> : <ChevronRight size={scale(19)} color={colors.chrome.common.textMuted} style={styles.moderatedTextChevron} />) : null}
                                    </View>
                                </Pressable>
                            ) : (
                                <ExpandableProfileBio
                                    text={bio}
                                    paragraphs={bioParagraphs}
                                    direction={bioDirection}
                                />
                            )
                        ) : headline && missingSummaryFields.includes('bio') ? (
                            <ProfileSummaryEditor
                                profile={profile}
                                fields={['bio']}
                                variant="card"
                                bioImpact={summaryImpacts.bio || 0}
                                onOptimisticSave={onProfilePatch}
                                onSaved={async () => {
                                    await onRefresh?.();
                                }}
                            />
                        ) : null}
                    </Section>
                ) : null}

                {moderatedSummaryField && showOwnerContent ? (
                    <ProfileSummaryEditor
                        key={moderatedSummaryField}
                        profile={profile}
                        fields={[moderatedSummaryField]}
                        initialActiveField={moderatedSummaryField}
                        hideRows
                        onCloseEditor={() => setModeratedSummaryField(null)}
                        onOptimisticSave={onProfilePatch}
                        onSaved={async () => {
                            setModeratedSummaryField(null);
                            await onRefresh?.();
                        }}
                    />
                ) : null}

                <SectionFacts title={t('religious_beliefs', 'Religious Beliefs')} facts={facts.faith} isDark={isDark} isRTL={isRTL} />
                <SectionFacts
                    title={t('education_career', 'Education & Career')}
                    facts={facts.career}
                    isDark={isDark}
                    isRTL={isRTL}
                    onPressCompany={showOwnerContent
                        ? () => router.push({ pathname: '/(tabs)/edit-profile', params: { openEditor: 'company' } })
                        : undefined}
                />
                {secondPhoto ? (
                    <InlineProfilePhoto
                        source={secondPhoto.item.url}
                        index={secondPhoto.index}
                        total={photos.length}
                        disabled={privateGallery}
                        onPress={() => openLightbox(secondPhoto.index)}
                    />
                ) : null}
                <SectionFacts title={t('appearance', 'Appearance')} facts={facts.appearance} isDark={isDark} isRTL={isRTL} />
                <ChipSection
                    title={t('faith_in_daily_life', 'Faith in Daily Life')}
                    items={profile?.faith_in_daily_life || []}
                    type="faith"
                    isDark={isDark}
                    isRTL={isRTL}
                    action={showOwnerContent ? {
                        label: t('edit', 'Edit'),
                        onPress: () => router.push({
                            pathname: '/(tabs)/hobbies-faith',
                            params: { section: 'faith', returnTo: '/(tabs)/profile' },
                        }),
                    } : undefined}
                />
                <SectionFacts title={t('background', 'Background')} facts={facts.background} isDark={isDark} isRTL={isRTL} />
                <SectionFacts title={t('future_plans', 'Future plans')} facts={facts.future} isDark={isDark} isRTL={isRTL} />
                <SectionFacts title={t('lifestyle', 'Lifestyle')} facts={facts.lifestyle} isDark={isDark} isRTL={isRTL} />
                {thirdPhoto ? (
                    <InlineProfilePhoto
                        source={thirdPhoto.item.url}
                        index={thirdPhoto.index}
                        total={photos.length}
                        disabled={privateGallery}
                        onPress={() => openLightbox(thirdPhoto.index)}
                    />
                ) : null}
                <ChipSection
                    title={t('hobbies', 'Hobbies')}
                    items={profile?.hobbies || []}
                    type="hobby"
                    isDark={isDark}
                    isRTL={isRTL}
                    action={showOwnerContent ? {
                        label: t('edit', 'Edit'),
                        onPress: () => router.push({
                            pathname: '/(tabs)/hobbies-faith',
                            params: { section: 'hobbies', returnTo: '/(tabs)/profile' },
                        }),
                    } : undefined}
                />
                {partnerPreferenceEmpty && showPartnerPreferenceEdit ? (
                    <PartnerPreferencePromptCard
                        title={t('add_partner_preference', 'Add partner preference')}
                        actionLabel={t('add', 'Add')}
                        onPress={() => router.push({
                            pathname: '/(tabs)/partner-preference',
                            params: { returnTo: '/(tabs)/profile' },
                        })}
                    />
                ) : showPartnerPreference ? (
                    <Section
                        title={t('partner_preference', 'Partner Preference')}
                        isDark={isDark}
                        highlight
                        card
                        extraBottomPadding={showOwnerContent ? 20 : 0}
                        action={showOwnerContent || showPartnerPreferenceEdit ? {
                            label: t('edit', 'Edit'),
                            onPress: () => router.push({
                                pathname: '/(tabs)/partner-preference',
                                params: { returnTo: '/(tabs)/profile' },
                            }),
                        } : undefined}
                    >
                        {partnerAbout ? (
                            <>
                                <View style={styles.factLabelRow}>
                                    <Quote size={scale(15)} color={colors.chrome.common.textMuted} />
                                    <Text
                                        variant="caption"
                                        className="font-body-semi"
                                        numberOfLines={1}
                                        adjustsFontSizeToFit
                                        minimumFontScale={0.86}
                                        style={[
                                            styles.factLabel,
                                            usesLatinLabels ? styles.latinFieldLabel : styles.naturalLabel,
                                            { color: colors.chrome.common.textMuted },
                                        ]}
                                    >
                                        {t('looking_for', 'Looking for')}
                                    </Text>
                                    {partnerAboutCandidate ? <UnderReviewPill /> : null}
                                </View>
                                <View style={styles.factValueRow}>
                                    <ExpandableProfileBio
                                        text={partnerAbout}
                                        paragraphs={partnerAboutParagraphs}
                                        direction={partnerAboutDirection}
                                    />
                                </View>
                                {partnerFacts.length > 0 ? (
                                    <Divider style={styles.partnerPreferenceDivider} />
                                ) : null}
                            </>
                        ) : null}
                        <FactRows facts={partnerFacts} isRTL={isRTL} relaxedMultiline />
                    </Section>
                ) : null}
                {!isOwnProfile ? (
                <View
                    style={[
                        styles.profileFooterActionWrap,
                        {
                            backgroundColor: colors.chrome.common.subtleSurface,
                            borderTopColor: colors.brand.bg.border,
                            paddingBottom: mode === 'screen' ? scale(102) : scale(36),
                        },
                    ]}
                >
                    <View style={styles.profileFooterActionRow}>
                        <View style={[styles.profileFooterActionSurface, { backgroundColor: colors.chrome.common.card }]}>
                            <Pressable
                                disabled={favoriteBusy}
                                onPress={toggleFavorite}
                                style={({ pressed }) => pressed && styles.profileFooterActionPressed}
                                accessibilityState={{ disabled: favoriteBusy }}
                            >
                                <View pointerEvents="none" style={styles.profileFooterLabelInset}>
                                    <Text
                                        variant="body-sm"
                                        numberOfLines={1}
                                        adjustsFontSizeToFit
                                        minimumFontScale={0.82}
                                    style={[styles.profileFooterActionText, { color: colors.chrome.common.textStrong }]}
                                >
                                        {favoriteBusy
                                            ? profile?.is_favorited
                                                ? t('removing', 'Removing...')
                                                : t('saving', 'Saving...')
                                            : profile?.is_favorited
                                                ? t('saved', 'Saved')
                                                : t('save_profile', 'Save profile')}
                                    </Text>
                                </View>
                            </Pressable>
                        </View>
                        <View style={[styles.profileFooterActionSurface, { backgroundColor: colors.chrome.common.card }]}>
                            <Pressable
                                disabled={reportOpening}
                                onPress={reportProfile}
                                style={({ pressed }) => pressed && styles.profileFooterActionPressed}
                                accessibilityState={{ disabled: reportOpening }}
                            >
                                <View pointerEvents="none" style={styles.profileFooterLabelInset}>
                                    {reportOpening ? (
                                        <ActivityIndicator size="small" color={colors.chrome.common.textStrong} />
                                    ) : (
                                        <Text
                                            variant="body-sm"
                                            numberOfLines={1}
                                            adjustsFontSizeToFit
                                            minimumFontScale={0.82}
                                            style={[styles.profileFooterActionText, { color: colors.chrome.common.textStrong }]}
                                        >
                                            {t('report_profile', 'Report profile')}
                                        </Text>
                                    )}
                                </View>
                            </Pressable>
                        </View>
                        <View style={[styles.profileFooterActionSurface, { backgroundColor: colors.chrome.common.card }]}>
                            <Pressable
                                disabled={blockBusy}
                                onPress={blockUser}
                                style={({ pressed }) => pressed && styles.profileFooterActionPressed}
                                accessibilityState={{ disabled: blockBusy }}
                            >
                                <View pointerEvents="none" style={styles.profileFooterLabelInset}>
                                    <Text
                                        variant="body-sm"
                                        numberOfLines={1}
                                        adjustsFontSizeToFit
                                        minimumFontScale={0.82}
                                        style={[styles.profileFooterActionText, { color: colors.chrome.common.textStrong }]}
                                    >
                                        {t('block_user', 'Block user')}
                                    </Text>
                                </View>
                            </Pressable>
                        </View>
                    </View>
                </View>
                ) : null}
                </>) : (
                    <View pointerEvents="none" style={styles.profileDetailSkeleton}>
                        <View style={[styles.profileSkeletonBar, { width: '40%', height: scale(22), backgroundColor: commonColors.skeleton }]} />
                        <View style={[styles.profileSkeletonBar, { width: '92%', marginTop: scale(22), backgroundColor: commonColors.skeleton }]} />
                        <View style={[styles.profileSkeletonBar, { width: '86%', backgroundColor: commonColors.skeleton }]} />
                        <View style={[styles.profileSkeletonBar, { width: '63%', backgroundColor: commonColors.skeleton }]} />
                    </View>
                )}
            </ProfileScrollView>

            {lightboxIndex !== null ? (
                <ImageLightbox
                    photos={photos}
                    index={lightboxIndex}
                    showReport={!isOwnProfile}
                    reportTarget={reportTarget?.type === 'Image' ? reportTarget : null}
                    onClose={() => setLightboxIndex(null)}
                    onCloseReport={() => setReportTarget(null)}
                    onReportBlocked={(blockedUserId) => {
                        queryClient.removeQueries({ queryKey: queryKeys.profile.detail(blockedUserId), exact: true });
                        onBlocked?.(blockedUserId);
                        setReportTarget(null);
                        setLightboxIndex(null);
                        close();
                    }}
                    onReport={(photoIndex) => {
                        if (!id || !requireVerified('report')) return;
                        const item = photoItems[photoIndex];
                        setReportTarget({
                            type: 'Image',
                            userId: id,
                            imageUrl: item?.url,
                            imageId: item?.uuid || undefined,
                        });
                    }}
                />
            ) : null}
            <ReportSheet
                target={reportTarget?.type === 'User' ? reportTarget : null}
                onOpened={() => setReportOpening(false)}
                onClose={() => {
                    setReportOpening(false);
                    setReportTarget(null);
                }}
                onBlocked={(blockedUserId) => {
                    onBlocked?.(blockedUserId);
                    close();
                }}
            />
            <IntroMessageSheet
                visible={messageSheetOpen}
                value={messageDraft}
                sending={messageSending}
                isDark={isDark}
                isRTL={isRTL}
                title={t('send_message', 'Send Message')}
                placeholder={t('message_compose_placeholder', "Write a respectful intro message — share why you're interested.")}
                hint={t('message_compose_hint', 'Enter for new line, blank line for paragraph break.')}
                onChange={(value) => setMessageDraft(value.slice(0, 500))}
                onClose={() => {
                    if (!messageSending) setMessageSheetOpen(false);
                }}
                onSend={sendIntroMessage}
            />
            <BlockConfirmModal
                visible={blockConfirmOpen}
                loading={blockBusy}
                onCancel={() => {
                    if (!blockBusy) setBlockConfirmOpen(false);
                }}
                onConfirm={confirmBlockUser}
            />
            <MessagingMembershipGate
                visible={membershipGateOpen}
                trialOffer={messagingEligibility.trialOffer}
                onClose={() => setMembershipGateOpen(false)}
            />
            </ProfileRootComponent>
    );
}

function BlockConfirmModal({
    visible,
    loading,
    onCancel,
    onConfirm,
}: {
    visible: boolean;
    loading: boolean;
    onCancel: () => void;
    onConfirm: () => void;
}) {
    const palette = useColors();
    return (
        <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
            <View style={styles.confirmLayer}>
                <Pressable style={styles.confirmBackdrop} onPress={onCancel} />
                <View
                    style={[
                        styles.confirmCard,
                        {
                            backgroundColor: palette.chrome.common.card,
                            borderColor: palette.brand.bg.border,
                        },
                    ]}
                >
                    <View style={[styles.confirmIcon, { backgroundColor: palette.chrome.common.primaryTint }]}>
                        <Ban size={scale(22)} color={palette.brand.accent.error} strokeWidth={2.3} />
                    </View>
                    <Text variant="h3" align="center" style={{ color: palette.chrome.common.textStrong }}>
                        {t('block_user', 'Block user')}
                    </Text>
                    <Text variant="body-sm" align="center" style={{ color: palette.brand.text.subtitle, lineHeight: scale(19) }}>
                        {t('block_user_confirm', 'Are you sure you want to block this user?')}
                    </Text>
                    <View style={styles.confirmActions}>
                        <Pressable
                            disabled={loading}
                            onPress={onCancel}
                            style={({ pressed }) => [
                                styles.confirmButton,
                                {
                                    borderColor: palette.brand.bg.border,
                                    backgroundColor: palette.chrome.common.card,
                                },
                                pressed && { opacity: 0.72 },
                                loading && { opacity: 0.7 },
                            ]}
                        >
                            <Text variant="body-sm" style={{ color: palette.chrome.common.textStrong, fontWeight: '600' }}>
                                {t('cancel', 'Cancel')}
                            </Text>
                        </Pressable>
                        <Pressable
                            disabled={loading}
                            onPress={onConfirm}
                            style={({ pressed }) => [
                                styles.confirmButton,
                                {
                                    borderColor: palette.brand.accent.error,
                                    backgroundColor: palette.brand.accent.error,
                                },
                                pressed && { opacity: 0.85 },
                                loading && { opacity: 0.78 },
                            ]}
                        >
                            {loading ? (
                                <ActivityIndicator size="small" color={palette.chrome.common.inverseText} />
                            ) : (
                                <Text variant="body-sm" style={{ color: palette.chrome.common.inverseText, fontWeight: '700' }}>
                                    {t('block', 'Block')}
                                </Text>
                            )}
                        </Pressable>
                    </View>
                </View>
            </View>
        </Modal>
    );
}

function IntroMessageSheet({
    visible,
    value,
    sending,
    isDark,
    isRTL,
    title,
    placeholder,
    hint,
    onChange,
    onClose,
    onSend,
}: {
    visible: boolean;
    value: string;
    sending: boolean;
    isDark: boolean;
    isRTL: boolean;
    title: string;
    placeholder: string;
    hint: string;
    onChange: (value: string) => void;
    onClose: () => void;
    onSend: () => void;
}) {
    const insets = useSafeAreaInsets();
    const palette = useColors();
    const inputRef = React.useRef<TextInput>(null);
    const keyboard = useKeyboardHeight();
    const maxSheetHeight = Math.round(Dimensions.get('window').height * 0.72);

    useEffect(() => {
        if (!visible) return undefined;
        const timer = setTimeout(() => {
            inputRef.current?.focus();
        }, 280);

        return () => clearTimeout(timer);
    }, [visible]);

    return (
        <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
            <View
                style={[
                    styles.messageOverlay,
                    keyboard.visible
                        ? {
                            justifyContent: 'flex-end',
                            paddingBottom: keyboard.height,
                        }
                        : null,
                ]}
            >
                <Pressable style={styles.messageBackdrop} onPress={onClose} />
                <View
                    style={[
                        styles.messageSheet,
                        {
                            backgroundColor: palette.chrome.common.card,
                            borderColor: palette.brand.bg.border,
                            paddingBottom: Math.max(insets.bottom + scale(12), scale(22)),
                            maxHeight: maxSheetHeight,
                        },
                    ]}
                >
                    <View style={styles.messageSheetHeader}>
                        <Text variant="body-sm" className="font-body-bold" style={{ color: palette.chrome.common.textStrong }}>
                            {title}
                        </Text>
                        <Pressable onPress={onClose} disabled={sending} style={styles.messageSheetClose} hitSlop={10}>
                            <X size={scale(20)} color={palette.chrome.common.textStrong} />
                        </Pressable>
                    </View>
                    <ScrollView
                        keyboardShouldPersistTaps="handled"
                        showsVerticalScrollIndicator={false}
                        contentContainerStyle={styles.messageSheetContent}
                    >
                        <TextInput
                            ref={inputRef}
                            value={value}
                            onChangeText={onChange}
                            placeholder={placeholder}
                            placeholderTextColor={palette.brand.text.muted}
                            multiline
                            textAlignVertical="top"
                            scrollEnabled
                            style={[
                                styles.messageInput,
                                {
                                    color: palette.chrome.common.textStrong,
                                    backgroundColor: palette.brand.bg.surface,
                                    borderColor: palette.brand.bg.border,
                                    textAlign: isRTL ? 'right' : 'left',
                                },
                            ]}
                        />
                        <View style={styles.messageMetaRow}>
                            <Text variant="caption" style={{ color: palette.brand.text.subtitle, flex: 1 }}>
                                {hint}
                            </Text>
                            <Text variant="caption" className="font-body-semi" style={{ color: value.length > 450 ? palette.chrome.primary : palette.brand.text.subtitle }}>
                                {value.length}/500
                            </Text>
                        </View>
                        <Pressable disabled={sending || !value.trim()} onPress={onSend} style={[styles.messageSendButton, (!value.trim() || sending) && styles.messageSendDisabled]}>
                            {sending ? <ActivityIndicator color={palette.chrome.common.inverseText} /> : <Text variant="body-sm" className="font-body-bold" style={{ color: palette.chrome.common.inverseText }}>{t('send', 'Send')}</Text>}
                        </Pressable>
                    </ScrollView>
                </View>
            </View>
        </Modal>
    );
}

function ProfileGallery({
    photos,
    photoItems,
    privateGallery,
    canOpenPhotos = true,
    name,
    age,
    nameDirection,
    appIsRTL,
    location,
    countryFlag,
    verified,
    activeMembership,
    profileManagerLabel,
    onOpenPhoto,
    isDark,
}: {
    photos: string[];
    photoItems: Array<{
        url: string;
        uuid: string;
        safe?: boolean;
        moderationStatus?: string;
        qualified?: boolean;
    }>;
    privateGallery: boolean;
    canOpenPhotos?: boolean;
    name: string;
    age: number | null;
    nameDirection: TextDirection;
    appIsRTL: boolean;
    location: string;
    countryFlag: string;
    verified: boolean;
    activeMembership: boolean;
    profileManagerLabel?: string | null;
    onOpenPhoto: (index: number) => void;
    isDark: boolean;
}) {
    const palette = useColors();
    const slots = photos.length > 1
        ? photos.slice(0, 3)
        : [photos[0] || '', '', ''];
    const canScrollPhotos = photos.length > 1;
    const slideWidth = Math.round(SCREEN_WIDTH * 0.68);
    const showPrivateBadge = privateGallery && photos.length > 0;

    return (
        <View style={[styles.gallery, { backgroundColor: palette.chrome.common.card }]}>
            <GHScrollView
                horizontal
                nestedScrollEnabled
                scrollEnabled={canScrollPhotos}
                alwaysBounceHorizontal={false}
                overScrollMode="never"
                showsHorizontalScrollIndicator={false}
                snapToInterval={slideWidth}
                decelerationRate="fast"
                directionalLockEnabled
            >
                {slots.map((src, index) => {
                    const item = photoItems[index];
                    const checking = isGalleryModerationActive(item?.moderationStatus);
                    const underReview = Boolean(
                        item && item.safe === false && !checking,
                    );
                    return (
                        <Pressable
                            key={item?.uuid || `${src}-${index}`}
                            disabled={!src || !canOpenPhotos}
                            onPress={() => onOpenPhoto(index)}
                            style={[styles.gallerySlide, { width: slideWidth, backgroundColor: palette.brand.bg.surface }]}
                        >
                            <Image
                                source={src ? { uri: src } : PROFILE_PLACEHOLDER_IMAGE}
                                style={StyleSheet.absoluteFill}
                                contentFit="cover"
                                cachePolicy="memory-disk"
                            />
                            {checking || underReview ? (
                                <View
                                    style={[
                                        styles.galleryModerationBadge,
                                        { backgroundColor: palette.chrome.toast.warning.bg },
                                    ]}
                                >
                                    {checking ? (
                                        <ActivityIndicator
                                            size="small"
                                            color={palette.chrome.toast.warning.icon}
                                            style={styles.galleryModerationSpinner}
                                        />
                                    ) : (
                                        <AlertCircle
                                            size={scale(12)}
                                            color={palette.chrome.toast.warning.icon}
                                            strokeWidth={2.5}
                                        />
                                    )}
                                    <Text
                                        variant="caption"
                                        className="font-body-bold"
                                        style={[
                                            styles.galleryModerationBadgeText,
                                            { color: palette.chrome.toast.warning.text },
                                        ]}
                                    >
                                        {checking
                                            ? t('image_moderation_checking', 'Checking photo')
                                            : t('moderation_text_under_review', 'Under review')}
                                    </Text>
                                </View>
                            ) : null}
                        </Pressable>
                    );
                })}
            </GHScrollView>
            <LinearGradient colors={['rgba(16, 16, 17,0.02)', 'rgba(16, 16, 17,0.72)']} style={styles.galleryGradient} pointerEvents="none" />
            <View style={styles.galleryBadges}>
                {photos.length > 0 ? (
                    <View style={styles.photoCount}>
                        <Text variant="caption" style={{ color: palette.chrome.common.inverseText }}>{photos.length}</Text>
                    </View>
                ) : null}
            </View>
            <View style={styles.galleryIdentity} pointerEvents="box-none">
                {(verified || activeMembership || showPrivateBadge || profileManagerLabel) ? (
                    <View style={[styles.trustRow, { flexDirection: 'row' }]} pointerEvents="box-none">
                        {verified ? (
                            <TrustChip
                                icon={<ShieldCheck size={scale(13)} color={palette.chrome.common.inverseText} fill="#3D63F3" />}
                                label={t('badge_verified', 'Verified')}
                            />
                        ) : null}
                        {activeMembership ? (
                            <TrustChip
                                icon={<Sparkles size={scale(13)} color={palette.chrome.common.inverseText} />}
                                label={t('badge_member', 'Member')}
                            />
                        ) : null}
                        {profileManagerLabel ? <ProfileManagerBadge label={profileManagerLabel} onDark /> : null}
                        {showPrivateBadge ? (
                            <TrustChip
                                icon={<Lock size={scale(13)} color={palette.chrome.common.inverseText} />}
                                label={t('badge_private_gallery', 'Private gallery')}
                                accessibilityLabel={t('gallery_isprivate', 'User gallery is private')}
                            />
                        ) : null}
                    </View>
                ) : null}
                <View
                    style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        justifyContent: appIsRTL ? 'flex-end' : 'flex-start',
                        gap: scale(8),
                        flexWrap: 'wrap',
                    }}
                    pointerEvents="none"
                >
                    <Text
                        variant="h2"
                        numberOfLines={2}
                        style={{
                            color: palette.chrome.common.inverseText,
                            fontSize: scale(23),
                            lineHeight: scale(28),
                            flexShrink: 1,
                            textAlign: appIsRTL ? 'right' : 'left',
                            writingDirection: nameDirection,
                            fontFamily: nameDirection === 'rtl'
                                ? Typography.font.arabic.bold
                                : Typography.font.heading.bold,
                            includeFontPadding: false,
                        }}
                    >
                        {nameDirection === 'rtl' ? '\u200F' : '\u200E'}{name}{age ? `, ${age}` : ''}
                    </Text>
                </View>
                {location ? (
                    <View style={[styles.heroLocationRow, { flexDirection: 'row' }]}>
                        {countryFlag ? <Text variant="body-sm" style={styles.heroLocationFlag}>{countryFlag}</Text> : <MapPin size={scale(15)} color={palette.chrome.common.inverseText} />}
                        <Text variant="body-sm" numberOfLines={1} style={{ color: palette.chrome.common.inverseText, flexShrink: 1 }}>
                            {location}
                        </Text>
                    </View>
                ) : null}
            </View>
        </View>
    );
}

function InlineProfilePhoto({
    source,
    index,
    total,
    disabled,
    onPress,
}: {
    source: string;
    index: number;
    total: number;
    disabled: boolean;
    onPress: () => void;
}) {
    const palette = useColors();

    return (
        <View
            style={[
                styles.inlineProfilePhoto,
                { backgroundColor: palette.chrome.common.skeleton },
            ]}
        >
            <Pressable
                disabled={disabled}
                onPress={onPress}
                accessibilityRole="button"
                accessibilityLabel={`${t('photo_gallery', 'Photo gallery')}, ${index + 1}/${total}`}
                style={({ pressed }) => [
                    styles.inlineProfilePhotoPressable,
                    pressed && !disabled ? styles.inlineProfilePhotoPressed : null,
                ]}
            >
                <Image
                    source={{ uri: source }}
                    style={styles.inlineProfilePhotoImage}
                    contentFit="contain"
                    cachePolicy="memory-disk"
                    transition={180}
                />
            </Pressable>
        </View>
    );
}

/** Small translucent pill used in the gallery hero trust row. */
function TrustChip({ icon, label, accessibilityLabel }: { icon: React.ReactNode; label: string; accessibilityLabel?: string }) {
    const palette = useColors();
    return (
        <View style={styles.trustChip} accessibilityLabel={accessibilityLabel || label}>
            {icon}
            <Text variant="caption" className="font-body-bold" numberOfLines={1} style={{ color: palette.chrome.common.inverseText, flexShrink: 1 }}>
                {label}
            </Text>
        </View>
    );
}

type SectionAction = { label: string; onPress: () => void };

function AtAGlancePills({ facts, hasFollowingContent }: { facts: Fact[]; hasFollowingContent: boolean }) {
    const palette = useColors();
    const { currentLanguage } = useLanguage();
    if (!facts.length) return null;

    return (
        <View style={[styles.atAGlanceWrap, hasFollowingContent && styles.atAGlanceWithContent, { flexDirection: 'row' }]}>
                {facts.map((fact) => {
                    const Icon = fact.icon;
                    const direction = getTextDirection(fact.value, localeTextDirection(currentLanguage));
                    return (
                        <View
                            key={fact.id}
                            accessible
                            accessibilityLabel={`${fact.label}: ${fact.value}`}
                            style={[styles.atAGlanceChip, { backgroundColor: palette.chrome.common.subtleSurface }]}
                        >
                            <Icon size={scale(15)} color={palette.chrome.common.textStrong} strokeWidth={2} />
                            <Text
                                variant="body-sm"
                                numberOfLines={1}
                                ellipsizeMode="tail"
                                style={[
                                    styles.atAGlanceValue,
                                    {
                                        color: palette.chrome.common.textStrong,
                                        textAlign: direction === 'rtl' ? 'right' : 'left',
                                        writingDirection: direction,
                                        fontFamily: direction === 'rtl'
                                            ? Typography.font.arabic.semi
                                            : Typography.font.body.semi,
                                    },
                                ]}
                            >
                                {fact.value}
                            </Text>
                        </View>
                    );
                })}
        </View>
    );
}

function SectionFacts({
    title,
    facts,
    isDark,
    isRTL,
    action,
    onPressCompany,
}: {
    title: string;
    facts: Fact[];
    isDark: boolean;
    isRTL: boolean;
    action?: SectionAction;
    onPressCompany?: () => void;
}) {
    if (!facts.length) return null;
    return (
        <Section title={title} isDark={isDark} action={action}>
            <FactRows facts={facts} isRTL={isRTL} onPressCompany={onPressCompany} />
        </Section>
    );
}

function FactRows({
    facts,
    isRTL,
    relaxedMultiline = false,
    onPressCompany,
}: {
    facts: Fact[];
    isRTL: boolean;
    relaxedMultiline?: boolean;
    onPressCompany?: () => void;
}) {
    const palette = useColors();
    const { currentLanguage } = useLanguage();
    const usesLatinLabels = localeUsesLatinScript(currentLanguage);
    if (!facts.length) return null;
    return (
        <View style={styles.factList}>
            {facts.map((fact) => {
                const Icon = fact.icon;
                const canEdit = fact.editTarget === 'company' && Boolean(onPressCompany);
                const content = (
                    <>
                        <View style={[styles.factLabelRow, relaxedMultiline && styles.relaxedFactLabelRow]}>
                            <Icon size={scale(15)} color={palette.chrome.common.textMuted} />
                            <Text
                                variant="caption"
                                className="font-body-semi"
                                numberOfLines={1}
                                adjustsFontSizeToFit
                                minimumFontScale={0.86}
                                style={[
                                    styles.factLabel,
                                    usesLatinLabels ? styles.latinFieldLabel : styles.naturalLabel,
                                    { color: palette.chrome.common.textMuted },
                                ]}
                            >
                                {fact.label}
                            </Text>
                            {fact.underReview ? <UnderReviewPill interactive={!canEdit} /> : null}
                        </View>
                            {/* Content-sized value inside a row: the row's main axis mirrors
                                under native RTL — no textAlign (unreliable on Android in RTL) */}
                        <View style={[styles.factValueRow, styles.factValueIndented]}>
                            <FactValueText value={fact.value} relaxedMultiline={relaxedMultiline} />
                            {canEdit ? (
                                isRTL
                                    ? <ChevronLeft size={scale(18)} color={palette.chrome.common.textMuted} />
                                    : <ChevronRight size={scale(18)} color={palette.chrome.common.textMuted} />
                            ) : null}
                        </View>
                    </>
                );
                return canEdit ? (
                    <Pressable
                        key={`${fact.label}-${fact.value}`}
                        onPress={onPressCompany}
                        accessibilityRole="button"
                        accessibilityLabel={`${fact.label}, ${fact.value}`}
                        style={({ pressed }) => [styles.factRow, pressed && styles.moderatedTextPressed]}
                    >
                        {content}
                    </Pressable>
                ) : (
                    <View key={`${fact.label}-${fact.value}`} style={styles.factRow}>{content}</View>
                );
            })}
        </View>
    );
}

function FactValueText({ value, relaxedMultiline }: { value: string; relaxedMultiline: boolean }) {
    const [isMultiline, setIsMultiline] = useState(false);
    const { currentLanguage } = useLanguage();
    const direction = getTextDirection(value, localeTextDirection(currentLanguage));
    return (
        <Text
            variant="body"
            className="font-body-semi"
            onTextLayout={relaxedMultiline
                ? (event) => {
                    const nextIsMultiline = event.nativeEvent.lines.length > 1;
                    setIsMultiline((current) => current === nextIsMultiline ? current : nextIsMultiline);
                }
                : undefined}
            style={[
                styles.factValueText,
                styles.factValueTextCompact,
                relaxedMultiline && isMultiline && styles.factValueTextMultiline,
                {
                    textAlign: direction === 'rtl' ? 'right' : 'left',
                    writingDirection: direction,
                    fontFamily: direction === 'rtl'
                        ? Typography.font.arabic.semi
                        : Typography.font.body.semi,
                },
            ]}
        >
            {value}
        </Text>
    );
}

function ExpandableProfileBio({
    text,
    paragraphs,
    direction,
}: {
    text: string;
    paragraphs: string[];
    direction: TextDirection;
}) {
    const palette = useColors();
    const [expanded, setExpanded] = useState(false);
    const [canExpand, setCanExpand] = useState(false);
    const directionalStyle = {
        textAlign: direction === 'rtl' ? 'right' as const : 'left' as const,
        writingDirection: direction,
        fontFamily: direction === 'rtl'
            ? Typography.font.arabic.regular
            : Typography.font.body.regular,
    };

    useEffect(() => {
        setExpanded(false);
    }, [text]);

    return (
        <View style={styles.expandableBio}>
            {expanded ? (
                <View style={styles.bioParagraphs}>
                    {paragraphs.map((paragraph, index) => (
                        <Text
                            key={index}
                            variant="body"
                            style={[
                                styles.bioText,
                                index < paragraphs.length - 1 && styles.bioParagraphGap,
                                directionalStyle,
                            ]}
                        >
                            {paragraph}
                        </Text>
                    ))}
                </View>
            ) : (
                <Text
                    variant="body"
                    numberOfLines={3}
                    ellipsizeMode="tail"
                    style={[styles.bioText, directionalStyle]}
                >
                    {text}
                </Text>
            )}

            <Text
                key={`bio-measure-${text}`}
                accessible={false}
                importantForAccessibility="no-hide-descendants"
                pointerEvents="none"
                onTextLayout={(event) => {
                    const nextCanExpand = event.nativeEvent.lines.length > 3;
                    setCanExpand((current) => current === nextCanExpand ? current : nextCanExpand);
                }}
                style={[styles.bioText, styles.bioMeasure, directionalStyle]}
            >
                {text}
            </Text>

            {canExpand ? expanded ? (
                <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={t('read_less', 'Read less')}
                    hitSlop={8}
                    onPress={() => setExpanded(false)}
                    style={styles.bioExpandButton}
                >
                    <Text style={[styles.bioExpandLabel, { color: palette.chrome.primary, textAlign: direction === 'rtl' ? 'right' : 'left', writingDirection: direction, fontFamily: direction === 'rtl' ? Typography.font.arabic.bold : Typography.font.body.bold }]}>
                        {t('read_less', 'Read less')}
                    </Text>
                </Pressable>
            ) : (
                <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={t('read_more', 'Read more')}
                    hitSlop={8}
                    onPress={() => setExpanded(true)}
                    style={styles.bioExpandButton}
                >
                    <Text style={[styles.bioExpandLabel, { color: palette.chrome.primary, textAlign: direction === 'rtl' ? 'right' : 'left', writingDirection: direction, fontFamily: direction === 'rtl' ? Typography.font.arabic.bold : Typography.font.body.bold }]}>
                        {t('read_more', 'Read more')}
                    </Text>
                </Pressable>
            ) : null}
        </View>
    );
}

function ChipSection({
    title,
    items,
    type,
    isDark,
    isRTL,
    action,
}: {
    title: string;
    items: any[];
    type: 'faith' | 'hobby';
    isDark: boolean;
    isRTL: boolean;
    action?: SectionAction;
}) {
    const palette = useColors();
    const clean = items.map((item) => emojiChipItem(item, type)).filter((item) => item.label);
    if (!clean.length) return null;
    return (
        <Section
            title={title}
            isDark={isDark}
            action={action}
            icon={type === 'hobby' ? Puzzle : BookHeart}
        >
            <View style={[styles.chipWrap, { flexDirection: 'row' }]}>
                {clean.map((item, index) => (
                    <View key={`${type}-${item.slug}-${index}`} style={[styles.chip, styles.emojiChip, { backgroundColor: palette.chrome.common.subtleSurface }]}>
                        <Text style={styles.emojiText}>{item.emoji}</Text>
                        <Text
                            variant="body-sm"
                            style={[
                                styles.emojiChipLabel,
                                {
                                    color: palette.chrome.common.textStrong,
                                    fontFamily: isRTL
                                        ? Typography.font.arabic.semi
                                        : Typography.font.body.semi,
                                },
                            ]}
                        >
                            {item.label}
                        </Text>
                    </View>
                ))}
            </View>
        </Section>
    );
}

function Section({
    title,
    children,
    isDark,
    action,
    icon: SectionIcon,
    highlight = false,
    card = false,
    extraBottomPadding = 0,
    hideTitle = false,
    topPadding,
    bottomPadding,
}: {
    title: string;
    children: React.ReactNode;
    isDark: boolean;
    action?: SectionAction;
    icon?: LucideIcon;
    highlight?: boolean;
    card?: boolean;
    extraBottomPadding?: number;
    hideTitle?: boolean;
    topPadding?: number;
    bottomPadding?: number;
}) {
    const palette = useColors();
    const { currentLanguage, isRTL } = useLanguage();
    const usesLatinLabels = localeUsesLatinScript(currentLanguage);
    const highlightStart = blendHexColors(
        palette.brand.gradient.end,
        palette.brand.bg.surface,
        isDark ? 0.22 : 0.18,
    );
    const highlightEnd = blendHexColors(
        palette.brand.gradient.start,
        palette.brand.bg.surface,
        isDark ? 0.13 : 0.1,
    );
    const highlightBackground = blendHexColors(
        palette.chrome.primary,
        palette.brand.bg.surface,
        isDark ? 0.14 : 0.06,
    );
    const borderColor = highlight
        ? blendHexColors(palette.chrome.primary, palette.brand.bg.surface, isDark ? 0.3 : 0.22)
        : palette.brand.bg.border;
    return (
        <View
            style={[
                styles.section,
                card && styles.sectionCard,
                highlight && card && styles.dashedSectionCard,
                topPadding !== undefined && { paddingTop: scale(topPadding) },
                bottomPadding !== undefined && { paddingBottom: scale(bottomPadding) },
                extraBottomPadding > 0 && { paddingBottom: scale(22 + extraBottomPadding) },
                {
                    backgroundColor: highlight && card
                        ? highlightBackground
                        : palette.brand.bg.surface,
                    borderColor,
                },
            ]}
        >
            {highlight && card ? (
                <DashedRoundedBorder color={palette.chrome.primary} />
            ) : highlight ? (
                <LinearGradient
                    pointerEvents="none"
                    colors={[
                        highlightStart,
                        palette.brand.bg.surface,
                        palette.brand.bg.surface,
                        highlightEnd,
                    ]}
                    locations={[0, 0.3, 0.72, 1]}
                    start={{ x: isRTL ? 1 : 0, y: 0 }}
                    end={{ x: isRTL ? 0 : 1, y: 1 }}
                    style={StyleSheet.absoluteFill}
                />
            ) : null}
            {!hideTitle ? <View style={styles.sectionHeader}>
                <View style={styles.sectionTitleRow}>
                    {SectionIcon ? (
                        <SectionIcon
                            size={scale(16)}
                            color={highlight ? palette.chrome.primary : palette.chrome.common.textStrong}
                            strokeWidth={2}
                        />
                    ) : null}
                    <Text
                        variant="caption"
                        className="font-body-semi"
                        numberOfLines={1}
                        adjustsFontSizeToFit
                        minimumFontScale={0.86}
                        style={[
                            styles.sectionTitle,
                            usesLatinLabels ? styles.latinSectionLabel : styles.naturalLabel,
                            { color: palette.chrome.common.textStrong },
                        ]}
                    >
                        {title}
                    </Text>
                </View>
                {action ? (
                    <Pressable onPress={action.onPress} style={styles.sectionAction} hitSlop={8}>
                        <Pencil size={scale(13)} color={palette.chrome.primary} />
                        <Text variant="caption" className="font-body-semi" style={[styles.sectionActionText, { color: palette.chrome.primary }]}>
                            {action.label}
                        </Text>
                    </Pressable>
                ) : null}
            </View> : null}
            {children}
        </View>
    );
}

function ImageLightbox({
    photos,
    index,
    onClose,
    onReport,
    reportTarget,
    onCloseReport,
    onReportBlocked,
    showReport = true,
}: {
    photos: string[];
    index: number | null;
    onClose: () => void;
    onReport: (photoIndex: number) => void;
    reportTarget: ReportTarget | null;
    onCloseReport: () => void;
    onReportBlocked: (userId: string) => void;
    showReport?: boolean;
}) {
    const [current, setCurrent] = useState(index ?? 0);
    const [imageStatuses, setImageStatuses] = useState<Record<string, 'loading' | 'loaded' | 'error'>>({});
    const [retryVersions, setRetryVersions] = useState<Record<string, number>>({});
    const palette = useColors();
    const insets = useSafeAreaInsets();
    const zoom = useSharedValue(1);
    const zoomStart = useSharedValue(1);
    const translateX = useSharedValue(0);
    const translateY = useSharedValue(0);
    const pinchStartX = useSharedValue(0);
    const pinchStartY = useSharedValue(0);
    const pinchFocalX = useSharedValue(0);
    const pinchFocalY = useSharedValue(0);
    const panStartX = useSharedValue(0);
    const panStartY = useSharedValue(0);
    const carouselX = useSharedValue(-(index ?? 0) * SCREEN_WIDTH);
    const dragY = useSharedValue(0);
    const backdropOpacity = useSharedValue(1);
    const viewerScale = useSharedValue(1.06);
    const viewportWidth = useSharedValue(SCREEN_WIDTH);
    const viewportHeight = useSharedValue(0);
    const fittedImageWidth = useSharedValue(SCREEN_WIDTH);
    const fittedImageHeight = useSharedValue(SCREEN_WIDTH * (4 / 3));
    const imageSizesRef = useRef<Record<number, { width: number; height: number }>>({});
    const topbarHeight = insets.top + scale(66);

    const syncImageSize = useCallback((photoIndex: number, width: number, height: number) => {
        if (width <= 0 || height <= 0) return;
        imageSizesRef.current[photoIndex] = { width, height };
        if (photoIndex !== current) return;
        const frameWidth = viewportWidth.value;
        const frameHeight = viewportHeight.value + topbarHeight;
        if (frameWidth <= 0 || frameHeight <= 0) return;
        const fitScale = Math.min(frameWidth / width, frameHeight / height);
        fittedImageWidth.value = width * fitScale;
        fittedImageHeight.value = height * fitScale;
    }, [current, fittedImageHeight, fittedImageWidth, topbarHeight, viewportHeight, viewportWidth]);

    const resetTransform = useCallback(() => {
        zoom.value = 1;
        zoomStart.value = 1;
        translateX.value = 0;
        translateY.value = 0;
        panStartX.value = 0;
        panStartY.value = 0;
        dragY.value = 0;
    }, [dragY, panStartX, panStartY, translateX, translateY, zoom, zoomStart]);

    useEffect(() => {
        if (index !== null) {
            setCurrent(index);
            resetTransform();
            carouselX.value = -index * viewportWidth.value;
            backdropOpacity.value = 1;
            viewerScale.value = withTiming(1, {
                duration: 280,
                easing: Easing.out(Easing.cubic),
            });
        }
    }, [backdropOpacity, carouselX, index, resetTransform, viewerScale, viewportWidth]);
    const hasMultiple = photos.length > 1;
    const previousPhoto = photos[current - 1];
    const nextPhoto = photos[current + 1];
    const finishNavigation = useCallback((nextIndex: number) => {
        setCurrent(nextIndex);
    }, []);

    const setImageStatus = useCallback((photo: string, status: 'loading' | 'loaded' | 'error') => {
        setImageStatuses((previous) => previous[photo] === status
            ? previous
            : { ...previous, [photo]: status });
    }, []);

    const retryImage = useCallback((photo: string) => {
        setImageStatus(photo, 'loading');
        setRetryVersions((previous) => ({
            ...previous,
            [photo]: (previous[photo] || 0) + 1,
        }));
    }, [setImageStatus]);

    useEffect(() => {
        const size = imageSizesRef.current[current];
        if (size) {
            syncImageSize(current, size.width, size.height);
        } else {
            fittedImageWidth.value = viewportWidth.value;
            fittedImageHeight.value = viewportWidth.value * (4 / 3);
        }
    }, [current, fittedImageHeight, fittedImageWidth, syncImageSize, topbarHeight, viewportHeight, viewportWidth]);

    useEffect(() => {
        if (index === null) return;
        const adjacentPhotos = [previousPhoto, nextPhoto].filter(
            (photo): photo is string => Boolean(photo),
        );
        if (adjacentPhotos.length === 0) return;
        void Image.prefetch(adjacentPhotos, 'memory-disk').catch(() => undefined);
    }, [index, nextPhoto, previousPhoto]);

    const pinchGesture = Gesture.Pinch()
        .onBegin(() => {
            carouselX.value = -current * viewportWidth.value;
            dragY.value = 0;
        })
        .onStart((event) => {
            const frameHeight = viewportHeight.value + topbarHeight;
            zoomStart.value = zoom.value;
            pinchStartX.value = translateX.value;
            pinchStartY.value = translateY.value;
            pinchFocalX.value = event.focalX - viewportWidth.value / 2;
            pinchFocalY.value = event.focalY + topbarHeight - frameHeight / 2;
        })
        .onUpdate((event) => {
            const nextZoom = Math.max(1, Math.min(2, zoomStart.value * event.scale));
            const zoomRatio = nextZoom / zoomStart.value;
            zoom.value = nextZoom;
            if (nextZoom > 1.01) {
                carouselX.value = -current * viewportWidth.value;
                dragY.value = 0;
            }
            const frameHeight = viewportHeight.value + topbarHeight;
            const maxX = Math.max(0, (fittedImageWidth.value * nextZoom - viewportWidth.value) / 2);
            const maxY = Math.max(0, (fittedImageHeight.value * nextZoom - frameHeight) / 2);
            const focalTranslateX = pinchFocalX.value
                + (pinchStartX.value - pinchFocalX.value) * zoomRatio;
            const focalTranslateY = pinchFocalY.value
                + (pinchStartY.value - pinchFocalY.value) * zoomRatio;
            translateX.value = Math.max(-maxX, Math.min(maxX, focalTranslateX));
            translateY.value = Math.max(-maxY, Math.min(maxY, focalTranslateY));
        })
        .onEnd(() => {
            if (zoom.value <= 1.05) {
                zoom.value = 1;
                zoomStart.value = 1;
                translateX.value = 0;
                translateY.value = 0;
                panStartX.value = 0;
                panStartY.value = 0;
            } else {
                zoomStart.value = zoom.value;
            }
        });

    const panGesture = Gesture.Pan()
        .maxPointers(1)
        .minDistance(5)
        .onBegin(() => {
            panStartX.value = translateX.value;
            panStartY.value = translateY.value;
        })
        .onUpdate((event) => {
            if (zoom.value > 1.01) {
                const frameHeight = viewportHeight.value + topbarHeight;
                const maxX = Math.max(0, (fittedImageWidth.value * zoom.value - viewportWidth.value) / 2);
                const maxY = Math.max(0, (fittedImageHeight.value * zoom.value - frameHeight) / 2);
                translateX.value = Math.max(-maxX, Math.min(maxX, panStartX.value + event.translationX));
                translateY.value = Math.max(-maxY, Math.min(maxY, panStartY.value + event.translationY));
                return;
            }

            if (Math.abs(event.translationX) > Math.abs(event.translationY)) {
                dragY.value = 0;
                if (!hasMultiple) return;
                const pageWidth = viewportWidth.value;
                const baseX = -current * pageWidth;
                const pullingPastStart = current === 0 && event.translationX > 0;
                const pullingPastEnd = current === photos.length - 1 && event.translationX < 0;
                const resistance = pullingPastStart || pullingPastEnd ? 0.22 : 1;
                carouselX.value = baseX + event.translationX * resistance;
            } else {
                carouselX.value = -current * viewportWidth.value;
                dragY.value = Math.max(0, event.translationY);
            }
        })
        .onEnd((event) => {
            if (zoom.value > 1.01) {
                panStartX.value = translateX.value;
                panStartY.value = translateY.value;
                return;
            }

            const isHorizontal = Math.abs(event.translationX) > Math.abs(event.translationY);
            const pageWidth = viewportWidth.value;
            let targetIndex = current;
            if (isHorizontal && hasMultiple
                && (Math.abs(event.translationX) > 70 || Math.abs(event.velocityX) > 650)) {
                if (event.translationX < 0) targetIndex = Math.min(current + 1, photos.length - 1);
                else targetIndex = Math.max(current - 1, 0);
            } else if (!isHorizontal && (event.translationY > 96 || event.velocityY > 700)) {
                backdropOpacity.value = withTiming(0, { duration: 130 });
                dragY.value = withTiming(
                    viewportHeight.value + topbarHeight,
                    { duration: 130 },
                    (finished) => {
                        if (finished) runOnJS(onClose)();
                    },
                );
                return;
            }
            carouselX.value = withTiming(
                -targetIndex * pageWidth,
                { duration: targetIndex === current ? 160 : 220 },
                (finished) => {
                    if (finished && targetIndex !== current) {
                        runOnJS(finishNavigation)(targetIndex);
                    }
                },
            );
            dragY.value = withSpring(0, { damping: 18, stiffness: 220 });
        });

    const doubleTapGesture = Gesture.Tap()
        .numberOfTaps(2)
        .maxDelay(260)
        .maxDistance(12)
        .onEnd((event, success) => {
            if (!success) return;
            if (zoom.value > 1.01) {
                zoom.value = withTiming(1, { duration: 180 });
                zoomStart.value = 1;
                translateX.value = withTiming(0, { duration: 180 });
                translateY.value = withTiming(0, { duration: 180 });
                panStartX.value = 0;
                panStartY.value = 0;
                return;
            }

            const targetZoom = 2;
            const frameHeight = viewportHeight.value + topbarHeight;
            const focalX = event.x - viewportWidth.value / 2;
            const focalY = event.y + topbarHeight - frameHeight / 2;
            const maxX = Math.max(0, (fittedImageWidth.value * targetZoom - viewportWidth.value) / 2);
            const maxY = Math.max(0, (fittedImageHeight.value * targetZoom - frameHeight) / 2);
            zoom.value = withTiming(targetZoom, { duration: 180 });
            zoomStart.value = targetZoom;
            translateX.value = withTiming(
                Math.max(-maxX, Math.min(maxX, -focalX)),
                { duration: 180 },
            );
            translateY.value = withTiming(
                Math.max(-maxY, Math.min(maxY, -focalY)),
                { duration: 180 },
            );
        });

    const photoGesture = Gesture.Simultaneous(
        pinchGesture,
        Gesture.Race(doubleTapGesture, panGesture),
    );
    const photoStyle = useAnimatedStyle(() => ({
        transform: [
            { translateX: translateX.value },
            { translateY: translateY.value },
            { scale: zoom.value },
        ],
    }));
    const carouselStyle = useAnimatedStyle(() => ({
        transform: [{ translateX: carouselX.value }],
    }));
    const dismissStyle = useAnimatedStyle(() => ({
        transform: [
            { translateY: dragY.value },
            { scale: viewerScale.value },
        ],
        opacity: 1 - Math.min(dragY.value / Math.max(viewportHeight.value, 1), 0.35),
    }));
    const backdropStyle = useAnimatedStyle(() => ({
        opacity: backdropOpacity.value * (
            1 - Math.min(dragY.value / Math.max(viewportHeight.value * 0.45, 1), 0.72)
        ),
    }));
    const headerStyle = useAnimatedStyle(() => {
        const frameHeight = Math.max(viewportHeight.value + topbarHeight, 1);
        const scaledImageHeight = fittedImageHeight.value * zoom.value;
        const hideProgress = Math.max(0, Math.min(
            1,
            (scaledImageHeight - frameHeight * 0.9) / (frameHeight * 0.1),
        ));
        const dismissOpacity = backdropOpacity.value * (
            1 - Math.min(dragY.value / Math.max(viewportHeight.value * 0.45, 1), 0.72)
        );
        return { opacity: dismissOpacity * (1 - hideProgress) };
    });

    return (
        <Modal
            visible={index !== null}
            transparent
            animationType="none"
            onRequestClose={reportTarget ? onCloseReport : onClose}
        >
            <GestureHandlerRootView style={{ flex: 1 }}>
                <View
                    style={styles.lightbox}
                    importantForAccessibility={reportTarget ? 'no-hide-descendants' : 'auto'}
                >
                    <Animated.View
                        pointerEvents="none"
                        style={[styles.lightboxBackdrop, backdropStyle]}
                    />
                    <Animated.View style={[styles.lightboxTopbar, { height: topbarHeight, paddingTop: insets.top }, headerStyle]}>
                        <LinearGradient
                            pointerEvents="none"
                            colors={['rgba(0,0,0,0.96)', 'rgba(0,0,0,0.96)', 'rgba(0,0,0,0)']}
                            locations={[0, 0.5, 1]}
                            style={[styles.lightboxHeaderGradient, { height: topbarHeight + scale(44) }]}
                        />
                        <Pressable
                            onPress={onClose}
                            style={styles.lightboxIconButton}
                            hitSlop={10}
                            accessibilityRole="button"
                            accessibilityLabel={t('close', 'Close')}
                        >
                            <X size={scale(23)} color={palette.chrome.common.inverseText} />
                        </Pressable>
                        <View
                            style={styles.lightboxDots}
                            accessible
                            accessibilityRole="text"
                            accessibilityLabel={`${t('photo_gallery', 'Photo gallery')}, ${current + 1}/${photos.length}`}
                        >
                            {photos.map((_, photoIndex) => (
                                <View
                                    key={photoIndex}
                                    style={[
                                        styles.lightboxDot,
                                        photoIndex === current
                                            ? [styles.lightboxDotActive, { backgroundColor: palette.chrome.primary }]
                                            : styles.lightboxDotInactive,
                                    ]}
                                />
                            ))}
                        </View>
                        {showReport ? (
                            <Pressable
                                onPress={() => onReport(current)}
                                style={styles.lightboxIconButton}
                                hitSlop={10}
                                accessibilityRole="button"
                                accessibilityLabel={t('report_image', 'Report image')}
                            >
                                <Flag size={scale(21)} color={palette.chrome.common.inverseText} />
                            </Pressable>
                        ) : (
                            <View style={styles.lightboxActionSpacer} />
                        )}
                    </Animated.View>
                    <View
                        style={[styles.lightboxViewport, { top: topbarHeight }]}
                        onLayout={(event) => {
                            viewportWidth.value = event.nativeEvent.layout.width;
                            viewportHeight.value = event.nativeEvent.layout.height;
                            carouselX.value = -current * event.nativeEvent.layout.width;
                            const size = imageSizesRef.current[current];
                            if (size) syncImageSize(current, size.width, size.height);
                        }}
                    >
                        <GestureDetector gesture={photoGesture}>
                            <Animated.View
                                style={[
                                    styles.lightboxGestureCanvas,
                                    dismissStyle,
                                ]}
                            >
                                <Animated.View
                                    style={[
                                        styles.lightboxCarousel,
                                        {
                                            top: -topbarHeight,
                                            width: SCREEN_WIDTH * photos.length,
                                        },
                                        carouselStyle,
                                    ]}
                                >
                                    {photos.map((photo, photoIndex) => (
                                        <Animated.View
                                            key={`${photo}-${photoIndex}`}
                                            style={[
                                                styles.lightboxImageFrame,
                                                { width: SCREEN_WIDTH },
                                            ]}
                                        >
                                            {Math.abs(photoIndex - current) <= 1 ? (
                                                <Animated.View
                                                    style={[
                                                        styles.lightboxZoomLayer,
                                                        photoIndex === current ? photoStyle : null,
                                                    ]}
                                                >
                                                    {(imageStatuses[photo] || 'loading') === 'loading' ? (
                                                        <View style={styles.lightboxImageState} pointerEvents="none">
                                                            <ActivityIndicator size="small" color={palette.chrome.primary} />
                                                        </View>
                                                    ) : null}
                                                    {imageStatuses[photo] === 'error' ? (
                                                        <View style={styles.lightboxImageState}>
                                                            <Pressable
                                                                onPress={() => retryImage(photo)}
                                                                style={styles.lightboxRetryButton}
                                                                accessibilityRole="button"
                                                                accessibilityLabel={t('btn_try_again', 'Try Again')}
                                                            >
                                                                <RefreshCw size={scale(19)} color={palette.chrome.common.inverseText} />
                                                                <Text
                                                                    variant="body-sm"
                                                                    className="font-body-semi"
                                                                    style={{ color: palette.chrome.common.inverseText }}
                                                                >
                                                                    {t('btn_try_again', 'Try Again')}
                                                                </Text>
                                                            </Pressable>
                                                        </View>
                                                    ) : null}
                                                    <Image
                                                        key={`${photo}-${retryVersions[photo] || 0}`}
                                                        source={{ uri: photo }}
                                                        style={styles.lightboxImage}
                                                        contentFit="contain"
                                                        cachePolicy="memory-disk"
                                                        accessibilityLabel={`${t('photo_gallery', 'Photo gallery')}, ${photoIndex + 1}/${photos.length}`}
                                                        onLoadStart={() => setImageStatus(photo, 'loading')}
                                                        onLoad={(event) => {
                                                            setImageStatus(photo, 'loaded');
                                                            syncImageSize(
                                                                photoIndex,
                                                                event.source.width,
                                                                event.source.height,
                                                            );
                                                        }}
                                                        onError={() => setImageStatus(photo, 'error')}
                                                    />
                                                </Animated.View>
                                            ) : null}
                                        </Animated.View>
                                    ))}
                                </Animated.View>
                            </Animated.View>
                        </GestureDetector>
                    </View>
                </View>
                <ReportSheet
                    target={reportTarget}
                    onClose={onCloseReport}
                    onBlocked={onReportBlocked}
                    embedded
                />
                <ToastProvider />
            </GestureHandlerRootView>
        </Modal>
    );
}

function buildFacts(profile: any, isOwnProfile = false) {
    // Owner sees their pending company candidate; others see approved text only
    const companyCandidate = isOwnProfile
        ? pendingModerationCandidate(profile?.contentModeration?.company)
        : '';
    const gender = String(
        profile?.gender?.value || profile?.gender?.label || profile?.gender || '',
    ).toLowerCase();
    const common = (value: any) => displayText(typeof value === 'object' ? value?.label : value);
    const ethnicity = (value: any) => {
        const candidates = typeof value === 'object'
            ? [value?.label, value?.name, value?.value, value?.value_id]
            : [value];
        const raw = candidates
            .map((candidate) => String(candidate || '').trim())
            .find((candidate) => candidate && !/^[a-f\d]{24}$/i.test(candidate));
        return translateNamespace('ethnic_group', raw);
    };
    const countryList = (values: any[]) => listText((values || []).map(translateCountry));
    const annualIncome = typeof profile?.annual_income === 'object'
        ? [profile?.annual_income?.amount, profile?.annual_income?.currency].filter(Boolean).join(' ')
        : String(profile?.annual_income || '');

    const compact = (facts: Array<Fact | null | false | undefined>) =>
        facts.filter((fact): fact is Fact => Boolean(fact && typeof fact !== 'boolean' && fact.value.trim()));

    return {
        atAGlance: compact([
            { id: 'sect', icon: BookOpen, label: t('sect', 'Sect'), value: common(profile?.sect) },
            { id: 'marital_status', icon: Gem, label: t('marital_status', 'Marital status'), value: common(profile?.marital_status) },
            { id: 'height', icon: Ruler, label: t('height', 'Height'), value: common(profile?.height) },
            { id: 'designation', icon: LampDesk, label: t('designation', 'Designation'), value: common(profile?.designation) },
            { id: 'prayers', icon: Mosque, label: t('prayers', 'Prayers'), value: common(profile?.prayers) },
            { id: 'have_children', icon: Baby, label: t('have_children', 'Has children'), value: common(profile?.have_children) },
        ]),
        faith: compact([
            { icon: Compass, label: t('maslak', 'Maslak'), value: common(profile?.maslak) },
            { icon: Signpost, label: t('following', 'Following'), value: common(profile?.following) },
            { icon: ShieldCheck, label: t('born_muslim', 'Born Muslim'), value: common(profile?.born_muslim) },
            { icon: Moon, label: t('practising', 'Practising'), value: common(profile?.is_practising) },
        ]),
        future: compact([
            { icon: Pram, label: t('wants_children', 'Wants children'), value: common(profile?.wants_children) },
            { icon: CalendarHeart, label: t('marriage_plan', 'Marriage plan'), value: common(profile?.marriage_plan) },
            { icon: Plane, label: t('relocation_plans', 'Relocation'), value: common(profile?.relocation_plans) },
        ]),
        career: compact([
            { icon: GraduationCap, label: t('education', 'Education'), value: common(profile?.education) },
            { icon: BriefcaseBusiness, label: t('occupation', 'Occupation'), value: common(profile?.occupation) },
            {
                icon: Building2,
                label: t('company', 'Company'),
                value: cleanProfileText(companyCandidate || profile?.company),
                underReview: Boolean(companyCandidate),
                editTarget: companyCandidate ? 'company' : undefined,
            },
            { icon: Banknote, label: t('annual_income', 'Annual income'), value: annualIncome },
        ]),
        background: compact([
            { icon: ShieldCheck, label: t('nationality', 'Nationality'), value: countryList(profile?.nationality) },
            { icon: Footprints, label: t('grew_up_in', 'Grew up in'), value: translateCountry(profile?.grew_up_in) },
            { icon: Mic, label: t('mother_tongue', 'Mother tongue'), value: common(profile?.mother_tongue) },
            { icon: Languages, label: t('languages_spoken', 'Languages'), value: listText((profile?.languages_spoken || []).map(displayText)) },
        ]),
        appearance: compact([
            { icon: Palette, label: t('complexion', 'Complexion'), value: common(profile?.complexion) },
            { icon: Users, label: t('ethnic_group', 'Ethnic group'), value: Array.isArray(profile?.ethnic_group) ? listText(profile.ethnic_group.map(ethnicity)) : ethnicity(profile?.ethnic_group) },
            gender === 'female'
                ? {
                    icon: Shirt,
                    label: t('profile.i_usually_dress', 'How do you usually dress?'),
                    value: common(profile?.i_usually_dress),
                }
                : null,
        ]),
        lifestyle: compact([
            { icon: Cigarette, label: t('smoking', 'Smoking'), value: common(profile?.smoking) },
            { icon: Wine, label: t('alcohol', 'Alcohol'), value: common(profile?.alcohol) },
        ]),
    };
}

function buildPartnerFacts(partnerPreference: any) {
    const compact = (facts: Array<Fact | null | false | undefined>) =>
        facts.filter((fact): fact is Fact => Boolean(fact && typeof fact !== 'boolean' && fact.value.trim()));
    const asArray = (value: any) => {
        if (Array.isArray(value)) return value;
        return value ? [value] : [];
    };
    const list = (values: any) => listText(asArray(values).map((value) => {
        if (typeof value === 'object') return displayText(value?.label || value?.name || value?.value);
        return displayText(value);
    }));
    const ethnicList = (values: any) => listText(asArray(values).map((value) => {
        const candidates = typeof value === 'object'
            ? [value?.label, value?.name, value?.value, value?.value_id]
            : [value];
        const raw = candidates
            .map((candidate) => String(candidate || '').trim())
            .find((candidate) => candidate && !/^[a-f\d]{24}$/i.test(candidate));
        return translateNamespace('ethnic_group', raw);
    }));
    const countryList = (values: any) => listText(asArray(values).map((value) => {
        if (typeof value === 'object') return translateCountry(value?.label || value?.name || value?.value || value?.country);
        return translateCountry(value);
    }));
    const heightFrom = partnerPreference?.height?.from?.label || partnerPreference?.height_from?.label || partnerPreference?.height_from;
    const heightTo = partnerPreference?.height?.to?.label || partnerPreference?.height_to?.label || partnerPreference?.height_to;
    const ageFrom = partnerPreference?.age?.from || partnerPreference?.age_from;
    const ageTo = partnerPreference?.age?.to || partnerPreference?.age_to;

    return compact([
        heightFrom && heightTo ? { icon: Ruler, label: t('preferred_height', 'Preferred height'), value: `${heightFrom} - ${heightTo}` } : null,
        ageFrom && ageTo ? { icon: CalendarHeart, label: t('preferred_age', 'Preferred age'), value: `${ageFrom} - ${ageTo} ${t('years', 'years')}` } : null,
        { icon: Users, label: t('preferred_marital_status', 'Preferred marital status'), value: list(partnerPreference?.marital_status) },
        { icon: Languages, label: t('preferred_languages', 'Preferred languages'), value: list(partnerPreference?.languages_spoken || partnerPreference?.languages || partnerPreference?.mother_tongue) },
        { icon: Users, label: t('preferred_ethnicity', 'Preferred ethnicity'), value: ethnicList(partnerPreference?.ethnic_group) },
        { icon: MapPin, label: t('location', 'Location'), value: countryList(partnerPreference?.location || partnerPreference?.countries || []) },
    ]);
}

const styles = StyleSheet.create({
    center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    closeError: { marginTop: scale(18), borderWidth: 1, borderRadius: scale(999), paddingHorizontal: scale(18), paddingVertical: scale(10) },
    header: {
        borderBottomWidth: 1,
        flexDirection: 'row',
        alignItems: 'center',
        paddingLeft: scale(7.5),
        paddingRight: scale(14),
    },
    ownHeader: {
        paddingLeft: scale(14),
        paddingRight: scale(14),
    },
    headerButton: { width: scale(38), height: scale(38), alignItems: 'center', justifyContent: 'center' },
    headerBackButton: {
        width: scale(36),
        height: scale(36),
        borderRadius: scale(18),
    },
    profileMessageAction: {
        width: scale(Platform.OS === 'android' ? 38 : 46),
        height: scale(Platform.OS === 'android' ? 38 : 46),
        position: 'relative',
        overflow: 'visible',
    },
    profileMessageSurface: {
        ...StyleSheet.absoluteFill,
        borderRadius: scale(Platform.OS === 'android' ? 18 : 22),
    },
    profileMessageGlass: {
        ...StyleSheet.absoluteFill,
        borderRadius: scale(22),
        borderCurve: 'continuous',
    },
    profileMessageIconCenter: {
        ...StyleSheet.absoluteFill,
        alignItems: 'center',
        justifyContent: 'center',
    },
    // Numerically ~11.5dp icon→title; optically matches the conversation header's
    // 14.5dp chevron→avatar. The wrap row takes all remaining width; the
    // content-sized text starts at the chevron side in both directions.
    headerTitleWrap: { flex: 1, minWidth: 0, flexDirection: 'row', marginStart: scale(4) },
    headerTitle: { flexShrink: 1, fontSize: scale(16), lineHeight: scale(20) },
    ownHeaderActions: {
        alignItems: 'center',
        flexDirection: 'row',
        flexShrink: 0,
        gap: scale(14),
    },
    content: { paddingHorizontal: 0, paddingTop: 0 },
    profileDetailSkeleton: { paddingHorizontal: scale(24), paddingTop: scale(30), paddingBottom: scale(56), gap: scale(16) },
    profileSkeletonBar: { height: scale(16), borderRadius: scale(4) },
    gallery: { overflow: 'hidden', minHeight: scale(342), marginBottom: 0 },
    gallerySlide: { aspectRatio: 3 / 4, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
    inlineProfilePhoto: {
        width: '100%',
        aspectRatio: 3 / 4,
        overflow: 'hidden',
    },
    inlineProfilePhotoPressable: { width: '100%', height: '100%' },
    inlineProfilePhotoImage: { width: '100%', height: '100%' },
    inlineProfilePhotoPressed: { opacity: 0.92 },
    galleryModerationBadge: {
        position: 'absolute',
        top: scale(14),
        left: scale(14),
        height: scale(24),
        maxWidth: '76%',
        borderRadius: scale(999),
        paddingHorizontal: scale(8),
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 4,
    },
    galleryModerationBadgeText: {
        flexShrink: 1,
        fontSize: scale(11),
        lineHeight: scale(14),
        includeFontPadding: false,
    },
    galleryModerationSpinner: { transform: [{ scale: 0.62 }], marginHorizontal: -scale(3) },
    galleryGradient: { position: 'absolute', left: 0, right: 0, bottom: 0, height: '55%' },
    galleryBadges: {
        position: 'absolute',
        right: scale(14),
        top: scale(14),
        flexDirection: 'row',
        alignItems: 'center',
        gap: scale(8),
    },
    photoCount: { minWidth: scale(28), height: scale(28), borderRadius: scale(14), backgroundColor: 'rgba(16, 16, 17,0.62)', alignItems: 'center', justifyContent: 'center', paddingHorizontal: scale(8) },
    galleryIdentity: { position: 'absolute', left: scale(18), right: scale(18), bottom: scale(18) },
    trustRow: {
        flexDirection: 'row',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: scale(6),
        marginBottom: scale(8),
    },
    trustChip: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: scale(5),
        borderRadius: scale(999),
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.25)',
        backgroundColor: 'rgba(0,0,0,0.38)',
        paddingHorizontal: scale(10),
        paddingVertical: scale(5),
    },
    heroLocationRow: { flexDirection: 'row', alignItems: 'center', gap: scale(6), marginTop: scale(5) },
    heroLocationFlag: { lineHeight: scale(18) },
    section: {
        borderTopWidth: 1,
        paddingHorizontal: scale(16),
        paddingTop: scale(22),
        paddingBottom: scale(28),
    },
    sectionCard: {
        marginHorizontal: scale(14),
        marginTop: scale(14),
        marginBottom: scale(24),
        borderWidth: 1,
        borderRadius: scale(8),
        overflow: 'hidden',
    },
    dashedSectionCard: {
        borderWidth: 0,
        borderTopWidth: 0,
        borderRightWidth: 0,
        borderBottomWidth: 0,
        borderLeftWidth: 0,
    },
    sectionHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: scale(12),
        marginBottom: scale(24),
    },
    sectionTitleRow: {
        flex: 1,
        minWidth: 0,
        flexDirection: 'row',
        alignItems: 'center',
        gap: scale(7),
    },
    sectionTitle: { color: '#241E17', fontSize: scale(16), lineHeight: scale(21), flexShrink: 1 },
    latinSectionLabel: { textTransform: 'none', letterSpacing: 0 },
    latinFieldLabel: { textTransform: 'uppercase', letterSpacing: 1.2 },
    naturalLabel: { textTransform: 'none', letterSpacing: 0 },
    sectionAction: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: scale(5),
        paddingHorizontal: scale(4),
        paddingVertical: scale(3),
    },
    sectionActionText: { color: '#F34B6F' },
    headline: { fontSize: scale(18), lineHeight: scale(25), marginBottom: scale(20) },
    bioOnlyTitle: {
        marginTop: scale(4),
        marginBottom: scale(10),
    },
    // Inline info icon + text for owner-visible pending moderation text
    moderatedTextPressable: { width: '100%' },
    moderatedTextRow: { width: '100%', flexDirection: 'row', alignItems: 'flex-start', gap: scale(5) },
    moderatedTextIcon: { marginTop: scale(3) },
    moderatedTextChevron: { marginTop: scale(3) },
    moderatedTextPressed: { opacity: 0.72 },
    // Pull the bio icon toward the card's start edge (pink bar side)
    moderatedText: { flex: 1, minWidth: 0 },
    factValueRow: { flexDirection: 'row' },
    factValueText: { flex: 1, minWidth: 0 },
    factValueIndented: { paddingStart: scale(22) },
    factValueTextCompact: { lineHeight: scale(20), includeFontPadding: false },
    factValueTextMultiline: { lineHeight: scale(22) },
    bioParagraphs: { flex: 1, minWidth: 0 },
    bioParagraphGap: { marginBottom: scale(12) },
    // Partner-about reuses bioText directly, but stays unframed.
    bioText: { fontSize: scale(15), lineHeight: scale(22), fontStyle: 'normal' },
    expandableBio: { position: 'relative', flex: 1, minWidth: 0 },
    bioMeasure: { position: 'absolute', start: 0, end: 0, top: 0, opacity: 0 },
    bioExpandButton: { width: '100%', marginTop: 4 },
    bioExpandLabel: { fontSize: scale(14), lineHeight: scale(22), fontWeight: '700', textTransform: 'lowercase' },
    partnerPreferenceDivider: { marginTop: scale(18), marginBottom: scale(18) },
    factList: { gap: scale(18) },
    factRow: { width: '100%' },
    factLabelRow: { flexDirection: 'row', alignItems: 'center', gap: scale(7), marginBottom: scale(3) },
    relaxedFactLabelRow: { marginBottom: scale(5) },
    // Pinned line height — Noto Sans Arabic's natural metrics add ~6dp of air
    factLabel: { color: '#737378', fontSize: scale(13), lineHeight: scale(17), includeFontPadding: false, flexShrink: 1 },
    atAGlanceWrap: { flexWrap: 'wrap', gap: scale(8) },
    atAGlanceWithContent: { marginBottom: scale(24) },
    atAGlanceChip: {
        maxWidth: '100%',
        minHeight: scale(30),
        borderRadius: scale(999),
        paddingHorizontal: scale(11),
        paddingVertical: scale(6),
        flexDirection: 'row',
        alignItems: 'center',
        gap: scale(7),
    },
    atAGlanceValue: { flexShrink: 1, fontSize: scale(13), lineHeight: scale(18), fontWeight: '600' },
    chipWrap: { flexWrap: 'wrap', gap: scale(8) },
    chip: { borderRadius: scale(999), paddingHorizontal: scale(11), paddingVertical: scale(6) },
    emojiChip: { flexDirection: 'row', alignItems: 'center', gap: scale(5) },
    emojiText: { fontSize: scale(13), lineHeight: scale(18) },
    emojiChipLabel: { fontSize: scale(13), fontWeight: '600', lineHeight: scale(18) },
    profileFooterActionWrap: {
        borderTopWidth: 1,
        paddingHorizontal: 0,
        paddingTop: 4,
        paddingBottom: scale(16),
    },
    profileFooterActionRow: {
        width: '100%',
        flexDirection: 'column',
        alignItems: 'stretch',
        justifyContent: 'center',
        gap: scale(4),
    },
    profileFooterActionSurface: {
        width: '100%',
        height: 44,
        alignSelf: 'stretch',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
    },
    profileFooterLabelInset: {
        height: 44,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 16,
    },
    profileFooterActionPressed: { opacity: 0.58 },
    profileFooterActionText: {
        textAlign: 'center',
        fontSize: 15,
        lineHeight: 20,
        fontWeight: '700',
    },
    confirmLayer: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: scale(22),
    },
    confirmBackdrop: {
        position: 'absolute',
        top: 0,
        right: 0,
        bottom: 0,
        left: 0,
        backgroundColor: 'rgba(16, 16, 17,0.42)',
    },
    confirmCard: {
        width: '100%',
        maxWidth: scale(360),
        borderWidth: StyleSheet.hairlineWidth,
        borderRadius: scale(18),
        paddingHorizontal: scale(18),
        paddingTop: scale(20),
        paddingBottom: scale(16),
        alignItems: 'center',
        gap: scale(12),
        shadowColor: '#000000',
        shadowOpacity: 0.18,
        shadowRadius: scale(24),
        shadowOffset: { width: 0, height: scale(12) },
        elevation: 18,
    },
    confirmIcon: {
        width: scale(48),
        height: scale(48),
        borderRadius: scale(24),
        alignItems: 'center',
        justifyContent: 'center',
    },
    confirmActions: {
        width: '100%',
        flexDirection: 'row',
        alignItems: 'center',
        gap: scale(10),
        marginTop: scale(4),
    },
    confirmButton: {
        flex: 1,
        minHeight: scale(42),
        borderRadius: scale(21),
        borderWidth: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: scale(14),
    },
    lightbox: { flex: 1, backgroundColor: 'transparent' },
    lightboxBackdrop: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, backgroundColor: '#000000' },
    lightboxTopbar: { position: 'absolute', left: 0, right: 0, top: 0, zIndex: 3, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: scale(16) },
    lightboxHeaderGradient: { position: 'absolute', top: 0, right: 0, left: 0 },
    lightboxIconButton: { width: scale(42), height: scale(42), borderRadius: scale(21), backgroundColor: 'rgba(255,255,255,0.14)', alignItems: 'center', justifyContent: 'center' },
    lightboxActionSpacer: { width: scale(42), height: scale(42) },
    lightboxDots: { minWidth: scale(42), height: scale(20), flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: scale(6) },
    lightboxDot: { height: scale(6), borderRadius: scale(3) },
    lightboxDotActive: { width: scale(18) },
    lightboxDotInactive: { width: scale(6), backgroundColor: 'rgba(255,255,255,0.48)' },
    lightboxViewport: { position: 'absolute', left: 0, right: 0, bottom: 0, overflow: 'visible' },
    lightboxGestureCanvas: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 },
    lightboxCarousel: { position: 'absolute', left: 0, bottom: 0, flexDirection: 'row' },
    lightboxImageFrame: { height: '100%', overflow: 'hidden' },
    lightboxZoomLayer: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    lightboxImage: { width: '100%', height: '100%' },
    lightboxImageState: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, zIndex: 2, alignItems: 'center', justifyContent: 'center' },
    lightboxRetryButton: { minHeight: scale(44), flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: scale(8), paddingHorizontal: scale(18), borderRadius: scale(22), backgroundColor: 'rgba(255,255,255,0.14)' },
    messageOverlay: {
        flex: 1,
        justifyContent: 'flex-end',
        backgroundColor: 'rgba(16, 16, 17,0.35)',
    },
    messageBackdrop: {
        ...StyleSheet.absoluteFill,
        zIndex: 0,
    },
    messageSheet: {
        zIndex: 2,
        elevation: 8,
        borderTopLeftRadius: scale(22),
        borderTopRightRadius: scale(22),
        borderWidth: StyleSheet.hairlineWidth,
        paddingHorizontal: scale(16),
        paddingTop: scale(14),
        gap: scale(12),
    },
    messageSheetContent: {
        gap: scale(12),
        paddingBottom: scale(2),
    },
    messageSheetHeader: {
        minHeight: scale(34),
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: scale(12),
    },
    messageSheetClose: {
        width: scale(34),
        height: scale(34),
        borderRadius: scale(17),
        alignItems: 'center',
        justifyContent: 'center',
    },
    messageInput: {
        minHeight: scale(130),
        maxHeight: scale(210),
        borderWidth: 1,
        borderRadius: scale(14),
        paddingHorizontal: scale(12),
        paddingTop: scale(11),
        paddingBottom: scale(11),
        fontSize: scale(14),
        lineHeight: scale(20),
    },
    messageMetaRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: scale(10),
    },
    messageSendButton: {
        height: scale(46),
        borderRadius: scale(23),
        backgroundColor: '#F34B6F',
        alignItems: 'center',
        justifyContent: 'center',
    },
    messageSendDisabled: {
        opacity: 0.55,
    },
});
