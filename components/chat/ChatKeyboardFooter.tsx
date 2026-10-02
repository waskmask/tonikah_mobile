import React from 'react';
import {
    StyleSheet,
    View,
    type LayoutChangeEvent,
    type StyleProp,
    type ViewStyle,
} from 'react-native';
import Reanimated, { interpolate, useAnimatedStyle } from 'react-native-reanimated';
import { useKeyboardContext } from 'react-native-keyboard-controller';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { scale } from '@/hooks/useResponsive';

/**
 * Keep the body at a stable height so the keyboard does not move the header.
 */
export function ChatKeyboardAvoider({ children }: { children: React.ReactNode }) {
    return <View style={styles.flex}>{children}</View>;
}

export function ChatKeyboardViewport({
    composerHeight,
    children,
}: {
    composerHeight: number;
    children: React.ReactNode;
}) {
    const insets = useSafeAreaInsets();
    const bottomInset = Math.max(insets.bottom, scale(8));
    const { reanimated } = useKeyboardContext();
    const viewportStyle = useAnimatedStyle(() => ({
        marginBottom: composerHeight
            + interpolate(reanimated.progress.value, [0, 1], [bottomInset, 0])
            - reanimated.height.value,
    }));

    return <Reanimated.View style={[styles.flex, viewportStyle]}>{children}</Reanimated.View>;
}

export function ChatStickyComposer({ children }: { children: React.ReactNode }) {
    const { reanimated } = useKeyboardContext();
    const stickyStyle = useAnimatedStyle(() => ({
        transform: [{ translateY: reanimated.height.value }],
    }));

    return <Reanimated.View style={[styles.stickyComposer, stickyStyle]}>{children}</Reanimated.View>;
}

type ComposerBarProps = {
    backgroundColor: string;
    borderTopColor?: string;
    children: React.ReactNode;
    onContentLayout?: (event: LayoutChangeEvent) => void;
    style?: StyleProp<ViewStyle>;
};

/**
 * Composer container. Bottom safe-area padding animates to 0 as the keyboard opens
 * so the input sits flush on the keyboard, and back to the inset when it closes.
 */
export function ChatComposerBar({
    backgroundColor,
    borderTopColor,
    children,
    onContentLayout,
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
            <View collapsable={false} onLayout={onContentLayout}>
                {children}
            </View>
        </Reanimated.View>
    );
}

const styles = StyleSheet.create({
    flex: {
        flex: 1,
    },
    stickyComposer: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
    },
    bar: {
        elevation: 0,
        shadowOpacity: 0,
    },
});
