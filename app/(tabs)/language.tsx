import React, { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Check } from 'lucide-react-native';
import { Text } from '@/components/ui/Text';
import { AppBackTitleBar } from '@/components/app/AppBackTitleBar';
import { SectionCard } from '@/components/ui/SectionCard';
import { useLanguage } from '@/hooks/useLanguage';
import { useColors } from '@/hooks/useColors';
import { scale } from '@/hooks/useResponsive';
import { space } from '@/constants/uiTokens';

const LANGUAGES = [
    { code: 'en', key: 'English', fallback: 'English' },
    { code: 'ar', key: 'Arabic', fallback: 'العربية' },
    { code: 'fr', key: 'French', fallback: 'Français' },
    { code: 'de', key: 'German', fallback: 'Deutsch' },
    { code: 'tr', key: 'Turkish', fallback: 'Türkçe' },
    { code: 'id', key: 'Indonesian', fallback: 'Indonesian' },
    { code: 'es', key: 'Spanish', fallback: 'Español' },
    { code: 'it', key: 'Italian', fallback: 'Italiano' },
    { code: 'pl', key: 'Polish', fallback: 'Polski' },
    { code: 'pt', key: 'Portuguese', fallback: 'Português' },
    { code: 'ru', key: 'Russian', fallback: 'Русский' },
];

function textValue(value: unknown, fallback: string) {
    return typeof value === 'string' && value.trim() ? value.trim() : fallback;
}

export default function LanguageScreen() {
    const { currentLanguage, changeLanguage, t, isRTL } = useLanguage();
    const colors = useColors();
    const primary = colors.chrome.primary;
    const [savingCode, setSavingCode] = useState<string | null>(null);

    const textColor = colors.brand.text.body;
    const mutedColor = colors.brand.text.subtitle;
    const borderColor = colors.brand.bg.border;

    async function selectLanguage(code: string) {
        if (code === currentLanguage || savingCode) return;
        setSavingCode(code);
        await changeLanguage(code);
    }

    return (
        <View style={[styles.root, { backgroundColor: colors.brand.bg.surface }]}>
            <AppBackTitleBar title={textValue(t('language'), 'Language')} fallbackHref="/(tabs)/settings" />
            <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
                <SectionCard>
                    {LANGUAGES.map((language, index) => {
                        const active = language.code === currentLanguage;
                        const loading = savingCode === language.code;
                        const label = textValue(t(language.key), language.fallback);

                        return (
                            <Pressable
                                key={language.code}
                                onPress={() => selectLanguage(language.code)}
                                disabled={Boolean(savingCode)}
                                style={({ pressed }) => [
                                    styles.row,
                                    index > 0 && { borderTopColor: borderColor, borderTopWidth: StyleSheet.hairlineWidth },
                                    active && { backgroundColor: isRTL ? 'rgba(243,75,111,0.12)' : 'rgba(243,75,111,0.07)' },
                                    pressed && !savingCode && styles.pressed,
                                    { flexDirection: isRTL ? 'row-reverse' : 'row' },
                                ]}
                            >
                                <Text
                                    variant="body"
                                    className="font-body-semi"
                                    style={[
                                        styles.label,
                                        { color: active ? primary : textColor, textAlign: isRTL ? 'right' : 'left' },
                                    ]}
                                >
                                    {label}
                                </Text>
                                <View style={[styles.checkCircle, active ? { borderColor: primary, backgroundColor: primary } : { borderColor }]}>
                                    {loading ? (
                                        <ActivityIndicator size="small" color={active ? '#FFFFFF' : primary} />
                                    ) : active ? (
                                        <Check size={scale(13)} color="#FFFFFF" strokeWidth={3} />
                                    ) : null}
                                </View>
                            </Pressable>
                        );
                    })}
                </SectionCard>

                <Text variant="caption" style={[styles.helper, { color: mutedColor, textAlign: isRTL ? 'right' : 'left' }]}>
                    {textValue(t('language_reload_note'), 'The app reloads after changing language so layout and translations update correctly.')}
                </Text>
            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    root: {
        flex: 1,
    },
    content: {
        paddingHorizontal: space('md'),
        paddingTop: space('md'),
        paddingBottom: scale(32),
    },
    row: {
        minHeight: scale(56),
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: scale(12),
        paddingVertical: scale(12),
        marginHorizontal: -space('xs'),
        paddingHorizontal: space('sm'),
    },
    label: {
        flex: 1,
        fontSize: scale(16),
        lineHeight: scale(21),
    },
    checkCircle: {
        width: scale(24),
        height: scale(24),
        borderRadius: scale(12),
        borderWidth: 2,
        alignItems: 'center',
        justifyContent: 'center',
    },
    helper: {
        marginTop: space('sm'),
        paddingHorizontal: scale(4),
    },
    pressed: {
        opacity: 0.72,
    },
});
