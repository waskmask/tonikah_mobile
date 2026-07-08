import React, { useEffect } from 'react';
import { StyleSheet, StatusBar, View } from 'react-native';
import Animated, {
    cancelAnimation,
    Easing,
    useAnimatedStyle,
    useSharedValue,
    withRepeat,
    withSequence,
    withTiming,
} from 'react-native-reanimated';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { Colors } from '@/constants/Colors';

const HEART_ICON = require('@/assets/icon/heart-white.png');

// Must pixel-match the native splash (expo-splash-screen in app.json):
// solid brand background + 96dp white heart, so the fade handoff is seamless.
// Intentionally not theme-aware — the native splash can't follow the theme.
const SPLASH_BACKGROUND = Colors.light.brand.gradient.end;
const HEART_SIZE = 96;

export function AppLoadingScreen() {
    const reduceMotion = useReducedMotion();
    const pulse = useSharedValue(1);

    useEffect(() => {
        if (reduceMotion) {
            pulse.value = 1;
            return;
        }
        // Gentle heartbeat so a slow network never looks like a frozen app
        pulse.value = withRepeat(
            withSequence(
                withTiming(1.1, { duration: 700, easing: Easing.inOut(Easing.quad) }),
                withTiming(1, { duration: 700, easing: Easing.inOut(Easing.quad) }),
            ),
            -1,
            false,
        );
        return () => cancelAnimation(pulse);
    }, [reduceMotion, pulse]);

    const heartStyle = useAnimatedStyle(() => ({
        transform: [{ scale: pulse.value }],
    }));

    return (
        <View style={styles.root}>
            <StatusBar barStyle="light-content" backgroundColor={SPLASH_BACKGROUND} />
            <Animated.Image
                source={HEART_ICON}
                style={[styles.heart, heartStyle]}
                resizeMode="contain"
                accessibilityLabel="toNikah"
            />
        </View>
    );
}

const styles = StyleSheet.create({
    root: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: SPLASH_BACKGROUND,
    },
    heart: {
        width: HEART_SIZE,
        height: HEART_SIZE,
    },
});
