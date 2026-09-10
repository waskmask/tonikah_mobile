import React from 'react';
import { AccessibilityState, Pressable, StyleProp, ViewStyle } from 'react-native';
import Reanimated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';

/** App-wide press spring so every tappable "moves the same". */
export const PRESS_SPRING = { damping: 16, stiffness: 320 } as const;

type PressableScaleProps = {
    children: React.ReactNode;
    onPress?: () => void;
    disabled?: boolean;
    style?: StyleProp<ViewStyle>;
    /** Layout style for the outer Pressable (needed when `style` uses flex to fill the parent). */
    containerStyle?: StyleProp<ViewStyle>;
    accessibilityLabel?: string;
    accessibilityRole?: 'button' | 'image';
    accessibilityState?: AccessibilityState;
    activeScale?: number;
    onLongPress?: () => void;
    delayLongPress?: number;
    hitSlop?: number;
};

export function PressableScale({
    children,
    onPress,
    disabled,
    style,
    containerStyle,
    accessibilityLabel,
    accessibilityRole,
    accessibilityState,
    activeScale = 0.9,
    onLongPress,
    delayLongPress,
    hitSlop,
}: PressableScaleProps) {
    const scaleValue = useSharedValue(1);
    const animStyle = useAnimatedStyle(() => ({
        transform: [{ scale: scaleValue.value }],
    }));
    return (
        <Pressable
            onPress={onPress}
            onLongPress={onLongPress}
            delayLongPress={delayLongPress}
            disabled={disabled}
            hitSlop={hitSlop}
            style={containerStyle}
            accessibilityLabel={accessibilityLabel}
            accessibilityRole={accessibilityRole}
            accessibilityState={accessibilityState}
            onPressIn={() => { scaleValue.value = withSpring(activeScale, PRESS_SPRING); }}
            onPressOut={() => { scaleValue.value = withSpring(1, PRESS_SPRING); }}
        >
            <Reanimated.View style={[style, animStyle]}>
                {children}
            </Reanimated.View>
        </Pressable>
    );
}
