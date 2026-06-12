import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
    ActivityIndicator,
    Pressable,
    RefreshControl,
    ScrollView,
    StyleSheet,
    View,
} from 'react-native';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import {
    BriefcaseBusiness,
    CalendarHeart,
    Cigarette,
    Edit3,
    GraduationCap,
    Heart,
    Home,
    Languages,
    Lock,
    MapPin,
    Moon,
    Ruler,
    ShieldCheck,
    Sparkles,
    UserRound,
    Users,
    Wine,
} from 'lucide-react-native';
import type { LucideIcon } from 'lucide-react-native';
import i18n from '@/lib/i18n';
import { Text } from '@/components/ui/Text';
import { useLanguage } from '@/hooks/useLanguage';
import { useTheme } from '@/hooks/useTheme';
import { scale } from '@/hooks/useResponsive';
import { profileService } from '@/lib/profileService';
import { galleryService, GalleryItem, GalleryPrivacy } from '@/lib/galleryService';
import { useAuthStore } from '@/store/authStore';
import { PROFILE_PLACEHOLDER_IMAGE } from '@/lib/profileAssets';

type Fact = {
    label: string;
    value: string;
    icon: LucideIcon;
};

type ProfileData = Record<string, any>;

function tr(key: string, fallback?: string, options?: Record<string, any>) {
    const value = i18n.t(key, { defaultValue: fallback || key, ...options });
    return typeof value === 'string' ? value : fallback || key;
}

function toKey(value: string) {
    return value
        .trim()
        .toLowerCase()
        .replace(/&/g, 'and')
        .replace(/[^a-z0-9]+/g, '_')
        .replace(/^_+|_+$/g, '');
}

function displayText(value?: string | null) {
    const raw = String(value || '').trim();
    if (!raw) return '';
    const key = toKey(raw);
    if (i18n.exists(key)) return tr(key, raw);
    return raw.replace(/_/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase());
}

function translateCountry(value?: string | null) {
    const raw = String(value || '').trim();
    if (!raw) return '';
    const lower = raw.toLowerCase();
    const upper = raw.toUpperCase();
    if (i18n.exists(lower, { ns: 'countries' })) return i18n.t(lower, { ns: 'countries' });
    if (i18n.exists(upper, { ns: 'countries' })) return i18n.t(upper, { ns: 'countries' });
    return displayText(raw);
}

function translateSelect(value?: any) {
    const label = String(value?.label || '').trim();
    if (!label) return '';
    if (/\d/.test(label)) return label;
    return displayText(label);
}

function formatList(values: Array<string | undefined | null>) {
    const items = values.filter((value): value is string => Boolean(value && value.trim()));
    return items.join(', ');
}

function calculateAge(dob?: string | Date) {
    if (!dob) return null;
    const date = new Date(dob);
    if (Number.isNaN(date.getTime())) return null;
    const now = new Date();
    let age = now.getFullYear() - date.getFullYear();
    const monthDiff = now.getMonth() - date.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && now.getDate() < date.getDate())) age -= 1;
    return age >= 0 ? age : null;
}

