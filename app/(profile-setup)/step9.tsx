import React, { useState } from 'react';
import { View, ScrollView, KeyboardAvoidingView, Platform, Alert, StyleSheet } from 'react-native';
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
import { profileService } from '@/lib/profileService';
import { useProfileSetupStore } from '@/store/profileSetupStore';
import { UserCircle } from 'lucide-react-native';

const PROFILE_MANAGER_OPTIONS = [
    'self',
    'father',
    'mother',
    'brother',
    'sister',
    'relative',
    'friend',
] as const;

type ProfileManagerOption = (typeof PROFILE_MANAGER_OPTIONS)[number];

function isProfileManagerOption(value: string): value is ProfileManagerOption {
    return PROFILE_MANAGER_OPTIONS.includes(value as ProfileManagerOption);
}

export default function Step9() {
    const { t } = useTranslation('common');
    const { isDark } = useTheme();
    const { setProfileData } = useProfileSetupStore();
    const iconColor = isDark ? '#94A3B8' : '#6B7280';

    const [profileManager, setProfileManager] = useState('');
    const [loading, setLoading] = useState(false);
    const [showSheet, setShowSheet] = useState(false);
    const [errors, setErrors] = useState<Record<string, string>>({});

    const options: SelectOption[] = PROFILE_MANAGER_OPTIONS.map((value) => ({
        value,
        label: t(value),
    }));

    const handleSubmit = async () => {
        if (!isProfileManagerOption(profileManager)) {
            setErrors({ profileManager: t('profile_manager_required') });
            return;
        }
        setLoading(true);
        try {
            const payload = { profile_manager: profileManager };
            const res = await profileService.updateProfile(payload);
            if (res.success) {
                setProfileData(payload);
                router.push('/(profile-setup)/step10');
            } else {
                Alert.alert(t('common:error', { defaultValue: 'Error' }), res.message || t('common:server_error_default', { defaultValue: 'Failed to update' }));
            }
        } catch {
            Alert.alert(t('common:error', { defaultValue: 'Error' }), t('common:server_error_default', { defaultValue: 'Something went wrong' }));
        } finally {
            setLoading(false);
        }
    };

    return (
        <SafeAreaView className="flex-1 bg-white dark:bg-slate-900">
            <ProgressBar currentStep={9} />
            <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
                <ScrollView contentContainerStyle={{ padding: scale(20), paddingBottom: scale(100) }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
                    <ProfileSetupHeader
                        title={t('profile_m_title', { defaultValue: 'Who Is Creating This Profile?' })}
                        subtitle={t('profile_m_desc', { defaultValue: 'Let us know who is operating this profile — yourself or someone on your behalf.' })}
                    />

                    <FieldLabel text={t('profile_manager')} required />
                    <SelectField
                        value={profileManager ? options.find((o) => o.value === profileManager)?.label || '' : ''}
                        placeholder={t('pm_placeholder')}
                        onPress={() => setShowSheet(true)}
                        icon={<UserCircle size={scale(18)} color={iconColor} />}
                        hasError={!!errors.profileManager}
                    />
                    {errors.profileManager && <ErrorText text={errors.profileManager} />}
                </ScrollView>
            </KeyboardAvoidingView>

            <View style={styles.footer}>
                <GradientButton
                    title={t('continue', { defaultValue: 'Continue' })}
                    onPress={handleSubmit}
                    loading={loading}
                    disabled={loading}
                />
            </View>

            <SingleSelectSheet
                visible={showSheet}
                onClose={() => setShowSheet(false)}
                onSelect={(v) => { setProfileManager(v); setErrors({}); }}
                options={options}
                selected={profileManager}
                title={t('profile_manager')}
            />
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({ footer: { padding: scale(20), paddingBottom: scale(10) } });
