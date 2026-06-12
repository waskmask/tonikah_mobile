import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import { Text } from '@/components/ui/Text';
import { GradientButton } from '@/components/ui/GradientButton';
import { useTheme } from '@/hooks/useTheme';
import { useLanguage } from '@/hooks/useLanguage';
import { scale } from '@/hooks/useResponsive';
import { Typography } from '@/constants/typography';
import { apiMessage, cleanProfileMultilineText, cleanProfileText, t } from '@/lib/profileDisplay';
import { profileService } from '@/lib/profileService';
import { useAuthStore } from '@/store/authStore';
import { useEmailVerificationGuard } from '@/hooks/useEmailVerificationGuard';
import { BIO_MAX, COMPANY_MAX, HEADLINE_MAX, cleanHeadlineTextForSave, cleanProfileTextForSave, countNonSpace, isAllowedProfileText, normalizeProfileText, trimToNonSpaceLimit } from '@/lib/profileValidation';

export default function EditProfileScreen() {
    const { isDark } = useTheme();
    const { refreshUser } = useAuthStore();
    const { requireVerified } = useEmailVerificationGuard();
    const [headline, setHeadline] = useState('');
    const [bio, setBio] = useState('');
    const [company, setCompany] = useState('');
    const [errors, setErrors] = useState<Record<string, string>>({});
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        (async () => {
            const res = await profileService.fetchMe();
            const profile = res.user?.profile || {};
            setHeadline(cleanProfileText(profile.profile_headline));
            setBio(cleanProfileMultilineText(profile.bio));
            setCompany(profile.company || '');
            setLoading(false);
        })();
    }, []);

    const save = async () => {
        if (!requireVerified('save')) return;
        const nextErrors: Record<string, string> = {};
        const cleanedHeadline = cleanHeadlineTextForSave(headline);
        const cleanedBio = cleanProfileTextForSave(bio);
        const cleanedCompany = company.trim();

        if (countNonSpace(cleanedHeadline) > HEADLINE_MAX) {
            nextErrors.headline = t('headline_too_long', 'Max 80 characters.');
        } else if (cleanedHeadline && !isAllowedProfileText(cleanedHeadline)) {
            nextErrors.headline = t('headline_invalid_chars', 'Headline can only contain letters, numbers, spaces and basic punctuation.');
        }
        if (countNonSpace(cleanedBio) > BIO_MAX) {
            nextErrors.bio = t('bio_too_long', 'Max 600 characters.');
        } else if (cleanedBio && !isAllowedProfileText(cleanedBio)) {
            nextErrors.bio = t('bio_invalid_chars', 'Bio can only contain letters, numbers, spaces and basic punctuation.');
        }
        if (cleanedCompany.length > COMPANY_MAX) {
            nextErrors.company = t('company_too_long', 'Company name must be 30 characters or less.');
        } else if (cleanedCompany && !isAllowedProfileText(cleanedCompany)) {
            nextErrors.company = t('company_invalid_chars', 'Company name can only contain letters, numbers, spaces and basic punctuation.');
        }

        setErrors(nextErrors);
        if (Object.keys(nextErrors).length) return;

        setSaving(true);
        const res = await profileService.updateProfile({
            profile_headline: cleanedHeadline,
            bio: cleanedBio,
            company: cleanedCompany,
        });
        if (res.success) {
            await refreshUser();
            Alert.alert(t('edit_profile', 'Edit profile'), t('profile_updated_success', 'Profile updated successfully.'));
        } else {
            Alert.alert(t('error', 'Error'), apiMessage(res.message));
        }
        setSaving(false);
    };

    if (loading) return <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: isDark ? '#0F172A' : '#F8FAFC' }}><ActivityIndicator color="#F34B6F" /></View>;

    return (
        <ScrollView style={{ flex: 1, backgroundColor: isDark ? '#0F172A' : '#F8FAFC' }} contentContainerStyle={{ paddingHorizontal: scale(14), paddingTop: scale(18), paddingBottom: scale(120) }}>
            <Text variant="h2">{t('edit_profile', 'Edit profile')}</Text>
            <Field
                label={t('profile_headline', 'Profile headline')}
                value={headline}
                onChangeText={(value: string) => {
                    setHeadline(trimToNonSpaceLimit(value, HEADLINE_MAX));
                    if (errors.headline) setErrors((current) => ({ ...current, headline: '' }));
                }}
                error={errors.headline}
                isDark={isDark}
            />
            <Field
                label={t('bio', 'Bio')}
                value={bio}
                onChangeText={(value: string) => {
                    setBio(trimToNonSpaceLimit(normalizeProfileText(value), BIO_MAX));
                    if (errors.bio) setErrors((current) => ({ ...current, bio: '' }));
                }}
                error={errors.bio}
                multiline
                isDark={isDark}
            />
            <Field
                label={t('company', 'Company')}
                value={company}
                onChangeText={(value: string) => {
                    setCompany(value);
                    if (errors.company) setErrors((current) => ({ ...current, company: '' }));
                }}
                error={errors.company}
                isDark={isDark}
            />
            <View style={{ gap: scale(10), marginTop: scale(18) }}>
                <NavRow label={t('hobbies', 'Hobbies')} onPress={() => router.push('/(tabs)/my-hobbies')} isDark={isDark} />
                <NavRow label={t('faith_in_daily_life', 'Faith in daily life')} onPress={() => router.push('/(tabs)/faith')} isDark={isDark} />
                <NavRow label={t('partner_preference', 'Partner Preference')} onPress={() => router.push('/(tabs)/partner-preference')} isDark={isDark} />
            </View>
            <GradientButton title={t('save', 'Save')} onPress={save} loading={saving} disabled={saving} widthMode="full" containerStyle={{ marginTop: scale(20) }} />
        </ScrollView>
    );
}

function Field({ label, isDark, error, ...props }: any) {
    const { currentLanguage } = useLanguage();
    const inputFontFamily = currentLanguage === 'ar' ? Typography.font.arabic.regular : Typography.font.body.regular;

    return (
        <View style={{ marginTop: scale(16) }}>
            <Text variant="body-sm" style={{ marginBottom: scale(6) }}>{label}</Text>
            <TextInput
                {...props}
                placeholderTextColor={isDark ? '#64748B' : '#9CA3AF'}
                style={[styles.input, props.multiline && styles.textArea, { color: isDark ? '#E2E8F0' : '#0A0D14', backgroundColor: isDark ? '#111827' : '#FFFFFF', borderColor: error ? '#EF4444' : isDark ? '#334155' : '#E2E8F0', fontFamily: inputFontFamily }]}
                textAlignVertical={props.multiline ? 'top' : 'center'}
            />
            {error ? (
                <Text variant="caption" style={{ color: '#EF4444', marginTop: scale(4) }}>
                    {error}
                </Text>
            ) : null}
        </View>
    );
}

function NavRow({ label, onPress, isDark }: { label: string; onPress: () => void; isDark: boolean }) {
    return (
        <Pressable onPress={onPress} style={{ minHeight: scale(50), justifyContent: 'center', borderRadius: scale(12), paddingHorizontal: scale(14), backgroundColor: isDark ? '#111827' : '#FFFFFF' }}>
            <Text variant="body">{label}</Text>
        </Pressable>
    );
}

const styles = StyleSheet.create({
    input: { minHeight: scale(50), borderWidth: 1, borderRadius: scale(12), paddingHorizontal: scale(14), fontSize: scale(14) },
    textArea: { minHeight: scale(160), paddingTop: scale(12) },
});
