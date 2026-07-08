import React, { useState, useEffect, useMemo } from 'react';
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
import { Ruler, Palette, Users2 } from 'lucide-react-native';
import { formatProfileOptionLabel } from '@/lib/profileOptionLabels';
import { apiMessage } from '@/lib/profileDisplay';

export default function Step4() {
    const { t, i18n } = useTranslation(['common', 'ethnic_groups']);
    const { isDark } = useTheme();
    const { setProfileData, masterdata, setMasterdata } = useProfileSetupStore();
    const iconColor = isDark ? '#A99C8D' : '#7D7266';

    const [height, setHeight] = useState('');
    const [complexion, setComplexion] = useState('');
    const [ethnicGroup, setEthnicGroup] = useState<string[]>([]);

    const [loading, setLoading] = useState(false);
    const [activeSheet, setActiveSheet] = useState<string | null>(null);
    const [errors, setErrors] = useState<Record<string, string>>({});

    useEffect(() => {
        const fetchData = async () => {
            if (!masterdata.height) {
                try {
                    const [hRes, cRes, eRes] = await Promise.all([
                        profileService.fetchMasterdata('height'),
                        profileService.fetchMasterdata('complexion'),
                        profileService.fetchMasterdata('ethnic_group'),
                    ]);
                    setMasterdata({
                        height: hRes.data || [],
                        complexion: cRes.data || [],
                        ethnic_group: eRes.data || [],
                    });
                } catch { }
            }
        };
        fetchData();
    }, []);

    const toOpts = (key: string): SelectOption[] =>
        (masterdata[key] || []).map((item: any) => ({
            value: item._id || item.value_id,
            label: formatProfileOptionLabel(item.label || item.name || item._id, i18n.language),
            description: item.description,
        }));

    const getLabel = (v: string, opts: SelectOption[]) => opts.find((o) => o.value === v)?.label || '';

    const validate = (): boolean => {
        const e: Record<string, string> = {};
        if (!height) e.height = 'Required';
        if (!complexion) e.complexion = 'Required';
        if (ethnicGroup.length === 0) e.ethnicGroup = 'Required';
        setErrors(e);
        return Object.keys(e).length === 0;
    };

    const handleSubmit = async () => {
        if (!validate()) return;
        setLoading(true);
        try {
            const payload = {
                height: { value_id: height },
                complexion: { value_id: complexion },
                ethnic_group: ethnicGroup.map((id) => ({ value_id: id })),
            };
            const res = await profileService.updateProfile(payload);
            if (res.success) {
                setProfileData(payload);
                router.push('/(profile-setup)/step5');
            } else {
                Alert.alert(t('error', { defaultValue: 'Error' }), apiMessage(res.message || 'server_error_default'));
            }
        } catch {
            Alert.alert(t('error', { defaultValue: 'Error' }), apiMessage('server_error_default'));
        } finally {
            setLoading(false);
        }
    };

    const heightOpts = toOpts('height');
    const complexionOpts = toOpts('complexion');
    const ethnicOpts = toOpts('ethnic_group');

    return (
        <SafeAreaView className="flex-1 bg-brand-bg-primary">
            <ProgressBar currentStep={4} />
            <KeyboardAwareScrollView

                style={{ flex: 1 }}

                contentContainerStyle={ProfileSetupTokens.scrollContent}

                keyboardShouldPersistTaps="handled"

                showsVerticalScrollIndicator={false}

                bottomOffset={scale(100)}

            >
                    <ProfileSetupHeader
                        step={4}
                        title={t('common:step_4.title', { defaultValue: 'Appearance' })}
                        subtitle={t('common:step_4.subtitle', { defaultValue: 'These details help others understand physical attributes respectfully.' })}
                    />

                    <SelectField required value={height ? getLabel(height, heightOpts) : ''} placeholder={t('common:select_height', { defaultValue: 'Select height' })} onPress={() => setActiveSheet('height')} icon={<Ruler size={scale(18)} color={iconColor} />} hasError={!!errors.height} />
                    {errors.height && <ErrorText text={errors.height} />}

                    <SelectField required value={complexion ? getLabel(complexion, complexionOpts) : ''} placeholder={t('common:select_complexion', { defaultValue: 'Select complexion' })} onPress={() => setActiveSheet('complexion')} icon={<Palette size={scale(18)} color={iconColor} />} hasError={!!errors.complexion} />
                    {errors.complexion && <ErrorText text={errors.complexion} />}

                    <SelectField required value={ethnicGroup.length > 0 ? ethnicGroup.map((e) => getLabel(e, ethnicOpts)).join(', ') : ''} placeholder={t('common:select_limit_2_ethnicity', { defaultValue: 'Select ethnic group (max 2)' })} onPress={() => setActiveSheet('ethnic')} icon={<Users2 size={scale(18)} color={iconColor} />} hasError={!!errors.ethnicGroup} />
                    {errors.ethnicGroup && <ErrorText text={errors.ethnicGroup} />}            </KeyboardAwareScrollView>

            <View style={styles.footer}><GradientButton title={t('common:continue', { defaultValue: 'Continue' })} onPress={handleSubmit} loading={loading} disabled={loading} /></View>

            <SingleSelectSheet visible={activeSheet === 'height'} onClose={() => setActiveSheet(null)} onSelect={(v) => { setHeight(v); setErrors((e) => ({ ...e, height: '' })); }} options={heightOpts} selected={height} title={t('common:height', { defaultValue: 'Height' })} searchEnabled />
            <SingleSelectSheet visible={activeSheet === 'complexion'} onClose={() => setActiveSheet(null)} onSelect={(v) => { setComplexion(v); setErrors((e) => ({ ...e, complexion: '' })); }} options={complexionOpts} selected={complexion} title={t('common:complexion', { defaultValue: 'Complexion' })} />
            <MultiSelectSheet visible={activeSheet === 'ethnic'} onClose={() => setActiveSheet(null)} onConfirm={(v) => { setEthnicGroup(v); setErrors((e) => ({ ...e, ethnicGroup: '' })); }} options={ethnicOpts} selected={ethnicGroup} title={t('common:ethnic_group', { defaultValue: 'Ethnic Group' })} maxSelections={2} searchEnabled />
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({ footer: { padding: scale(20), paddingBottom: scale(10) } });
