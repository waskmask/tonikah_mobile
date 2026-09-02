import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { View, StyleSheet } from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { GradientButton } from '@/components/ui/GradientButton';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { ProfileSetupHeader } from '@/components/ui/ProfileSetupHeader';
import { SingleSelectSheet, SelectOption } from '@/components/ui/SingleSelectSheet';
import { ErrorText, SelectField } from '@/components/ui/FormField';
import { useTheme } from '@/hooks/useTheme';
import { scale } from '@/hooks/useResponsive';
import { ProfileSetupTokens } from '@/constants/uiTokens';
import { profileService } from '@/lib/profileService';
import { useProfileSetupStore } from '@/store/profileSetupStore';
import { useAuthStore } from '@/store/authStore';
import { toast } from '@/hooks/useToast';
import { GraduationCap, Briefcase, IdCard } from 'lucide-react-native';
import { formatProfileOptionLabel } from '@/lib/profileOptionLabels';
import { apiMessage } from '@/lib/profileDisplay';

export default function Step5() {
    const { t, i18n } = useTranslation('common');
    const { isDark } = useTheme();
    const { setProfileData, masterdata, setMasterdata } = useProfileSetupStore();
    const iconColor = isDark ? '#A99C8D' : '#7D7266';

    const [education, setEducation] = useState('');
    const [occupation, setOccupation] = useState('');
    const [designation, setDesignation] = useState('');

    const [loading, setLoading] = useState(false);
    const [activeSheet, setActiveSheet] = useState<string | null>(null);
    const [errors, setErrors] = useState<Record<string, string>>({});

    useEffect(() => {
        const fetchData = async () => {
            if (!masterdata.education) {
                try {
                    const [eRes, oRes, dRes] = await Promise.all([
                        profileService.fetchMasterdata('education'),
                        profileService.fetchMasterdata('occupation'),
                        profileService.fetchMasterdata('designation'),
                    ]);
                    setMasterdata({ education: eRes.data || [], occupation: oRes.data || [], designation: dRes.data || [] });
                } catch { }
            }
        };
        fetchData();
    }, []);

    const toOpts = useCallback(
        (key: string): SelectOption[] =>
            (masterdata[key] || []).map((item: any) => ({
                value: item._id || item.value_id,
                label: formatProfileOptionLabel(item.label || item.name || item._id, i18n.language),
            })),
        [masterdata, i18n.language],
    );

    const getLabel = (v: string, opts: SelectOption[]) => opts.find((o) => o.value === v)?.label || '';

    const validate = (): boolean => {
        const e: Record<string, string> = {};
        if (!education) e.education = t('education_required', { defaultValue: 'Please select your education.' });
        if (!occupation) e.occupation = t('occupation_required', { defaultValue: 'Please select your occupation.' });
        setErrors(e);
        return Object.keys(e).length === 0;
    };

    const handleSubmit = async () => {
        if (!validate()) return;
        setLoading(true);
        try {
            // Company and annual income moved to edit-profile: both are optional
            // and sensitive, so they don't belong in the onboarding funnel.
            const payload: any = {
                education: { value_id: education },
                occupation: { value_id: occupation },
            };
            if (designation) payload.designation = { value_id: designation };

            const res = await profileService.updateProfile(payload);
            if (res.success) {
                setProfileData(payload);
                // Keep the cached /me user in sync so reload resumes correctly
                useAuthStore.getState().refreshUser().catch(() => { });
                router.push('/(profile-setup)/step6');
            } else {
                toast.show(apiMessage(res.message || 'server_error_default'), 'error');
            }
        } catch {
            toast.show(apiMessage('server_error_default'), 'error');
        } finally {
            setLoading(false);
        }
    };

    const educationOpts = useMemo(() => toOpts('education'), [toOpts]);
    const occupationOpts = useMemo(() => toOpts('occupation'), [toOpts]);
    const designationOpts = useMemo(() => toOpts('designation'), [toOpts]);

    return (
        <SafeAreaView className="flex-1 bg-brand-bg-primary">
            <ProgressBar currentStep={5} />
            <KeyboardAwareScrollView
                style={{ flex: 1 }}
                contentContainerStyle={ProfileSetupTokens.scrollContent}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
                bottomOffset={scale(100)}
            >
                    <ProfileSetupHeader
                        step={5}
                        title={t('step_5.title', { defaultValue: 'Education and Career' })}
                        subtitle={t('step_5.subtitle', { defaultValue: 'Highlight academic background and current job details.' })}
                    />

                    <SelectField required value={education ? getLabel(education, educationOpts) : ''} placeholder={t('select_education', { defaultValue: 'Select education' })} onPress={() => setActiveSheet('education')} icon={<GraduationCap size={scale(18)} color={iconColor} />} hasError={!!errors.education} />
                    {errors.education && <ErrorText text={errors.education} />}

                    <SelectField required value={occupation ? getLabel(occupation, occupationOpts) : ''} placeholder={t('select_occupation', { defaultValue: 'Select occupation' })} onPress={() => setActiveSheet('occupation')} icon={<Briefcase size={scale(18)} color={iconColor} />} hasError={!!errors.occupation} />
                    {errors.occupation && <ErrorText text={errors.occupation} />}

                    <SelectField value={designation ? getLabel(designation, designationOpts) : ''} placeholder={t('designation', { defaultValue: 'Designation' })} onPress={() => setActiveSheet('designation')} icon={<IdCard size={scale(18)} color={iconColor} />} hasError={!!errors.designation} />
                    {errors.designation && <ErrorText text={errors.designation} />}
            </KeyboardAwareScrollView>

            <View style={styles.footer}><GradientButton title={t('continue', { defaultValue: 'Continue' })} onPress={handleSubmit} loading={loading} disabled={loading} widthMode="full" height={40} textSize={15} /></View>

            <SingleSelectSheet visible={activeSheet === 'education'} onClose={() => setActiveSheet(null)} onSelect={(v) => { setEducation(v); setErrors((e) => ({ ...e, education: '' })); }} options={educationOpts} selected={education} title={t('education', { defaultValue: 'Education' })} presentation="sheet" />
            <SingleSelectSheet visible={activeSheet === 'occupation'} onClose={() => setActiveSheet(null)} onSelect={(v) => { setOccupation(v); setErrors((e) => ({ ...e, occupation: '' })); }} options={occupationOpts} selected={occupation} title={t('occupation', { defaultValue: 'Occupation' })} presentation="sheet" />
            <SingleSelectSheet visible={activeSheet === 'designation'} onClose={() => setActiveSheet(null)} onSelect={(v) => { setDesignation(v); setErrors((e) => ({ ...e, designation: '' })); }} options={designationOpts} selected={designation} title={t('designation', { defaultValue: 'Designation' })} searchEnabled />
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({ footer: { padding: scale(20), paddingBottom: scale(10) } });
