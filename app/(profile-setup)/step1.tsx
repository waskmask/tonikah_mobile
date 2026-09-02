import React, { useState, useMemo } from 'react';
import {
    View,
    ScrollView,
    KeyboardAvoidingView,
    Platform,
    StyleSheet,
} from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Input } from '@/components/ui/Input';
import { GradientButton } from '@/components/ui/GradientButton';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { ProfileSetupHeader } from '@/components/ui/ProfileSetupHeader';
import { SingleSelectSheet, SelectOption } from '@/components/ui/SingleSelectSheet';
import { MultiSelectSheet } from '@/components/ui/MultiSelectSheet';
import { FieldLabel, ErrorText, SelectField } from '@/components/ui/FormField';
import { useTheme } from '@/hooks/useTheme';
import { useLanguage } from '@/hooks/useLanguage';
import { scale } from '@/hooks/useResponsive';
import { ProfileSetupTokens } from '@/constants/uiTokens';
import { profileService } from '@/lib/profileService';
import { useProfileSetupStore } from '@/store/profileSetupStore';
import { useAuthStore } from '@/store/authStore';
import { toast } from '@/hooks/useToast';
import { DateWheelSheet } from '@/components/ui/DateWheelSheet';
import { ConfirmSheet } from '@/components/ui/ConfirmSheet';
import { VenusAndMars, CalendarDays, Flag, Globe, User } from 'lucide-react-native';
import { COUNTRY_OPTIONS, NATIONALITY_OPTIONS } from '@/constants/profileOptions';
import { formatProfileOptionLabel } from '@/lib/profileOptionLabels';
import { apiMessage } from '@/lib/profileDisplay';

/** Format date as DD.MM.YYYY */
const formatDate = (date: Date): string => {
    const d = String(date.getDate()).padStart(2, '0');
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const y = date.getFullYear();
    return `${d}.${m}.${y}`;
};

/** Format date as YYYY-MM-DD, matching the Next.js profile payload. */
const formatInputDate = (date: Date): string => {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
};

