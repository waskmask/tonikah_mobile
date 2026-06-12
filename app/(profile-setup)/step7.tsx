import React, { useState } from 'react';
import { View, ScrollView, KeyboardAvoidingView, Platform, Alert, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { GradientButton } from '@/components/ui/GradientButton';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { ProfileSetupHeader } from '@/components/ui/ProfileSetupHeader';
import { SingleSelectSheet, SelectOption } from '@/components/ui/SingleSelectSheet';
import { FieldLabel, ErrorText, SelectField } from '@/components/ui/FormField';
import { useTheme } from '@/hooks/useTheme';
import { scale } from '@/hooks/useResponsive';
import { profileService } from '@/lib/profileService';
import { useProfileSetupStore } from '@/store/profileSetupStore';
import { Cigarette, Wine } from 'lucide-react-native';

export default function Step7() {
    const { t } = useTranslation('common');
    const { isDark } = useTheme();
    const { setProfileData } = useProfileSetupStore();
    const iconColor = isDark ? '#94A3B8' : '#6B7280';

    const [smoking, setSmoking] = useState('');
    const [alcohol, setAlcohol] = useState('');

    const [loading, setLoading] = useState(false);
    const [activeSheet, setActiveSheet] = useState<string | null>(null);
    const [errors, setErrors] = useState<Record<string, string>>({});

    const smokingOptions: SelectOption[] = [
        { value: 'never_smoke', label: t('never_smoke', { defaultValue: 'Never smoke' }) },
        { value: 'quit_smoking', label: t('quit_smoking', { defaultValue: 'Quit smoking' }) },
        { value: 'occasionally_smokes', label: t('occasionally_smokes', { defaultValue: 'Occasionally smokes' }) },
        { value: 'smokes_regularly', label: t('smokes_regularly', { defaultValue: 'Smokes regularly' }) },
        { value: 'trying_to_quit', label: t('trying_to_quit', { defaultValue: 'Trying to quit' }) },
    ];

    const alcoholOptions: SelectOption[] = [
        { value: 'never_drinks', label: t('never_drinks', { defaultValue: 'Never drinks alcohol' }) },
        { value: 'drinks_alcohol', label: t('drinks_alcohol', { defaultValue: 'Drinks alcohol' }) },
        { value: 'quit_alcohol', label: t('quit_alcohol', { defaultValue: 'Quit drinking' }) },
    ];

    const validate = (): boolean => {
        const e: Record<string, string> = {};
        if (!smoking) e.smoking = t('smoking_required');
        if (!alcohol) e.alcohol = t('alcohol_required');
        setErrors(e);
        return Object.keys(e).length === 0;
    };

    const handleSubmit = async () => {
        if (!validate()) return;
        setLoading(true);
        try {
            const payload = { smoking, alcohol };
            const res = await profileService.updateProfile(payload);
            if (res.success) {
                setProfileData(payload);
                router.push('/(profile-setup)/step8');
            } else {
                Alert.alert('Error', res.message || 'Failed to update');
            }
        } catch {
            Alert.alert('Error', 'Something went wrong');
        } finally {
            setLoading(false);
        }
    };

    const getLabel = (v: string, opts: SelectOption[]) => opts.find((o) => o.value === v)?.label || '';

    return (
        <SafeAreaView className="flex-1 bg-white dark:bg-slate-900">
            <ProgressBar currentStep={7} />
            <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
                <ScrollView contentContainerStyle={{ padding: scale(20), paddingBottom: scale(100) }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
                    <ProfileSetupHeader
                        title={t('lifestyle_title', { defaultValue: 'Lifestyle & Habits' })}
                        subtitle={t('lifestyle_desc', { defaultValue: 'Help others understand your day-to-day habits and choices.' })}
                    />

                    <FieldLabel text={t('smoking')} required />
                    <SelectField value={smoking ? getLabel(smoking, smokingOptions) : ''} placeholder={t('select')} onPress={() => setActiveSheet('smoking')} icon={<Cigarette size={scale(18)} color={iconColor} />} hasError={!!errors.smoking} />
                    {errors.smoking && <ErrorText text={errors.smoking} />}

                    <FieldLabel text={t('alcohol')} required />
                    <SelectField value={alcohol ? getLabel(alcohol, alcoholOptions) : ''} placeholder={t('select')} onPress={() => setActiveSheet('alcohol')} icon={<Wine size={scale(18)} color={iconColor} />} hasError={!!errors.alcohol} />
                    {errors.alcohol && <ErrorText text={errors.alcohol} />}
                </ScrollView>
            </KeyboardAvoidingView>

            <View style={styles.footer}><GradientButton title={t('continue', { defaultValue: 'Continue' })} onPress={handleSubmit} loading={loading} disabled={loading} /></View>

            <SingleSelectSheet visible={activeSheet === 'smoking'} onClose={() => setActiveSheet(null)} onSelect={(v) => { setSmoking(v); setErrors((e) => ({ ...e, smoking: '' })); }} options={smokingOptions} selected={smoking} title={t('smoking')} />
            <SingleSelectSheet visible={activeSheet === 'alcohol'} onClose={() => setActiveSheet(null)} onSelect={(v) => { setAlcohol(v); setErrors((e) => ({ ...e, alcohol: '' })); }} options={alcoholOptions} selected={alcohol} title={t('alcohol')} />
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({ footer: { padding: scale(20), paddingBottom: scale(10) } });
