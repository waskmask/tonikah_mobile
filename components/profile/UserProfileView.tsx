import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
    ActivityIndicator,
    Dimensions,
    KeyboardAvoidingView,
    Modal,
    Platform,
    Pressable,
    RefreshControl,
    ScrollView,
    StyleSheet,
    TextInput,
    View,
} from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import {
    Baby,
    Ban,
    BriefcaseBusiness,
    Building2,
    CalendarHeart,
    ChevronLeft,
    ChevronRight,
    Cigarette,
    Coins,
    Flag,
    GraduationCap,
    Heart,
    Home,
    Languages,
    Lock,
    MapPin,
    MessageCircle,
    Moon,
    MoreVertical,
    Pencil,
    Plane,
    Quote,
    Ruler,
    ShieldCheck,
    Sparkles,
    UserRound,
    Users,
    Wine,
    X,
    Bookmark,
} from 'lucide-react-native';
import type { LucideIcon } from 'lucide-react-native';
import { Text } from '@/components/ui/Text';
import { useEmailVerificationGuard } from '@/hooks/useEmailVerificationGuard';
import { useLanguage } from '@/hooks/useLanguage';
import { scale, wp } from '@/hooks/useResponsive';
import { useTheme } from '@/hooks/useTheme';
import { useColors } from '@/hooks/useColors';
import { useToast } from '@/hooks/useToast';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { usersService } from '@/lib/usersService';
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

type Fact = { icon: LucideIcon; label: string; value: string };
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

const HOBBY_EMOJI: Record<string, string> = {
    sports: '\u{1F3C6}',
    reading: '\u{1F4DA}',
    reading_quran: '\u{1F4D6}',
    traveling: '\u{2708}\u{FE0F}',
    travel: '\u{2708}\u{FE0F}',
    cooking: '\u{1F373}',
    baking: '\u{1F9C1}',
    music: '\u{1F3B5}',
    art: '\u{1F3A8}',
    painting: '\u{1F3A8}',
    drawing: '\u{270F}\u{FE0F}',
    photography: '\u{1F4F8}',
    gaming: '\u{1F3AE}',
    video_games: '\u{1F3AE}',
    fitness: '\u{1F4AA}',
    gym: '\u{1F4AA}',
    running: '\u{1F3C3}',
    hiking: '\u{1F97E}',
    swimming: '\u{1F3CA}',
    cycling: '\u{1F6B4}',
    yoga: '\u{1F9D8}',
    meditation: '\u{1F9D8}',
    football: '\u{26BD}',
    soccer: '\u{26BD}',
    basketball: '\u{1F3C0}',
    cricket: '\u{1F3CF}',
    tennis: '\u{1F3BE}',
    chess: '\u{265F}\u{FE0F}',
    horse_riding: '\u{1F40E}',
    fishing: '\u{1F3A3}',
    writing: '\u{270D}\u{FE0F}',
    calligraphy: '\u{1F58B}\u{FE0F}',
    vlogging: '\u{1F3A5}',
    diy: '\u{1F6E0}\u{FE0F}',
    gardening: '\u{1F331}',
    fashion: '\u{1F457}',
    investing: '\u{1F4C8}',
    volunteering: '\u{1F91D}',
    animals_pets: '\u{1F43E}',
    animals_and_pets: '\u{1F43E}',
    pets: '\u{1F43E}',
    movies: '\u{1F3AC}',
    netflix: '\u{1F4FA}',
    podcasts: '\u{1F399}\u{FE0F}',
    poetry: '\u{1F4DC}',
    technology: '\u{1F4BB}',
    coding: '\u{1F4BB}',
    teaching: '\u{1F468}\u{200D}\u{1F3EB}',
    dancing: '\u{1F483}',
    singing: '\u{1F3A4}',
};

const FAITH_EMOJI: Record<string, string> = {
    prays_5_times: '\u{1F932}',
    prays_5_times_a_day: '\u{1F932}',
    prays_on_time: '\u{23F1}\u{FE0F}',
    prays_sometimes: '\u{1F932}',
    jummah_regular: '\u{1F54C}',
    regular_for_friday_prayer: '\u{1F54C}',
    quran_recitation: '\u{1F4D6}',
    recites_quran: '\u{1F4D6}',
    recites_qur_an: '\u{1F4D6}',
    dhikr_regular: '\u{1F319}',
    regular_in_dhikr: '\u{1F319}',
    fasts_ramadan: '\u{1F319}',
    fasts_in_ramadan: '\u{1F319}',
    fasts_sunnah: '\u{1F319}',
    gives_sadaqah: '\u{1F49D}',
    zakat_conscious: '\u{1F4B0}',
    careful_about_zakat: '\u{1F4B0}',
    completed_umrah: '\u{1F54B}',
    plans_umrah: '\u{1F54B}',
    plans_to_perform_umrah: '\u{1F54B}',
    completed_hajj: '\u{1F54B}',
    plans_hajj: '\u{1F54B}',
    plans_to_perform_hajj: '\u{1F54B}',
    halal_earnings_priority: '\u{2705}',
    prioritizes_halal_earnings: '\u{2705}',
    avoids_interest_riba: '\u{1F6AB}',
    avoids_interest: '\u{1F6AB}',
    avoids_alcohol: '\u{1F6AB}',
    avoids_smoking: '\u{1F6AB}',
    modest_lifestyle: '\u{1F33F}',
    lives_a_modest_lifestyle: '\u{1F33F}',
    honest_trustworthy: '\u{1F48E}',
    honest_and_trustworthy: '\u{1F48E}',
    kind_soft_spoken: '\u{1F497}',
    kind_and_soft_spoken: '\u{1F497}',
    patient_calm_temper: '\u{1F343}',
    patient_and_calm: '\u{1F343}',
    respectful: '\u{1F64F}',
    respectful_to_others: '\u{1F64F}',
    growth_in_deen: '\u{1F331}',
    focused_on_growing_in_deen: '\u{1F331}',
    family_oriented: '\u{1F46A}',
    close_to_family: '\u{1F46A}',
    values_marriage: '\u{1F48D}',
    community_minded: '\u{1F30D}',
    balances_deen_dunya: '\u{2696}\u{FE0F}',
    balances_deen_and_duniya: '\u{2696}\u{FE0F}',
    attends_mosque: '\u{1F54C}',
    studies_hadith: '\u{1F4DC}',
    modest_dressing: '\u{1F9D5}',
    islamic_lectures: '\u{1F399}\u{FE0F}',
    learns_islam: '\u{1F4DA}',
};

