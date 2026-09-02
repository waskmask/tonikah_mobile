import React, { useState, useEffect, useMemo } from 'react';
import { View, ScrollView, KeyboardAvoidingView, Platform, StyleSheet } from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';
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
import { ProfileSetupTokens } from '@/constants/uiTokens';
import { profileService } from '@/lib/profileService';
import { useProfileSetupStore } from '@/store/profileSetupStore';
import { useAuthStore } from '@/store/authStore';
import { toast } from '@/hooks/useToast';
import { BookOpen, Compass, Signpost, MoonStar } from 'lucide-react-native';
import { Mosque } from '@/components/ui/icons/Mosque';
import { formatProfileOptionLabel } from '@/lib/profileOptionLabels';
import { apiMessage } from '@/lib/profileDisplay';

const SECT_FILTERS: Record<string, { maslak: string[]; following: string[] }> = {
    sunni: {
        maslak: ['hanafi', 'shafi', 'maliki', 'hanbali', 'not_applicable'],
        following: [
            'ahle_hadith',
            'ahle_sunnat',
            'deobandi',
            'barelvi',
            'sufi',
            'tabligi',
            'salafi',
            'just_muslim',
            'other_sunni',
        ],
    },
    shia: {
        maslak: ['jafari', 'zaydi', 'ismaili', 'other'],
        following: ['ithna_ashari', 'bohra', 'ismaili', 'zaidi', 'just_shia', 'other_shia'],
    },
    ibadi: {
        maslak: ['not_applicable', 'other'],
        following: ['ahle_hadith', 'ahle_sunnat', 'salafi', 'just_muslim', 'other_sunni'],
    },
};

const normalizeMasterKey = (value?: string) =>
    String(value || '')
        .trim()
        .toLowerCase();

