import React from 'react';
import {
    ActivityIndicator,
    Platform,
    Pressable,
    StyleSheet,
    View,
    type AccessibilityValue,
    type StyleProp,
    type ViewStyle,
} from 'react-native';
import { GlassView, isGlassEffectAPIAvailable, isLiquidGlassAvailable } from 'expo-glass-effect';
import { requireOptionalNativeModule } from 'expo-modules-core';

import { Text } from '@/components/ui/Text';
import { useColors } from '@/hooks/useColors';
import { useHaptics } from '@/hooks/useHaptics';
import { useTheme } from '@/hooks/useTheme';
import { scale } from '@/hooks/useResponsive';

type PlatformActionButtonProps = {
    icon: React.ReactNode;
    onPress: () => void;
    accessibilityLabel: string;
    accessibilityValue?: AccessibilityValue;
    badge?: number | string;
    disabled?: boolean;
    loading?: boolean;
    loaderColor?: string;
    androidSize?: number;
    iosSize?: number;
    style?: StyleProp<ViewStyle>;
};

/**
 * Shared contract for compact app-bar action buttons. Keep platform styling here:
 * 1. Android uses Material 3 FAB styling supplied by product/design.
 * 2. iOS 26+ uses interactive native GlassView Liquid Glass.
 * 3. Older iOS uses a visually matching translucent fallback.
 * 4. This component owns icon/badge layout, size, disabled/loading states,
 *    accessibility, haptics, and press feedback.
 *
 * Android and iOS visual values are independent. Never reuse or change one
 * platform's dimensions, shape, fill, elevation, or effects for the other.
 * Do not recreate these platform branches inside individual screens.
 */
export function PlatformActionButton({
    icon,
    onPress,
    accessibilityLabel,
    accessibilityValue,
    badge,
    disabled = false,
    loading = false,
    loaderColor,
    androidSize = 38,
    iosSize = 46,
    style,
}: PlatformActionButtonProps) {
    const colors = useColors();
    const { isDark } = useTheme();
    const { lightImpact } = useHaptics();
    const scaledSize = scale(Platform.OS === 'android' ? androidSize : iosSize);
    const radius = scaledSize / 2;
    const nativeGlassModule = Platform.OS === 'ios'
        ? requireOptionalNativeModule('ExpoGlassEffect')
        : null;
    const hasNativeGlass = Platform.OS === 'ios'
        && !!nativeGlassModule
        && isGlassEffectAPIAvailable()
        && isLiquidGlassAvailable();
    const fallbackSurface = isDark ? 'rgba(45,45,48,0.82)' : 'rgba(255,255,255,0.92)';
    const androidSurface = isDark ? colors.chrome.explore.actionCircle : '#F7F7F7';
    const showBadge = badge !== undefined && badge !== null && badge !== '' && badge !== 0;

    const handlePress = () => {
        lightImpact();
        onPress();
    };

    const content = (
        <View pointerEvents="none" style={styles.content}>
            {loading ? (
                <ActivityIndicator size="small" color={loaderColor ?? colors.chrome.header.icon} />
            ) : icon}
        </View>
    );

    return (
        <View style={[styles.root, { width: scaledSize, height: scaledSize }, style]}>
            <Pressable
                accessibilityRole="button"
                accessibilityLabel={accessibilityLabel}
                accessibilityValue={accessibilityValue}
                accessibilityState={{ disabled, busy: loading }}
                disabled={disabled || loading}
                hitSlop={4}
                onPress={handlePress}
                style={({ pressed }) => [
                    styles.button,
                    {
                        width: scaledSize,
                        height: scaledSize,
                        borderRadius: radius,
                        backgroundColor: hasNativeGlass
                            ? 'transparent'
                            : Platform.OS === 'android'
                                ? androidSurface
                                : fallbackSurface,
                        borderColor: hasNativeGlass
                            ? 'transparent'
                            : isDark
                                ? 'rgba(255,255,255,0.16)'
                                : '#FFFFFF',
                    },
                    !hasNativeGlass && (Platform.OS === 'android' ? styles.androidFab : styles.iosFallback),
                    (disabled || loading) && styles.disabled,
                    pressed && styles.pressed,
                ]}
            >
                {hasNativeGlass ? (
                    <GlassView
                        pointerEvents="none"
                        isInteractive
                        glassEffectStyle="regular"
                        colorScheme={isDark ? 'dark' : 'light'}
                        style={[
                            styles.nativeGlass,
                            { width: scaledSize, height: scaledSize, borderRadius: radius, borderCurve: 'continuous' },
                        ]}
                    >
                        {content}
                    </GlassView>
                ) : content}
            </Pressable>
            {showBadge ? (
                <View
                    pointerEvents="none"
                    style={[
                        styles.badge,
                        {
                            backgroundColor: colors.chrome.badge.background,
                            borderColor: colors.chrome.explore.screen,
                        },
                    ]}
                >
                    <Text style={[styles.badgeText, { color: colors.chrome.common.inverseText }]}>
                        {badge}
                    </Text>
                </View>
            ) : null}
        </View>
    );
}

const styles = StyleSheet.create({
    root: {
        position: 'relative',
        overflow: 'visible',
    },
    button: {
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
    },
    // Temporary M3-compatible baseline; replace these values with the approved Android spec.
    androidFab: {},
    iosFallback: {
        borderCurve: 'continuous',
    },
    nativeGlass: {
        alignItems: 'center',
        justifyContent: 'center',
    },
    content: {
        flex: 1,
        alignSelf: 'stretch',
        alignItems: 'center',
        justifyContent: 'center',
    },
    badge: {
        position: 'absolute',
        top: scale(-5),
        right: scale(-6),
        minWidth: scale(17),
        height: scale(17),
        borderRadius: scale(9),
        borderWidth: 1.5,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: scale(3),
    },
    badgeText: {
        fontSize: scale(10),
        lineHeight: scale(12),
    },
    disabled: {
        opacity: 0.46,
    },
    pressed: {
        transform: [{ scale: 0.96 }],
    },
});
