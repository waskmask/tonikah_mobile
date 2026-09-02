import React, { useCallback, useRef, useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { Text } from '@/components/ui/Text';
import { AppBackTitleBar } from '@/components/app/AppBackTitleBar';
import { TextModerationWarningModal } from '@/components/app/TextModerationWarningModal';
import { UnderReviewPill } from '@/components/app/UnderReviewPill';
import { GradientButton } from '@/components/ui/GradientButton';
import { useTheme } from '@/hooks/useTheme';
import { useColors } from '@/hooks/useColors';
import { useLanguage } from '@/hooks/useLanguage';
import { scale } from '@/hooks/useResponsive';
import { Typography } from '@/constants/typography';
import { apiMessage, t } from '@/lib/profileDisplay';
import { profileService } from '@/lib/profileService';
import { useAuthStore } from '@/store/authStore';
import { useEmailVerificationGuard } from '@/hooks/useEmailVerificationGuard';
import { useToast } from '@/hooks/useToast';
import { getTextDirection, localeTextDirection } from '@/lib/textDirection';
import {
    getTextModerationWarning,
    moderationCandidateForEditing,
    pendingModerationCandidate,
    TextModerationWarning,
} from '@/lib/textModeration';

export default function PartnerPreferenceScreen() {
    const { isDark } = useTheme();
    const colors = useColors();
    const primary = colors.chrome.primary;
    const { currentLanguage } = useLanguage();
    const { user, refreshUser } = useAuthStore();
    const { requireVerified } = useEmailVerificationGuard();
    const toast = useToast();
    const [about, setAbout] = useState('');
    const aboutDirection = getTextDirection(about, localeTextDirection(currentLanguage));
    const [ageFrom, setAgeFrom] = useState('');
    const [ageTo, setAgeTo] = useState('');
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [moderationWarning, setModerationWarning] = useState<TextModerationWarning | null>(null);
    const aboutInputRef = useRef<TextInput>(null);
    const initialLoadRef = useRef(true);

    const aboutModerationMeta = user?.profile?.contentModeration?.partnerPreferenceAboutPartner;
    const aboutPendingReview = Boolean(pendingModerationCandidate(aboutModerationMeta));

    const loadPreference = useCallback(async () => {
            if (initialLoadRef.current) setLoading(true);
            await refreshUser().catch(() => undefined);
            const res = await profileService.fetchPartnerPreference();
            const pref = res.partner_preference || {};
            // The owner keeps editing their pending/rejected candidate, not the
            // old approved text other users still see.
            const candidate = moderationCandidateForEditing(
                useAuthStore.getState().user?.profile?.contentModeration?.partnerPreferenceAboutPartner,
            );
            setAbout(candidate || pref.about_partner || '');
            setAgeFrom(pref.age?.from ? String(pref.age.from) : '');
            setAgeTo(pref.age?.to ? String(pref.age.to) : '');
            setLoading(false);
            initialLoadRef.current = false;
    }, [refreshUser]);

    useFocusEffect(
        useCallback(() => {
            void loadPreference();
        }, [loadPreference]),
    );

    const save = async (submitAnyway = false) => {
        if (!requireVerified('save')) return;
        setSaving(true);
        try {
            const payload = {
                about_partner: about.trim(),
                age: {
                    from: ageFrom ? Number(ageFrom) : null,
                    to: ageTo ? Number(ageTo) : null,
                },
                clientLocale: currentLanguage,
                ...(submitAnyway ? { submitAnyway: true } : {}),
            };
            const res = await profileService.savePartnerPreference(payload);
            if (res.success) {
                setModerationWarning(null);
                await refreshUser();
                const savedForReview = Boolean(
                    pendingModerationCandidate(
                        useAuthStore.getState().user?.profile?.contentModeration
                            ?.partnerPreferenceAboutPartner,
                    ),
                );
                toast.show(
                    submitAnyway || savedForReview
                        ? t('moderation_submit_anyway_success', 'Submitted for review.')
                        : t('partner_preference_updated', 'Partner preference updated successfully.'),
                    'success',
                    3000,
                );
            } else {
                const warning = getTextModerationWarning(res);
                if (warning) {
                    setModerationWarning(warning);
                } else {
                    Alert.alert(t('error', 'Error'), apiMessage(res.message));
                }
            }
        } catch {
            toast.show(t('something_went_wrong', 'Something went wrong.'), 'error');
        } finally {
            setSaving(false);
        }
    };

    if (loading) return <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.brand.bg.surface }}><ActivityIndicator color={primary} /></View>;

    return (
        <View style={{ flex: 1, backgroundColor: colors.brand.bg.surface }}>
            <AppBackTitleBar title={t('partner_preference', 'Partner Preference')} />
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingHorizontal: scale(14), paddingTop: scale(18), paddingBottom: scale(120) }}>
            <Field
                label={t('about_partner', 'About partner')}
                labelAccessory={aboutPendingReview ? <UnderReviewPill /> : null}
                value={about}
                onChangeText={setAbout}
                multiline
                isDark={isDark}
                textDirection={aboutDirection}
                inputRef={aboutInputRef}
            />
            <View style={{ flexDirection: 'row', gap: scale(10) }}>
                <Field label={t('preferred_age', 'Preferred age')} value={ageFrom} onChangeText={setAgeFrom} keyboardType="number-pad" isDark={isDark} style={{ flex: 1 }} />
                <Field label={t('to', 'To')} value={ageTo} onChangeText={setAgeTo} keyboardType="number-pad" isDark={isDark} style={{ flex: 1 }} />
            </View>
            <GradientButton title={t('save', 'Save')} onPress={() => void save()} loading={saving} disabled={saving} widthMode="full" containerStyle={{ marginTop: scale(20) }} />
        </ScrollView>

        <TextModerationWarningModal
            warning={moderationWarning}
            submitting={saving}
            onEdit={() => {
                setModerationWarning(null);
                setTimeout(() => aboutInputRef.current?.focus(), 150);
            }}
            onClose={() => setModerationWarning(null)}
            onSubmitAnyway={() => void save(true)}
        />
        </View>
    );
}

function Field({ label, labelAccessory, isDark, style, textDirection, inputRef, ...props }: any) {
    const { currentLanguage } = useLanguage();
    const inputFontFamily = currentLanguage === 'ar' ? Typography.font.arabic.regular : Typography.font.body.regular;

    return (
        <View style={[{ marginTop: scale(16) }, style]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: scale(8), marginBottom: scale(6) }}>
                <Text variant="body-sm">{label}</Text>
                {labelAccessory}
            </View>
            <TextInput
                ref={inputRef}
                {...props}
                placeholderTextColor={isDark ? '#7D7266' : '#A99C8D'}
                style={[
                    styles.input,
                    props.multiline && styles.textArea,
                    {
                        color: isDark ? '#E8E1D6' : '#201B15',
                        backgroundColor: isDark ? '#1B1713' : '#FFFFFF',
                        borderColor: isDark ? '#3A332B' : '#E8E1D6',
                        fontFamily: inputFontFamily,
                        ...(textDirection
                            ? {
                                textAlign: textDirection === 'rtl' ? 'right' : 'left',
                                writingDirection: textDirection,
                            }
                            : {}),
                    },
                ]}
                textAlignVertical={props.multiline ? 'top' : 'center'}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    input: { minHeight: scale(50), borderWidth: 1, borderRadius: scale(12), paddingHorizontal: scale(14), fontSize: scale(14) },
    textArea: { minHeight: scale(160), paddingTop: scale(12) },
});
