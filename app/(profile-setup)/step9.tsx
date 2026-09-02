import React, { useState } from 'react';
import { View, Pressable, StyleSheet } from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Text } from '@/components/ui/Text';
import { GradientButton } from '@/components/ui/GradientButton';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { ProfileSetupHeader } from '@/components/ui/ProfileSetupHeader';
import { useTheme } from '@/hooks/useTheme';
import { useColors } from '@/hooks/useColors';
import { useHaptics } from '@/hooks/useHaptics';
import { useLanguage } from '@/hooks/useLanguage';
import { scale } from '@/hooks/useResponsive';
import { ProfileSetupTokens } from '@/constants/uiTokens';
import { profileService } from '@/lib/profileService';
import { useProfileSetupStore } from '@/store/profileSetupStore';
import { useAuthStore } from '@/store/authStore';
import { toast } from '@/hooks/useToast';

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
    const palette = useColors();
    const { isRTL } = useLanguage();
    const { lightImpact } = useHaptics();
    const { setProfileData } = useProfileSetupStore();

    const [profileManager, setProfileManager] = useState('');
    const [loading, setLoading] = useState(false);

    const handleSelect = (value: ProfileManagerOption) => {
        lightImpact();
        setProfileManager(value);
    };

    const handleSubmit = async () => {
        if (!isProfileManagerOption(profileManager)) return;
        setLoading(true);
        try {
            const payload = { profile_manager: profileManager };
            const res = await profileService.updateProfile(payload);
            if (res.success) {
                setProfileData(payload);
                // Keep the cached /me user in sync so reload resumes correctly
                useAuthStore.getState().refreshUser().catch(() => { });
                router.push('/(profile-setup)/step10');
            } else {
                toast.show(res.message || t('server_error_default', { defaultValue: 'Failed to update' }), 'error');
            }
        } catch {
            toast.show(t('server_error_default', { defaultValue: 'Something went wrong' }), 'error');
        } finally {
            setLoading(false);
        }
    };

    return (
        <SafeAreaView className="flex-1 bg-brand-bg-primary">
            <ProgressBar currentStep={9} />
            <KeyboardAwareScrollView
                style={{ flex: 1 }}
                contentContainerStyle={ProfileSetupTokens.scrollContent}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
                bottomOffset={scale(100)}
            >
                    <ProfileSetupHeader
                        step={9}
                        title={t('profile_m_title', { defaultValue: 'Who Is Creating This Profile?' })}
                        subtitle={t('profile_m_desc', { defaultValue: 'Let us know who is operating this profile — yourself or someone on your behalf.' })}
                    />

                    {PROFILE_MANAGER_OPTIONS.map((value) => {
                        const isActive = profileManager === value;
                        return (
                            <Pressable
                                key={value}
                                onPress={() => handleSelect(value)}
                                style={[
                                    styles.option,
                                    {
                                        flexDirection: 'row',
                                        borderColor: isActive
                                            ? palette.chrome.primary
                                            : isDark ? palette.brand.bg.border : '#E8E1D6',
                                        backgroundColor: isActive
                                            ? palette.chrome.common.primaryTint
                                            : 'transparent',
                                    },
                                ]}
                            >
                                <View style={{ flex: 1 }}>
                                    <Text
                                        variant="body"
                                        className="font-body-medium"
                                        style={[
                                            { fontSize: scale(15), textAlign: isRTL ? 'right' : 'left' },
                                            isActive && { color: palette.chrome.primary },
                                        ]}
                                    >
                                        {t(value)}
                                    </Text>
                                    <Text
                                        variant="body-sm"
                                        style={{
                                            color: palette.brand.text.muted,
                                            marginTop: scale(2),
                                            fontSize: scale(12),
                                            textAlign: isRTL ? 'right' : 'left',
                                        }}
                                    >
                                        {t(`pm_${value}_desc`)}
                                    </Text>
                                </View>
                            </Pressable>
                        );
                    })}
            </KeyboardAwareScrollView>

            <View style={styles.footer}>
                <GradientButton
                    title={t('continue', { defaultValue: 'Continue' })}
                    onPress={handleSubmit}
                    loading={loading}
                    disabled={loading || !profileManager}
                    widthMode="full"
                    height={40}
                    textSize={15}
                />
            </View>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    footer: { padding: scale(20), paddingBottom: scale(10) },
    option: {
        alignItems: 'center',
        gap: scale(12),
        borderWidth: 1,
        borderRadius: scale(12),
        paddingHorizontal: scale(14),
        paddingVertical: scale(11),
        marginBottom: scale(10),
    },
});
