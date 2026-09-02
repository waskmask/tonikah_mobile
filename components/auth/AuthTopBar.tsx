import React from 'react';
import { View, StyleSheet, Text as RNText } from 'react-native';
import { ChevronLeft, ChevronRight } from 'lucide-react-native';
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
    const Arrow = isRTL ? ChevronRight : ChevronLeft;

    return (
        <View style={styles.bar}>
            {leftLabel && onLeftPress ? (
                <PressableScale
                    onPress={onLeftPress}
                    hitSlop={10}
                    accessibilityRole="button"
                    accessibilityLabel={leftLabel}
                    activeScale={0.95}
                    style={styles.leftAction}
                >
                    <Arrow size={scale(23)} color={linkColor} />
                    <RNText
                        style={{
                            color: linkColor,
                            fontSize: scale(16),
                            lineHeight: scale(20),
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
        // Native RTL (I18nManager.forceRTL) already mirrors 'row' — no manual reversal
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        // 14dp edge gap — consistent with all other topbars
        paddingHorizontal: scale(14),
        paddingTop: scale(12),
        paddingBottom: scale(4),
    },
    leftAction: {
        flexDirection: 'row',
        alignItems: 'center',
        // Optical match with profile/conversation headers' chevron→title rhythm
        gap: scale(8),
        paddingVertical: scale(6),
    },
    spacer: {
        width: scale(36),
    },
});