export default function Step1() {
    const { t } = useTranslation(['common', 'countries']);
    const { isDark } = useTheme();
    const { isRTL, currentLanguage } = useLanguage();
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
    const [showConfirm, setShowConfirm] = useState(false);
    const [showGenderSheet, setShowGenderSheet] = useState(false);
    const [showNationalitySheet, setShowNationalitySheet] = useState(false);
    const [showCountrySheet, setShowCountrySheet] = useState(false);
    const [errors, setErrors] = useState<Record<string, string>>({});

    // Gender options
    const genderOptions: SelectOption[] = [
        { value: 'male', label: t('common:step_1.male', { defaultValue: 'Male' }) },
        { value: 'female', label: t('common:step_1.female', { defaultValue: 'Female' }) },
    ];

    // Next.js translates nationality values through the countries namespace.
    const nationalityOptions = useMemo(() => {
        return NATIONALITY_OPTIONS.map((key) => ({
            value: key,
            label: formatProfileOptionLabel(
                t(`countries:${key}`, { defaultValue: key.replace(/_/g, ' ') }),
                currentLanguage
            ),
        })).sort((a, b) => a.label.localeCompare(b.label));
    }, [t, currentLanguage]);

    // Build country options from translation files
    const countryOptions = useMemo(() => {
        return COUNTRY_OPTIONS.map((key) => ({
            value: key,
            label: formatProfileOptionLabel(
                t(`countries:${key}`, { defaultValue: key.replace(/_/g, ' ') }),
                currentLanguage
            ),
        })).sort((a, b) => a.label.localeCompare(b.label));
    }, [t, currentLanguage]);

    // Validation
    const validate = (): boolean => {
        const required = t('common:validation_required', { defaultValue: 'Required' });
        const e: Record<string, string> = {};
        if (!profileName.trim()) e.profileName = required;
        else if (profileName.length > 16) e.profileName = t('common:validation_max_16_chars', { defaultValue: 'Max 16 characters' });
        else if (!/^[\p{L}\p{M} ]+$/u.test(profileName)) e.profileName = t('common:validation_letters_only', { defaultValue: 'Only letters and spaces' });
        if (!gender) e.gender = required;
        if (!dob) e.dob = required;
        else {
            // Calendar-accurate age — the old 365.25-day float math failed for
            // people born exactly 18 years ago (leap-day drift)
            const today = new Date();
            let age = today.getFullYear() - dob.getFullYear();
            const monthDiff = today.getMonth() - dob.getMonth();
            if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < dob.getDate())) age--;
            if (age < 18) e.dob = t('common:age_must_be_18', { defaultValue: 'You must be at least 18 years old to use toNikah.' });
        }
        if (nationality.length === 0) e.nationality = required;
        if (!grewUpIn) e.grewUpIn = required;
        setErrors(e);
        return Object.keys(e).length === 0;
    };

    const handleSubmit = () => {
        if (!validate()) return;
        setShowConfirm(true);
    };

    const submitProfile = async () => {
        setShowConfirm(false);
        setLoading(true);
        try {
            const payload = {
                religion: 'islam',
                profileName: profileName.trim(),
                gender,
                dob: formatInputDate(dob!),
                nationality,
                grew_up_in: grewUpIn,
            };

            const res = await profileService.createProfile(payload);
            if (res.success) {
                setGender(gender);
                setProfileData(payload);
                // Refresh the cached /me user so an app reload resumes at the
                // next incomplete step instead of replaying this one
                useAuthStore.getState().refreshUser().catch(() => { });
                router.replace('/(profile-setup)/step2');
            } else {
                toast.show(apiMessage(res.message || 'server_error_default'), 'error');
            }
        } catch (err) {
            toast.show(apiMessage('server_error_default'), 'error');
        } finally {
            setLoading(false);
        }
    };

    // Latest selectable birthday: 18 years ago minus one day, so picking the
    // default always passes the 18+ check
    const maxDate = useMemo(() => {
        const d = new Date();
        d.setFullYear(d.getFullYear() - 18);
        d.setDate(d.getDate() - 1);
        return d;
    }, []);

    const handleDateConfirm = (selectedDate: Date) => {
        setDob(selectedDate);
        if (errors.dob) setErrors((e) => ({ ...e, dob: '' }));
    };

    const getDisplayLabel = (value: string, opts: SelectOption[]) =>
        opts.find((o) => o.value === value)?.label || '';

    const iconColor = isDark ? '#A99C8D' : '#7D7266';

    return (
        <SafeAreaView className="flex-1 bg-brand-bg-primary">
            <ProgressBar currentStep={1} />

                <KeyboardAwareScrollView
                    style={{ flex: 1 }}
                    contentContainerStyle={ProfileSetupTokens.scrollContent}
                    keyboardShouldPersistTaps="handled"
                    showsVerticalScrollIndicator={false}
                    bottomOffset={scale(100)}
                >
                    <ProfileSetupHeader
                        step={1}
                        title={t('common:step_1.title', { defaultValue: 'Profile Basics' })}
                        subtitle={t('common:step_1.subtitle', { defaultValue: 'Kindly provide the essential details of the person this profile is for.' })}
                    />

                    {/* Profile Name */}
                    <Input required
                        // Input has its own bottom margin; SelectField below adds 22 top —
                        // cancel ours so every field gap in the form is equal
                        containerStyle="mb-0"
                        placeholder={t('common:step_1.profile_name_placeholder', { defaultValue: 'Profile name' })}
                        value={profileName}
                        onChangeText={(text) => {
                            setProfileName(text);
                            if (errors.profileName) setErrors((e) => ({ ...e, profileName: '' }));
                        }}
                        maxLength={16}
                        error={errors.profileName}
                        rightIcon={<User size={scale(18)} color={iconColor} />}
                    />

                    {/* Gender */}
                    <SelectField required
                        value={gender ? getDisplayLabel(gender, genderOptions) : ''}
                        placeholder={t('common:step_1.select_gender', { defaultValue: 'Select your gender' })}
                        onPress={() => setShowGenderSheet(true)}
                        icon={<VenusAndMars size={scale(18)} color={iconColor} />}
                        hasError={!!errors.gender}
                    />
                    {errors.gender && <ErrorText text={errors.gender} />}

                    {/* Date of Birth */}
                    <SelectField required
                        value={dob ? formatDate(dob) : ''}
                        placeholder={t('common:step_1.select_dob', { defaultValue: formatDate(maxDate) })}
                        onPress={() => setShowDatePicker(true)}
                        icon={<CalendarDays size={scale(18)} color={iconColor} />}
                        hasError={!!errors.dob}
                    />
                    {errors.dob && <ErrorText text={errors.dob} />}

                    {/* Nationality */}
                    <SelectField required
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
                    <SelectField required
                        value={grewUpIn ? getDisplayLabel(grewUpIn, countryOptions) : ''}
                        placeholder={t('common:step_1.select_country', { defaultValue: 'Where Did You Grow Up?' })}
                        onPress={() => setShowCountrySheet(true)}
                        icon={<Globe size={scale(18)} color={iconColor} />}
                        hasError={!!errors.grewUpIn}
                    />
                    {errors.grewUpIn && <ErrorText text={errors.grewUpIn} />}
                </KeyboardAwareScrollView>

            {/* Next Button */}
            <View style={styles.footer}>
                <GradientButton
                    title={t('common:continue', { defaultValue: 'Continue' })}
                    onPress={handleSubmit}
                    loading={loading}
                    disabled={loading}
                    widthMode="full"
                    height={40}
                    textSize={15}
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
            <ConfirmSheet
                visible={showConfirm}
                onClose={() => setShowConfirm(false)}
                onConfirm={submitProfile}
                title={t('common:step_1.confirm_title', { defaultValue: 'Confirm Details' })}
                message={t('common:step_1.confirm_message', {
                    defaultValue: 'Profile name, gender, date of birth, and where you grew up cannot be changed later. Are you sure?',
                })}
                confirmLabel={t('common:continue', { defaultValue: 'Continue' })}
                cancelLabel={t('common:cancel', { defaultValue: 'Cancel' })}
            />
            <DateWheelSheet
                visible={showDatePicker}
                onClose={() => setShowDatePicker(false)}
                onConfirm={handleDateConfirm}
                value={dob}
                minDate={new Date(1940, 0, 1)}
                maxDate={maxDate}
                title={t('common:step_1.dob', { defaultValue: 'Date of Birth' })}
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
