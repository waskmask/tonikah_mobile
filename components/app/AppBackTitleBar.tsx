import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ChevronLeft, ChevronRight } from 'lucide-react-native';
import { Text } from '@/components/ui/Text';
import { useLanguage } from '@/hooks/useLanguage';
import { useColors } from '@/hooks/useColors';
import { HeaderTokens } from '@/constants/uiTokens';
import { scale } from '@/hooks/useResponsive';
import { useTranslation } from 'react-i18next';

type AppBackTitleBarProps = {
    title: string;
    fallbackHref?: string;
    onBack?: () => void;
};

export function AppBackTitleBar({ title, fallbackHref = '/(tabs)/search', onBack }: AppBackTitleBarProps) {
    const { t } = useTranslation('common');
    const { isRTL } = useLanguage();
    const chrome = useColors().chrome.header;
    const BackIcon = isRTL ? ChevronRight : ChevronLeft;

    const goBack = () => {
        if (onBack) {
            onBack();
            return;
        }
        if (router.canGoBack()) {
            router.back();
            return;
        }
        router.replace(fallbackHref as any);
    };

    return (
        <SafeAreaView
            edges={['top']}
            style={[
                styles.safeArea,
                {
                    backgroundColor: chrome.background,
                    borderBottomColor: chrome.border,
                },
            ]}
        >
            <View style={styles.topBar}>
                <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={t('back', 'Back')}
                    onPress={goBack}
                    style={styles.backButton}
                    hitSlop={8}
                >
                    <BackIcon size={scale(23)} color={chrome.icon} />
                </Pressable>
                {/* Content-sized title in a flex row hugs the chevron in both
                    directions — no textAlign (Android flips literal values in RTL) */}
                <View style={styles.titleWrap}>
                    <Text
                        variant="body-sm"
                        numberOfLines={1}
                        className="font-body-bold"
                        style={[styles.title, { color: chrome.title }]}
                    >
                        {title}
                    </Text>
                </View>
                <View style={styles.rightSpacer} />
            </View>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    safeArea: {
        borderBottomWidth: StyleSheet.hairlineWidth,
    },
    topBar: {
        minHeight: HeaderTokens.minHeight,
        // Native RTL (I18nManager) mirrors 'row' — no manual reversal
        flexDirection: 'row',
        alignItems: 'center',
        // 5.5 + 8.5 (chevron inset inside its 40pt button) = 14dp edge→icon
        paddingHorizontal: scale(5.5),
    },
    backButton: {
        width: scale(40),
        height: scale(40),
        borderRadius: scale(20),
        alignItems: 'center',
        justifyContent: 'center',
    },
    titleWrap: {
        flex: 1,
        minWidth: 0,
        flexDirection: 'row',
        // 8.5 chevron inset + 3 ≈ 11.5dp icon→title (optical match with conversation header)
        marginStart: scale(3),
    },
    title: {
        flexShrink: 1,
        fontSize: scale(15),
        lineHeight: scale(20),
    },
    rightSpacer: {
        width: scale(40),
        height: scale(40),
    },
});
