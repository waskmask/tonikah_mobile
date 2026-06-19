import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Dimensions,
    KeyboardAvoidingView,
    Modal,
    Platform,
    Pressable,
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
} from '@/lib/profileDisplay';
import {
    bioText,
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

export type UserProfileViewProps = {
    userId?: string;
    initialProfile?: any;
    mode?: 'inline' | 'screen' | 'modal';
    showClose?: boolean;
    advanceOnClose?: boolean;
    onClose?: () => void;
    onAfterClose?: () => void;
    onBlocked?: (userId: string) => void;
    onUnblocked?: (userId: string) => void;
    onFavoriteChanged?: (userId: string, favorited: boolean) => void;
};

const SCREEN_WIDTH = Dimensions.get('window').width;

export function UserProfileView({
    userId,
    initialProfile,
    mode = 'inline',
    showClose = true,
    advanceOnClose = false,
    onClose,
    onAfterClose,
    onBlocked,
    onUnblocked,
    onFavoriteChanged,
}: UserProfileViewProps) {
    const { isDark } = useTheme();
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
    const gallery = normalizeGallery(profile);
    const photos = gallery.map(imageUrl).filter(Boolean);
    const privateGallery = (profile?.privacy || 'public') === 'private';
    const verified = isVerifiedProfile(profile);
    const activeMembership = isMembershipActive(profile);
    const location = formatProfileLocation(profile, true);
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
        Alert.alert(
            t('block_user', 'Block user'),
            t('block_user_confirm', 'Are you sure you want to block this user?'),
            [
                { text: t('cancel', 'Cancel'), style: 'cancel' },
                {
                    text: t('block', 'Block'),
                    style: 'destructive',
                    onPress: async () => {
                        const res = await usersService.block(id);
                        if (res.success) {
                            onBlocked?.(id);
                            close();
                            setTimeout(() => {
                                toast.show(t('blocked', 'User has been blocked.'), 'success', 2500);
                            }, 360);
                        } else {
                            toast.show(apiMessage(res.message), 'error');
                        }
                    },
                },
            ],
        );
    };

    const unblockUser = async () => {
        if (!id) return;
        const res = await usersService.unblock(id);
        if (res.success) {
            onUnblocked?.(id);
            close();
            setTimeout(() => {
                toast.show(t('unblocked', 'User has been unblocked.'), 'success', 2500);
            }, 360);
        } else {
            toast.show(apiMessage(res.message), 'error');
        }
    };

    const facts = useMemo(() => buildFacts(profile), [profile]);
    const partnerPreference = profile?.partner_preference || profile?.partnerPreference || {};
    const partnerAbout = cleanProfileMultilineText(partnerPreference?.about_partner);
    const partnerFacts = useMemo(() => buildPartnerFacts(partnerPreference), [partnerPreference]);
    const showPartnerPreference = Boolean(partnerAbout || partnerFacts.length);

    if (loading) {
        return (
            <View style={[styles.center, { backgroundColor: isDark ? '#0F172A' : '#F8FAFC' }]}>
                <ActivityIndicator color="#F34B6F" />
            </View>
        );
    }

    if (error || !profile || blocked) {
        return (
            <View style={[styles.center, { backgroundColor: isDark ? '#0F172A' : '#F8FAFC', padding: scale(24) }]}>
                <Text variant="h3" align="center">
                    {blocked ? t('you_blocked_this_user', 'You have blocked this user') : error || t('profile_unavailable', 'Profile unavailable')}
                </Text>
                {blocked ? (
                    <Pressable onPress={unblockUser} style={[styles.closeError, { borderColor: '#F34B6F', backgroundColor: '#F34B6F' }]}>
                        <Text style={{ color: '#FFFFFF', fontWeight: '700' }}>{t('unblock', 'Unblock')}</Text>
                    </Pressable>
                ) : null}
                {showClose ? (
                    <Pressable onPress={close} style={[styles.closeError, { borderColor: isDark ? '#334155' : '#E2E8F0' }]}>
                        <Text>{t('close', 'Close')}</Text>
                    </Pressable>
                ) : null}
            </View>
        );
    }

    return (
        <View style={{ flex: 1, backgroundColor: isDark ? '#0F172A' : '#F8FAFC' }}>
            <View
                style={[
                    styles.header,
                    {
                        paddingTop: headerTopInset,
                        minHeight: headerTopInset + headerRowHeight,
                        backgroundColor: isDark ? '#0F172A' : '#FFFFFF',
                        borderBottomColor: isDark ? '#334155' : '#E2E8F0',
                    },
                ]}
            >
                {showClose ? (
                    <Pressable onPress={close} style={styles.headerButton} hitSlop={10}>
                        <ChevronLeft size={scale(23)} color={isDark ? '#E2E8F0' : '#1F2A24'} />
                    </Pressable>
                ) : <View style={styles.headerButton} />}
                <Text variant="body" className="font-body-semi" numberOfLines={1} style={[styles.headerTitle, { textAlign: isRTL ? 'right' : 'left' }]}>
                    {headerTitle}
                </Text>
                <Pressable onPress={toggleFavorite} style={styles.headerButton} hitSlop={10}>
                    <Bookmark size={scale(21)} color={profile?.is_favorited ? '#F34B6F' : isDark ? '#E2E8F0' : '#1F2A24'} fill={profile?.is_favorited ? '#F34B6F' : 'transparent'} />
                </Pressable>
                <Pressable onPress={startMessage} style={styles.headerButton} hitSlop={10}>
                    {messageChecking ? <ActivityIndicator size="small" color="#F34B6F" /> : <MessageCircle size={scale(21)} color={isDark ? '#E2E8F0' : '#1F2A24'} />}
                </Pressable>
                <Pressable onPress={() => setProfileMenuOpen(true)} style={styles.headerButton} hitSlop={10}>
                    <MoreVertical size={scale(21)} color={isDark ? '#E2E8F0' : '#1F2A24'} />
                </Pressable>
            </View>

            <ScrollView
                showsVerticalScrollIndicator={false}
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
                                <Quote size={scale(24)} color="rgba(243,75,111,0.28)" style={styles.quoteIcon} />
                                <Text variant="body" style={styles.bioText}>{bio}</Text>
                            </View>
                        ) : null}
                    </Section>
                ) : null}

                <SectionFacts title={t('religious_beliefs', 'Faith & Values')} facts={facts.faith} isDark={isDark} isRTL={isRTL} />
                <SectionFacts title={t('marriage_future_plans', 'Marriage / Future plans')} facts={facts.marriage} isDark={isDark} isRTL={isRTL} />
                <ChipSection title={t('faith_in_daily_life', 'Faith in Daily Life')} items={(profile?.faith_in_daily_life || []).map(displayText)} isDark={isDark} isRTL={isRTL} />
                <SectionFacts title={t('education_career', 'Education & Career')} facts={facts.career} isDark={isDark} isRTL={isRTL} />
                <SectionFacts title={t('background', 'Background')} facts={facts.background} isDark={isDark} isRTL={isRTL} />
                <SectionFacts title={t('appearance', 'Appearance')} facts={facts.appearance} isDark={isDark} isRTL={isRTL} />
                <SectionFacts title={t('lifestyle', 'Lifestyle')} facts={facts.lifestyle} isDark={isDark} isRTL={isRTL} />
                <ChipSection title={t('hobbies', 'Hobbies')} items={(profile?.hobbies || []).map(displayText)} isDark={isDark} isRTL={isRTL} />
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
                <View style={[styles.profileFooterActionWrap, { borderTopColor: isDark ? '#334155' : '#E2E8F0' }]}>
                    <Pressable onPress={reportProfile} style={({ pressed }) => [styles.reportProfileButton, pressed && styles.profileMenuItemPressed]}>
                        <Flag size={scale(18)} color="#EF4444" strokeWidth={2.4} />
                        <Text variant="body-sm" className="font-body-semi" style={styles.reportProfileText}>
                            {t('report_profile', 'Report profile')}
                        </Text>
                    </Pressable>
                </View>
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
        </View>
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
    const colors = {
        card: isDark ? '#111827' : '#FFFFFF',
        border: isDark ? '#334155' : '#E2E8F0',
        text: isDark ? '#E2E8F0' : '#1F2A24',
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
                        <ProfileMenuItem icon={Flag} label={t('report_profile', 'Report profile')} color={colors.text} danger onPress={onReport} />
                        <ProfileMenuItem icon={Ban} label={t('block_user', 'Block user')} color={colors.text} danger onPress={onBlock} />
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
    danger,
    onPress,
}: {
    icon: LucideIcon;
    label: string;
    color: string;
    danger?: boolean;
    onPress: () => void;
}) {
    const tint = danger ? '#EF4444' : color;
    return (
        <Pressable onPress={onPress} style={({ pressed }) => [styles.profileMenuItem, pressed && styles.profileMenuItemPressed]}>
            <View style={styles.profileMenuItemRow}>
                <View style={styles.profileMenuIcon}>
                    <Icon size={scale(18)} color={tint} strokeWidth={2.4} />
                </View>
                <Text variant="body-sm" numberOfLines={1} className="font-body-semi" style={[styles.profileMenuLabel, { color: tint }]}>
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
                            backgroundColor: isDark ? '#111827' : '#FFFFFF',
                            borderColor: isDark ? '#334155' : '#E2E8F0',
                            paddingBottom: Math.max(insets.bottom + scale(12), scale(22)),
                            maxHeight: maxSheetHeight,
                        },
                    ]}
                >
                    <View style={styles.messageSheetHeader}>
                        <Text variant="body-sm" className="font-body-bold" style={{ color: isDark ? '#F8FAFC' : '#1F2A24' }}>
                            {title}
                        </Text>
                        <Pressable onPress={onClose} disabled={sending} style={styles.messageSheetClose} hitSlop={10}>
                            <X size={scale(20)} color={isDark ? '#CBD5E1' : '#1F2A24'} />
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
                            placeholderTextColor={isDark ? '#64748B' : '#94A3B8'}
                            multiline
                            textAlignVertical="top"
                            scrollEnabled
                            style={[
                                styles.messageInput,
                                {
                                    color: isDark ? '#F8FAFC' : '#1F2A24',
                                    backgroundColor: isDark ? '#0F172A' : '#F8FAFC',
                                    borderColor: isDark ? '#334155' : '#E2E8F0',
                                    textAlign: isRTL ? 'right' : 'left',
                                },
                            ]}
                        />
                        <View style={styles.messageMetaRow}>
                            <Text variant="caption" style={{ color: isDark ? '#94A3B8' : '#64748B', flex: 1 }}>
                                {hint}
                            </Text>
                            <Text variant="caption" className="font-body-semi" style={{ color: value.length > 450 ? '#F34B6F' : isDark ? '#94A3B8' : '#64748B' }}>
                                {value.length}/500
                            </Text>
                        </View>
                        <Pressable disabled={sending || !value.trim()} onPress={onSend} style={[styles.messageSendButton, (!value.trim() || sending) && styles.messageSendDisabled]}>
                            {sending ? <ActivityIndicator color="#FFFFFF" /> : <Text variant="body-sm" className="font-body-bold" style={{ color: '#FFFFFF' }}>{t('send', 'Send')}</Text>}
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
    verified: boolean;
    activeMembership: boolean;
    onOpenPhoto: (index: number) => void;
    isDark: boolean;
}) {
    const slots = [0, 1, 2].map((index) => photos[index] || '');
    const slideWidth = Math.round(SCREEN_WIDTH * 0.68);

    return (
        <View style={[styles.gallery, { backgroundColor: isDark ? '#111827' : '#FFFFFF' }]}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} snapToInterval={slideWidth} decelerationRate="fast">
                {slots.map((src, index) => (
                    <Pressable
                        key={`${src}-${index}`}
                        disabled={!src || privateGallery}
                        onPress={() => onOpenPhoto(index)}
                        style={[styles.gallerySlide, { width: slideWidth, backgroundColor: isDark ? '#1E293B' : '#E2E8F0' }]}
                    >
                        <Image source={src ? { uri: src } : PROFILE_PLACEHOLDER_IMAGE} style={StyleSheet.absoluteFill} contentFit="cover" blurRadius={privateGallery ? 18 : 0} />
                        {privateGallery && (
                            <View style={styles.privateOverlay}>
                                <Lock size={scale(22)} color="#FFFFFF" />
                                <Text variant="caption" style={{ color: '#FFFFFF' }}>{t('gallery_isprivate', 'Gallery is private')}</Text>
                            </View>
                        )}
                    </Pressable>
                ))}
            </ScrollView>
            <LinearGradient colors={['rgba(15,23,42,0.02)', 'rgba(15,23,42,0.72)']} style={styles.galleryGradient} pointerEvents="none" />
            <View style={styles.photoCount}>
                <Text variant="caption" style={{ color: '#FFFFFF' }}>{photos.length || 0}</Text>
            </View>
            <View style={styles.galleryIdentity} pointerEvents="none">
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: scale(8), flexWrap: 'wrap' }}>
                    <Text variant="h2" numberOfLines={2} style={{ color: '#FFFFFF', fontSize: scale(23), lineHeight: scale(28), flexShrink: 1 }}>
                        {name}{age ? `, ${age}` : ''}
                    </Text>
                    {verified ? <ShieldCheck size={scale(22)} color="#FFFFFF" fill="#3D63F3" /> : null}
                    {activeMembership ? <View style={styles.membershipBadge}><Text variant="caption" style={{ color: '#FFFFFF' }}>M</Text></View> : null}
                </View>
                {location ? <Text variant="body-sm" style={{ color: '#FFFFFF', marginTop: scale(5) }}>{location}</Text> : null}
            </View>
        </View>
    );
}