export default function Step6() {
    const { t, i18n } = useTranslation('common');
    const { isDark } = useTheme();
    const { setProfileData, masterdata, setMasterdata } = useProfileSetupStore();
    const iconColor = isDark ? '#A99C8D' : '#7D7266';

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
            label: formatProfileOptionLabel(item.label || item.name || item._id, i18n.language),
            key: item.label || item.name,
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

    const sectOpts = useMemo(() => toOpts('sect'), [masterdata.sect, i18n.language]);
    const maslakOptsRaw = useMemo(() => toOpts('maslak'), [masterdata.maslak, i18n.language]);
    const followingOptsRaw = useMemo(() => toOpts('following'), [masterdata.following, i18n.language]);
    const selectedSectKey = normalizeMasterKey(sectOpts.find((item) => item.value === sect)?.key);

    const maslakOpts = useMemo(() => {
        const filters = SECT_FILTERS[selectedSectKey];
        if (!filters) return maslakOptsRaw;
        return maslakOptsRaw.filter((item) => !item.key || filters.maslak.includes(normalizeMasterKey(item.key)));
    }, [maslakOptsRaw, selectedSectKey]);

    const followingOpts = useMemo(() => {
        const filters = SECT_FILTERS[selectedSectKey];
        if (!filters) return followingOptsRaw;
        return followingOptsRaw.filter((item) => !item.key || filters.following.includes(normalizeMasterKey(item.key)));
    }, [followingOptsRaw, selectedSectKey]);

    useEffect(() => {
        if (maslak && !maslakOpts.some((item) => item.value === maslak)) {
            setMaslak('');
        }
        if (following && !followingOpts.some((item) => item.value === following)) {
            setFollowing('');
        }
    }, [following, followingOpts, maslak, maslakOpts]);

    const validate = (): boolean => {
        const e: Record<string, string> = {};
        const required = t('common:validation_required', { defaultValue: 'Required' });
        if (!sect) e.sect = required;
        if (!maslak) e.maslak = required;
        if (!isPractising) e.isPractising = required;
        if (!prayers) e.prayers = required;
        setErrors(e);
        return Object.keys(e).length === 0;
    };

    const handleSubmit = async () => {
        if (!validate()) return;
        setLoading(true);
        try {
            const payload: any = {
                sect: { value_id: sect },
                maslak: { value_id: maslak },
                is_practising: isPractising,
                prayers,
            };
            if (following) payload.following = { value_id: following };

            const res = await profileService.updateProfile(payload);
            if (res.success) {
                setProfileData(payload);
                // Keep the cached /me user in sync so reload resumes correctly
                useAuthStore.getState().refreshUser().catch(() => { });
                router.push('/(profile-setup)/step7');
            } else {
                toast.show(apiMessage(res.message || 'server_error_default'), 'error');
            }
        } catch {
            toast.show(apiMessage('server_error_default'), 'error');
        } finally {
            setLoading(false);
        }
    };

    return (
        <SafeAreaView className="flex-1 bg-brand-bg-primary">
            <ProgressBar currentStep={6} />
            <KeyboardAwareScrollView

                style={{ flex: 1 }}

                contentContainerStyle={ProfileSetupTokens.scrollContent}

                keyboardShouldPersistTaps="handled"

                showsVerticalScrollIndicator={false}

                bottomOffset={scale(100)}

            >
                    <ProfileSetupHeader
                        step={6}
                        title={t('step_6.title', { defaultValue: 'Religious Beliefs and Practices' })}
                        subtitle={t('step_6.subtitle', { defaultValue: 'Provide information about your religious values and practices.' })}
                    />

                    <SelectField required value={sect ? getLabel(sect, sectOpts) : ''} placeholder={t('select_sect', { defaultValue: 'Select sect' })} onPress={() => setActiveSheet('sect')} icon={<BookOpen size={scale(18)} color={iconColor} />} hasError={!!errors.sect} />
                    {errors.sect && <ErrorText text={errors.sect} />}

                    {!!sect && (
                        <>
                            <SelectField required value={maslak ? getLabel(maslak, maslakOpts) : ''} placeholder={t('maslak', { defaultValue: 'Maslak' })} onPress={() => setActiveSheet('maslak')} icon={<Compass size={scale(18)} color={iconColor} />} hasError={!!errors.maslak} />
                            {errors.maslak && <ErrorText text={errors.maslak} />}
                        </>
                    )}

                    {!!maslak && (
                        <>
                            <SelectField value={following ? getLabel(following, followingOpts) : ''} placeholder={t('following', { defaultValue: 'Following' })} onPress={() => setActiveSheet('following')} icon={<Signpost size={scale(18)} color={iconColor} />} />

                            <SelectField required value={isPractising ? getLabel(isPractising, practisingOptions) : ''} placeholder={t('practising_label', { defaultValue: 'Practising Level' })} onPress={() => setActiveSheet('practising')} icon={<MoonStar size={scale(18)} color={iconColor} />} hasError={!!errors.isPractising} />
                            {errors.isPractising && <ErrorText text={errors.isPractising} />}

                            <SelectField required value={prayers ? getLabel(prayers, prayerOptions) : ''} placeholder={t('prayers_title', { defaultValue: 'Prayer Habit' })} onPress={() => setActiveSheet('prayers')} icon={<Mosque size={scale(18)} color={iconColor} />} hasError={!!errors.prayers} />
                            {errors.prayers && <ErrorText text={errors.prayers} />}
                        </>
                    )}            </KeyboardAwareScrollView>

            <View style={styles.footer}><GradientButton title={t('continue', { defaultValue: 'Continue' })} onPress={handleSubmit} loading={loading} disabled={loading || !maslak} widthMode="full" height={40} textSize={15} /></View>

            <SingleSelectSheet visible={activeSheet === 'sect'} onClose={() => setActiveSheet(null)} onSelect={(v) => { setSect(v); setMaslak(''); setFollowing(''); setErrors((e) => ({ ...e, sect: '', maslak: '' })); }} options={sectOpts} selected={sect} title={t('sect', { defaultValue: 'Sect' })} presentation="sheet" />
            <SingleSelectSheet visible={activeSheet === 'maslak'} onClose={() => setActiveSheet(null)} onSelect={(v) => { setMaslak(v); setErrors((e) => ({ ...e, maslak: '' })); }} options={maslakOpts} selected={maslak} title={t('maslak', { defaultValue: 'Maslak' })} presentation="sheet" />
            <SingleSelectSheet visible={activeSheet === 'following'} onClose={() => setActiveSheet(null)} onSelect={(v) => setFollowing(v)} options={followingOpts} selected={following} title={t('following', { defaultValue: 'Following' })} searchEnabled />
            <SingleSelectSheet visible={activeSheet === 'practising'} onClose={() => setActiveSheet(null)} onSelect={(v) => { setIsPractising(v); setErrors((e) => ({ ...e, isPractising: '' })); }} options={practisingOptions} selected={isPractising} title={t('practising_label', { defaultValue: 'Practising Level' })} />
            <SingleSelectSheet visible={activeSheet === 'prayers'} onClose={() => setActiveSheet(null)} onSelect={(v) => { setPrayers(v); setErrors((e) => ({ ...e, prayers: '' })); }} options={prayerOptions} selected={prayers} title={t('prayers_title', { defaultValue: 'Prayer Habit' })} />
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({ footer: { padding: scale(20), paddingBottom: scale(10) } });
