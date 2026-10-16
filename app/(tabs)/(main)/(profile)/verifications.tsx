import React from 'react';
import { router, useFocusEffect } from 'expo-router';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppBackTitleBar } from '@/components/app/AppBackTitleBar';
import { SettingsFieldSection } from '@/components/settings/SettingsFieldSection';
import { SettingsInfoRow, SettingsNavRow } from '@/components/settings/SettingsRows';
import { useAuthStore } from '@/store/authStore';
import { Camera, CalendarDots, Phone } from 'phosphor-react-native';
import { Text } from '@/components/ui/Text';
import { useColors } from '@/hooks/useColors';
import { useLanguage } from '@/hooks/useLanguage';
import { scale } from '@/hooks/useResponsive';
import { t } from '@/lib/profileDisplay';

export default function VerificationsScreen() {
    const user = useAuthStore((state) => state.user);
    const refreshUser = useAuthStore((state) => state.refreshUser);
    useFocusEffect(React.useCallback(() => { void refreshUser(); }, [refreshUser]));
    const colors = useColors();
    const insets = useSafeAreaInsets();
    const { isRTL } = useLanguage();
    const sections = [
        ['phone', 'Phone number', 'Confirm that your phone number belongs to you.', Phone],
        ['selfie', 'Selfie verification', 'Match a fresh selfie to your profile photo.', Camera],
        ['age', 'Age verification', 'Confirm your age through a verification check.', CalendarDots],
    ] as const;

    return (
        <View style={[styles.screen, { backgroundColor: colors.brand.bg.surface }]}>
            <AppBackTitleBar title={t('verifications_page.title', 'Verifications')} fallbackHref="/settings" showMenu />
            <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + scale(24) }}>
                <SettingsFieldSection>
                    {sections.map(([key, title, description, Icon], index) => key === 'phone' ? (
                        <SettingsNavRow key={key} icon={<Icon size={scale(19)} color={colors.chrome.common.textStrong} />}
                            iconAlign="flex-start"
                            labelColor={colors.chrome.common.textMuted}
                            descriptionColor={colors.brand.text.body}
                            label={t(`verifications_page.${key}`, title)}
                            description={t('phone_verification.intro')}
                            descriptionContent={user?.phone?.verified ? (
                                <View style={[styles.verifiedNumber, { flexDirection: 'row' }]}>
                                    <Text variant="body-sm" style={{ color: colors.brand.text.body, writingDirection: 'ltr', fontSize: scale(14), lineHeight: scale(20) }}>
                                        {user.phone.number}
                                    </Text>
                                    <View style={[styles.verifiedPill, { backgroundColor: colors.chrome.primary }]}>
                                        <Text variant="caption" className="font-body-bold" style={[styles.verifiedText, { color: colors.chrome.common.inverseText }]}>
                                            {t('badge_verified', 'Verified')}
                                        </Text>
                                    </View>
                                </View>
                            ) : undefined}
                            divider={index > 0} onPress={() => router.push('/phone-verification' as any)} />
                    ) : (
                        <SettingsInfoRow
                            iconAlign="flex-start"
                            key={key}
                            icon={<Icon size={scale(19)} color={colors.chrome.common.textStrong} />}
                            label={t(`verifications_page.${key}`, title)}
                            value={t(`verifications_page.${key}_description`, description)}
                            note={t('verifications_page.notice', 'Available to paid members')}
                            noteColor={colors.chrome.primary}
                            divider={index > 0}
                        />
                    ))}
                </SettingsFieldSection>
            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    screen: { flex: 1 },
    verifiedNumber: { width: '100%', flexWrap: 'wrap', alignItems: 'center', gap: scale(6) },
    verifiedPill: { borderRadius: 999, paddingHorizontal: scale(8), paddingVertical: scale(2), maxWidth: '100%' },
    verifiedText: { fontSize: scale(11), lineHeight: scale(16), textAlign: 'center' },
});
