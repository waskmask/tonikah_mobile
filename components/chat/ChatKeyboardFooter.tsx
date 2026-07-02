import React, { useEffect } from 'react';
import {
    StyleSheet,
    View,
    type LayoutChangeEvent,
    type StyleProp,
    type ViewStyle,
} from 'react-native';
import Reanimated, { interpolate, useAnimatedStyle, useSharedValue } from 'react-native-reanimated';
import { useKeyboardContext } from 'react-native-keyboard-controller';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useKeyboardHeight } from '@/hooks/useKeyboardHeight';
import { scale } from '@/hooks/useResponsive';

/**
 * Wraps the message list + composer. Adds bottom padding equal to the keyboard
 * height so the inner area reflows (list shrinks, composer rides on the keyboard).
 * Pair with Android ADJUST_NOTHING so the OS doesn't also resize the window.
 *
 * A JS visibility gate forces padding back to 0 whenever the keyboard is reported
 * hidden — this prevents the composer getting stuck mid-screen if a native image
 * picker / modal swallows the keyboard-close animation event.
 */
export function ChatKeyboardAvoider({ children }: { children: React.ReactNode }) {
    const { reanimated } = useKeyboardContext();
    const { visible } = useKeyboardHeight();
    const gate = useSharedValue(0);

    useEffect(() => {
        gate.value = visible ? 1 : 0;
    }, [visible, gate]);

    // Slide the whole [list + composer] block up as one piece using a transform
    // (GPU-composited, no per-frame layout) instead of animating paddingBottom,
    // which re-laid out the FlatList every frame and caused the keyboard jank.
    // reanimated.height is negative while the keyboard is open.
    const liftStyle = useAnimatedStyle(() => ({
        transform: [{ translateY: Math.min(0, reanimated.height.value) * gate.value }],
    }));

    return (
        <Reanimated.View style={[styles.flex, liftStyle]} collapsable={false}>
            {children}
        </Reanimated.View>
    );
}

type ComposerBarProps = {
    backgroundColor: string;
    borderTopColor?: string;
    onLayout?: (event: LayoutChangeEvent) => void;
    children: React.ReactNode;
    style?: StyleProp<ViewStyle>;
};

/**
 * Composer container. Bottom safe-area padding animates to 0 as the keyboard opens
 * so the input sits flush on the keyboard, and back to the inset when it closes.
 */
export function ChatComposerBar({
    backgroundColor,
    borderTopColor,
    onLayout,
    children,
    style,
}: ComposerBarProps) {
    const insets = useSafeAreaInsets();
    const bottomInset = Math.max(insets.bottom, scale(8));
    const { reanimated } = useKeyboardContext();

    const barStyle = useAnimatedStyle(() => ({
        paddingBottom: interpolate(reanimated.progress.value, [0, 1], [bottomInset, 0]),
    }));

    return (
        <Reanimated.View
            style={[
                styles.bar,
                {
                    backgroundColor,
                    borderTopColor: borderTopColor ?? 'transparent',
                    borderTopWidth: borderTopColor ? StyleSheet.hairlineWidth : 0,
                },
                barStyle,
                style,
            ]}
            collapsable={false}
        >
            <View onLayout={onLayout} collapsable={false}>
                {children}
            </View>
        </Reanimated.View>
    );
}

const styles = StyleSheet.create({
    flex: {
        flex: 1,
    },
    bar: {
        elevation: 0,
        shadowOpacity: 0,
    },
});
