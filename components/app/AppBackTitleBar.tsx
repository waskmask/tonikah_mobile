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

type AppBackTitleBarProps = {
    title: string;
    fallbackHref?: string;
};

export function AppBackTitleBar({ title, fallbackHref = '/(tabs)/search' }: AppBackTitleBarProps) {
    const { isRTL } = useLanguage();
    const chrome = useColors().chrome.header;
    const BackIcon = isRTL ? ChevronRight : ChevronLeft;

    const goBack = () => {
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
            <View style={[styles.topBar, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
                <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Back"
                    onPress={goBack}
                    style={styles.backButton}
                    hitSlop={8}
                >
                    <BackIcon size={scale(22)} color={chrome.icon} strokeWidth={2.6} />
                </Pressable>
                <Text
                    variant="body-sm"
                    numberOfLines={1}
                    className="font-body-bold"
                    style={[styles.title, { color: chrome.title, textAlign: isRTL ? 'right' : 'left' }]}
                >
                    {title}
                </Text>
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
        alignItems: 'center',
        paddingHorizontal: scale(8),
    },
    backButton: {
        width: scale(40),
        height: scale(40),
        borderRadius: scale(20),
        alignItems: 'center',
        justifyContent: 'center',
    },
    title: {
        flex: 1,
        minWidth: 0,
        fontSize: scale(15),
        lineHeight: scale(20),
    },
    rightSpacer: {
        width: scale(40),
        height: scale(40),
    },
});
