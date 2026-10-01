import React, { useState } from 'react';
import { usePathname } from 'expo-router';
import { ActivityIndicator, ScrollView, StyleSheet, View } from 'react-native';
import { Check } from '@/components/ui/icons/PhosphorCompat';
import { Text } from '@/components/ui/Text';
import { AppBackTitleBar } from '@/components/app/AppBackTitleBar';
import { SettingsNavRow } from '@/components/settings/SettingsRows';
import { SettingsFieldSection } from '@/components/settings/SettingsFieldSection';
import { useLanguage } from '@/hooks/useLanguage';
import { useColors } from '@/hooks/useColors';
import { scale } from '@/hooks/useResponsive';
import { SUPPORTED_APP_LANGUAGES } from '@/lib/languageNames';

const LANGUAGES = SUPPORTED_APP_LANGUAGES;

function textValue(value: unknown, fallback: string) {
    return typeof value === 'string' && value.trim() ? value.trim() : fallback;
}

export default function LanguageScreen() {
    const { currentLanguage, changeLanguage, t } = useLanguage();
    const pathname = usePathname();
    const colors = useColors();
    const primary = colors.chrome.primary;
    const [savingCode, setSavingCode] = useState<string | null>(null);

    async function selectLanguage(code: string) {
        if (code === currentLanguage || savingCode) return;
        setSavingCode(code);
        try {
            await changeLanguage(code, pathname);
        } finally {
            setSavingCode(null);
        }
    }

    return (
        <View style={[styles.root, { backgroundColor: colors.brand.bg.surface }]}>
            <AppBackTitleBar title={textValue(t('language'), 'Language')} fallbackHref="/settings" showMenu />
            <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
                <SettingsFieldSection>
                    {LANGUAGES.map((language, index) => {
                        const active = language.code === currentLanguage;
                        const loading = savingCode === language.code;
                        const label = textValue(t(language.translationKey), language.name);

                        return (
                            <SettingsNavRow
                                key={language.code}
                                icon={<Text style={styles.flag}>{language.flag}</Text>}
                                label={language.code.toUpperCase()}
                                description={label}
                                onPress={() => void selectLanguage(language.code)}
                                disabled={Boolean(savingCode)}
                                divider={index > 0}
                                selected={active}
                                showChevron={false}
                                accessory={(
                                    <View style={styles.accessorySlot}>
                                        {loading ? (
                                            <ActivityIndicator size="small" color={primary} />
                                        ) : active ? (
                                            <View style={[styles.checkCircle, { backgroundColor: primary }]}>
                                                <Check size={scale(12)} color="#FFFFFF" strokeWidth={3} />
                                            </View>
                                        ) : null}
                                    </View>
                                )}
                            />
                        );
                    })}
                </SettingsFieldSection>
            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    root: {
        flex: 1,
    },
    content: {
        paddingTop: 0,
        paddingBottom: scale(32),
    },
    flag: {
        fontSize: scale(19),
        lineHeight: scale(24),
    },
    accessorySlot: {
        width: scale(24),
        height: scale(24),
        alignItems: 'center',
        justifyContent: 'center',
    },
    checkCircle: {
        width: scale(22),
        height: scale(22),
        borderRadius: scale(11),
        alignItems: 'center',
        justifyContent: 'center',
    },
});
