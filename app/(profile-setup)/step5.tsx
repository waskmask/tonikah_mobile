import React, { useState, useEffect } from 'react';
import { View, ScrollView, KeyboardAvoidingView, Platform, Alert, StyleSheet } from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Input } from '@/components/ui/Input';
import { GradientButton } from '@/components/ui/GradientButton';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { ProfileSetupHeader } from '@/components/ui/ProfileSetupHeader';
import { SingleSelectSheet, SelectOption } from '@/components/ui/SingleSelectSheet';
import { FieldLabel, ErrorText, SelectField } from '@/components/ui/FormField';
import { useTheme } from '@/hooks/useTheme';
import { scale } from '@/hooks/useResponsive';
import { ProfileSetupTokens } from '@/constants/uiTokens';
import { profileService } from '@/lib/profileService';
import { useProfileSetupStore } from '@/store/profileSetupStore';
import { GraduationCap, Briefcase, Award, Building2, DollarSign } from 'lucide-react-native';
import { formatProfileOptionLabel } from '@/lib/profileOptionLabels';
import { COMPANY_MAX, MAX_INCOME, formatAmount, isAllowedProfileText, parseAmount } from '@/lib/profileValidation';
import { apiMessage } from '@/lib/profileDisplay';

export default function Step5() {
    const { t, i18n } = useTranslation('common');
    const { isDark } = useTheme();
    const { setProfileData, masterdata, setMasterdata } = useProfileSetupStore();
    const iconColor = isDark ? '#A99C8D' : '#7D7266';

    const [education, setEducation] = useState('');
    const [occupation, setOccupation] = useState('');
    const [designation, setDesignation] = useState('');
    const [companyName, setCompanyName] = useState('');
    const [annualIncome, setAnnualIncome] = useState('');
    const [currency, setCurrency] = useState('USD');

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

    const toOpts = (key: string): SelectOption[] =>
        (masterdata[key] || []).map((item: any) => ({
            value: item._id || item.value_id,
            label: formatProfileOptionLabel(item.label || item.name || item._id, i18n.language),
        }));

    const getLabel = (v: string, opts: SelectOption[]) => opts.find((o) => o.value === v)?.label || '';

    const currencyOptions: SelectOption[] = [
        { value: 'USD', label: 'USD' },
        { value: 'EUR', label: 'EUR' },
        { value: 'INR', label: 'INR' },
        { value: 'SAR', label: 'SAR' },
        { value: 'AED', label: 'AED' },
        { value: 'AUD', label: 'AUD' },
        { value: 'CAD', label: 'CAD' },
        { value: 'QAR', label: 'QAR' },
    ];

    const validate = (): boolean => {
        const e: Record<string, string> = {};
        const cleanedCompany = companyName.trim();
        const amount = parseAmount(annualIncome);

        if (!education) e.education = t('education_required', { defaultValue: 'Please select your education.' });
        if (!occupation) e.occupation = t('occupation_required', { defaultValue: 'Please select your occupation.' });
        if (cleanedCompany.length > COMPANY_MAX) {
            e.company = t('company_too_long', { defaultValue: 'Company name must be 30 characters or less.' });
        } else if (cleanedCompany && !isAllowedProfileText(cleanedCompany)) {
            e.company = t('company_invalid_chars', {
                defaultValue: 'Company name can only contain letters, numbers, spaces and basic punctuation.',
            });
        }
        if (annualIncome.trim()) {
            if (!Number.isFinite(amount) || amount <= 0) {
                e.annualIncome = t('annual_income_invalid', { defaultValue: 'Please enter a valid annual income amount.' });
            } else if (amount > MAX_INCOME) {
                e.annualIncome = t('annual_income_too_high', { defaultValue: 'Annual income is too high.' });
            }
        }
        setErrors(e);
        return Object.keys(e).length === 0;
    };

    const handleSubmit = async () => {
        if (!validate()) return;
        setLoading(true);
        try {
            const payload: any = {
                education: { value_id: education },
                occupation: { value_id: occupation },
            };
            if (designation) payload.designation = { value_id: designation };
            if (companyName.trim()) payload.company = companyName.trim();
            const amount = parseAmount(annualIncome);
            if (annualIncome.trim() && Number.isFinite(amount) && amount > 0) payload.annual_income = { currency, amount };

            const res = await profileService.updateProfile(payload);
            if (res.success) {
                setProfileData(payload);
                router.push('/(profile-setup)/step6');
            } else {
                Alert.alert(t('error', { defaultValue: 'Error' }), apiMessage(res.message || 'server_error_default'));
            }
        } catch {
            Alert.alert(t('error', { defaultValue: 'Error' }), apiMessage('server_error_default'));
        } finally {
            setLoading(false);
        }
    };

    const educationOpts = toOpts('education');
    const occupationOpts = toOpts('occupation');
    const designationOpts = toOpts('designation');

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

                    <SelectField value={designation ? getLabel(designation, designationOpts) : ''} placeholder={t('designation', { defaultValue: 'Designation' })} onPress={() => setActiveSheet('designation')} icon={<Award size={scale(18)} color={iconColor} />} hasError={!!errors.designation} />
                    {errors.designation && <ErrorText text={errors.designation} />}

                    <Input
                        placeholder={t('company_name', { defaultValue: 'Company name' })}
                        containerStyle="mb-0 mt-5"
                        value={companyName}
                        onChangeText={(value) => {
                            setCompanyName(value);
                            if (errors.company) setErrors((current) => ({ ...current, company: '' }));
                        }}
                        rightIcon={<Building2 size={scale(18)} color={iconColor} />}
                        error={errors.company}
                        maxLength={80}
                    />

                    <View style={{ flexDirection: 'row', gap: scale(8), alignItems: 'flex-end' }}>
                        <View style={{ width: scale(110) }}>
                            <SelectField value={currency} placeholder={t('currency', { defaultValue: 'Currency' })} onPress={() => setActiveSheet('currency')} icon={<DollarSign size={scale(16)} color={iconColor} />} />
                        </View>
                        <View style={{ flex: 1 }}>
                            <Input
                                placeholder={t('annual_income', { defaultValue: 'Annual income' })}
                                containerStyle="mb-0 mt-5"
                                value={annualIncome}
                                onChangeText={(value) => {
                                    setAnnualIncome(formatAmount(value));
                                    if (errors.annualIncome) setErrors((current) => ({ ...current, annualIncome: '' }));
                                }}
                                keyboardType="numeric"
                                error={errors.annualIncome}
                                maxLength={12}
                            />
                        </View>
                    </View>            </KeyboardAwareScrollView>

            <View style={styles.footer}><GradientButton title={t('continue', { defaultValue: 'Continue' })} onPress={handleSubmit} loading={loading} disabled={loading} /></View>

            <SingleSelectSheet visible={activeSheet === 'education'} onClose={() => setActiveSheet(null)} onSelect={(v) => { setEducation(v); setErrors((e) => ({ ...e, education: '' })); }} options={educationOpts} selected={education} title={t('education', { defaultValue: 'Education' })} searchEnabled />
            <SingleSelectSheet visible={activeSheet === 'occupation'} onClose={() => setActiveSheet(null)} onSelect={(v) => { setOccupation(v); setErrors((e) => ({ ...e, occupation: '' })); }} options={occupationOpts} selected={occupation} title={t('occupation', { defaultValue: 'Occupation' })} searchEnabled />
            <SingleSelectSheet visible={activeSheet === 'designation'} onClose={() => setActiveSheet(null)} onSelect={(v) => { setDesignation(v); setErrors((e) => ({ ...e, designation: '' })); }} options={designationOpts} selected={designation} title={t('designation', { defaultValue: 'Designation' })} searchEnabled />
            <SingleSelectSheet visible={activeSheet === 'currency'} onClose={() => setActiveSheet(null)} onSelect={(v) => setCurrency(v)} options={currencyOptions} selected={currency} title={t('select_currency', { defaultValue: 'Select Currency' })} />
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({ footer: { padding: scale(20), paddingBottom: scale(10) } });
