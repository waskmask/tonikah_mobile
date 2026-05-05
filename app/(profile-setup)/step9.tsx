import React, { useState } from 'react';
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
import { UserCircle } from 'lucide-react-native';

export default function Step9() {
    const { t } = useTranslation('common');
    const { isDark } = useTheme();
    const { setProfileData, reset } = useProfileSetupStore();
    const iconColor = isDark ? '#94A3B8' : '#6B7280';

    const [profileManager, setProfileManager] = useState('');
    const [loading, setLoading] = useState(false);
    const [showSheet, setShowSheet] = useState(false);
    const [errors, setErrors] = useState<Record<string, string>>({});

    const options: SelectOption[] = [
        { value: 'self', label: t('step_9.self') },
        { value: 'father', label: t('step_9.father') },
        { value: 'mother', label: t('step_9.mother') },
        { value: 'brother', label: t('step_9.brother') },
        { value: 'sister', label: t('step_9.sister') },
        { value: 'relative', label: t('step_9.relative') },
        { value: 'friend', label: t('step_9.friend') },
    ];

    const handleSubmit = async () => {
        if (!profileManager) {
            setErrors({ profileManager: 'Required' });
            return;
        }
        setLoading(true);
        try {
            const payload = { profile_manager: profileManager };
            const res = await profileService.updateProfile(payload);
            if (res.success) {
                setProfileData(payload);
                reset();
                router.replace('/(tabs)/home');
            } else {
                Alert.alert('Error', res.message || 'Failed to update');
            }
        } catch {
            Alert.alert('Error', 'Something went wrong');
        } finally {
            setLoading(false);
        }
    };

    return (
        <SafeAreaView className="flex-1 bg-white dark:bg-slate-900">
            <ProgressBar currentStep={9} />
            <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
                <ScrollView contentContainerStyle={{ padding: scale(20), paddingBottom: scale(100) }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
                    <Text variant="heading" className="font-heading mb-1" align="center">{t('step_9.title')}</Text>
                    <Text variant="body-sm" className="mb-4" align="center" style={{ color: isDark ? '#94A3B8' : '#6B7280' }}>{t('step_9.subtitle')}</Text>

                    <FieldLabel text={t('step_9.profile_manager')} required />
                    <SelectField
                        value={profileManager ? options.find((o) => o.value === profileManager)?.label || '' : ''}
                        placeholder="Select"
                        onPress={() => setShowSheet(true)}
                        icon={<UserCircle size={scale(18)} color={iconColor} />}
                        hasError={!!errors.profileManager}
                    />
                    {errors.profileManager && <ErrorText text={errors.profileManager} />}
                </ScrollView>
            </KeyboardAvoidingView>

            <View style={styles.footer}>
                <GradientButton
                    title={t('step_9.finish', { defaultValue: 'Finish' })}
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
                title={t('step_9.profile_manager')}
            />
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({ footer: { padding: scale(20), paddingBottom: scale(10) } });
