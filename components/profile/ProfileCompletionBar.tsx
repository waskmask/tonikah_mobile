import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Text } from '@/components/ui/Text';
import { useColors } from '@/hooks/useColors';
import { scale } from '@/hooks/useResponsive';

type Props = {
    percent: number;
};

/** Slim completion meter card, mirroring the web ProfileCompletionStatus:
    thin brand-filled track with a bold trailing percent. */
export function ProfileCompletionBar({ percent }: Props) {
    const palette = useColors();
    const clamped = Math.max(0, Math.min(100, Math.round(percent)));

    return (
        <View
            accessibilityRole="progressbar"
            accessibilityValue={{ min: 0, max: 100, now: clamped }}
            style={[
                styles.card,
                {
                    backgroundColor: palette.brand.bg.surface,
                    borderColor: palette.brand.bg.border,
                },
            ]}
        >
            <View style={[styles.track, { backgroundColor: palette.brand.bg.border }]}>
                <View
                    style={[
                        styles.fill,
                        { backgroundColor: palette.chrome.primary, width: `${clamped}%` },
                    ]}
                />
            </View>
            <Text
                variant="caption"
                className="font-body-bold"
                style={[styles.percent, { color: palette.chrome.primary }]}
            >
                {clamped}%
            </Text>
        </View>
    );
}

const styles = StyleSheet.create({
    card: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: scale(12),
        paddingHorizontal: scale(18),
        paddingVertical: scale(14),
    },
    track: {
        flex: 1,
        height: scale(4),
        borderRadius: scale(2),
        overflow: 'hidden',
    },
    fill: {
        height: '100%',
        borderRadius: scale(2),
    },
    percent: {
        fontSize: scale(13),
        // Digits keep LTR order in RTL locales
        writingDirection: 'ltr',
    },
});
