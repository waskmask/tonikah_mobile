import React, { useState, useMemo } from 'react';
import { View, ScrollView, KeyboardAvoidingView, Platform, Alert, StyleSheet } from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { GradientButton } from '@/components/ui/GradientButton';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { ProfileSetupHeader } from '@/components/ui/ProfileSetupHeader';
import { SingleSelectSheet, SelectOption } from '@/components/ui/SingleSelectSheet';
import { MultiSelectSheet } from '@/components/ui/MultiSelectSheet';
import { FieldLabel, ErrorText, SelectField } from '@/components/ui/FormField';
import { useTheme } from '@/hooks/useTheme';
import { scale } from '@/hooks/useResponsive';
import { ProfileSetupTokens } from '@/constants/uiTokens';
import { profileService } from '@/lib/profileService';
import { useProfileSetupStore } from '@/store/profileSetupStore';
import { Languages, BookOpenCheck, MessageCircle, Shirt } from 'lucide-react-native';
import { LANGUAGE_OPTIONS } from '@/constants/profileOptions';
import { formatProfileOptionLabel } from '@/lib/profileOptionLabels';
import { apiMessage } from '@/lib/profileDisplay';

export default function Step2() {
    const { t, i18n } = useTranslation(['common', 'languages']);
    const { isDark } = useTheme();
    const { gender, setProfileData } = useProfileSetupStore();

    const [motherTongue, setMotherTongue] = useState('');
    const [bornMuslim, setBornMuslim] = useState('');
    const [languagesSpoken, setLanguagesSpoken] = useState<string[]>([]);
    const [dress, setDress] = useState('');

    const [loading, setLoading] = useState(false);
    const [showMotherTongueSheet, setShowMotherTongueSheet] = useState(false);
    const [showBornMuslimSheet, setShowBornMuslimSheet] = useState(false);
    const [showLanguagesSheet, setShowLanguagesSheet] = useState(false);
    const [showDressSheet, setShowDressSheet] = useState(false);
    const [errors, setErrors] = useState<Record<string, string>>({});

    const isFemale = gender === 'female';
    const iconColor = isDark ? '#A99C8D' : '#7D7266';

    const languageOptions = useMemo(() => {
        return LANGUAGE_OPTIONS.map((key) => ({
            value: key,
            label: formatProfileOptionLabel(
                t(`languages:${key}`, { defaultValue: key.replace(/_/g, ' ') }),
                i18n.language
            ),
        })).sort((a, b) => a.label.localeCompare(b.label));
    }, [t, i18n.language]);

    const bornMuslimOptions: SelectOption[] = [
        { value: 'muslim_by_birth', label: t('common:step_2.muslim_by_birth') },
        { value: 'convert_revert', label: t('common:step_2.converted_reverted') },
    ];

    const dressOptions: SelectOption[] = [
        { value: 'hijab', label: t('common:step_2.hijab') },
        { value: 'jilbab_abaya_hijab', label: t('common:step_2.jilbab_abaya_hijab') },
        { value: 'hijab_niqab', label: t('common:step_2.hijab_niqab') },
        { value: 'modest_clothing', label: t('common:step_2.modest_clothing') },
        { value: 'western_secular', label: t('common:step_2.western_secular') },
        { value: 'no_religious_dress', label: t('common:step_2.no_religious_dress') },
    ];

    const validate = (): boolean => {
        const e: Record<string, string> = {};
        if (!motherTongue) e.motherTongue = 'Required';
        if (!bornMuslim) e.bornMuslim = 'Required';
        if (languagesSpoken.length === 0) e.languagesSpoken = 'Required';
        if (isFemale && !dress) e.dress = 'Required';
        setErrors(e);
        return Object.keys(e).length === 0;
    };

    const handleSubmit = async () => {
        if (!validate()) return;
        setLoading(true);
        try {
            const payload: any = {
                mother_tongue: motherTongue,
                born_muslim: bornMuslim,
                languages_spoken: languagesSpoken,
            };
            if (isFemale && dress) payload.i_usually_dress = dress;

            const res = await profileService.updateProfile(payload);
            if (res.success) {
                setProfileData(payload);
                router.push('/(profile-setup)/step3');
            } else {
                Alert.alert(t('error', { defaultValue: 'Error' }), apiMessage(res.message || 'server_error_default'));
            }
        } catch {
            Alert.alert(t('error', { defaultValue: 'Error' }), apiMessage('server_error_default'));
        } finally {
            setLoading(false);
        }
    };

    const getLabel = (v: string, opts: SelectOption[]) => opts.find((o) => o.value === v)?.label || '';

    return (
        <SafeAreaView className="flex-1 bg-brand-bg-primary">
            <ProgressBar currentStep={2} />
            <KeyboardAwareScrollView

                style={{ flex: 1 }}

                contentContainerStyle={ProfileSetupTokens.scrollContent}

                keyboardShouldPersistTaps="handled"

                showsVerticalScrollIndicator={false}

                bottomOffset={scale(100)}

            >
                    <ProfileSetupHeader
                        step={2}
                        title={t('common:step_2.title', { defaultValue: 'Personal and Cultural Background' })}
                        subtitle={t('common:step_2.subtitle', { defaultValue: 'Tell us more about your cultural identity, language skills, and preferences.' })}
                    />

                    <SelectField required value={motherTongue ? getLabel(motherTongue, languageOptions) : ''} placeholder={t('common:step_2.mother_tongue', { defaultValue: 'Mother Tongue' })} onPress={() => setShowMotherTongueSheet(true)} icon={<Languages size={scale(18)} color={iconColor} />} hasError={!!errors.motherTongue} />
                    {errors.motherTongue && <ErrorText text={errors.motherTongue} />}

                    <SelectField required value={bornMuslim ? getLabel(bornMuslim, bornMuslimOptions) : ''} placeholder={t('common:step_2.born_muslim', { defaultValue: 'Born Muslim?' })} onPress={() => setShowBornMuslimSheet(true)} icon={<BookOpenCheck size={scale(18)} color={iconColor} />} hasError={!!errors.bornMuslim} />
                    {errors.bornMuslim && <ErrorText text={errors.bornMuslim} />}

                    <SelectField required value={languagesSpoken.length > 0 ? languagesSpoken.map((l) => getLabel(l, languageOptions)).join(', ') : ''} placeholder={t('common:select_limit_5_languages', { defaultValue: 'Select languages (max 5)' })} onPress={() => setShowLanguagesSheet(true)} icon={<MessageCircle size={scale(18)} color={iconColor} />} hasError={!!errors.languagesSpoken} />
                    {errors.languagesSpoken && <ErrorText text={errors.languagesSpoken} />}

                    {isFemale && (
                        <>
                            <SelectField required value={dress ? getLabel(dress, dressOptions) : ''} placeholder={t('common:step_2.dress', { defaultValue: 'How Do You Usually Dress?' })} onPress={() => setShowDressSheet(true)} icon={<Shirt size={scale(18)} color={iconColor} />} hasError={!!errors.dress} />
                            {errors.dress && <ErrorText text={errors.dress} />}
                        </>
                    )}            </KeyboardAwareScrollView>

            <View style={styles.footer}><GradientButton title={t('common:continue', { defaultValue: 'Continue' })} onPress={handleSubmit} loading={loading} disabled={loading} /></View>

            <SingleSelectSheet visible={showMotherTongueSheet} onClose={() => setShowMotherTongueSheet(false)} onSelect={(v) => { setMotherTongue(v); setErrors((e) => ({ ...e, motherTongue: '' })); }} options={languageOptions} selected={motherTongue} title={t('common:step_2.mother_tongue', { defaultValue: 'Mother Tongue' })} searchEnabled />
            <SingleSelectSheet visible={showBornMuslimSheet} onClose={() => setShowBornMuslimSheet(false)} onSelect={(v) => { setBornMuslim(v); setErrors((e) => ({ ...e, bornMuslim: '' })); }} options={bornMuslimOptions} selected={bornMuslim} title={t('common:step_2.born_muslim', { defaultValue: 'Born Muslim?' })} />
            <MultiSelectSheet visible={showLanguagesSheet} onClose={() => setShowLanguagesSheet(false)} onConfirm={(v) => { setLanguagesSpoken(v); setErrors((e) => ({ ...e, languagesSpoken: '' })); }} options={languageOptions} selected={languagesSpoken} title={t('common:step_2.languages_spoken', { defaultValue: 'Languages Spoken' })} maxSelections={5} searchEnabled />
            {isFemale && <SingleSelectSheet visible={showDressSheet} onClose={() => setShowDressSheet(false)} onSelect={(v) => { setDress(v); setErrors((e) => ({ ...e, dress: '' })); }} options={dressOptions} selected={dress} title={t('common:step_2.dress', { defaultValue: 'How Do You Usually Dress?' })} />}
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({ footer: { padding: scale(20), paddingBottom: scale(10) } });
