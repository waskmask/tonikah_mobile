import React, { useState } from 'react';
import { View, ScrollView, KeyboardAvoidingView, Platform, Alert, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Text } from '@/components/ui/Text';
import { GradientButton } from '@/components/ui/GradientButton';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { SingleSelectSheet, SelectOption } from '@/components/ui/SingleSelectSheet';
import { FieldLabel, ErrorText, SelectField } from '@/components/ui/FormField';
import { useTheme } from '@/hooks/useTheme';
import { scale } from '@/hooks/useResponsive';
import { profileService } from '@/lib/profileService';
import { useProfileSetupStore } from '@/store/profileSetupStore';
import { Heart, Baby, Calendar, MapPinned, Users } from 'lucide-react-native';

export default function Step3() {
    const { t } = useTranslation('common');
    const { isDark } = useTheme();
    const { setProfileData } = useProfileSetupStore();
    const iconColor = isDark ? '#94A3B8' : '#6B7280';

    const [maritalStatus, setMaritalStatus] = useState('');
    const [hasChildren, setHasChildren] = useState('');
    const [wantsChildren, setWantsChildren] = useState('');
    const [marriagePlan, setMarriagePlan] = useState('');
    const [relocationPlan, setRelocationPlan] = useState('');

    const [loading, setLoading] = useState(false);
    const [activeSheet, setActiveSheet] = useState<string | null>(null);
    const [errors, setErrors] = useState<Record<string, string>>({});

    const maritalOptions: SelectOption[] = [
        { value: 'never_married', label: t('step_3.never_married') },
        { value: 'divorced', label: t('step_3.divorced') },
        { value: 'separated', label: t('step_3.separated') },
        { value: 'widowed', label: t('step_3.widowed', { defaultValue: 'Widowed' }) },
        { value: 'annulled', label: t('step_3.annulled') },
        { value: 'married', label: t('step_3.married') },
    ];

    const childrenOptions: SelectOption[] = [
        { value: 'no_children', label: t('step_3.no_children') },
        { value: 'has_children', label: t('step_3.has_children') },
    ];

    const wantsChildrenOptions: SelectOption[] = [
        { value: 'wants_children', label: t('step_3.wants_children') },
        { value: 'does_not_want_children', label: t('step_3.does_not_want_children') },
        { value: 'open_to_have_children', label: t('step_3.open_to_have_children') },
        { value: 'no_preference', label: t('step_3.no_preference') },
    ];

    const marriagePlanOptions: SelectOption[] = [
        { value: 'as_soon_possible', label: t('step_3.as_soon_possible') },
        { value: 'three_to_six_months', label: t('step_3.three_to_six_months') },
        { value: 'six_months_to_one_year', label: t('step_3.six_months_to_one_year') },
    ];

    const relocationOptions: SelectOption[] = [
        { value: 'open_to_relocate', label: t('step_3.open_to_relocate') },
        { value: 'not_open_to_relocate', label: t('step_3.not_open_to_relocate') },
        { value: 'not_sure_yet', label: t('step_3.not_sure_yet') },
    ];

    const fields = [
        { key: 'maritalStatus', label: t('step_3.marital_status'), value: maritalStatus, options: maritalOptions, sheet: 'marital', icon: <Heart size={scale(18)} color={iconColor} /> },
        { key: 'hasChildren', label: t('step_3.has_children_label'), value: hasChildren, options: childrenOptions, sheet: 'children', icon: <Baby size={scale(18)} color={iconColor} /> },
        { key: 'wantsChildren', label: t('step_3.wants_children_label'), value: wantsChildren, options: wantsChildrenOptions, sheet: 'wantsChildren', icon: <Baby size={scale(18)} color={iconColor} /> },
        { key: 'marriagePlan', label: t('step_3.whats_marriage_plan'), value: marriagePlan, options: marriagePlanOptions, sheet: 'marriagePlan', icon: <Calendar size={scale(18)} color={iconColor} /> },
        { key: 'relocationPlan', label: t('step_3.relocation_label'), value: relocationPlan, options: relocationOptions, sheet: 'relocation', icon: <MapPinned size={scale(18)} color={iconColor} /> },
    ];

    const setters: Record<string, (v: string) => void> = {
        maritalStatus: setMaritalStatus,
        hasChildren: setHasChildren,
        wantsChildren: setWantsChildren,
        marriagePlan: setMarriagePlan,
        relocationPlan: setRelocationPlan,
    };

    const validate = (): boolean => {
        const e: Record<string, string> = {};
        if (!maritalStatus) e.maritalStatus = 'Required';
        if (!hasChildren) e.hasChildren = 'Required';
        if (!wantsChildren) e.wantsChildren = 'Required';
        if (!marriagePlan) e.marriagePlan = 'Required';
        if (!relocationPlan) e.relocationPlan = 'Required';
        setErrors(e);
        return Object.keys(e).length === 0;
    };

    const handleSubmit = async () => {
        if (!validate()) return;
        setLoading(true);
        try {
            const payload = { maritalStatus, hasChildren, wantsChildren, marriagePlan, relocationPlan };
            const res = await profileService.updateProfile(payload);
            if (res.success) {
                setProfileData(payload);
                router.push('/(profile-setup)/step4');
            } else {
                Alert.alert('Error', res.message || 'Failed to update profile');
            }
        } catch {
            Alert.alert('Error', 'Something went wrong');
        } finally {
            setLoading(false);
        }
    };

    return (
        <SafeAreaView className="flex-1 bg-white dark:bg-slate-900">
            <ProgressBar currentStep={3} />
            <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
                <ScrollView contentContainerStyle={{ padding: scale(20), paddingBottom: scale(100) }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
                    <Text variant="heading" className="font-heading mb-1" align="center">{t('step_3.title')}</Text>
                    <Text variant="body-sm" className="mb-4" align="center" style={{ color: isDark ? '#94A3B8' : '#6B7280' }}>{t('step_3.subtitle')}</Text>

                    {fields.map((field) => (
                        <View key={field.key}>
                            <FieldLabel text={field.label} required />
                            <SelectField
                                value={field.value ? field.options.find((o) => o.value === field.value)?.label || '' : ''}
                                placeholder="Select"
                                onPress={() => setActiveSheet(field.sheet)}
                                icon={field.icon}
                                hasError={!!errors[field.key]}
                            />
                            {errors[field.key] && <ErrorText text={errors[field.key]} />}
                        </View>
                    ))}
                </ScrollView>
            </KeyboardAvoidingView>

            <View style={styles.footer}><GradientButton title={t('common.continue')} onPress={handleSubmit} loading={loading} disabled={loading} /></View>

            {fields.map((field) => (
                <SingleSelectSheet key={field.sheet} visible={activeSheet === field.sheet} onClose={() => setActiveSheet(null)} onSelect={(v) => { setters[field.key](v); setErrors((e) => ({ ...e, [field.key]: '' })); }} options={field.options} selected={field.value} title={field.label} />
            ))}
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({ footer: { padding: scale(20), paddingBottom: scale(10) } });
