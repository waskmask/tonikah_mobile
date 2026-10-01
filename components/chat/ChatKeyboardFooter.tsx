import React from 'react';
import {
    StyleSheet,
    View,
    type LayoutChangeEvent,
    type StyleProp,
    type ViewStyle,
} from 'react-native';
import Reanimated, { interpolate, useAnimatedStyle } from 'react-native-reanimated';
import { KeyboardAvoidingView, useKeyboardContext } from 'react-native-keyboard-controller';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { scale } from '@/hooks/useResponsive';

/**
 * The header stays outside this view; only the message list and composer
 * resize as the keyboard moves on either platform.
 */
export function ChatKeyboardAvoider({ children }: { children: React.ReactNode }) {
    return (
        <KeyboardAvoidingView behavior="height" automaticOffset style={styles.flex}>
            {children}
        </KeyboardAvoidingView>
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
