import React, { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Check, ChevronLeft, ChevronRight } from 'lucide-react-native';
import { Text } from '@/components/ui/Text';
import { useLanguage } from '@/hooks/useLanguage';
import { useTheme } from '@/hooks/useTheme';
import { scale } from '@/hooks/useResponsive';

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
    const { isDark } = useTheme();
    const [savingCode, setSavingCode] = useState<string | null>(null);

    const backgroundColor = isDark ? '#0F172A' : '#F8FAFC';
    const surfaceColor = isDark ? '#111827' : '#FFFFFF';
    const borderColor = isDark ? '#334155' : '#E2E8F0';
    const textColor = isDark ? '#E2E8F0' : '#1F2A24';
    const mutedColor = isDark ? '#94A3B8' : '#64748B';
    const BackIcon = isRTL ? ChevronRight : ChevronLeft;

    async function selectLanguage(code: string) {
        if (code === currentLanguage || savingCode) return;
        setSavingCode(code);
        await changeLanguage(code);
    }

    return (
        <SafeAreaView edges={['top']} style={[styles.safeArea, { backgroundColor }]}>
            <View style={[styles.topbar, { backgroundColor: surfaceColor, borderBottomColor: borderColor, flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
                <Pressable onPress={() => router.back()} style={styles.backButton} hitSlop={10}>
                    <BackIcon size={scale(22)} color={textColor} />
                </Pressable>
                <Text variant="h3" numberOfLines={1} style={[styles.title, { color: textColor, textAlign: isRTL ? 'right' : 'left' }]}>
                    {textValue(t('language'), 'Language')}
                </Text>
                <View style={styles.backButton} />
            </View>

            <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
                <View style={[styles.panel, { backgroundColor: surfaceColor, borderColor }]}>
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
                                    active && { backgroundColor: isDark ? 'rgba(243,75,111,0.12)' : 'rgba(243,75,111,0.07)' },
                                    pressed && !savingCode && styles.pressed,
                                    { flexDirection: isRTL ? 'row-reverse' : 'row' },
                                ]}
                            >
                                <Text
                                    variant="body"
                                    className="font-body-semi"
                                    style={[
                                        styles.label,
                                        { color: active ? '#F34B6F' : textColor, textAlign: isRTL ? 'right' : 'left' },
                                    ]}
                                >
                                    {label}
                                </Text>
                                <View style={[styles.checkCircle, active ? styles.activeCircle : { borderColor }]}>
                                    {loading ? (
                                        <ActivityIndicator size="small" color={active ? '#FFFFFF' : '#F34B6F'} />
                                    ) : active ? (
                                        <Check size={scale(13)} color="#FFFFFF" strokeWidth={3} />
                                    ) : null}
                                </View>
                            </Pressable>
                        );
                    })}
                </View>

                <Text variant="caption" style={[styles.helper, { color: mutedColor, textAlign: isRTL ? 'right' : 'left' }]}>
                    {textValue(t('language_reload_note'), 'The app reloads after changing language so layout and translations update correctly.')}
                </Text>
            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    safeArea: {
        flex: 1,
    },
    topbar: {
        minHeight: scale(54),
        alignItems: 'center',
        borderBottomWidth: StyleSheet.hairlineWidth,
        paddingHorizontal: scale(12),
    },
    backButton: {
        width: scale(42),
        height: scale(42),
        alignItems: 'center',
        justifyContent: 'center',
    },
    title: {
        flex: 1,
        fontSize: scale(18),
        lineHeight: scale(23),
    },
    content: {
        paddingHorizontal: scale(14),
        paddingTop: scale(14),
        paddingBottom: scale(32),
    },
    panel: {
        overflow: 'hidden',
        borderWidth: 1,
        borderRadius: scale(8),
    },
    row: {
        minHeight: scale(56),
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: scale(12),
        paddingHorizontal: scale(16),
        paddingVertical: scale(12),
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
    activeCircle: {
        borderColor: '#F34B6F',
        backgroundColor: '#F34B6F',
    },
    helper: {
        marginTop: scale(12),
        paddingHorizontal: scale(4),
    },
    pressed: {
        opacity: 0.72,
    },
});
