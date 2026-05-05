import React, { useState, useMemo } from 'react';
import {
    View,
    ScrollView,
    KeyboardAvoidingView,
    Platform,
    Alert,
    StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Text } from '@/components/ui/Text';
import { Input } from '@/components/ui/Input';
import { GradientButton } from '@/components/ui/GradientButton';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { SingleSelectSheet, SelectOption } from '@/components/ui/SingleSelectSheet';
import { MultiSelectSheet } from '@/components/ui/MultiSelectSheet';
import { FieldLabel, ErrorText, SelectField } from '@/components/ui/FormField';
import { useTheme } from '@/hooks/useTheme';
import { useLanguage } from '@/hooks/useLanguage';
import { scale } from '@/hooks/useResponsive';
import { profileService } from '@/lib/profileService';
import { useProfileSetupStore } from '@/store/profileSetupStore';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Users, CalendarDays, Flag, Globe, User } from 'lucide-react-native';

/** Format date as DD.MM.YYYY */
const formatDate = (date: Date): string => {
    const d = String(date.getDate()).padStart(2, '0');
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const y = date.getFullYear();
    return `${d}.${m}.${y}`;
};

export default function Step1() {
    const { t } = useTranslation(['common', 'countries', 'nationalities']);
    const { isDark } = useTheme();
    const { isRTL } = useLanguage();
    const { setGender, setProfileData } = useProfileSetupStore();

    // Form state
    const [profileName, setProfileName] = useState('');
    const [gender, setGenderLocal] = useState('');
    const [dob, setDob] = useState<Date | null>(null);
    const [nationality, setNationality] = useState<string[]>([]);
    const [grewUpIn, setGrewUpIn] = useState('');

    // UI state
    const [loading, setLoading] = useState(false);
    const [showDatePicker, setShowDatePicker] = useState(false);
    const [showGenderSheet, setShowGenderSheet] = useState(false);
    const [showNationalitySheet, setShowNationalitySheet] = useState(false);
    const [showCountrySheet, setShowCountrySheet] = useState(false);
    const [errors, setErrors] = useState<Record<string, string>>({});

    // Gender options
    const genderOptions: SelectOption[] = [
        { value: 'male', label: t('common:step_1.male', { defaultValue: 'Male' }) },
        { value: 'female', label: t('common:step_1.female', { defaultValue: 'Female' }) },
    ];

    // Build nationality options from translation files
    const nationalityOptions = useMemo(() => {
        const keys = [
            'afghan', 'albanian', 'algerian', 'andorran', 'angolan', 'argentine', 'armenian', 'australian',
            'austrian', 'azerbaijani', 'bahamian', 'bahraini', 'bangladeshi', 'barbadian', 'belarusian', 'belgian',
            'belizean', 'beninese', 'bhutanese', 'bolivian', 'bosnian', 'brazilian', 'british', 'bruneian',
            'bulgarian', 'burkinabe', 'burundian', 'cambodian', 'cameroonian', 'canadian', 'cabo_verdean',
            'central_african', 'chadian', 'chilean', 'chinese', 'colombian', 'comoran', 'congolese', 'costa_rican',
            'croatian', 'cuban', 'cypriot', 'czech', 'danish', 'djiboutian', 'dominican', 'dutch', 'ecuadorian',
            'egyptian', 'salvadoran', 'equatorial_guinean', 'eritrean', 'estonian', 'ethiopian', 'fijian',
            'finnish', 'french', 'gabonese', 'gambian', 'georgian', 'german', 'ghanaian', 'greek', 'grenadian',
            'guatemalan', 'guinean', 'guyanese', 'haitian', 'honduran', 'hungarian', 'icelandic', 'indian',
            'indonesian', 'iranian', 'iraqi', 'irish', 'israeli', 'italian', 'ivorian', 'jamaican', 'japanese',
            'jordanian', 'kazakhstani', 'kenyan', 'north_korean', 'south_korean', 'kosovan', 'kuwaiti', 'kyrgyz',
            'laotian', 'latvian', 'lebanese', 'liberian', 'libyan', 'liechtensteiner', 'lithuanian',
            'luxembourgish', 'madagascan', 'malawian', 'malaysian', 'maldivian', 'malian', 'maltese',
            'mauritanian', 'mauritian', 'mexican', 'micronesian', 'moldovan', 'monacan', 'mongolian',
            'montenegrin', 'moroccan', 'mozambican', 'namibian', 'nauruan', 'nepalese', 'new_zealander',
            'nicaraguan', 'nigerien', 'nigerian', 'north_macedonian', 'norwegian', 'omani', 'pakistani',
            'palauan', 'panamanian', 'papua_new_guinean', 'paraguayan', 'peruvian', 'filipino', 'polish',
            'portuguese', 'qatari', 'romanian', 'russian', 'rwandan', 'saudi', 'senegalese', 'serbian',
            'seychellois', 'sierra_leonean', 'singaporean', 'slovak', 'slovenian', 'solomon_islander',
            'somali', 'south_african', 'south_sudanese', 'spanish', 'sri_lankan', 'sudanese', 'surinamese',
            'swedish', 'swiss', 'syrian', 'taiwanese', 'tajik', 'tanzanian', 'thai', 'timorese', 'togolese',
            'tongan', 'trinidadian_tobagonian', 'tunisian', 'turkish', 'turkmen', 'tuvaluan', 'ugandan',
            'ukrainian', 'emirati', 'american', 'uruguayan', 'uzbekistani', 'venezuelan', 'vietnamese',
            'yemeni', 'zambian', 'zimbabwean',
        ];
        return keys.map((key) => ({
            value: key,
            label: t(`nationalities:${key}`, { defaultValue: key.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()) }),
        })).sort((a, b) => a.label.localeCompare(b.label));
    }, [t]);

    // Build country options from translation files
    const countryOptions = useMemo(() => {
        const keys = [
            'c_af', 'c_al', 'c_dz', 'c_ad', 'c_ao', 'c_ag', 'c_ar', 'c_am', 'c_au', 'c_at', 'c_az',
            'c_bs', 'c_bh', 'c_bd', 'c_bb', 'c_by', 'c_be', 'c_bz', 'c_bj', 'c_bt', 'c_bo', 'c_ba',
            'c_bw', 'c_br', 'c_bn', 'c_bg', 'c_bf', 'c_bi', 'c_kh', 'c_cm', 'c_ca', 'c_cv', 'c_cf',
            'c_td', 'c_cl', 'c_cn', 'c_co', 'c_km', 'c_cg', 'c_cd', 'c_cr', 'c_hr', 'c_cu', 'c_cy',
            'c_cz', 'c_ci', 'c_dk', 'c_dj', 'c_dm', 'c_do', 'c_ec', 'c_eg', 'c_sv', 'c_gq', 'c_er',
            'c_ee', 'c_sz', 'c_et', 'c_fj', 'c_fi', 'c_fr', 'c_ga', 'c_gm', 'c_ge', 'c_de', 'c_gh',
            'c_gr', 'c_gd', 'c_gt', 'c_gn', 'c_gw', 'c_gy', 'c_ht', 'c_hn', 'c_hu', 'c_is', 'c_in',
            'c_id', 'c_ir', 'c_iq', 'c_ie', 'c_il', 'c_it', 'c_jm', 'c_jp', 'c_jo', 'c_kz', 'c_ke',
            'c_ki', 'c_kp', 'c_kr', 'c_kw', 'c_kg', 'c_la', 'c_lv', 'c_lb', 'c_ls', 'c_lr', 'c_ly',
            'c_li', 'c_lt', 'c_lu', 'c_mg', 'c_mw', 'c_my', 'c_mv', 'c_ml', 'c_mt', 'c_mh', 'c_mr',
            'c_mu', 'c_mx', 'c_fm', 'c_md', 'c_mc', 'c_mn', 'c_me', 'c_ma', 'c_mz', 'c_mm', 'c_na',
            'c_nr', 'c_np', 'c_nl', 'c_nz', 'c_ni', 'c_ne', 'c_ng', 'c_mk', 'c_no', 'c_om', 'c_pk',
            'c_pw', 'c_ps', 'c_pa', 'c_pg', 'c_py', 'c_pe', 'c_ph', 'c_pl', 'c_pt', 'c_qa', 'c_ro',
            'c_ru', 'c_rw', 'c_kn', 'c_lc', 'c_vc', 'c_ws', 'c_sm', 'c_st', 'c_sa', 'c_sn', 'c_rs',
            'c_sc', 'c_sl', 'c_sg', 'c_sk', 'c_si', 'c_sb', 'c_so', 'c_za', 'c_ss', 'c_es', 'c_lk',
            'c_sd', 'c_sr', 'c_se', 'c_ch', 'c_sy', 'c_tj', 'c_tz', 'c_th', 'c_tl', 'c_tg', 'c_to',
            'c_tt', 'c_tn', 'c_tr', 'c_tm', 'c_tv', 'c_ug', 'c_ua', 'c_ae', 'c_gb', 'c_us', 'c_uy',
            'c_uz', 'c_vu', 'c_va', 'c_ve', 'c_vn', 'c_ye', 'c_zm', 'c_zw',
        ];
        return keys.map((key) => ({
            value: key,
            label: t(`countries:${key}`, { defaultValue: key }),
        })).sort((a, b) => a.label.localeCompare(b.label));
    }, [t]);

    // Validation
    const validate = (): boolean => {
        const e: Record<string, string> = {};
        if (!profileName.trim()) e.profileName = 'Required';
        else if (profileName.length > 15) e.profileName = 'Max 15 characters';
        else if (!/^[a-zA-Z0-9 ]+$/.test(profileName)) e.profileName = 'Only letters, numbers, and spaces';
        if (!gender) e.gender = 'Required';
        if (!dob) e.dob = 'Required';
        else {
            const age = Math.floor((Date.now() - dob.getTime()) / (365.25 * 24 * 60 * 60 * 1000));
            if (age < 18) e.dob = 'Must be at least 18 years old';
        }
        if (nationality.length === 0) e.nationality = 'Required';
        if (!grewUpIn) e.grewUpIn = 'Required';
        setErrors(e);
        return Object.keys(e).length === 0;
    };

    const handleSubmit = async () => {
        if (!validate()) return;

        Alert.alert(
            t('common:step_1.confirm_title', { defaultValue: 'Confirm Details' }),
            t('common:step_1.confirm_message', {
                defaultValue: 'Gender, date of birth, and where you grew up cannot be changed later. Are you sure?',
            }),
            [
                { text: t('common:common.cancel', { defaultValue: 'Cancel' }), style: 'cancel' },
                {
                    text: t('common:common.continue', { defaultValue: 'Continue' }),
                    onPress: async () => {
                        setLoading(true);
                        try {
                            const payload = {
                                religion: 'islam',
                                profileName: profileName.trim(),
                                gender,
                                dob: dob!.toISOString().split('T')[0],
                                nationality,
                                grew_up_in: grewUpIn,
                            };

                            const res = await profileService.createProfile(payload);
                            if (res.success) {
                                setGender(gender);
                                setProfileData(payload);
                                router.push('/(profile-setup)/step2');
                            } else {
                                Alert.alert('Error', res.message || 'Failed to create profile');
                            }
                        } catch (err) {
                            Alert.alert('Error', 'Something went wrong');
                        } finally {
                            setLoading(false);
                        }
                    },
                },
            ]
        );
    };

    const maxDate = new Date();
    maxDate.setFullYear(maxDate.getFullYear() - 18);

    const getDisplayLabel = (value: string, opts: SelectOption[]) =>
        opts.find((o) => o.value === value)?.label || '';

    const iconColor = isDark ? '#94A3B8' : '#6B7280';

    return (
        <SafeAreaView className="flex-1 bg-white dark:bg-slate-900">
            <ProgressBar currentStep={1} />

            <KeyboardAvoidingView
                style={{ flex: 1 }}
                behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            >
                <ScrollView
                    contentContainerStyle={{ padding: scale(20), paddingBottom: scale(100) }}
                    keyboardShouldPersistTaps="handled"
                    showsVerticalScrollIndicator={false}
                >
                    {/* Title */}
                    <Text variant="heading" className="font-heading mb-1" align="center">
                        {t('common:step_1.title')}
                    </Text>
                    <Text variant="body-sm" className="mb-6" align="center" style={{ color: isDark ? '#94A3B8' : '#6B7280' }}>
                        {t('common:step_1.subtitle')}
                    </Text>

                    {/* Profile Name */}
                    <FieldLabel text={t('common:step_1.profile_name', { defaultValue: 'Name' })} required />
                    <Input
                        placeholder={t('common:step_1.profile_name_placeholder', { defaultValue: 'Profile name' })}
                        value={profileName}
                        onChangeText={(text) => {
                            setProfileName(text);
                            if (errors.profileName) setErrors((e) => ({ ...e, profileName: '' }));
                        }}
                        maxLength={15}
                        error={errors.profileName}
                        leftIcon={<User size={scale(18)} color={iconColor} />}
                    />

                    {/* Gender */}
                    <FieldLabel text={t('common:step_1.gender', { defaultValue: 'Gender' })} required />
                    <SelectField
                        value={gender ? getDisplayLabel(gender, genderOptions) : ''}
                        placeholder={t('common:step_1.select_gender', { defaultValue: 'Select your gender' })}
                        onPress={() => setShowGenderSheet(true)}
                        icon={<Users size={scale(18)} color={iconColor} />}
                        hasError={!!errors.gender}
                    />
                    {errors.gender && <ErrorText text={errors.gender} />}

                    {/* Date of Birth */}
                    <FieldLabel text={t('common:step_1.dob', { defaultValue: 'Date of Birth' })} required />
                    <SelectField
                        value={dob ? formatDate(dob) : ''}
                        placeholder={t('common:step_1.select_dob', { defaultValue: formatDate(maxDate) })}
                        onPress={() => setShowDatePicker(true)}
                        icon={<CalendarDays size={scale(18)} color={iconColor} />}
                        hasError={!!errors.dob}
                    />
                    {errors.dob && <ErrorText text={errors.dob} />}
                    {showDatePicker && (
                        <DateTimePicker
                            value={dob || maxDate}
                            mode="date"
                            display="spinner"
                            maximumDate={maxDate}
                            minimumDate={new Date(1940, 0, 1)}
                            onChange={(_, selectedDate) => {
                                setShowDatePicker(false);
                                if (selectedDate) {
                                    setDob(selectedDate);
                                    if (errors.dob) setErrors((e) => ({ ...e, dob: '' }));
                                }
                            }}
                        />
                    )}

                    {/* Nationality */}
                    <FieldLabel text={t('common:step_1.nationality', { defaultValue: 'Nationality' })} required />
                    <SelectField
                        value={
                            nationality.length > 0
                                ? nationality.map((n) => getDisplayLabel(n, nationalityOptions)).join(', ')
                                : ''
                        }
                        placeholder={t('common:step_1.select_nationality', { defaultValue: 'Nationality' })}
                        onPress={() => setShowNationalitySheet(true)}
                        icon={<Flag size={scale(18)} color={iconColor} />}
                        hasError={!!errors.nationality}
                    />
                    {errors.nationality && <ErrorText text={errors.nationality} />}

                    {/* Where Did You Grow Up */}
                    <FieldLabel text={t('common:step_1.grew_up_in', { defaultValue: 'Where did you grow up?' })} required />
                    <SelectField
                        value={grewUpIn ? getDisplayLabel(grewUpIn, countryOptions) : ''}
                        placeholder={t('common:step_1.select_country', { defaultValue: 'Where Did You Grow Up?' })}
                        onPress={() => setShowCountrySheet(true)}
                        icon={<Globe size={scale(18)} color={iconColor} />}
                        hasError={!!errors.grewUpIn}
                    />
                    {errors.grewUpIn && <ErrorText text={errors.grewUpIn} />}
                </ScrollView>
            </KeyboardAvoidingView>

            {/* Next Button */}
            <View style={styles.footer}>
                <GradientButton
                    title={t('common:common.continue', { defaultValue: 'Continue' })}
                    onPress={handleSubmit}
                    loading={loading}
                    disabled={loading}
                />
            </View>

            {/* Sheets */}
            <SingleSelectSheet
                visible={showGenderSheet}
                onClose={() => setShowGenderSheet(false)}
                onSelect={(v) => { setGenderLocal(v); if (errors.gender) setErrors((e) => ({ ...e, gender: '' })); }}
                options={genderOptions}
                selected={gender}
                title={t('common:step_1.gender', { defaultValue: 'Gender' })}
            />
            <MultiSelectSheet
                visible={showNationalitySheet}
                onClose={() => setShowNationalitySheet(false)}
                onConfirm={(v) => { setNationality(v); if (errors.nationality) setErrors((e) => ({ ...e, nationality: '' })); }}
                options={nationalityOptions}
                selected={nationality}
                title={t('common:step_1.nationality', { defaultValue: 'Nationality' })}
                maxSelections={2}
                searchEnabled
            />
            <SingleSelectSheet
                visible={showCountrySheet}
                onClose={() => setShowCountrySheet(false)}
                onSelect={(v) => { setGrewUpIn(v); if (errors.grewUpIn) setErrors((e) => ({ ...e, grewUpIn: '' })); }}
                options={countryOptions}
                selected={grewUpIn}
                title={t('common:step_1.grew_up_in', { defaultValue: 'Where Did You Grow Up?' })}
                searchEnabled
            />
        </SafeAreaView>
    );
}



const styles = StyleSheet.create({
    footer: {
        padding: scale(20),
        paddingBottom: scale(10),
    },
});
