import React from 'react';
import { Platform, Pressable, StyleSheet, View } from 'react-native';
import { Menu } from 'lucide-react-native';
import Svg, { Line } from 'react-native-svg';

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
        <View
            style={[
                styles.shell,
                {
                    width: size,
                    height: size,
                    backgroundColor: 'transparent',
                },
            ]}
        >
            <Pressable
                accessibilityRole="button"
                accessibilityLabel={accessibilityLabel || t('menu', 'Menu')}
                onPress={onPress}
                hitSlop={6}
                style={({ pressed }) => [styles.button, pressed && styles.pressed]}
            >
                {isAndroid ? (
                    <Svg pointerEvents="none" width={size} height={size} viewBox="0 0 36 36">
                        <Line x1="9" y1="11.1" x2="27" y2="11.1" stroke={iconColor} strokeWidth="2.2" strokeLinecap="butt" />
                        <Line x1="9" y1="18" x2="27" y2="18" stroke={iconColor} strokeWidth="2.2" strokeLinecap="butt" />
                        <Line x1="9" y1="24.9" x2="27" y2="24.9" stroke={iconColor} strokeWidth="2.2" strokeLinecap="butt" />
                    </Svg>
                ) : (
                    <Menu size={scale(15)} color={iconColor} strokeWidth={2.55} />
                )}
            </Pressable>
        </View>
    );
}

const styles = StyleSheet.create({
    shell: {
        borderRadius: scale(17),
        marginEnd: scale(4),
        overflow: 'hidden',
    },
    button: {
        position: 'absolute',
        top: 0,
        right: 0,
        bottom: 0,
        left: 0,
        alignItems: 'center',
        justifyContent: 'center',
    },
    pressed: {
        opacity: 0.78,
        transform: [{ scale: 0.97 }],
    },
});