function cleanText(value?: string | null) {
    return String(value || '')
        .replace(/<[^>]+>/g, ' ')
        .replace(/&nbsp;/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

function cleanMultilineText(value?: string | null) {
    return String(value || '')
        .replace(/<\s*br\s*\/?\s*>/gi, '\n')
        .replace(/<\/\s*(p|div|li)\s*>/gi, '\n')
        .replace(/<[^>]+>/g, ' ')
        .replace(/&nbsp;/g, ' ')
        .replace(/\r\n?/g, '\n')
        .split('\n')
        .map((line) => line.replace(/[^\S\n]+/g, ' ').trim())
        .join('\n')
        .replace(/\n{3,}/g, '\n\n')
        .trim();
}

function normalizeGallery(items: GalleryItem[]) {
    return [...items].sort((a, b) => {
        if (a.isPrimary && !b.isPrimary) return -1;
        if (!a.isPrimary && b.isPrimary) return 1;
        return (a.sort_index ?? 0) - (b.sort_index ?? 0);
    });
}

function galleryUrl(item?: GalleryItem | null) {
    return item?.urls?.avatar || item?.urls?.small || item?.urls?.thumb || item?.urls?.original || item?.urls?.blur || item?.url || '';
}

function compactFacts(facts: Array<Fact | null | false | undefined>) {
    return facts.filter((fact): fact is Fact => Boolean(fact && fact.value && fact.value.trim()));
}

function formatLocation(location?: any) {
    if (!location) return '';
    const place = [location.city, location.state].filter(Boolean).join(', ');
    const country = translateCountry(location.country);
    return [place, country].filter(Boolean).join(' - ');
}

function formatIncome(profile: ProfileData) {
    const amount = profile.annual_income?.amount;
    const currency = profile.annual_income?.currency;
    if (!amount) return '';
    return currency ? `${amount} ${currency}` : String(amount);
}

function hasPartnerPreference(pref?: any) {
    return Boolean(
        pref?.about_partner ||
        pref?.height?.from?.label ||
        pref?.height?.to?.label ||
        pref?.age?.from ||
        pref?.age?.to ||
        pref?.marital_status ||
        pref?.mother_tongue ||
        pref?.location ||
        pref?.education
    );
}

export default function ProfileScreen() {
    const { isRTL } = useLanguage();
    const { isDark } = useTheme();
    const { user, setUser } = useAuthStore();
    const [profile, setProfile] = useState<ProfileData>(() => user?.profile || {});
    const [gallery, setGallery] = useState<GalleryItem[]>([]);
    const [privacy, setPrivacy] = useState<GalleryPrivacy>('public');
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    const loadProfile = useCallback(async () => {
        const [meRes, galleryRes] = await Promise.all([
            profileService.fetchMe(),
            galleryService.fetchMe(),
        ]);

        if (meRes.success && meRes.user) {
            setUser(meRes.user);
            setProfile(meRes.user.profile || {});
        }

        if (galleryRes.privacy) setPrivacy(galleryRes.privacy);
        if (Array.isArray(galleryRes.gallery)) setGallery(normalizeGallery(galleryRes.gallery));
    }, [setUser]);

    useEffect(() => {
        (async () => {
            setLoading(true);
            await loadProfile();
            setLoading(false);
        })();
    }, [loadProfile]);

    const refresh = async () => {
        setRefreshing(true);
        await loadProfile();
        setRefreshing(false);
    };

    const age = calculateAge(profile.dob);
    const location = formatLocation(profile.current_location);
    const headline = cleanText(profile.profile_headline);
    const bio = cleanMultilineText(profile.bio);
    const isEmailVerified = Boolean(user?.email_verified ?? user?.emailVerified);
    const isProfileVerified = Boolean(user?.verified_account?.id && user?.verified_account?.age && user?.verified_account?.selfie);
    const partnerPreference = profile.partner_preference || {};

    const facts = useMemo(() => {
        const faithFacts = compactFacts([
            { icon: Moon, label: tr('sect', 'Sect'), value: translateSelect(profile.sect) },
            { icon: ShieldCheck, label: tr('maslak', 'Maslak'), value: translateSelect(profile.maslak) },
            { icon: Sparkles, label: tr('following', 'Following'), value: translateSelect(profile.following) },
            { icon: Heart, label: tr('is_practising', 'Practising'), value: displayText(profile.is_practising) },
            { icon: CalendarHeart, label: tr('prayers_label', 'Prayers'), value: displayText(profile.prayers) },
        ]);

        const marriageFacts = compactFacts([
            { icon: Users, label: tr('marital_status', 'Marital status'), value: displayText(profile.marital_status) },
            { icon: Users, label: tr('have_children_label', 'Has children'), value: displayText(profile.have_children) },
            { icon: Heart, label: tr('wants_children_label', 'Wants children'), value: displayText(profile.wants_children) },
            { icon: CalendarHeart, label: tr('marriage_plan_label', 'Marriage plan'), value: displayText(profile.marriage_plan) },
            { icon: MapPin, label: tr('relocation_label', 'Relocation plans'), value: displayText(profile.relocation_plans) },
        ]);

        const careerFacts = compactFacts([
            { icon: GraduationCap, label: tr('education_label', 'Education'), value: translateSelect(profile.education) },
            { icon: BriefcaseBusiness, label: tr('occupation_label', 'Occupation'), value: translateSelect(profile.designation) },
            { icon: BriefcaseBusiness, label: tr('company', 'Company'), value: String(profile.company || '') },
            { icon: BriefcaseBusiness, label: tr('annual_income', 'Annual income'), value: formatIncome(profile) },
        ]);

        const backgroundFacts = compactFacts([
            { icon: ShieldCheck, label: tr('nationality_label', 'Nationality'), value: formatList((profile.nationality || []).map(translateCountry)) },
            { icon: Home, label: tr('grew_up_label', 'Grew up in'), value: translateCountry(profile.grew_up_in) },
            { icon: Languages, label: tr('mother_tongue_label', 'Mother tongue'), value: displayText(profile.mother_tongue) },
            { icon: Languages, label: tr('languages_label', 'Languages'), value: formatList((profile.languages_spoken || []).map(displayText)) },
            { icon: ShieldCheck, label: tr('born_muslim_label', 'Born Muslim'), value: displayText(profile.born_muslim) },
            { icon: UserRound, label: tr('profile_manager', 'Profile manager'), value: displayText(profile.profile_manager) },
        ]);

        const appearanceFacts = compactFacts([
            { icon: Ruler, label: tr('height_label', 'Height'), value: translateSelect(profile.height) },
            { icon: UserRound, label: tr('ethnic_group', 'Ethnic group'), value: displayText(profile.ethnic_group) },
            { icon: UserRound, label: tr('i_usually_dress', 'I usually dress'), value: displayText(profile.i_usually_dress) },
        ]);

        const lifestyleFacts = compactFacts([
            { icon: Cigarette, label: tr('smoking_label', 'Smoking'), value: displayText(profile.smoking) },
            { icon: Wine, label: tr('alcohol_label', 'Alcohol'), value: displayText(profile.alcohol) },
        ]);

        return { faithFacts, marriageFacts, careerFacts, backgroundFacts, appearanceFacts, lifestyleFacts };
    }, [profile]);

    const partnerFacts = compactFacts([
        partnerPreference.height?.from?.label && partnerPreference.height?.to?.label
            ? {
                icon: Ruler,
                label: tr('preferred_height', 'Preferred height'),
                value: `${partnerPreference.height.from.label} - ${partnerPreference.height.to.label}`,
            }
            : null,
        partnerPreference.age?.from && partnerPreference.age?.to
            ? {
                icon: CalendarHeart,
                label: tr('preferred_age', 'Preferred age'),
                value: `${partnerPreference.age.from} - ${partnerPreference.age.to}`,
            }
            : null,
        { icon: Users, label: tr('preferred_marital_status', 'Preferred marital status'), value: displayText(partnerPreference.marital_status) },
        { icon: Languages, label: tr('preferred_languages', 'Preferred languages'), value: formatList((partnerPreference.mother_tongue || []).map(displayText)) },
        { icon: MapPin, label: tr('location', 'Location'), value: formatList((partnerPreference.location || []).map(translateCountry)) },
    ]);

    const sectionDirection = { flexDirection: isRTL ? 'row-reverse' : 'row' } as const;

    if (loading) {
        return (
            <View style={[styles.center, { backgroundColor: isDark ? '#0F172A' : '#F8FAFC' }]}>
                <ActivityIndicator size="large" color="#F34B6F" />
            </View>
        );
    }

    return (
        <ScrollView
            style={{ flex: 1, backgroundColor: isDark ? '#0F172A' : '#F8FAFC' }}
            contentContainerStyle={{ paddingHorizontal: scale(14), paddingTop: scale(18), paddingBottom: scale(120) }}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor="#F34B6F" />}
            showsVerticalScrollIndicator={false}
        >
            <View style={styles.hero}>
                <View style={styles.galleryMain}>
                    <Image source={galleryUrl(gallery[0]) ? { uri: galleryUrl(gallery[0]) } : PROFILE_PLACEHOLDER_IMAGE} style={StyleSheet.absoluteFill} contentFit="cover" />
                    {privacy === 'private' && (
                        <View style={[styles.privacyBadge, sectionDirection]}>
                            <Lock size={scale(14)} color="#FFFFFF" />
                            <Text variant="caption" style={{ color: '#FFFFFF' }}>
                                {tr('gallery_privacy_notice', 'Your gallery is set to private')}
                            </Text>
                        </View>
                    )}
                </View>

                <View style={[styles.galleryStrip, sectionDirection]}>
                    {[0, 1, 2].map((index) => {
                        const url = galleryUrl(gallery[index]);
                        return (
                            <View key={index} style={[styles.thumb, { backgroundColor: isDark ? '#1E293B' : '#E2E8F0' }]}>
                                <Image source={url ? { uri: url } : PROFILE_PLACEHOLDER_IMAGE} style={StyleSheet.absoluteFill} contentFit="cover" />
                            </View>
                        );
                    })}
                </View>
            </View>

            <View style={[styles.identityRow, sectionDirection]}>
                <View style={{ flex: 1 }}>
                    <Text variant="h2" style={{ textAlign: isRTL ? 'right' : 'left' }}>
                        {profile.profileName || tr('not_set', 'Not set')}
                        {age ? `, ${age}` : ''}
                    </Text>
                    {location ? (
                        <Text variant="body-sm" style={{ color: isDark ? '#94A3B8' : '#64748B', textAlign: isRTL ? 'right' : 'left' }}>
                            {location}
                        </Text>
                    ) : null}
                </View>
                {isProfileVerified && (
                    <View style={styles.verifiedBadge}>
                        <ShieldCheck size={scale(17)} color="#FFFFFF" />
                    </View>
                )}
            </View>

            {!isEmailVerified && (
                <Notice
                    title={tr('email_not_verified', 'Your email is not verified yet.')}
                    body={tr('verify_email_browse_limit_message', 'Verify your email to continue exploring more matches.')}
                    action={tr('verify_email', 'Verify Email-address Now')}
                    onPress={() => router.push({ pathname: '/(auth)/verify-email', params: { email: user?.email || '' } })}
                    isDark={isDark}
                    isRTL={isRTL}
                />
            )}

            <Section title={tr('about_me', 'About me')} actionLabel={tr('edit', 'Edit')} onAction={() => router.push('/(tabs)/edit-profile')} isDark={isDark} isRTL={isRTL}>
                {headline ? (
                    <Text variant="h3" style={{ fontSize: scale(20), marginBottom: scale(8), textAlign: isRTL ? 'right' : 'left' }}>
                        {headline}
                    </Text>
                ) : null}
                {bio ? (
                    <Text variant="body" style={{ lineHeight: scale(24), textAlign: isRTL ? 'right' : 'left' }}>
                        {bio}
                    </Text>
                ) : (
                    <EmptyText title={tr('tell_your_story', 'Tell your story')} hint={tr('bio_empty_hint', 'Share what makes you unique to attract better matches')} isDark={isDark} />
                )}
            </Section>

            <Section title={tr('faith_values', 'Faith & Values')} actionLabel={tr('edit', 'Edit')} onAction={() => router.push('/(tabs)/faith')} isDark={isDark} isRTL={isRTL}>
                <FactList facts={facts.faithFacts} isDark={isDark} isRTL={isRTL} />
            </Section>

            <Section title={tr('marriage_future_plans', 'Marriage / Future plans')} actionLabel={tr('edit', 'Edit')} onAction={() => router.push('/(tabs)/edit-profile')} isDark={isDark} isRTL={isRTL}>
                <FactList facts={facts.marriageFacts} isDark={isDark} isRTL={isRTL} />
            </Section>

            <Section title={tr('career', 'Career')} actionLabel={tr('edit', 'Edit')} onAction={() => router.push('/(tabs)/edit-profile')} isDark={isDark} isRTL={isRTL}>
                <FactList facts={facts.careerFacts} isDark={isDark} isRTL={isRTL} />
            </Section>

            <Section title={tr('background', 'Background')} actionLabel={tr('edit', 'Edit')} onAction={() => router.push('/(tabs)/edit-profile')} isDark={isDark} isRTL={isRTL}>
                <FactList facts={facts.backgroundFacts} isDark={isDark} isRTL={isRTL} />
            </Section>

            <Section title={tr('appearance', 'Appearance')} actionLabel={tr('edit', 'Edit')} onAction={() => router.push('/(tabs)/edit-profile')} isDark={isDark} isRTL={isRTL}>
                <FactList facts={facts.appearanceFacts} isDark={isDark} isRTL={isRTL} />
            </Section>

            <Section title={tr('lifestyle', 'Lifestyle')} actionLabel={tr('edit', 'Edit')} onAction={() => router.push('/(tabs)/edit-profile')} isDark={isDark} isRTL={isRTL}>
                <FactList facts={facts.lifestyleFacts} isDark={isDark} isRTL={isRTL} />
            </Section>

            <Section title={tr('hobbies', 'Hobbies')} actionLabel={tr('edit', 'Edit')} onAction={() => router.push('/(tabs)/my-hobbies')} isDark={isDark} isRTL={isRTL}>
                {Array.isArray(profile.hobbies) && profile.hobbies.length ? (
                    <ChipList items={profile.hobbies.map((item: any) => displayText(typeof item === 'string' ? item : item?.label))} isDark={isDark} isRTL={isRTL} />
                ) : (
                    <EmptyText title={tr('click_add_hobbies', 'Add hobbies')} isDark={isDark} />
                )}
            </Section>

            <Section title={tr('partner_preference', 'Partner Preference')} actionLabel={tr('edit', 'Edit')} onAction={() => router.push('/(tabs)/partner-preference')} isDark={isDark} isRTL={isRTL}>
                {hasPartnerPreference(partnerPreference) ? (
                    <>
                        {cleanMultilineText(partnerPreference.about_partner) ? (
                            <Text variant="body" style={{ marginBottom: scale(12), lineHeight: scale(24), textAlign: isRTL ? 'right' : 'left' }}>
                                {cleanMultilineText(partnerPreference.about_partner)}
                            </Text>
                        ) : null}
                        <FactList facts={partnerFacts} isDark={isDark} isRTL={isRTL} />
                    </>
                ) : (
                    <EmptyText title={tr('add_partner_pref', 'Add partner preference')} isDark={isDark} />
                )}
            </Section>
        </ScrollView>
    );
}

function Section({
    title,
    actionLabel,
    onAction,
    children,
    isDark,
    isRTL,
}: {
    title: string;
    actionLabel: string;
    onAction: () => void;
    children: React.ReactNode;
    isDark: boolean;
    isRTL: boolean;
}) {
    return (
        <View style={[styles.section, { backgroundColor: isDark ? '#111827' : '#FFFFFF', borderColor: isDark ? '#334155' : '#E2E8F0' }]}>
            <View style={[styles.sectionHeader, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
                <Text variant="h3" style={{ flex: 1, fontSize: scale(20), textAlign: isRTL ? 'right' : 'left' }}>
                    {title}
                </Text>
                <Pressable onPress={onAction} style={[styles.editButton, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
                    <Edit3 size={scale(14)} color="#F34B6F" />
                    <Text variant="caption" style={{ color: '#F34B6F' }}>
                        {actionLabel}
                    </Text>
                </Pressable>
            </View>
            {children}
        </View>
    );
}

function FactList({ facts, isDark, isRTL }: { facts: Fact[]; isDark: boolean; isRTL: boolean }) {
    if (!facts.length) return <EmptyText title={tr('not_set', 'Not set')} isDark={isDark} />;

    return (
        <View style={{ gap: scale(10) }}>
            {facts.map((fact) => {
                const Icon = fact.icon;
                return (
                    <View key={`${fact.label}-${fact.value}`} style={[styles.factRow, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
                        <View style={[styles.factIcon, { backgroundColor: isDark ? '#1E293B' : '#F8FAFC' }]}>
                            <Icon size={scale(17)} color={isDark ? '#CBD5E1' : '#475569'} />
                        </View>
                        <View style={{ flex: 1 }}>
                            <Text variant="caption" style={{ color: isDark ? '#94A3B8' : '#64748B', textAlign: isRTL ? 'right' : 'left' }}>
                                {fact.label}
                            </Text>
                            <Text variant="body" style={{ textAlign: isRTL ? 'right' : 'left' }}>
                                {fact.value}
                            </Text>
                        </View>
                    </View>
                );
            })}
        </View>
    );
}

function ChipList({ items, isDark, isRTL }: { items: string[]; isDark: boolean; isRTL: boolean }) {
    return (
        <View style={[styles.chipWrap, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
            {items.filter(Boolean).map((item) => (
                <View key={item} style={[styles.chip, { backgroundColor: isDark ? '#1E293B' : '#F8FAFC', borderColor: isDark ? '#334155' : '#E2E8F0' }]}>
                    <Text variant="body-sm">{item}</Text>
                </View>
            ))}
        </View>
    );
}

function EmptyText({ title, hint, isDark }: { title: string; hint?: string; isDark: boolean }) {
    return (
        <View style={[styles.emptyBox, { backgroundColor: isDark ? '#1E293B' : '#F8FAFC' }]}>
            <Text variant="body" align="center">
                {title}
            </Text>
            {hint ? (
                <Text variant="caption" align="center" style={{ color: isDark ? '#94A3B8' : '#64748B', marginTop: scale(4) }}>
                    {hint}
                </Text>
            ) : null}
        </View>
    );
}

function Notice({
    title,
    body,
    action,
    onPress,
    isDark,
    isRTL,
}: {
    title: string;
    body: string;
    action: string;
    onPress: () => void;
    isDark: boolean;
    isRTL: boolean;
}) {
    return (
        <View style={[styles.notice, { backgroundColor: isDark ? '#451A1A' : '#FFF1F2', borderColor: isDark ? '#7F1D1D' : '#FECDD3' }]}>
            <Text variant="body" className="font-body-semi" style={{ color: isDark ? '#FDA4AF' : '#BE123C', textAlign: isRTL ? 'right' : 'left' }}>
                {title}
            </Text>
            <Text variant="body-sm" style={{ color: isDark ? '#FECACA' : '#9F1239', marginTop: scale(4), textAlign: isRTL ? 'right' : 'left' }}>
                {body}
            </Text>
            <Pressable onPress={onPress} style={{ marginTop: scale(10), alignSelf: isRTL ? 'flex-end' : 'flex-start' }}>
                <Text variant="body-sm" className="font-body-semi" style={{ color: '#F34B6F' }}>
                    {action}
                </Text>
            </Pressable>
        </View>
    );
}

const styles = StyleSheet.create({
    center: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
    },
    hero: {
        gap: scale(10),
    },
    galleryMain: {
        height: scale(390),
        borderRadius: scale(18),
        overflow: 'hidden',
        backgroundColor: '#E2E8F0',
    },
    emptyHero: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
    },
    privacyBadge: {
        position: 'absolute',
        left: scale(12),
        bottom: scale(12),
        alignItems: 'center',
        gap: scale(6),
        borderRadius: scale(999),
        paddingHorizontal: scale(10),
        paddingVertical: scale(7),
        backgroundColor: 'rgba(15,23,42,0.74)',
    },
    galleryStrip: {
        gap: scale(8),
    },
    thumb: {
        flex: 1,
        aspectRatio: 3 / 4,
        borderRadius: scale(10),
        overflow: 'hidden',
    },
    identityRow: {
        alignItems: 'center',
        gap: scale(12),
        marginTop: scale(18),
        marginBottom: scale(12),
    },
    verifiedBadge: {
        width: scale(34),
        height: scale(34),
        borderRadius: scale(17),
        backgroundColor: '#059669',
        alignItems: 'center',
        justifyContent: 'center',
    },
    notice: {
        borderWidth: 1,
        borderRadius: scale(14),
        padding: scale(14),
        marginBottom: scale(14),
    },
    section: {
        borderWidth: 1,
        borderRadius: scale(16),
        padding: scale(16),
        marginBottom: scale(14),
    },
    sectionHeader: {
        alignItems: 'center',
        gap: scale(12),
        marginBottom: scale(12),
    },
    editButton: {
        alignItems: 'center',
        gap: scale(5),
        paddingHorizontal: scale(10),
        paddingVertical: scale(6),
    },
    factRow: {
        alignItems: 'center',
        gap: scale(12),
    },
    factIcon: {
        width: scale(36),
        height: scale(36),
        borderRadius: scale(12),
        alignItems: 'center',
        justifyContent: 'center',
    },
    emptyBox: {
        borderRadius: scale(12),
        padding: scale(14),
    },
    chipWrap: {
        flexWrap: 'wrap',
        gap: scale(8),
    },
    chip: {
        borderWidth: 1,
        borderRadius: scale(999),
        paddingHorizontal: scale(12),
        paddingVertical: scale(7),
    },
});
