import React, { useState, useMemo } from 'react';
import { View, ScrollView, KeyboardAvoidingView, Platform, Alert, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Text } from '@/components/ui/Text';
import { GradientButton } from '@/components/ui/GradientButton';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { SingleSelectSheet, SelectOption } from '@/components/ui/SingleSelectSheet';
import { MultiSelectSheet } from '@/components/ui/MultiSelectSheet';
import { FieldLabel, ErrorText, SelectField } from '@/components/ui/FormField';
import { useTheme } from '@/hooks/useTheme';
import { scale } from '@/hooks/useResponsive';
import { profileService } from '@/lib/profileService';
import { useProfileSetupStore } from '@/store/profileSetupStore';
import { Languages, BookOpenCheck, MessageCircle, Shirt } from 'lucide-react-native';

export default function Step2() {
    const { t } = useTranslation(['common', 'languages']);
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
    const iconColor = isDark ? '#94A3B8' : '#6B7280';

    const languageOptions = useMemo(() => {
        const keys = [
            'arabic', 'english', 'french', 'german', 'spanish', 'portuguese', 'russian', 'turkish',
            'hindi', 'urdu', 'bengali', 'punjabi', 'gujarati', 'tamil', 'telugu', 'kannada', 'malayalam',
            'marathi', 'nepali', 'assamese', 'oriya', 'sindhi', 'pashto', 'dari', 'farsi_persian',
            'kurdish', 'azerbaijani', 'kazakh', 'kyrgyz', 'tajik', 'turkmen', 'uzbek', 'uyghur',
            'indonesian', 'malay', 'javanese', 'tagalog', 'cebuano', 'ilocano', 'vietnamese', 'thai',
            'burmese', 'khmer', 'lao', 'japanese', 'korean', 'mandarin', 'cantonese', 'chinese_simplified',
            'amharic', 'tigrinya', 'somali', 'swahili', 'hausa', 'igbo', 'yoruba', 'shona', 'zulu',
            'xhosa', 'afrikaans', 'tsonga', 'lingala', 'luganda', 'bambara', 'fula', 'akan',
            'albanian', 'bosnian', 'bulgarian', 'croatian', 'czech', 'danish', 'dutch', 'estonian',
            'finnish', 'georgian', 'greek', 'hebrew', 'hungarian', 'icelandic', 'irish', 'italian',
            'latvian', 'lithuanian', 'macedonian', 'maltese', 'norwegian', 'polish', 'romanian',
            'samoan', 'serbian', 'slovakian', 'swedish', 'welsh', 'catalan', 'basque', 'gaelic_scottish',
            'belarusian', 'mongolian', 'maori', 'quechua', 'aymara', 'bislama', 'fijian', 'hiri_motu',
            'tongan', 'chechen',
        ];
        return keys.map((key) => ({
            value: key,
            label: t(`languages:${key}`, { defaultValue: key.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()) }),
        })).sort((a, b) => a.label.localeCompare(b.label));
    }, [t]);

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
                motherTongue,
                bornMuslim: bornMuslim === 'muslim_by_birth' ? 'yes' : 'no',
                languagesSpoken,
            };
            if (isFemale) payload.dress = dress;

            const res = await profileService.updateProfile(payload);
            if (res.success) {
                setProfileData(payload);
                router.push('/(profile-setup)/step3');
            } else {
                Alert.alert('Error', res.message || 'Failed to update profile');
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
            <ProgressBar currentStep={2} />
            <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
                <ScrollView contentContainerStyle={{ padding: scale(20), paddingBottom: scale(100) }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
                    <Text variant="heading" className="font-heading mb-1" align="center">{t('common:step_2.title')}</Text>
                    <Text variant="body-sm" className="mb-4" align="center" style={{ color: isDark ? '#94A3B8' : '#6B7280' }}>{t('common:step_2.subtitle')}</Text>

                    <FieldLabel text={t('common:step_2.mother_tongue')} required />
                    <SelectField value={motherTongue ? getLabel(motherTongue, languageOptions) : ''} placeholder="Select language" onPress={() => setShowMotherTongueSheet(true)} icon={<Languages size={scale(18)} color={iconColor} />} hasError={!!errors.motherTongue} />
                    {errors.motherTongue && <ErrorText text={errors.motherTongue} />}

                    <FieldLabel text={t('common:step_2.born_muslim')} required />
                    <SelectField value={bornMuslim ? getLabel(bornMuslim, bornMuslimOptions) : ''} placeholder="Select" onPress={() => setShowBornMuslimSheet(true)} icon={<BookOpenCheck size={scale(18)} color={iconColor} />} hasError={!!errors.bornMuslim} />
                    {errors.bornMuslim && <ErrorText text={errors.bornMuslim} />}

                    <FieldLabel text={t('common:step_2.languages_spoken')} required />
                    <SelectField value={languagesSpoken.length > 0 ? languagesSpoken.map((l) => getLabel(l, languageOptions)).join(', ') : ''} placeholder="Select languages (max 5)" onPress={() => setShowLanguagesSheet(true)} icon={<MessageCircle size={scale(18)} color={iconColor} />} hasError={!!errors.languagesSpoken} />
                    {errors.languagesSpoken && <ErrorText text={errors.languagesSpoken} />}

                    {isFemale && (
                        <>
                            <FieldLabel text={t('common:step_2.dress')} required />
                            <SelectField value={dress ? getLabel(dress, dressOptions) : ''} placeholder="Select" onPress={() => setShowDressSheet(true)} icon={<Shirt size={scale(18)} color={iconColor} />} hasError={!!errors.dress} />
                            {errors.dress && <ErrorText text={errors.dress} />}
                        </>
                    )}
                </ScrollView>
            </KeyboardAvoidingView>

            <View style={styles.footer}><GradientButton title={t('common:common.continue')} onPress={handleSubmit} loading={loading} disabled={loading} /></View>

            <SingleSelectSheet visible={showMotherTongueSheet} onClose={() => setShowMotherTongueSheet(false)} onSelect={(v) => { setMotherTongue(v); setErrors((e) => ({ ...e, motherTongue: '' })); }} options={languageOptions} selected={motherTongue} title="Mother Tongue" searchEnabled />
            <SingleSelectSheet visible={showBornMuslimSheet} onClose={() => setShowBornMuslimSheet(false)} onSelect={(v) => { setBornMuslim(v); setErrors((e) => ({ ...e, bornMuslim: '' })); }} options={bornMuslimOptions} selected={bornMuslim} title="Born Muslim?" />
            <MultiSelectSheet visible={showLanguagesSheet} onClose={() => setShowLanguagesSheet(false)} onConfirm={(v) => { setLanguagesSpoken(v); setErrors((e) => ({ ...e, languagesSpoken: '' })); }} options={languageOptions} selected={languagesSpoken} title="Languages Spoken" maxSelections={5} searchEnabled />
            {isFemale && <SingleSelectSheet visible={showDressSheet} onClose={() => setShowDressSheet(false)} onSelect={(v) => { setDress(v); setErrors((e) => ({ ...e, dress: '' })); }} options={dressOptions} selected={dress} title="How Do You Usually Dress?" />}
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({ footer: { padding: scale(20), paddingBottom: scale(10) } });
