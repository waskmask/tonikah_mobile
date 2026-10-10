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
    const textAlign = isRTL ? 'right' : 'left';
    const sections = [
        ['selfie', 'Selfie verification', 'Match a fresh selfie to your profile photo.', Camera],
        ['age', 'Age verification', 'Confirm your age through a verification check.', CalendarDots],
        ['phone', 'Phone number', 'Confirm that your phone number belongs to you.', Phone],
    ] as const;

    return (
        <View style={[styles.screen, { backgroundColor: colors.brand.bg.surface }]}>
            <AppBackTitleBar title={t('verifications_page.title', 'Verifications')} fallbackHref="/settings" showMenu />
            <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + scale(24) }}>
                <View style={[styles.notice, {
                    borderColor: colors.chrome.primary,
                    backgroundColor: colors.chrome.common.primaryTint,
                }]}>
                    <Text variant="body-sm" className="font-body-bold" style={{ textAlign, color: colors.chrome.common.textStrong }}>
                        {t('phone_verification.notice')}
                    </Text>
                    <Text variant="body-sm" style={{ textAlign, color: colors.brand.text.subtitle }}>
                        {t('phone_verification.notice_description')}
                    </Text>
                </View>
                <SettingsFieldSection>
                    {sections.map(([key, title, description, Icon], index) => key === 'phone' ? (
                        <SettingsNavRow key={key} icon={<Icon size={scale(19)} color={colors.chrome.common.textStrong} />}
                            label={t(`verifications_page.${key}`, title)}
                            description={user?.phone?.verified ? `${t('phone_verification.verified')} · ${user.phone.number}` : t('phone_verification.intro')}
                            divider={index > 0} onPress={() => router.push('/phone-verification' as any)} />
                    ) : (
                        <SettingsInfoRow
                            key={key}
                            icon={<Icon size={scale(19)} color={colors.chrome.common.textStrong} />}
                            label={t(`verifications_page.${key}`, title)}
                            value={t(`verifications_page.${key}_description`, description)}
                            note={t('phone_verification.coming_soon')}
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
    notice: { margin: scale(16), padding: scale(16), gap: scale(8), borderWidth: 2, borderStyle: 'dashed', borderRadius: 8 },
});
