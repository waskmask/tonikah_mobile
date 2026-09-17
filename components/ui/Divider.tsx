import React from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { useColors } from '@/hooks/useColors';

type DividerProps = {
    orientation?: 'horizontal' | 'vertical';
    style?: StyleProp<ViewStyle>;
};

/** Theme-aware separator for standalone lines. Row borders use the same
    brand.bg.border token directly to avoid adding layout wrappers. */
export function Divider({ orientation = 'horizontal', style }: DividerProps) {
    const color = useColors().brand.bg.border;

    return (
        <View
            accessible={false}
            pointerEvents="none"
            style={[
                orientation === 'horizontal' ? styles.horizontal : styles.vertical,
                { backgroundColor: color },
                style,
            ]}
        />
    );
}

const styles = StyleSheet.create({
    horizontal: {
        width: '100%',
        height: StyleSheet.hairlineWidth,
    },
    vertical: {
        alignSelf: 'stretch',
        width: StyleSheet.hairlineWidth,
    },
});