function SectionFacts({ title, facts, isDark, isRTL }: { title: string; facts: Fact[]; isDark: boolean; isRTL: boolean }) {
    if (!facts.length) return null;
    return (
        <Section title={title} isDark={isDark}>
            <FactRows facts={facts} isRTL={isRTL} />
        </Section>
    );
}

function FactRows({ facts, isRTL }: { facts: Fact[]; isRTL: boolean }) {
    if (!facts.length) return null;
    return (
        <View style={{ gap: scale(14) }}>
            {facts.map((fact) => {
                const Icon = fact.icon;
                return (
                    <View key={`${fact.label}-${fact.value}`} style={[styles.factRow, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
                        <View style={styles.factIcon}>
                            <Icon size={scale(18)} color="#F34B6F" />
                        </View>
                        <View style={{ flex: 1 }}>
                            <Text variant="caption" className="font-body-semi" style={[styles.factLabel, { textAlign: isRTL ? 'right' : 'left' }]}>{fact.label}</Text>
                            <Text variant="body" className="font-body-semi" style={{ textAlign: isRTL ? 'right' : 'left' }}>{fact.value}</Text>
                        </View>
                    </View>
                );
            })}
        </View>
    );
}

function ChipSection({ title, items, isDark, isRTL }: { title: string; items: string[]; isDark: boolean; isRTL: boolean }) {
    const clean = items.filter(Boolean);
    if (!clean.length) return null;
    return (
        <Section title={title} isDark={isDark}>
            <View style={[styles.chipWrap, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
                {clean.map((item) => (
                    <View key={item} style={[styles.chip, { backgroundColor: isDark ? '#1E293B' : '#F8FAFC', borderColor: isDark ? '#334155' : '#E2E8F0' }]}>
                        <Text variant="body-sm" className="font-body-semi">{item}</Text>
                    </View>
                ))}
            </View>
        </Section>
    );
}

function Section({ title, children, isDark }: { title: string; children: React.ReactNode; isDark: boolean }) {
    return (
        <View style={[styles.section, { backgroundColor: isDark ? '#111827' : '#FFFFFF', borderTopColor: isDark ? '#334155' : '#E2E8F0' }]}>
            <Text variant="caption" className="font-body-semi" style={styles.sectionTitle}>{title}</Text>
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
                        <X size={scale(23)} color="#FFFFFF" />
                    </Pressable>
                    {hasMultiple ? (
                        <Text variant="body-sm" className="font-body-semi" style={{ color: '#FFFFFF' }}>
                            {current + 1}/{photos.length}
                        </Text>
                    ) : <View />}
                    <Pressable onPress={onReport} style={styles.lightboxIconButton} hitSlop={10}>
                        <Flag size={scale(21)} color="#FFFFFF" />
                    </Pressable>
                </View>
                {src ? <Image source={{ uri: src }} style={styles.lightboxImage} contentFit="contain" /> : null}
                {hasMultiple ? (
                    <>
                        <Pressable onPress={goPrevious} style={[styles.lightboxNav, styles.lightboxNavLeft]} hitSlop={12}>
                            <ChevronLeft size={scale(28)} color="#FFFFFF" />
                        </Pressable>
                        <Pressable onPress={goNext} style={[styles.lightboxNav, styles.lightboxNavRight]} hitSlop={12}>
                            <ChevronRight size={scale(28)} color="#FFFFFF" />
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
    const list = (values: any[]) => listText((values || []).map((value) => {
        if (typeof value === 'object') return displayText(value?.label || value?.name || value?.value);
        return displayText(value);
    }));
    const countryList = (values: any[]) => listText((values || []).map((value) => {
        if (typeof value === 'object') return translateCountry(value?.label || value?.name || value?.value || value?.country);
        return translateCountry(value);
    }));
    const heightFrom = partnerPreference?.height?.from?.label || partnerPreference?.height_from?.label || partnerPreference?.height_from;
    const heightTo = partnerPreference?.height?.to?.label || partnerPreference?.height_to?.label || partnerPreference?.height_to;
    const ageFrom = partnerPreference?.age?.from || partnerPreference?.age_from;
    const ageTo = partnerPreference?.age?.to || partnerPreference?.age_to;

    return compact([
        heightFrom && heightTo ? { icon: Ruler, label: t('preferred_height', 'Preferred height'), value: `${heightFrom} - ${heightTo}` } : null,
        ageFrom && ageTo ? { icon: CalendarHeart, label: t('preferred_age', 'Preferred age'), value: `${ageFrom} - ${ageTo}` } : null,
        { icon: Users, label: t('preferred_marital_status', 'Preferred marital status'), value: displayText(partnerPreference?.marital_status) },
        { icon: Languages, label: t('preferred_languages', 'Preferred languages'), value: list(partnerPreference?.mother_tongue || partnerPreference?.languages || []) },
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
        paddingHorizontal: scale(8),
    },
    headerButton: { width: scale(38), height: scale(38), alignItems: 'center', justifyContent: 'center' },
    headerTitle: { flex: 1, fontSize: scale(16), lineHeight: scale(20) },
    content: { paddingHorizontal: 0, paddingTop: 0 },
    gallery: { overflow: 'hidden', minHeight: scale(342), marginBottom: 0 },
    gallerySlide: { aspectRatio: 3 / 4, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
    galleryGradient: { position: 'absolute', left: 0, right: 0, bottom: 0, height: '55%' },
    privateOverlay: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center', gap: scale(6), backgroundColor: 'rgba(15,23,42,0.22)' },
    photoCount: { position: 'absolute', right: scale(14), top: scale(14), minWidth: scale(28), height: scale(28), borderRadius: scale(14), backgroundColor: 'rgba(15,23,42,0.62)', alignItems: 'center', justifyContent: 'center', paddingHorizontal: scale(8) },
    galleryIdentity: { position: 'absolute', left: scale(18), right: scale(18), bottom: scale(18) },
    membershipBadge: { width: scale(22), height: scale(22), borderRadius: scale(11), backgroundColor: '#F34B6F', alignItems: 'center', justifyContent: 'center' },
    section: {
        borderTopWidth: 1,
        paddingHorizontal: scale(18),
        paddingVertical: scale(20),
    },
    sectionTitle: { textTransform: 'uppercase', letterSpacing: 2, color: '#1F2A24', marginBottom: scale(14), fontSize: scale(13) },
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
    profileFooterActionWrap: {
        borderTopWidth: 1,
        paddingHorizontal: scale(18),
        paddingTop: scale(18),
        paddingBottom: scale(34),
    },
    reportProfileButton: {
        minHeight: scale(44),
        alignSelf: 'flex-start',
        flexDirection: 'row',
        alignItems: 'center',
        gap: scale(10),
        paddingVertical: scale(8),
    },
    reportProfileText: { color: '#EF4444' },
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
        gap: scale(10),
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
    },
    profileMenuItemPressed: {
        backgroundColor: 'rgba(148,163,184,0.12)',
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
