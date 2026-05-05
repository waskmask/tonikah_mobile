import React, { useState, useEffect } from 'react';
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
import { BookOpen, Landmark, Star, Sparkles, HandHeart } from 'lucide-react-native';

export default function Step6() {
    const { t } = useTranslation('common');
    const { isDark } = useTheme();
    const { setProfileData, masterdata, setMasterdata } = useProfileSetupStore();
    const iconColor = isDark ? '#94A3B8' : '#6B7280';

    const [sect, setSect] = useState('');
    const [maslak, setMaslak] = useState('');
    const [following, setFollowing] = useState('');
    const [isPractising, setIsPractising] = useState('');
    const [prayers, setPrayers] = useState('');

    const [loading, setLoading] = useState(false);
    const [activeSheet, setActiveSheet] = useState<string | null>(null);
    const [errors, setErrors] = useState<Record<string, string>>({});

    useEffect(() => {
        const fetchData = async () => {
            if (!masterdata.sect) {
                try {
                    const [sRes, mRes, fRes] = await Promise.all([
                        profileService.fetchMasterdata('sect'),
                        profileService.fetchMasterdata('maslak'),
                        profileService.fetchMasterdata('following'),
                    ]);
                    setMasterdata({ sect: sRes.data || [], maslak: mRes.data || [], following: fRes.data || [] });
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

    const practisingOptions: SelectOption[] = [
        { value: 'very_religious', label: t('step_6.very_religious'), description: t('step_6.very_religious_desc') },
        { value: 'religious', label: t('step_6.religious'), description: t('step_6.religious_desc') },
        { value: 'moderate', label: t('step_6.moderate'), description: t('step_6.moderate_desc') },
        { value: 'liberal', label: t('step_6.liberal'), description: t('step_6.liberal_desc') },
        { value: 'not_practicing', label: t('step_6.not_practicing'), description: t('step_6.not_practicing_desc') },
        { value: 'spiritual', label: t('step_6.spiritual'), description: t('step_6.spiritual_desc') },
    ];

    const prayerOptions: SelectOption[] = [
        { value: 'five_times_daily', label: t('step_6.five_times_daily') },
        { value: 'most_prayers', label: t('step_6.most_prayers') },
        { value: 'some_prayers', label: t('step_6.some_prayers') },
        { value: 'friday_only', label: t('step_6.friday_only') },
        { value: 'never_prays', label: t('step_6.never_prays') },
    ];

    const validate = (): boolean => {
        const e: Record<string, string> = {};
        if (!sect) e.sect = 'Required';
        if (!isPractising) e.isPractising = 'Required';
        if (!prayers) e.prayers = 'Required';
        setErrors(e);
        return Object.keys(e).length === 0;
    };

    const handleSubmit = async () => {
        if (!validate()) return;
        setLoading(true);
        try {
            const payload: any = {
                sect: { value_id: sect },
                is_practising: isPractising,
                prayers,
            };
            if (maslak) payload.maslak = { value_id: maslak };
            if (following) payload.following = { value_id: following };

            const res = await profileService.updateProfile(payload);
            if (res.success) {
                setProfileData(payload);
                router.push('/(profile-setup)/step7');
            } else {
                Alert.alert('Error', res.message || 'Failed to update');
            }
        } catch {
            Alert.alert('Error', 'Something went wrong');
        } finally {
            setLoading(false);
        }
    };

    const sectOpts = toOpts('sect');
    const maslakOpts = toOpts('maslak');
    const followingOpts = toOpts('following');

    return (
        <SafeAreaView className="flex-1 bg-white dark:bg-slate-900">
            <ProgressBar currentStep={6} />
            <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
                <ScrollView contentContainerStyle={{ padding: scale(20), paddingBottom: scale(100) }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
                    <Text variant="heading" className="font-heading mb-1" align="center">{t('step_6.title')}</Text>
                    <Text variant="body-sm" className="mb-4" align="center" style={{ color: isDark ? '#94A3B8' : '#6B7280' }}>{t('step_6.subtitle')}</Text>

                    <FieldLabel text="Sect" required />
                    <SelectField value={sect ? getLabel(sect, sectOpts) : ''} placeholder="Select sect" onPress={() => setActiveSheet('sect')} icon={<BookOpen size={scale(18)} color={iconColor} />} hasError={!!errors.sect} />
                    {errors.sect && <ErrorText text={errors.sect} />}

                    <FieldLabel text="Maslak / School of Thought" />
                    <SelectField value={maslak ? getLabel(maslak, maslakOpts) : ''} placeholder="Select (optional)" onPress={() => setActiveSheet('maslak')} icon={<Landmark size={scale(18)} color={iconColor} />} />

                    <FieldLabel text="Following / Movement" />
                    <SelectField value={following ? getLabel(following, followingOpts) : ''} placeholder="Select (optional)" onPress={() => setActiveSheet('following')} icon={<Star size={scale(18)} color={iconColor} />} />

                    <FieldLabel text="How Practising Are You?" required />
                    <SelectField value={isPractising ? getLabel(isPractising, practisingOptions) : ''} placeholder="Select level" onPress={() => setActiveSheet('practising')} icon={<Sparkles size={scale(18)} color={iconColor} />} hasError={!!errors.isPractising} />
                    {errors.isPractising && <ErrorText text={errors.isPractising} />}

                    <FieldLabel text="Prayer Habit" required />
                    <SelectField value={prayers ? getLabel(prayers, prayerOptions) : ''} placeholder="Select" onPress={() => setActiveSheet('prayers')} icon={<HandHeart size={scale(18)} color={iconColor} />} hasError={!!errors.prayers} />
                    {errors.prayers && <ErrorText text={errors.prayers} />}
                </ScrollView>
            </KeyboardAvoidingView>

            <View style={styles.footer}><GradientButton title={t('common.continue')} onPress={handleSubmit} loading={loading} disabled={loading} /></View>

            <SingleSelectSheet visible={activeSheet === 'sect'} onClose={() => setActiveSheet(null)} onSelect={(v) => { setSect(v); setErrors((e) => ({ ...e, sect: '' })); }} options={sectOpts} selected={sect} title="Sect" searchEnabled />
            <SingleSelectSheet visible={activeSheet === 'maslak'} onClose={() => setActiveSheet(null)} onSelect={(v) => setMaslak(v)} options={maslakOpts} selected={maslak} title="Maslak" searchEnabled />
            <SingleSelectSheet visible={activeSheet === 'following'} onClose={() => setActiveSheet(null)} onSelect={(v) => setFollowing(v)} options={followingOpts} selected={following} title="Following" searchEnabled />
            <SingleSelectSheet visible={activeSheet === 'practising'} onClose={() => setActiveSheet(null)} onSelect={(v) => { setIsPractising(v); setErrors((e) => ({ ...e, isPractising: '' })); }} options={practisingOptions} selected={isPractising} title="Practising Level" />
            <SingleSelectSheet visible={activeSheet === 'prayers'} onClose={() => setActiveSheet(null)} onSelect={(v) => { setPrayers(v); setErrors((e) => ({ ...e, prayers: '' })); }} options={prayerOptions} selected={prayers} title="Prayer Habit" />
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({ footer: { padding: scale(20), paddingBottom: scale(10) } });