function profileFieldSlug(value: any) {
    const raw = String(
        typeof value === 'object' && value !== null
            ? value.label || value.name || value.title || value.value || value.value_id || ''
            : value || '',
    ).trim();
    return toKey(raw);
}

function emojiChipItem(value: any, type: 'faith' | 'hobby') {
    const slug = profileFieldSlug(value);
    const fallback = displayText(value);
    const label = type === 'hobby' ? t(`hobby_${slug}`, fallback) : t(slug, fallback);
    const emoji = type === 'hobby' ? HOBBY_EMOJI[slug] || '\u{2728}' : FAITH_EMOJI[slug] || '\u{1F319}';
    return { label, emoji, slug };
}

export type UserProfileViewProps = {
    userId?: string;
    initialProfile?: any;
    mode?: 'inline' | 'screen' | 'modal';
    showClose?: boolean;
    isOwnProfile?: boolean;
    advanceOnClose?: boolean;
    onEditProfile?: () => void;
    onClose?: () => void;
    onAfterClose?: () => void;
    onBlocked?: (userId: string) => void;
    onUnblocked?: (userId: string) => void;
    onFavoriteChanged?: (userId: string, favorited: boolean) => void;
    refreshing?: boolean;
    onRefresh?: () => void;
};

const SCREEN_WIDTH = Dimensions.get('window').width;

