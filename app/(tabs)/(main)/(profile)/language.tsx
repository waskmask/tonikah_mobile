import React, { useCallback, useEffect, useRef, useState } from 'react';
import { router, type Href, useFocusEffect, useLocalSearchParams, usePathname } from 'expo-router';
import { ActivityIndicator, BackHandler, ScrollView, StyleSheet, View } from 'react-native';
import { Check } from '@/components/ui/icons/PhosphorCompat';
import { Text } from '@/components/ui/Text';
import { AppBackTitleBar } from '@/components/app/AppBackTitleBar';
import { SettingsNavRow } from '@/components/settings/SettingsRows';
import { SettingsFieldSection } from '@/components/settings/SettingsFieldSection';
import { useLanguage } from '@/hooks/useLanguage';
import { useColors } from '@/hooks/useColors';
import { scale } from '@/hooks/useResponsive';
import { SUPPORTED_APP_LANGUAGES } from '@/lib/languageNames';
import { firstSearchParam, sanitizeAuthReturnPath } from '@/lib/authReturn';
import { useRootAppMenu } from '@/components/app/RootAppMenuDrawer';
import { useToast } from '@/hooks/useToast';

const LANGUAGES = SUPPORTED_APP_LANGUAGES;

function textValue(value: unknown, fallback: string) {
    return typeof value === 'string' && value.trim() ? value.trim() : fallback;
}

export default function LanguageScreen() {
    const { currentLanguage, changeLanguage, t } = useLanguage();
    const pathname = usePathname();
    const params = useLocalSearchParams<{ returnTo?: string | string[] }>();
    const candidate = sanitizeAuthReturnPath(firstSearchParam(params.returnTo), '/settings');
    const returnHref = candidate === '/language' ? '/settings' : candidate;
    const closeRootMenu = useRootAppMenu()?.closeMenu;
    const colors = useColors();
    const primary = colors.chrome.primary;
    const toast = useToast();
    const [savingCode, setSavingCode] = useState<string | null>(null);
    const savingCodeRef = useRef<string | null>(null);
    const mounted = useRef(true);
    const focusSession = useRef(0);
    const pendingFeedback = useRef<{ frame: number; finish: (ready: boolean) => void } | null>(null);

    const cancelFeedback = useCallback(() => {
        const pending = pendingFeedback.current;
        if (!pending) return;
        pendingFeedback.current = null;
        cancelAnimationFrame(pending.frame);
        pending.finish(false);
    }, []);

    useEffect(() => {
        mounted.current = true;
        return () => {
            mounted.current = false;
            cancelFeedback();
        };
    }, [cancelFeedback]);

    const handleBack = useCallback(() => {
        closeRootMenu?.();
        router.navigate(returnHref as Href);
    }, [closeRootMenu, returnHref]);

    useFocusEffect(useCallback(() => {
        focusSession.current += 1;
        const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
            handleBack();
            return true;
        });
        return () => {
            focusSession.current += 1;
            subscription.remove();
            cancelFeedback();
        };
    }, [handleBack, cancelFeedback]));

    async function selectLanguage(code: string) {
        if (!mounted.current || code === currentLanguage || savingCodeRef.current) return;
        savingCodeRef.current = code;
        setSavingCode(code);
        const session = focusSession.current;
        try {
            // Let the loading state commit and have a frame to paint before
            // languageChanged subscribers start their synchronous render work.
            const ready = await new Promise<boolean>((finish) => {
                const pending = { frame: 0, finish };
                pendingFeedback.current = pending;
                pending.frame = requestAnimationFrame(() => {
                    if (pendingFeedback.current !== pending) return;
                    pending.frame = requestAnimationFrame(() => {
                        if (pendingFeedback.current !== pending) return;
                        pendingFeedback.current = null;
                        finish(true);
                    });
                });
            });
            if (!ready || !mounted.current || session !== focusSession.current) return;
            await changeLanguage(code, `${pathname}?returnTo=${encodeURIComponent(returnHref)}`);
        } catch {
            if (mounted.current) {
                toast.show(textValue(t('something_went_wrong'), 'Unable to change language. Please try again.'), 'error');
            }
        } finally {
            savingCodeRef.current = null;
            if (mounted.current) setSavingCode(null);
        }
    }

    return (
        <View style={[styles.root, { backgroundColor: colors.brand.bg.surface }]}>
            <AppBackTitleBar title={textValue(t('language'), 'Language')} fallbackHref={returnHref} onBack={handleBack} showMenu />
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
                                animatePress={false}
                                showChevron={false}
                                accessory={(
                                    <View style={styles.accessorySlot}>
                                        {/* Keep marker identity stable to avoid stale Android checks after removal. */}
                                        <View
                                            pointerEvents="none"
                                            style={[styles.checkCircle, { backgroundColor: primary, opacity: active && !loading ? 1 : 0 }]}
                                        >
                                            <Check size={scale(12)} color="#FFFFFF" strokeWidth={3} />
                                        </View>
                                        {loading ? <ActivityIndicator style={StyleSheet.absoluteFill} size="small" color={primary} /> : null}
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
