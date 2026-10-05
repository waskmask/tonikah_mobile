import React from 'react';
import { Platform, Pressable, StyleSheet, View } from 'react-native';
import { List } from 'phosphor-react-native';

import { scale } from '@/hooks/useResponsive';
import { useTheme } from '@/hooks/useTheme';
import { t } from '@/lib/profileDisplay';

type AppMenuButtonProps = {
    onPress: () => void;
    accessibilityLabel?: string;
};

/** Shared app-menu trigger. Keep Messages and Conversation headers independent. */
export function AppMenuButton({ onPress, accessibilityLabel }: AppMenuButtonProps) {
    const { isDark } = useTheme();
    const isAndroid = Platform.OS === 'android';
    const size = scale(isAndroid ? 36 : 34);
    const iconColor = isDark ? '#E5E5E7' : '#201B15';

    return (
        <Pressable
            accessibilityRole="button"
            accessibilityLabel={accessibilityLabel || t('menu', 'Menu')}
            onPress={onPress}
            hitSlop={6}
            style={[styles.button, { width: size, height: size }]}
        >
            {({ pressed }) => (
                <View pointerEvents="none" style={[styles.icon, pressed && styles.pressed]}>
                    <List size={scale(22)} style={styles.icon} color={iconColor} weight="bold" />
                </View>
            )}
        </Pressable>
    );
}

const styles = StyleSheet.create({
    button: {
        borderRadius: scale(17),
        marginEnd: scale(4),
        alignItems: 'center',
        justifyContent: 'center',
    },
    icon: {
        width: scale(22),
        height: scale(22),
    },
    pressed: {
        opacity: 0.78,
        transform: [{ scale: 0.97 }],
    },
});
