import React from 'react';
import { View, StyleSheet, Text as RNText } from 'react-native';
import { ArrowLeft, ArrowRight } from 'lucide-react-native';
import { PressableScale } from '@/components/ui/PressableScale';
import { LanguagePicker } from '@/components/ui/LanguagePicker';
import { useLanguage } from '@/hooks/useLanguage';
import { useTheme } from '@/hooks/useTheme';
import { scale } from '@/hooks/useResponsive';
import { Typography } from '@/constants/typography';

type AuthTopBarProps = {
    leftLabel?: string;
    onLeftPress?: () => void;
};

export function AuthTopBar({ leftLabel, onLeftPress }: AuthTopBarProps) {
    const { isRTL, currentLanguage } = useLanguage();
    const { isDark } = useTheme();
    // Explicit colors, no theme classes — must be visible in both modes
    const linkColor = isDark ? '#F4EEE6' : '#1B1713';
    const linkFont = currentLanguage === 'ar' ? Typography.font.arabic.bold : Typography.font.body.bold;
    const Arrow = isRTL ? ArrowRight : ArrowLeft;

    return (
        <View
            style={[
                styles.bar,
                { flexDirection: isRTL ? 'row-reverse' : 'row' },
            ]}
        >
            {leftLabel && onLeftPress ? (
                <PressableScale
                    onPress={onLeftPress}
                    hitSlop={10}
                    accessibilityRole="button"
                    accessibilityLabel={leftLabel}
                    activeScale={0.95}
                    style={[styles.leftAction, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}
                >
                    <Arrow size={scale(16)} color={linkColor} strokeWidth={2.5} />
                    <RNText
                        style={{
                            color: linkColor,
                            fontSize: scale(13),
                            lineHeight: scale(17),
                            fontFamily: linkFont,
                            includeFontPadding: false,
                        }}
                    >
                        {leftLabel}
                    </RNText>
                </PressableScale>
            ) : (
                <View style={styles.spacer} />
            )}

            <LanguagePicker variant="icon" />
        </View>
    );
}

const styles = StyleSheet.create({
    bar: {
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: scale(20),
        paddingTop: scale(12),
        paddingBottom: scale(4),
    },
    leftAction: {
        alignItems: 'center',
        gap: scale(6),
        paddingVertical: scale(6),
    },
    spacer: {
        width: scale(36),
    },
});
