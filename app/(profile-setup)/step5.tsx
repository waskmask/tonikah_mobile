import React, { useState, useEffect } from 'react';
import { View, ScrollView, KeyboardAvoidingView, Platform, Alert, StyleSheet, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Text } from '@/components/ui/Text';
import { Input } from '@/components/ui/Input';
import { GradientButton } from '@/components/ui/GradientButton';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { SingleSelectSheet, SelectOption } from '@/components/ui/SingleSelectSheet';
import { FieldLabel, ErrorText, SelectField } from '@/components/ui/FormField';
import { useTheme } from '@/hooks/useTheme';
import { scale } from '@/hooks/useResponsive';
import { profileService } from '@/lib/profileService';
import { useProfileSetupStore } from '@/store/profileSetupStore';
import { GraduationCap, Briefcase, Award, Building2, DollarSign } from 'lucide-react-native';

export default function Step5() {
    const { t } = useTranslation('common');
    const { isDark } = useTheme();
    const { setProfileData, masterdata, setMasterdata } = useProfileSetupStore();
    const iconColor = isDark ? '#94A3B8' : '#6B7280';

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
            label: item.label || item.name || item._id,
        }));

    const getLabel = (v: string, opts: SelectOption[]) => opts.find((o) => o.value === v)?.label || '';

    const currencyOptions: SelectOption[] = [
        { value: 'USD', label: 'USD ($)' },
        { value: 'EUR', label: 'EUR (€)' },
        { value: 'GBP', label: 'GBP (£)' },
        { value: 'AED', label: 'AED (د.إ)' },
        { value: 'SAR', label: 'SAR (﷼)' },
        { value: 'PKR', label: 'PKR (₨)' },
        { value: 'INR', label: 'INR (₹)' },
        { value: 'BDT', label: 'BDT (৳)' },
        { value: 'MYR', label: 'MYR (RM)' },
        { value: 'IDR', label: 'IDR (Rp)' },
        { value: 'TRY', label: 'TRY (₺)' },
    ];

    const validate = (): boolean => {
        const e: Record<string, string> = {};
        if (!education) e.education = 'Required';
        if (!occupation) e.occupation = 'Required';
        if (!designation) e.designation = 'Required';
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
                designation: { value_id: designation },
            };
            if (companyName.trim()) payload.company = companyName.trim();
            if (annualIncome) payload.annual_income = { currency, amount: Number(annualIncome) };

            const res = await profileService.updateProfile(payload);
            if (res.success) {
                setProfileData(payload);
                router.push('/(profile-setup)/step6');
            } else {
                Alert.alert('Error', res.message || 'Failed to update');
            }
        } catch {
            Alert.alert('Error', 'Something went wrong');
        } finally {
            setLoading(false);
        }
    };

    const educationOpts = toOpts('education');
    const occupationOpts = toOpts('occupation');
    const designationOpts = toOpts('designation');

    return (
        <SafeAreaView className="flex-1 bg-white dark:bg-slate-900">
            <ProgressBar currentStep={5} />
            <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
                <ScrollView contentContainerStyle={{ padding: scale(20), paddingBottom: scale(100) }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
                    <Text variant="heading" className="font-heading mb-1" align="center">{t('step_5.title')}</Text>
                    <Text variant="body-sm" className="mb-4" align="center" style={{ color: isDark ? '#94A3B8' : '#6B7280' }}>{t('step_5.subtitle')}</Text>

                    <FieldLabel text="Education" required />
                    <SelectField value={education ? getLabel(education, educationOpts) : ''} placeholder="Select education" onPress={() => setActiveSheet('education')} icon={<GraduationCap size={scale(18)} color={iconColor} />} hasError={!!errors.education} />
                    {errors.education && <ErrorText text={errors.education} />}

                    <FieldLabel text="Occupation" required />
                    <SelectField value={occupation ? getLabel(occupation, occupationOpts) : ''} placeholder="Select occupation" onPress={() => setActiveSheet('occupation')} icon={<Briefcase size={scale(18)} color={iconColor} />} hasError={!!errors.occupation} />
                    {errors.occupation && <ErrorText text={errors.occupation} />}

                    <FieldLabel text="Work Title" required />
                    <SelectField value={designation ? getLabel(designation, designationOpts) : ''} placeholder="Select designation" onPress={() => setActiveSheet('designation')} icon={<Award size={scale(18)} color={iconColor} />} hasError={!!errors.designation} />
                    {errors.designation && <ErrorText text={errors.designation} />}

                    <FieldLabel text="Company" />
                    <Input
                        placeholder="Company name (optional)"
                        value={companyName}
                        onChangeText={setCompanyName}
                        leftIcon={<Building2 size={scale(18)} color={iconColor} />}
                    />

                    <FieldLabel text="Annual Income" />
                    <View style={{ flexDirection: 'row', gap: scale(8) }}>
                        <View style={{ width: scale(100) }}>
                            <SelectField value={currency} placeholder="USD" onPress={() => setActiveSheet('currency')} icon={<DollarSign size={scale(16)} color={iconColor} />} />
                        </View>
                        <View style={{ flex: 1 }}>
                            <Input
                                placeholder="Amount (optional)"
                                value={annualIncome}
                                onChangeText={setAnnualIncome}
                                keyboardType="numeric"
                            />
                        </View>
                    </View>
                </ScrollView>
            </KeyboardAvoidingView>

            <View style={styles.footer}><GradientButton title={t('common.continue')} onPress={handleSubmit} loading={loading} disabled={loading} /></View>

            <SingleSelectSheet visible={activeSheet === 'education'} onClose={() => setActiveSheet(null)} onSelect={(v) => { setEducation(v); setErrors((e) => ({ ...e, education: '' })); }} options={educationOpts} selected={education} title="Education" searchEnabled />
            <SingleSelectSheet visible={activeSheet === 'occupation'} onClose={() => setActiveSheet(null)} onSelect={(v) => { setOccupation(v); setErrors((e) => ({ ...e, occupation: '' })); }} options={occupationOpts} selected={occupation} title="Occupation" searchEnabled />
            <SingleSelectSheet visible={activeSheet === 'designation'} onClose={() => setActiveSheet(null)} onSelect={(v) => { setDesignation(v); setErrors((e) => ({ ...e, designation: '' })); }} options={designationOpts} selected={designation} title="Work Title" searchEnabled />
            <SingleSelectSheet visible={activeSheet === 'currency'} onClose={() => setActiveSheet(null)} onSelect={(v) => setCurrency(v)} options={currencyOptions} selected={currency} title="Select Currency" />
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({ footer: { padding: scale(20), paddingBottom: scale(10) } });