export function UserProfileView({
    userId,
    initialProfile,
    mode = 'inline',
    showClose = true,
    isOwnProfile = false,
    advanceOnClose = false,
    onEditProfile,
    onClose,
    onAfterClose,
    onBlocked,
    onUnblocked,
    onFavoriteChanged,
    refreshing = false,
    onRefresh,
}: UserProfileViewProps) {
    const { isDark } = useTheme();
    const colors = useColors();
    const commonColors = colors.chrome.common;
    const toast = useToast();
    const { isRTL } = useLanguage();
    const { requireVerified } = useEmailVerificationGuard();
    const insets = useSafeAreaInsets();
    const headerTopInset = insets.top;
    const headerRowHeight = scale(48);
    const [profile, setProfile] = useState<any>(initialProfile || null);
    const [loading, setLoading] = useState(Boolean(userId));
    const [error, setError] = useState('');
    const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
    const [messageSheetOpen, setMessageSheetOpen] = useState(false);
    const [messageDraft, setMessageDraft] = useState('');
    const [messageChecking, setMessageChecking] = useState(false);
    const [messageSending, setMessageSending] = useState(false);
    const [locallySentRequestIds, setLocallySentRequestIds] = useState<Set<string>>(() => new Set());
    const [pendingProfileToast, setPendingProfileToast] = useState<PendingProfileToast | null>(null);
    const [profileMenuOpen, setProfileMenuOpen] = useState(false);
    const [blockConfirmOpen, setBlockConfirmOpen] = useState(false);
    const [blockBusy, setBlockBusy] = useState(false);
    const [unblockBusy, setUnblockBusy] = useState(false);

    const resolvedUserId = userId || profileId(initialProfile);

    const load = useCallback(async () => {
        if (!resolvedUserId) return;
        setLoading(true);
        setError('');
        const res = await usersService.detail(resolvedUserId);
        if (res.success === false) {
            setError(apiMessage(res.message, 'profile_unavailable'));
        } else {
            setProfile(res);
        }
        setLoading(false);
    }, [resolvedUserId]);

    useEffect(() => {
        if (resolvedUserId) void load();
    }, [load, resolvedUserId]);

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
    const gallery = normalizeGallery(profile);
    const photos = gallery.map(imageUrl).filter(Boolean);
    const privateGallery = !isOwnProfile && (profile?.privacy || profile?.gallery_privacy || profile?.galleryPrivacy || 'public') === 'private';
    const verified = isVerifiedProfile(profile);
    const activeMembership = isMembershipActive(profile);
    const location = formatProfileLocation(profile, true);
    const countryFlag = flagEmoji(profile);
    const headline = cleanProfileText(profile?.profile_headline);
    const bio = bioText(profile);
    const blocked = profile?.blocked === true;

    const close = () => {
        onClose?.();
        if (advanceOnClose) onAfterClose?.();
    };

    const startMessage = async () => {
        if (!id || !requireVerified('chat')) return;
        if (messageChecking) return;
        setMessageChecking(true);
        try {
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
        if (!id || !requireVerified('profileActions')) return;
        const favorited = Boolean(profile?.is_favorited);
        const res = favorited ? await usersService.unfavorite(id) : await usersService.favorite(id);
        if (res.success) {
            const nextFavorited = !favorited;
            setProfile((current: any) => ({ ...current, is_favorited: nextFavorited }));
            onFavoriteChanged?.(id, nextFavorited);
            toast.show(
                nextFavorited ? t('favorited', 'Added to Saved') : t('unfavorited', 'Removed from Saved'),
                'success',
                2500,
            );
        } else {
            toast.show(apiMessage(res.message), 'error');
        }
    };

    const reportProfile = () => {
        if (!id || !requireVerified('report')) return;
        setProfileMenuOpen(false);
        router.push('/support' as any);
    };

    const blockUser = () => {
        if (!id || !requireVerified('report')) return;
        setProfileMenuOpen(false);
        setBlockConfirmOpen(true);
    };

    const confirmBlockUser = async () => {
        if (!id || blockBusy) return;
        setBlockBusy(true);
        const res = await usersService.block(id);
        setBlockBusy(false);
        if (res.success) {
            setBlockConfirmOpen(false);
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
                void load();
            } else {
                toast.show(apiMessage(res.message), 'error');
            }
        } finally {
            setUnblockBusy(false);
        }
    };

    const facts = useMemo(() => buildFacts(profile), [profile]);
    const partnerPreference = profile?.partner_preference || profile?.partnerPreference || {};
    const partnerAbout = cleanProfileMultilineText(partnerPreference?.about_partner);
    const partnerFacts = useMemo(() => buildPartnerFacts(partnerPreference), [partnerPreference]);
    const showPartnerPreference = Boolean(partnerAbout || partnerFacts.length);

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

    return (
        <View style={{ flex: 1, backgroundColor: colors.brand.bg.surface }}>
            <View
                style={[
                    styles.header,
                    {
                        paddingTop: headerTopInset,
                        minHeight: headerTopInset + headerRowHeight,
                        backgroundColor: colors.chrome.header.background,
                        borderBottomColor: colors.brand.bg.border,
                    },
                ]}
            >
                {!isOwnProfile && showClose ? (
                    <Pressable onPress={close} style={styles.headerButton} hitSlop={10}>
                        <ChevronLeft size={scale(23)} color={colors.chrome.header.icon} />
                    </Pressable>
                ) : isOwnProfile ? null : <View style={styles.headerButton} />}
                <Text variant="body" className="font-body-semi" numberOfLines={1} style={[styles.headerTitle, { textAlign: isRTL ? 'right' : 'left' }]}>
                    {visibleHeaderTitle}
                </Text>
                {isOwnProfile ? (
                    <Pressable
                        onPress={onEditProfile || (() => router.push('/(tabs)/edit-profile'))}
                        style={[styles.editProfileButton, { borderColor: colors.brand.bg.border }]}
                        hitSlop={8}
                    >
                        <Pencil size={scale(15)} color={colors.chrome.primary} />
                        <Text variant="body-sm" className="font-body-semi" style={{ color: colors.chrome.primary }}>
                            {t('edit_profile', 'Edit profile')}
                        </Text>
                    </Pressable>
                ) : (
                    <>
                        <Pressable onPress={toggleFavorite} style={styles.headerButton} hitSlop={10}>
                            <Bookmark size={scale(21)} color={profile?.is_favorited ? colors.chrome.primary : colors.chrome.header.icon} fill={profile?.is_favorited ? colors.chrome.primary : 'transparent'} />
                        </Pressable>
                        <Pressable onPress={startMessage} style={styles.headerButton} hitSlop={10}>
                            {messageChecking ? <ActivityIndicator size="small" color={colors.chrome.primary} /> : <MessageCircle size={scale(21)} color={colors.chrome.header.icon} />}
                        </Pressable>
                        <Pressable onPress={() => setProfileMenuOpen(true)} style={styles.headerButton} hitSlop={10}>
                            <MoreVertical size={scale(21)} color={colors.chrome.header.icon} />
                        </Pressable>
                    </>
                )}
            </View>

            <ScrollView
                showsVerticalScrollIndicator={false}
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
                    mode === 'screen' ? { paddingBottom: scale(120) } : { paddingBottom: scale(26) },
                ]}
            >
                <ProfileGallery
                    photos={photos}
                    privateGallery={privateGallery}
                    name={name}
                    age={age}
                    location={location}
                    countryFlag={countryFlag}
                    verified={verified}
                    activeMembership={activeMembership}
                    onOpenPhoto={(index) => setLightboxIndex(index)}
                    isDark={isDark}
                />

                {(headline || bio) ? (
                    <Section title={t('about_me', 'About me')} isDark={isDark}>
                        {headline ? <Text variant="h3" style={styles.headline}>{headline}</Text> : null}
                        {bio ? (
                            <View style={styles.bioBox}>
                                <Quote size={scale(24)} color={commonColors.primaryGlow} style={styles.quoteIcon} />
                                <Text variant="body" style={styles.bioText}>{bio}</Text>
                            </View>
                        ) : null}
                    </Section>
                ) : null}

                <SectionFacts title={t('religious_beliefs', 'Faith & Values')} facts={facts.faith} isDark={isDark} isRTL={isRTL} />
                <SectionFacts title={t('marriage_future_plans', 'Marriage / Future plans')} facts={facts.marriage} isDark={isDark} isRTL={isRTL} />
                <ChipSection
                    title={t('faith_in_daily_life', 'Faith in Daily Life')}
                    items={profile?.faith_in_daily_life || []}
                    type="faith"
                    isDark={isDark}
                    isRTL={isRTL}
                    action={isOwnProfile ? { label: t('edit', 'Edit'), onPress: () => router.push('/(tabs)/faith') } : undefined}
                />
                <SectionFacts title={t('education_career', 'Education & Career')} facts={facts.career} isDark={isDark} isRTL={isRTL} />
                <SectionFacts title={t('background', 'Background')} facts={facts.background} isDark={isDark} isRTL={isRTL} />
                <SectionFacts title={t('appearance', 'Appearance')} facts={facts.appearance} isDark={isDark} isRTL={isRTL} />
                <SectionFacts title={t('lifestyle', 'Lifestyle')} facts={facts.lifestyle} isDark={isDark} isRTL={isRTL} />
                <ChipSection
                    title={t('hobbies', 'Hobbies')}
                    items={profile?.hobbies || []}
                    type="hobby"
                    isDark={isDark}
                    isRTL={isRTL}
                    action={isOwnProfile ? { label: t('edit', 'Edit'), onPress: () => router.push('/(tabs)/my-hobbies') } : undefined}
                />
                {showPartnerPreference ? (
                    <Section title={t('partner_preference', 'Partner Preference')} isDark={isDark}>
                        {partnerAbout ? (
                            <Text variant="body" style={[styles.partnerAbout, { textAlign: isRTL ? 'right' : 'left' }]}>
                                {partnerAbout}
                            </Text>
                        ) : null}
                        <FactRows facts={partnerFacts} isRTL={isRTL} />
                    </Section>
                ) : null}
                {!isOwnProfile ? (
                <View style={[styles.profileFooterActionWrap, { borderTopColor: colors.brand.bg.border }]}>
                    <View style={styles.profileFooterActionRow}>
                        <Pressable onPress={reportProfile} style={({ pressed }) => [styles.profileFooterActionButton, pressed && styles.profileMenuItemPressed]}>
                            <View style={styles.profileFooterActionIconSlot}>
                                <Flag size={scale(19)} color={colors.brand.text.subtitle} strokeWidth={2.1} />
                            </View>
                            <Text variant="body-sm" style={[styles.profileFooterActionText, { color: colors.brand.text.subtitle }]}>
                                {t('report_profile', 'Report profile')}
                            </Text>
                        </Pressable>
                        <Pressable onPress={toggleFavorite} style={({ pressed }) => [styles.profileFooterActionButton, pressed && styles.profileMenuItemPressed]}>
                            <View style={styles.profileFooterActionIconSlot}>
                                <Bookmark
                                    size={scale(19)}
                                    color={profile?.is_favorited ? colors.chrome.primary : colors.brand.text.subtitle}
                                    fill={profile?.is_favorited ? colors.chrome.primary : 'transparent'}
                                    strokeWidth={2.1}
                                />
                            </View>
                            <Text
                                variant="body-sm"
                                style={[
                                    styles.profileFooterActionText,
                                    { color: profile?.is_favorited ? colors.chrome.primary : colors.brand.text.subtitle },
                                ]}
                            >
                                {profile?.is_favorited ? t('saved', 'Saved') : t('save_profile', 'Save profile')}
                            </Text>
                        </Pressable>
                    </View>
                </View>
                ) : null}
            </ScrollView>

            <ImageLightbox
                photos={photos}
                index={lightboxIndex}
                onClose={() => setLightboxIndex(null)}
                onReport={() => {
                    setLightboxIndex(null);
                    router.push('/support' as any);
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
            <ProfileActionsMenu
                visible={profileMenuOpen}
                top={headerTopInset + headerRowHeight + scale(6)}
                isDark={isDark}
                onClose={() => setProfileMenuOpen(false)}
                onReport={reportProfile}
                onBlock={blockUser}
            />
            <BlockConfirmModal
                visible={blockConfirmOpen}
                loading={blockBusy}
                onCancel={() => {
                    if (!blockBusy) setBlockConfirmOpen(false);
                }}
                onConfirm={confirmBlockUser}
            />
        </View>
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
                                pressed && styles.profileMenuItemPressed,
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

function ProfileActionsMenu({
    visible,
    top,
    isDark,
    onClose,
    onReport,
    onBlock,
}: {
    visible: boolean;
    top: number;
    isDark: boolean;
    onClose: () => void;
    onReport: () => void;
    onBlock: () => void;
}) {
    const palette = useColors();
    const colors = {
        card: palette.chrome.common.card,
        border: palette.brand.bg.border,
        text: palette.chrome.common.textStrong,
        danger: palette.brand.accent.error,
    };
    return (
        <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
            <View style={styles.profileMenuLayer} pointerEvents="box-none">
                <Pressable style={styles.profileMenuBackdrop} onPress={onClose} />
                <View style={[styles.profileMenu, { top, backgroundColor: colors.card, borderColor: colors.border }]}>
                    <View style={[styles.profileMenuHeader, { borderBottomColor: colors.border }]}>
                        <Text variant="body-sm" className="font-body-bold" style={{ color: colors.text }}>
                            {t('chat:more_options', 'More options')}
                        </Text>
                        <Pressable onPress={onClose} style={styles.profileMenuClose}>
                            <X size={scale(18)} color={colors.text} strokeWidth={2.6} />
                        </Pressable>
                    </View>
                    <View style={styles.profileMenuLinks}>
                        <ProfileMenuItem icon={Flag} label={t('report_profile', 'Report profile')} color={colors.text} dangerColor={colors.danger} danger onPress={onReport} />
                        <ProfileMenuItem icon={Ban} label={t('block_user', 'Block user')} color={colors.text} dangerColor={colors.danger} danger onPress={onBlock} />
                    </View>
                </View>
            </View>
        </Modal>
    );
}

function ProfileMenuItem({
    icon: Icon,
    label,
    color,
    dangerColor,
    danger,
    onPress,
}: {
    icon: LucideIcon;
    label: string;
    color: string;
    dangerColor?: string;
    danger?: boolean;
    onPress: () => void;
}) {
    const tint = danger ? dangerColor || color : color;
    return (
        <Pressable onPress={onPress} style={({ pressed }) => [styles.profileMenuItem, pressed && styles.profileMenuItemPressed]}>
            <View style={styles.profileMenuItemRow}>
                <View style={styles.profileMenuIcon}>
                    <Icon size={scale(18)} color={tint} strokeWidth={2.4} />
                </View>
                <Text variant="body-sm" numberOfLines={1} style={[styles.profileMenuLabel, { color: tint }]}>
                    {label}
                </Text>
            </View>
        </Pressable>
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
    const keyboardOffset = Platform.OS === 'ios' ? insets.top : 0;
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
            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                keyboardVerticalOffset={keyboardOffset}
                style={styles.messageOverlay}
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
            </KeyboardAvoidingView>
        </Modal>
    );
}

function ProfileGallery({
    photos,
    privateGallery,
    name,
    age,
    location,
    countryFlag,
    verified,
    activeMembership,
    onOpenPhoto,
    isDark,
}: {
    photos: string[];
    privateGallery: boolean;
    name: string;
    age: number | null;
    location: string;
    countryFlag: string;
    verified: boolean;
    activeMembership: boolean;
    onOpenPhoto: (index: number) => void;
    isDark: boolean;
}) {
    const palette = useColors();
    const slots = [0, 1, 2].map((index) => photos[index] || '');
    const slideWidth = Math.round(SCREEN_WIDTH * 0.68);

    return (
        <View style={[styles.gallery, { backgroundColor: palette.chrome.common.card }]}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} snapToInterval={slideWidth} decelerationRate="fast">
                {slots.map((src, index) => (
                    <Pressable
                        key={`${src}-${index}`}
                        disabled={!src || privateGallery}
                        onPress={() => onOpenPhoto(index)}
                        style={[styles.gallerySlide, { width: slideWidth, backgroundColor: palette.brand.bg.surface }]}
                    >
                        <Image source={src ? { uri: src } : PROFILE_PLACEHOLDER_IMAGE} style={StyleSheet.absoluteFill} contentFit="cover" blurRadius={privateGallery ? 18 : 0} />
                        {privateGallery && (
                            <View style={styles.privateOverlay}>
                                <Lock size={scale(22)} color={palette.chrome.common.inverseText} />
                                <Text variant="caption" style={{ color: palette.chrome.common.inverseText }}>{t('gallery_isprivate', 'Gallery is private')}</Text>
                            </View>
                        )}
                    </Pressable>
                ))}
            </ScrollView>
            <LinearGradient colors={['rgba(15,23,42,0.02)', 'rgba(15,23,42,0.72)']} style={styles.galleryGradient} pointerEvents="none" />
            <View style={styles.photoCount}>
                <Text variant="caption" style={{ color: palette.chrome.common.inverseText }}>{photos.length || 0}</Text>
            </View>
            <View style={styles.galleryIdentity} pointerEvents="none">
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: scale(8), flexWrap: 'wrap' }}>
                    <Text variant="h2" numberOfLines={2} style={{ color: palette.chrome.common.inverseText, fontSize: scale(23), lineHeight: scale(28), flexShrink: 1 }}>
                        {name}{age ? `, ${age}` : ''}
                    </Text>
                    {verified ? <ShieldCheck size={scale(22)} color={palette.chrome.common.inverseText} fill="#3D63F3" /> : null}
                    {activeMembership ? <View style={styles.membershipBadge}><Text variant="caption" style={{ color: palette.chrome.common.inverseText }}>M</Text></View> : null}
                </View>
                {location ? (
                    <View style={styles.heroLocationRow}>
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

type SectionAction = { label: string; onPress: () => void };

function SectionFacts({
    title,
    facts,
    isDark,
    isRTL,
    action,
}: {
    title: string;
    facts: Fact[];
    isDark: boolean;
    isRTL: boolean;
    action?: SectionAction;
}) {
    if (!facts.length) return null;
    return (
        <Section title={title} isDark={isDark} action={action}>
            <FactRows facts={facts} isRTL={isRTL} />
        </Section>
    );
}

function FactRows({ facts, isRTL }: { facts: Fact[]; isRTL: boolean }) {
    const palette = useColors();
    if (!facts.length) return null;
    return (
        <View style={{ gap: scale(14) }}>
            {facts.map((fact) => {
                const Icon = fact.icon;
                return (
                    <View key={`${fact.label}-${fact.value}`} style={[styles.factRow, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
                        <View style={styles.factIcon}>
                            <Icon size={scale(18)} color={palette.chrome.primary} />
                        </View>
                        <View style={{ flex: 1 }}>
                            <Text variant="caption" className="font-body-semi" style={[styles.factLabel, { color: palette.chrome.common.textMuted, textAlign: isRTL ? 'right' : 'left' }]}>{fact.label}</Text>
                            <Text variant="body" className="font-body-semi" style={{ textAlign: isRTL ? 'right' : 'left' }}>{fact.value}</Text>
                        </View>
                    </View>
                );
            })}
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
        <Section title={title} isDark={isDark} action={action}>
            <View style={[styles.chipWrap, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
                {clean.map((item, index) => (
                    <View key={`${type}-${item.slug}-${index}`} style={[styles.chip, styles.emojiChip, { backgroundColor: palette.brand.bg.surface, borderColor: palette.brand.bg.border }]}>
                        <Text style={styles.emojiText}>{item.emoji}</Text>
                        <Text variant="body-sm" style={styles.emojiChipLabel}>{item.label}</Text>
                    </View>
                ))}
            </View>
        </Section>
    );
}

function Section({ title, children, isDark, action }: { title: string; children: React.ReactNode; isDark: boolean; action?: SectionAction }) {
    const palette = useColors();
    return (
        <View style={[styles.section, { backgroundColor: palette.chrome.common.card, borderTopColor: palette.brand.bg.border }]}>
            <View style={styles.sectionHeader}>
                <Text variant="caption" className="font-body-semi" style={[styles.sectionTitle, { color: palette.chrome.common.textStrong }]}>{title}</Text>
                {action ? (
                    <Pressable onPress={action.onPress} style={styles.sectionAction} hitSlop={8}>
                        <Pencil size={scale(13)} color={palette.chrome.primary} />
                        <Text variant="caption" className="font-body-semi" style={[styles.sectionActionText, { color: palette.chrome.primary }]}>
                            {action.label}
                        </Text>
                    </Pressable>
                ) : null}
            </View>
            {children}
        </View>
    );
}

function ImageLightbox({
    photos,
    index,
    onClose,
    onReport,
}: {
    photos: string[];
    index: number | null;
    onClose: () => void;
    onReport: () => void;
}) {
    const [current, setCurrent] = useState(0);
    const palette = useColors();
    useEffect(() => {
        if (index !== null) setCurrent(index);
    }, [index]);
    const src = index !== null ? photos[current] : '';
    const hasMultiple = photos.length > 1;
    const goPrevious = () => setCurrent((value) => (value <= 0 ? photos.length - 1 : value - 1));
    const goNext = () => setCurrent((value) => (value >= photos.length - 1 ? 0 : value + 1));

    return (
        <Modal visible={index !== null} transparent animationType="fade" onRequestClose={onClose}>
            <View style={styles.lightbox}>
                <View style={styles.lightboxTopbar}>
                    <Pressable onPress={onClose} style={styles.lightboxIconButton} hitSlop={10}>
                        <X size={scale(23)} color={palette.chrome.common.inverseText} />
                    </Pressable>
                    {hasMultiple ? (
                        <Text variant="body-sm" className="font-body-semi" style={{ color: palette.chrome.common.inverseText }}>
                            {current + 1}/{photos.length}
                        </Text>
                    ) : <View />}
                    <Pressable onPress={onReport} style={styles.lightboxIconButton} hitSlop={10}>
                        <Flag size={scale(21)} color={palette.chrome.common.inverseText} />
                    </Pressable>
                </View>
                {src ? <Image source={{ uri: src }} style={styles.lightboxImage} contentFit="contain" /> : null}
                {hasMultiple ? (
                    <>
                        <Pressable onPress={goPrevious} style={[styles.lightboxNav, styles.lightboxNavLeft]} hitSlop={12}>
                            <ChevronLeft size={scale(28)} color={palette.chrome.common.inverseText} />
                        </Pressable>
                        <Pressable onPress={goNext} style={[styles.lightboxNav, styles.lightboxNavRight]} hitSlop={12}>
                            <ChevronRight size={scale(28)} color={palette.chrome.common.inverseText} />
                        </Pressable>
                    </>
                ) : null}
            </View>
        </Modal>
    );
}

function buildFacts(profile: any) {
    const common = (value: any) => displayText(typeof value === 'object' ? value?.label : value);
    const countryList = (values: any[]) => listText((values || []).map(translateCountry));
    const annualIncome = typeof profile?.annual_income === 'object'
        ? [profile?.annual_income?.amount, profile?.annual_income?.currency].filter(Boolean).join(' ')
        : String(profile?.annual_income || '');

    const compact = (facts: Array<Fact | null | false | undefined>) =>
        facts.filter((fact): fact is Fact => Boolean(fact && typeof fact !== 'boolean' && fact.value.trim()));

    return {
        faith: compact([
            { icon: Moon, label: t('sect', 'Sect'), value: common(profile?.sect) },
            { icon: Sparkles, label: t('maslak', 'Maslak'), value: common(profile?.maslak) },
            { icon: Heart, label: t('following', 'Following'), value: common(profile?.following) },
            { icon: ShieldCheck, label: t('born_muslim', 'Born Muslim'), value: common(profile?.born_muslim) },
            { icon: Moon, label: t('practising', 'Practising'), value: common(profile?.is_practising) },
            { icon: CalendarHeart, label: t('prayers', 'Prayers'), value: common(profile?.prayers) },
        ]),
        marriage: compact([
            { icon: Users, label: t('marital_status', 'Marital status'), value: common(profile?.marital_status) },
            { icon: Baby, label: t('have_children', 'Has children'), value: common(profile?.have_children) },
            { icon: Baby, label: t('wants_children', 'Wants children'), value: common(profile?.wants_children) },
            { icon: CalendarHeart, label: t('marriage_plan', 'Marriage plan'), value: common(profile?.marriage_plan) },
            { icon: Plane, label: t('relocation_plans', 'Relocation'), value: common(profile?.relocation_plans) },
        ]),
        career: compact([
            { icon: GraduationCap, label: t('education', 'Education'), value: common(profile?.education) },
            { icon: BriefcaseBusiness, label: t('occupation', 'Occupation'), value: common(profile?.occupation) },
            { icon: BriefcaseBusiness, label: t('designation', 'Designation'), value: common(profile?.designation) },
            { icon: Building2, label: t('company', 'Company'), value: String(profile?.company || '') },
            { icon: Coins, label: t('annual_income', 'Annual income'), value: annualIncome },
        ]),
        background: compact([
            { icon: ShieldCheck, label: t('nationality', 'Nationality'), value: countryList(profile?.nationality) },
            { icon: Home, label: t('grew_up_in', 'Grew up in'), value: translateCountry(profile?.grew_up_in) },
            { icon: Languages, label: t('mother_tongue', 'Mother tongue'), value: common(profile?.mother_tongue) },
            { icon: Languages, label: t('languages_spoken', 'Languages'), value: listText((profile?.languages_spoken || []).map(displayText)) },
            { icon: Sparkles, label: t('dress', 'Dress'), value: common(profile?.i_usually_dress) },
        ]),
        appearance: compact([
            { icon: Ruler, label: t('height', 'Height'), value: common(profile?.height) },
            { icon: UserRound, label: t('complexion', 'Complexion'), value: common(profile?.complexion) },
            { icon: Users, label: t('ethnic_group', 'Ethnic group'), value: Array.isArray(profile?.ethnic_group) ? listText(profile.ethnic_group.map(displayText)) : common(profile?.ethnic_group) },
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
        const raw = typeof value === 'object' ? value?.label || value?.name || value?.value : value;
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
        paddingHorizontal: scale(14),
    },
    headerButton: { width: scale(38), height: scale(38), alignItems: 'center', justifyContent: 'center' },
    headerTitle: { flex: 1, fontSize: scale(16), lineHeight: scale(20) },
    editProfileButton: {
        minHeight: scale(34),
        borderWidth: 1,
        borderRadius: scale(999),
        paddingHorizontal: scale(12),
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: scale(6),
    },
    content: { paddingHorizontal: 0, paddingTop: 0 },
    gallery: { overflow: 'hidden', minHeight: scale(342), marginBottom: 0 },
    gallerySlide: { aspectRatio: 3 / 4, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
    galleryGradient: { position: 'absolute', left: 0, right: 0, bottom: 0, height: '55%' },
    privateOverlay: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center', gap: scale(6), backgroundColor: 'rgba(15,23,42,0.22)' },
    photoCount: { position: 'absolute', right: scale(14), top: scale(14), minWidth: scale(28), height: scale(28), borderRadius: scale(14), backgroundColor: 'rgba(15,23,42,0.62)', alignItems: 'center', justifyContent: 'center', paddingHorizontal: scale(8) },
    galleryIdentity: { position: 'absolute', left: scale(18), right: scale(18), bottom: scale(18) },
    heroLocationRow: { flexDirection: 'row', alignItems: 'center', gap: scale(6), marginTop: scale(5) },
    heroLocationFlag: { lineHeight: scale(18) },
    membershipBadge: { width: scale(22), height: scale(22), borderRadius: scale(11), backgroundColor: '#F34B6F', alignItems: 'center', justifyContent: 'center' },
    section: {
        borderTopWidth: 1,
        paddingHorizontal: scale(18),
        paddingVertical: scale(20),
    },
    sectionHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: scale(12),
        marginBottom: scale(14),
    },
    sectionTitle: { textTransform: 'uppercase', letterSpacing: 2, color: '#1F2A24', fontSize: scale(13), flexShrink: 1 },
    sectionAction: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: scale(5),
        paddingHorizontal: scale(4),
        paddingVertical: scale(3),
    },
    sectionActionText: { color: '#F34B6F' },
    headline: { fontSize: scale(20), lineHeight: scale(25), marginBottom: scale(10) },
    bioBox: { borderLeftWidth: 4, borderLeftColor: '#F34B6F', backgroundColor: 'rgba(243,75,111,0.04)', borderRadius: scale(8), padding: scale(14) },
    quoteIcon: { position: 'absolute', right: scale(12), top: scale(10) },
    bioText: { lineHeight: scale(25), fontStyle: 'italic' },
    partnerAbout: { lineHeight: scale(24), marginBottom: scale(14) },
    factRow: { alignItems: 'flex-start', gap: scale(12) },
    factIcon: { width: scale(40), height: scale(40), borderRadius: scale(20), backgroundColor: 'rgba(243,75,111,0.08)', alignItems: 'center', justifyContent: 'center' },
    factLabel: { color: '#7A8480', textTransform: 'uppercase', letterSpacing: 1.2, marginBottom: scale(3) },
    chipWrap: { flexWrap: 'wrap', gap: scale(8) },
    chip: { borderWidth: 1, borderRadius: scale(999), paddingHorizontal: scale(12), paddingVertical: scale(8) },
    emojiChip: { flexDirection: 'row', alignItems: 'center', gap: scale(6) },
    emojiText: { fontSize: scale(15), lineHeight: scale(18) },
    emojiChipLabel: { fontWeight: '400' },
    profileFooterActionWrap: {
        borderTopWidth: 1,
        paddingHorizontal: scale(18),
        paddingTop: scale(18),
        paddingBottom: scale(34),
    },
    profileFooterActionRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: scale(16),
    },
    profileFooterActionButton: {
        minWidth: scale(96),
        minHeight: scale(58),
        borderRadius: scale(12),
        alignItems: 'center',
        justifyContent: 'center',
        gap: scale(10),
        paddingVertical: scale(8),
    },
    profileFooterActionIconSlot: {
        width: '100%',
        height: scale(24),
        alignItems: 'center',
        justifyContent: 'center',
    },
    profileFooterActionText: {
        textAlign: 'center',
        fontSize: scale(13),
        lineHeight: scale(17),
        fontWeight: '400',
    },
    profileMenuLayer: {
        position: 'absolute',
        top: 0,
        right: 0,
        bottom: 0,
        left: 0,
        justifyContent: 'flex-start',
    },
    profileMenuBackdrop: {
        position: 'absolute',
        top: 0,
        right: 0,
        bottom: 0,
        left: 0,
        backgroundColor: 'rgba(15,23,42,0.28)',
    },
    profileMenu: {
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
    profileMenuHeader: {
        height: scale(48),
        paddingLeft: scale(16),
        paddingRight: scale(8),
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        borderBottomWidth: StyleSheet.hairlineWidth,
    },
    profileMenuClose: {
        width: scale(36),
        height: scale(36),
        borderRadius: scale(18),
        alignItems: 'center',
        justifyContent: 'center',
    },
    profileMenuLinks: {
        paddingHorizontal: scale(10),
        paddingTop: scale(8),
        paddingBottom: scale(12),
        gap: scale(14),
    },
    profileMenuItem: {
        height: scale(52),
        paddingHorizontal: scale(16),
        justifyContent: 'center',
    },
    profileMenuItemRow: {
        width: '100%',
        flexDirection: 'row',
        alignItems: 'center',
    },
    profileMenuIcon: {
        width: scale(24),
        height: scale(24),
        marginRight: scale(12),
        alignItems: 'center',
        justifyContent: 'center',
    },
    profileMenuLabel: {
        flex: 1,
        fontSize: scale(14),
        lineHeight: scale(18),
        fontWeight: '400',
    },
    profileMenuItemPressed: {
        backgroundColor: 'rgba(148,163,184,0.12)',
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
        backgroundColor: 'rgba(15,23,42,0.42)',
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
    lightbox: { flex: 1, backgroundColor: '#000000', alignItems: 'center', justifyContent: 'center' },
    lightboxTopbar: { position: 'absolute', left: 0, right: 0, top: scale(42), zIndex: 3, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: scale(16) },
    lightboxIconButton: { width: scale(42), height: scale(42), borderRadius: scale(21), backgroundColor: 'rgba(255,255,255,0.14)', alignItems: 'center', justifyContent: 'center' },
    lightboxImage: { width: wp(100), height: '82%' },
    lightboxNav: { position: 'absolute', top: '50%', zIndex: 3, width: scale(44), height: scale(44), marginTop: -scale(22), borderRadius: scale(22), backgroundColor: 'rgba(255,255,255,0.14)', alignItems: 'center', justifyContent: 'center' },
    lightboxNavLeft: { left: scale(14) },
    lightboxNavRight: { right: scale(14) },
    messageOverlay: {
        flex: 1,
        justifyContent: 'flex-end',
        backgroundColor: 'rgba(15,23,42,0.35)',
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
