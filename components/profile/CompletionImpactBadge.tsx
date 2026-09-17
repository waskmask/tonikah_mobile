import React from 'react';
import { StyleSheet, View } from 'react-native';

import { Text } from '@/components/ui/Text';
import { useColors } from '@/hooks/useColors';
import { scale } from '@/hooks/useResponsive';

export function CompletionImpactBadge({ value }: { value: number }) {
    const colors = useColors();

    return (
        <View
            accessibilityLabel={`+${value}%`}
            style={[styles.badge, { backgroundColor: colors.chrome.primary }]}
        >
            <Text variant="caption" className="font-body-bold" style={styles.text}>
                {`\u2066+${value}%\u2069`}
            </Text>
        </View>
    );
}

const styles = StyleSheet.create({
    badge: {
        height: scale(18),
        borderRadius: 999,
        paddingHorizontal: scale(6),
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
    },
    text: {
        color: '#FFFFFF',
        fontSize: scale(11),
        lineHeight: scale(14),
        includeFontPadding: false,
        writingDirection: 'ltr',
    },
});
