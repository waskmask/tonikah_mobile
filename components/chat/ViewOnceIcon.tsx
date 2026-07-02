import React from 'react';
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { scale } from '@/hooks/useResponsive';

type Props = {
    size?: number;
    color: string;
    active?: boolean;
    style?: StyleProp<ViewStyle>;
};

/** WhatsApp-style view-once badge: circle with "1". */
export function ViewOnceIcon({ size = scale(22), color, active = false, style }: Props) {
    const fontSize = Math.round(size * 0.52);

    return (
        <View
            style={[
                styles.badge,
                {
                    width: size,
                    height: size,
                    borderRadius: size / 2,
                    borderColor: color,
                    backgroundColor: active ? 'rgba(243,75,111,0.18)' : 'transparent',
                },
                style,
            ]}
        >
            <Text style={[styles.glyph, { color, fontSize, lineHeight: fontSize + 1 }]}>1</Text>
        </View>
    );
}

const styles = StyleSheet.create({
    badge: {
        borderWidth: StyleSheet.hairlineWidth * 2,
        alignItems: 'center',
        justifyContent: 'center',
    },
    glyph: {
        fontWeight: '700',
        includeFontPadding: false,
        textAlign: 'center',
    },
});
