import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { Text } from '@/components/ui/Text';
import { AppBackTitleBar } from '@/components/app/AppBackTitleBar';
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

export default function PartnerPreferenceScreen() {
    const { isDark } = useTheme();
    const colors = useColors();
    const primary = colors.chrome.primary;
    const { refreshUser } = useAuthStore();
    const { requireVerified } = useEmailVerificationGuard();
    const toast = useToast();
    const [about, setAbout] = useState('');
    const [ageFrom, setAgeFrom] = useState('');
    const [ageTo, setAgeTo] = useState('');
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        (async () => {
            const res = await profileService.fetchPartnerPreference();
            const pref = res.partner_preference || {};
            setAbout(pref.about_partner || '');
            setAgeFrom(pref.age?.from ? String(pref.age.from) : '');
            setAgeTo(pref.age?.to ? String(pref.age.to) : '');
            setLoading(false);
        })();
    }, []);

    const save = async () => {
        if (!requireVerified('save')) return;
        setSaving(true);
        const payload = {
            about_partner: about.trim(),
            age: {
                from: ageFrom ? Number(ageFrom) : null,
                to: ageTo ? Number(ageTo) : null,
            },
        };
        const res = await profileService.savePartnerPreference(payload);
        if (res.success) {
            await refreshUser();
            toast.show(t('partner_preference_updated', 'Partner preference updated successfully.'), 'success', 3000);
        } else {
            Alert.alert(t('error', 'Error'), apiMessage(res.message));
        }
        setSaving(false);
    };

    if (loading) return <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.brand.bg.surface }}><ActivityIndicator color={primary} /></View>;

    return (
        <View style={{ flex: 1, backgroundColor: colors.brand.bg.surface }}>
            <AppBackTitleBar title={t('partner_preference', 'Partner Preference')} />
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingHorizontal: scale(14), paddingTop: scale(18), paddingBottom: scale(120) }}>
            <Field label={t('about_partner', 'About partner')} value={about} onChangeText={setAbout} multiline isDark={isDark} />
            <View style={{ flexDirection: 'row', gap: scale(10) }}>
                <Field label={t('preferred_age', 'Preferred age')} value={ageFrom} onChangeText={setAgeFrom} keyboardType="number-pad" isDark={isDark} style={{ flex: 1 }} />
                <Field label={t('to', 'To')} value={ageTo} onChangeText={setAgeTo} keyboardType="number-pad" isDark={isDark} style={{ flex: 1 }} />
            </View>
            <GradientButton title={t('save', 'Save')} onPress={save} loading={saving} disabled={saving} widthMode="full" containerStyle={{ marginTop: scale(20) }} />
        </ScrollView>
        </View>
    );
}

function Field({ label, isDark, style, ...props }: any) {
    const { currentLanguage } = useLanguage();
    const inputFontFamily = currentLanguage === 'ar' ? Typography.font.arabic.regular : Typography.font.body.regular;

    return (
        <View style={[{ marginTop: scale(16) }, style]}>
            <Text variant="body-sm" style={{ marginBottom: scale(6) }}>{label}</Text>
            <TextInput
                {...props}
                placeholderTextColor={isDark ? '#7D7266' : '#A99C8D'}
                style={[styles.input, props.multiline && styles.textArea, { color: isDark ? '#E8E1D6' : '#201B15', backgroundColor: isDark ? '#1B1713' : '#FFFFFF', borderColor: isDark ? '#3A332B' : '#E8E1D6', fontFamily: inputFontFamily }]}
                textAlignVertical={props.multiline ? 'top' : 'center'}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    input: { minHeight: scale(50), borderWidth: 1, borderRadius: scale(12), paddingHorizontal: scale(14), fontSize: scale(14) },
    textArea: { minHeight: scale(160), paddingTop: scale(12) },
});
