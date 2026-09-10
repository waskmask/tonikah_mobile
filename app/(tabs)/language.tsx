import React, { useState } from 'react';
import { usePathname } from 'expo-router';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Check } from 'lucide-react-native';
import { Text } from '@/components/ui/Text';
import { AppBackTitleBar } from '@/components/app/AppBackTitleBar';
import { useLanguage } from '@/hooks/useLanguage';
import { useColors } from '@/hooks/useColors';
import { scale } from '@/hooks/useResponsive';
import { space } from '@/constants/uiTokens';
import { SUPPORTED_APP_LANGUAGES } from '@/lib/languageNames';

const LANGUAGES = SUPPORTED_APP_LANGUAGES;

function textValue(value: unknown, fallback: string) {
    return typeof value === 'string' && value.trim() ? value.trim() : fallback;
}

export default function LanguageScreen() {
    const { currentLanguage, changeLanguage, t, isRTL } = useLanguage();
    const pathname = usePathname();
    const colors = useColors();
    const primary = colors.chrome.primary;
    const [savingCode, setSavingCode] = useState<string | null>(null);

    const textColor = colors.brand.text.body;
    const mutedColor = colors.brand.text.subtitle;
    const borderColor = colors.brand.bg.border;

    async function selectLanguage(code: string) {
        if (code === currentLanguage || savingCode) return;
        setSavingCode(code);
        await changeLanguage(code, pathname);
    }

    return (
        <View style={[styles.root, { backgroundColor: colors.brand.bg.surface }]}>
            <AppBackTitleBar title={textValue(t('language'), 'Language')} fallbackHref="/(tabs)/settings" />
            <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
                {LANGUAGES.map((language, index) => {
                    const active = language.code === currentLanguage;
                    const loading = savingCode === language.code;
                    const label = textValue(t(language.translationKey), language.name);

                    return (
                        <Pressable
                            key={language.code}
                            accessibilityRole="radio"
                            accessibilityLabel={label}
                            accessibilityState={{ checked: active, disabled: Boolean(savingCode) }}
                            onPress={() => selectLanguage(language.code)}
                            disabled={Boolean(savingCode)}
                            android_ripple={{ color: colors.chrome.common.primaryTint }}
                            style={[
                                styles.row,
                                index > 0 && { borderTopColor: borderColor, borderTopWidth: StyleSheet.hairlineWidth },
                                active && { backgroundColor: colors.chrome.common.primaryTint },
                            ]}
                        >
                            <View
                                pointerEvents="none"
                                style={[
                                    styles.checkCircle,
                                    isRTL ? styles.checkCircleRtl : styles.checkCircleLtr,
                                    active ? { borderColor: primary, backgroundColor: primary } : { borderColor },
                                ]}
                            >
                                {loading ? (
                                    <ActivityIndicator size="small" color={active ? '#FFFFFF' : primary} />
                                ) : active ? (
                                    <Check size={scale(13)} color="#FFFFFF" strokeWidth={3} />
                                ) : null}
                            </View>
                            <Text
                                pointerEvents="none"
                                numberOfLines={1}
                                variant="body"
                                className="font-body-semi"
                                style={[
                                    styles.label,
                                    isRTL ? styles.labelRtl : styles.labelLtr,
                                    { color: active ? primary : textColor, textAlign: isRTL ? 'right' : 'left' },
                                ]}
                            >
                                {label}
                            </Text>
                        </Pressable>
                    );
                })}

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
        position: 'relative',
        width: '100%',
        height: scale(56),
        borderRadius: scale(12),
    },
    label: {
        position: 'absolute',
        top: scale(15),
        fontSize: scale(16),
        lineHeight: scale(21),
    },
    labelLtr: {
        left: scale(48),
        right: space('sm'),
    },
    labelRtl: {
        left: space('sm'),
        right: scale(48),
    },
    checkCircle: {
        position: 'absolute',
        top: scale(16),
        width: scale(24),
        height: scale(24),
        borderRadius: scale(12),
        borderWidth: 2,
        alignItems: 'center',
        justifyContent: 'center',
    },
    checkCircleLtr: {
        left: space('sm'),
    },
    checkCircleRtl: {
        right: space('sm'),
    },
    helper: {
        marginTop: space('sm'),
        paddingHorizontal: scale(4),
    },
});
