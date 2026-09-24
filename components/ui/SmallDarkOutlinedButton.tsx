import React from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { Text } from '@/components/ui/Text';
import { scale } from '@/hooks/useResponsive';
import { useTheme } from '@/hooks/useTheme';
import type { LucideIcon } from 'lucide-react-native';

type SmallDarkOutlinedButtonProps = {
    label: string;
    onPress: () => void;
    accessibilityLabel?: string;
    disabled?: boolean;
    loading?: boolean;
    icon?: LucideIcon;
    labelWeight?: '500' | '700';
    foregroundColor?: string;
    backgroundColor?: string;
    borderColor?: string;
    style?: StyleProp<ViewStyle>;
};

export function SmallDarkOutlinedButton({
    label,
    onPress,
    accessibilityLabel,
    disabled = false,
    loading = false,
    icon: Icon,
    labelWeight = '700',
    foregroundColor,
    backgroundColor = 'transparent',
    borderColor,
    style,
}: SmallDarkOutlinedButtonProps) {
    const { isDark } = useTheme();
    const color = foregroundColor ?? (isDark ? '#E5E5E7' : '#201B15');

    return (
        <Pressable
            accessibilityRole="button"
            accessibilityLabel={accessibilityLabel || label}
            accessibilityState={{ disabled: disabled || loading, busy: loading }}
            disabled={disabled || loading}
            hitSlop={8}
            onPress={onPress}
            style={({ pressed }) => [
                styles.touchTarget,
                (pressed || disabled || loading) && styles.dimmed,
            ]}
        >
            <View style={[styles.button, { borderColor: borderColor ?? color, backgroundColor }, style]}>
                <View style={[styles.content, loading && styles.hiddenContent]}>
                    {Icon ? <Icon size={scale(14)} color={color} strokeWidth={2.2} /> : null}
                    <Text
                        variant="body-sm"
                        className={labelWeight === '500' ? 'font-body-medium' : 'font-body-bold'}
                        numberOfLines={1}
                        style={[styles.label, { color, fontWeight: labelWeight }]}
                    >
                        {label}
                    </Text>
                </View>
                {loading ? (
                    <View pointerEvents="none" style={styles.loadingLayer}>
                        <ActivityIndicator size={scale(14)} color={color} />
                    </View>
                ) : null}
            </View>
        </Pressable>
    );
}

const styles = StyleSheet.create({
    touchTarget: {
        flexShrink: 0,
    },
    button: {
        height: scale(30),
        paddingHorizontal: scale(10),
        borderWidth: 2,
        borderStyle: 'solid',
        borderRadius: scale(15),
        backgroundColor: 'transparent',
        alignItems: 'center',
        justifyContent: 'center',
    },
    label: {
        fontSize: scale(13),
        lineHeight: scale(17),
        includeFontPadding: false,
        textAlignVertical: 'center',
    },
    content: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: scale(4),
    },
    hiddenContent: {
        opacity: 0,
    },
    loadingLayer: {
        ...StyleSheet.absoluteFill,
        alignItems: 'center',
        justifyContent: 'center',
    },
    dimmed: {
        opacity: 0.72,
    },
});
