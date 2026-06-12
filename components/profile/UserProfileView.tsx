import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Dimensions,
    Modal,
    Pressable,
    ScrollView,
    StyleSheet,
    View,
} from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import {
    Baby,
    BriefcaseBusiness,
    Building2,
    CalendarHeart,
    ChevronLeft,
    Cigarette,
    Coins,
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
} from 'lucide-react-native';
import type { LucideIcon } from 'lucide-react-native';
import { Text } from '@/components/ui/Text';
import { useEmailVerificationGuard } from '@/hooks/useEmailVerificationGuard';
import { useLanguage } from '@/hooks/useLanguage';
import { scale, wp } from '@/hooks/useResponsive';
import { useTheme } from '@/hooks/useTheme';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { usersService } from '@/lib/usersService';
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

export type UserProfileViewProps = {
    userId?: string;
    initialProfile?: any;
    mode?: 'inline' | 'screen' | 'modal';
    showClose?: boolean;
    advanceOnClose?: boolean;
    onClose?: () => void;
    onAfterClose?: () => void;
    onBlocked?: (userId: string) => void;
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
    onFavoriteChanged,
}: UserProfileViewProps) {
    const { isDark } = useTheme();
    const { isRTL } = useLanguage();
    const { requireVerified } = useEmailVerificationGuard();
    const insets = useSafeAreaInsets();
    const headerTopInset = insets.top;
    const [profile, setProfile] = useState<any>(initialProfile || null);
    const [loading, setLoading] = useState(Boolean(userId));
    const [error, setError] = useState('');
    const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

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

    const id = profileId(profile) || resolvedUserId || '';
    const name = profileName(profile) || t('profile', 'Profile');
    const age = profileAge(profile);
    const title = `${name}${age ? `, ${age}` : ''}`;
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

    const startMessage = () => {
        if (!id || !requireVerified('chat')) return;
        router.push({ pathname: '/conversation/new', params: { recipientId: id, name } } as any);
    };

    const toggleFavorite = async () => {
        if (!id || !requireVerified('profileActions')) return;
        const favorited = Boolean(profile?.is_favorited);
        const res = favorited ? await usersService.unfavorite(id) : await usersService.favorite(id);
        if (res.success) {
            setProfile((current: any) => ({ ...current, is_favorited: !favorited }));
            onFavoriteChanged?.(id, !favorited);
        } else {
            Alert.alert(t('error', 'Error'), apiMessage(res.message));
        }
    };

    const blockUser = () => {
        if (!id || !requireVerified('report')) return;
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
                        } else {
                            Alert.alert(t('error', 'Error'), apiMessage(res.message));
                        }
                    },
                },
            ],
        );
    };

    const openMenu = () => {
        Alert.alert(title, t('profile_actions', 'Profile actions'), [
            { text: t('report_profile', 'Report profile'), onPress: () => router.push('/support' as any) },
            { text: t('block_user', 'Block user'), style: 'destructive', onPress: blockUser },
            { text: t('cancel', 'Cancel'), style: 'cancel' },
        ]);
    };

    const facts = useMemo(() => buildFacts(profile), [profile]);

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
                        minHeight: headerTopInset + scale(48),
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
                    {title}
                </Text>
                <Pressable onPress={toggleFavorite} style={styles.headerButton} hitSlop={10}>
                    <Heart size={scale(21)} color={profile?.is_favorited ? '#F34B6F' : isDark ? '#E2E8F0' : '#1F2A24'} fill={profile?.is_favorited ? '#F34B6F' : 'transparent'} />
                </Pressable>
                <Pressable onPress={startMessage} style={styles.headerButton} hitSlop={10}>
                    <MessageCircle size={scale(21)} color={isDark ? '#E2E8F0' : '#1F2A24'} />
                </Pressable>
                <Pressable onPress={openMenu} style={styles.headerButton} hitSlop={10}>
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
            </ScrollView>

            <ImageLightbox
                photos={photos}
                index={lightboxIndex}
                onClose={() => setLightboxIndex(null)}
            />
        </View>
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
                    <Text variant="h2" style={{ color: '#FFFFFF', fontSize: scale(26), lineHeight: scale(31) }}>
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
            <View style={{ gap: scale(14) }}>
                {facts.map((fact) => {
                    const Icon = fact.icon;
                    return (
                        <View key={`${title}-${fact.label}-${fact.value}`} style={[styles.factRow, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
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
        </Section>
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
        <View style={[styles.section, { backgroundColor: isDark ? '#111827' : '#FFFFFF', borderColor: isDark ? '#334155' : '#E2E8F0' }]}>
            <Text variant="caption" className="font-body-semi" style={styles.sectionTitle}>{title}</Text>
            {children}
        </View>
    );
}

function ImageLightbox({ photos, index, onClose }: { photos: string[]; index: number | null; onClose: () => void }) {
    const [current, setCurrent] = useState(0);
    useEffect(() => {
        if (index !== null) setCurrent(index);
    }, [index]);
    const src = index !== null ? photos[current] : '';
    return (
        <Modal visible={index !== null} transparent animationType="fade" onRequestClose={onClose}>
            <View style={styles.lightbox}>
                <Pressable onPress={onClose} style={styles.lightboxClose}><X size={scale(24)} color="#FFFFFF" /></Pressable>
                {src ? <Image source={{ uri: src }} style={styles.lightboxImage} contentFit="contain" /> : null}
                {photos.length > 1 ? (
                    <View style={styles.lightboxFooter}>
                        <Pressable onPress={() => setCurrent((value) => Math.max(0, value - 1))} style={styles.lightboxButton}>
                            <Text style={{ color: '#FFFFFF' }}>{t('previous', 'Previous')}</Text>
                        </Pressable>
                        <Text style={{ color: '#FFFFFF' }}>{current + 1}/{photos.length}</Text>
                        <Pressable onPress={() => setCurrent((value) => Math.min(photos.length - 1, value + 1))} style={styles.lightboxButton}>
                            <Text style={{ color: '#FFFFFF' }}>{t('next', 'Next')}</Text>
                        </Pressable>
                    </View>
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

const styles = StyleSheet.create({
    center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    closeError: { marginTop: scale(18), borderWidth: 1, borderRadius: scale(999), paddingHorizontal: scale(18), paddingVertical: scale(10) },
    header: {
        borderBottomWidth: 1,
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: scale(8),
    },
    headerButton: { width: scale(40), height: scale(40), alignItems: 'center', justifyContent: 'center' },
    headerTitle: { flex: 1, fontSize: scale(17) },
    content: { paddingHorizontal: scale(14), paddingTop: scale(12) },
    gallery: { borderRadius: scale(8), overflow: 'hidden', minHeight: scale(342), marginBottom: scale(14) },
    gallerySlide: { aspectRatio: 3 / 4, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
    galleryGradient: { position: 'absolute', left: 0, right: 0, bottom: 0, height: '55%' },
    privateOverlay: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center', gap: scale(6), backgroundColor: 'rgba(15,23,42,0.22)' },
    photoCount: { position: 'absolute', right: scale(14), top: scale(14), minWidth: scale(28), height: scale(28), borderRadius: scale(14), backgroundColor: 'rgba(15,23,42,0.62)', alignItems: 'center', justifyContent: 'center', paddingHorizontal: scale(8) },
    galleryIdentity: { position: 'absolute', left: scale(18), right: scale(18), bottom: scale(18) },
    membershipBadge: { width: scale(22), height: scale(22), borderRadius: scale(11), backgroundColor: '#F34B6F', alignItems: 'center', justifyContent: 'center' },
    section: { borderWidth: 1, borderRadius: scale(8), padding: scale(18), marginBottom: scale(14), shadowColor: '#0F172A', shadowOpacity: 0.04, shadowRadius: scale(10), shadowOffset: { width: 0, height: 2 }, elevation: 1 },
    sectionTitle: { textTransform: 'uppercase', letterSpacing: 2, color: '#1F2A24', marginBottom: scale(14), fontSize: scale(13) },
    headline: { fontSize: scale(20), lineHeight: scale(25), marginBottom: scale(10) },
    bioBox: { borderLeftWidth: 4, borderLeftColor: '#F34B6F', backgroundColor: 'rgba(243,75,111,0.04)', borderRadius: scale(8), padding: scale(14) },
    quoteIcon: { position: 'absolute', right: scale(12), top: scale(10) },
    bioText: { lineHeight: scale(25), fontStyle: 'italic' },
    factRow: { alignItems: 'flex-start', gap: scale(12) },
    factIcon: { width: scale(40), height: scale(40), borderRadius: scale(20), backgroundColor: 'rgba(243,75,111,0.08)', alignItems: 'center', justifyContent: 'center' },
    factLabel: { color: '#7A8480', textTransform: 'uppercase', letterSpacing: 1.2, marginBottom: scale(3) },
    chipWrap: { flexWrap: 'wrap', gap: scale(8) },
    chip: { borderWidth: 1, borderRadius: scale(999), paddingHorizontal: scale(12), paddingVertical: scale(8) },
    lightbox: { flex: 1, backgroundColor: '#000000', alignItems: 'center', justifyContent: 'center' },
    lightboxClose: { position: 'absolute', right: scale(18), top: scale(52), zIndex: 2, width: scale(42), height: scale(42), borderRadius: scale(21), backgroundColor: 'rgba(255,255,255,0.14)', alignItems: 'center', justifyContent: 'center' },
    lightboxImage: { width: wp(100), height: '82%' },
    lightboxFooter: { position: 'absolute', left: 0, right: 0, bottom: scale(28), flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: scale(22) },
    lightboxButton: { borderWidth: 1, borderColor: 'rgba(255,255,255,0.24)', borderRadius: scale(999), paddingHorizontal: scale(14), paddingVertical: scale(8) },
});
