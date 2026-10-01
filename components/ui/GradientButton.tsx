import React from "react";
import { TouchableOpacity, ActivityIndicator, View, StyleSheet, ViewStyle } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Text } from "./Text";
import { scale, wp } from "@/hooks/useResponsive";
import { useLanguage } from "@/hooks/useLanguage";
import { useColors } from "@/hooks/useColors";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import { useHaptics } from "@/hooks/useHaptics";
import { CaretLeft, CaretRight } from "phosphor-react-native";
import Animated, { useSharedValue, useAnimatedStyle, withSpring } from "react-native-reanimated";

interface GradientButtonProps {
    title: string;
    onPress: () => void;
    variant?: "primary" | "dark" | "outline";
    disabled?: boolean;
    loading?: boolean;
    showChevron?: boolean;
    rightIcon?: React.ReactNode | ((color: string) => React.ReactNode);
    className?: string;
    size?: "default" | "compact";

    // ✅ new
    widthMode?: "auto" | "full";
    containerStyle?: ViewStyle;
    /** Overrides the selected size's button height in design pt. */
    height?: number;
    /** Overrides the selected size's title font size in design pt. */
    textSize?: number;
    /** Expands the touch target without changing the visible button size. */
    hitSlop?: number;
}

export const GradientButton: React.FC<GradientButtonProps> = ({
    title,
    onPress,
    variant = "primary",
    disabled = false,
    loading = false,
    showChevron = false,
    rightIcon,
    className = "",
    size = "default",
    widthMode = "auto",
    containerStyle,
    height,
    textSize,
    hitSlop,
}) => {
    const { isRTL } = useLanguage();
    const palette = useColors();
    const reduceMotion = useReducedMotion();
    const { lightImpact } = useHaptics();
    const scaleValue = useSharedValue(1);
    const resolvedHeight = height ?? (size === "compact" ? 40 : variant === "outline" ? 48 : 50);
    const resolvedTextSize = textSize ?? (size === "compact" ? 14 : undefined);
    const resolvedHitSlop = hitSlop ?? (size === "compact" ? scale(4) : undefined);
    const foregroundColor = variant === 'outline'
        ? palette.chrome.primary
        : variant === 'primary'
            ? palette.chrome.common.inverseText
            : palette.brand.text.heading;

    const gradientColors =
        variant === "outline"
            ? (["transparent", "transparent"] as [string, string])
            : variant === "primary"
                ? ([palette.brand.gradient.start, palette.brand.gradient.end] as [string, string])
                : ([palette.brand.bg.surface, palette.brand.bg.border] as [string, string]);

    const animatedStyle = useAnimatedStyle(() => ({
        transform: [{ scale: scaleValue.value }],
    }));

    const handlePressIn = () => {
        if (!disabled && !loading) {
            scaleValue.value = reduceMotion ? 1 : withSpring(0.97);
        }
    };
    const handlePressOut = () => {
        scaleValue.value = reduceMotion ? 1 : withSpring(1);
    };

    return (
        <Animated.View
            style={[
                animatedStyle,
                (widthMode === "full" || variant === "outline")
                    ? { width: "100%" }
                    : { width: wp(70), alignSelf: "center" },
                containerStyle,
            ]}
        >
            <View style={styles.shadowWrapper}>
                <TouchableOpacity
                    accessibilityRole="button"
                    accessibilityLabel={title}
                    accessibilityState={{ disabled: disabled || loading, busy: loading }}
                    hitSlop={resolvedHitSlop}
                    onPress={() => {
                        if (!disabled && !loading) lightImpact();
                        onPress();
                    }}
                    onPressIn={handlePressIn}
                    onPressOut={handlePressOut}
                    disabled={disabled || loading}
                    activeOpacity={1}
                    className={`overflow-hidden ${variant === 'outline' ? 'rounded-xl' : 'rounded-full'} ${disabled ? "opacity-50" : ""} ${className}`}
                    style={[
                        {
                            height: scale(resolvedHeight),
                            width: "100%",
                        },
                        variant === 'outline' && {
                            borderWidth: 1,
                            borderColor: palette.brand.bg.border,
                        },
                    ]}
                >
                    <LinearGradient
                        colors={gradientColors}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 0 }}
                        style={{
                            flex: 1, // guarantees it fills 56px height
                            width: "100%", // guarantees it fills button width
                            alignItems: "center",
                            justifyContent: "center",
                            paddingHorizontal: 32,
                        }}
                    >
                        {loading ? (
                            <ActivityIndicator color={foregroundColor} />
                        ) : (
                            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: variant === 'outline' ? 'space-between' : 'center', width: '100%', paddingHorizontal: variant === 'outline' ? 4 : 0 }}>
                                <Text
                                    variant={variant === 'outline' ? 'body-sm' : 'button'}
                                    className={variant === 'outline' ? 'font-body text-brand-text-body' : 'text-white font-body-semi text-center'}
                                    numberOfLines={1}
                                    style={[
                                        variant === 'outline' ? { flex: 1 } : undefined,
                                        resolvedTextSize !== undefined ? { fontSize: scale(resolvedTextSize) } : undefined,
                                        { color: foregroundColor },
                                        // Android adds asymmetric font padding that pushes the
                                        // label up inside compact buttons
                                        { includeFontPadding: false, textAlignVertical: 'center' },
                                    ]}
                                >
                                    {title}
                                </Text>

                                {typeof rightIcon === 'function' ? rightIcon(foregroundColor) : rightIcon}

                                {showChevron && (
                                    <View style={styles.chevron}>
                                        {isRTL ? (
                                            <CaretLeft size={scale(20)} color={foregroundColor} weight="bold" />
                                        ) : (
                                            <CaretRight size={scale(20)} color={foregroundColor} weight="bold" />
                                        )}
                                    </View>
                                )}
                            </View>
                        )}
                    </LinearGradient>
                </TouchableOpacity>
            </View>
        </Animated.View>
    );
};

const styles = StyleSheet.create({
    shadowWrapper: {
        borderRadius: 9999,
        shadowColor: "#0B1B4F",
        shadowOpacity: 0.14,
        shadowRadius: 10,
        shadowOffset: { width: 0, height: 4 },
        elevation: 3,
    },
    chevron: {
        position: "absolute",
        right: 16,
        top: 0,
        bottom: 0,
        alignItems: "center",
        justifyContent: "center",
    },
});
