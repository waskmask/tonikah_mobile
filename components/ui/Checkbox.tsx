import React, { useEffect } from 'react';
import { View, Pressable, StyleSheet } from 'react-native';
import { Text } from './Text';
import { Check } from 'phosphor-react-native';
import Animated, {
    useSharedValue,
    useAnimatedStyle,
    withSpring,
    interpolateColor,
    withTiming
} from 'react-native-reanimated';
import { scale } from '@/hooks/useResponsive';
import { useColors } from '@/hooks/useColors';
import { useLanguage } from '@/hooks/useLanguage';

interface CheckboxProps {
    checked: boolean;
    onChange: (checked: boolean) => void;
    label: React.ReactNode;
    error?: string;
    disabled?: boolean;
}

export function Checkbox({ checked, onChange, label, error, disabled }: CheckboxProps) {
    const colors = useColors();
    const { isRTL } = useLanguage();
    const scaleAnim = useSharedValue(checked ? 1 : 0);
    const borderColorAnim = useSharedValue(error ? 1 : 0);

    useEffect(() => {
        scaleAnim.value = withSpring(checked ? 1 : 0, {
            mass: 0.5,
            stiffness: 300,
            damping: 20
        });
    }, [checked]);

    useEffect(() => {
        borderColorAnim.value = withTiming(error ? 1 : 0, { duration: 200 });
    }, [error]);

    const checkStyle = useAnimatedStyle(() => {
        return {
            transform: [{ translateX: 0.5 }, { scale: scaleAnim.value }],
            opacity: scaleAnim.value,
        };
    });

    const boxStyle = useAnimatedStyle(() => {
        const defaultColor = checked ? colors.chrome.primary : colors.brand.text.muted;
        const errorColor = '#EF4444'; // red-500

        return {
            borderColor: interpolateColor(
                borderColorAnim.value,
                [0, 1],
                [defaultColor, errorColor]
            )
        };
    });

    return (
        <View className="w-full">
            <Pressable
                onPress={() => !disabled && onChange(!checked)}
                accessibilityRole="checkbox"
                accessibilityLabel={typeof label === 'string' ? label : undefined}
                accessibilityState={{ checked, disabled }}
                className={`flex-row items-start ${disabled ? 'opacity-50' : ''}`}
                style={{ gap: scale(12), flexDirection: isRTL ? 'row-reverse' : 'row' }}
            >
                <Animated.View
                    style={[
                        styles.checkbox,
                        boxStyle,
                        {
                            marginTop: scale(2),
                            backgroundColor: checked ? colors.chrome.primary : 'transparent',
                        },
                    ]}
                >
                    <Animated.View style={checkStyle}>
                        <Check size={scale(12)} color={colors.chrome.common.inverseText} weight="bold" />
                    </Animated.View>
                </Animated.View>

                {/* Label */}
                <View className="flex-1">
                    {typeof label === 'string' ? (
                        <Text
                            variant="body-sm"
                            className="leading-5 text-brand-text-subtitle flex-wrap"
                            style={{ textAlign: isRTL ? 'right' : 'left', writingDirection: isRTL ? 'rtl' : 'ltr' }}
                        >
                            {label}
                        </Text>
                    ) : (
                        <View style={{ flexDirection: isRTL ? 'row-reverse' : 'row', flexWrap: 'wrap', alignItems: 'flex-start' }}>
                            {label}
                        </View>
                    )}
                </View>
            </Pressable>

            {/* Error Message */}
            {error && (
                <Text
                    variant="caption"
                    accessibilityRole="alert"
                    accessibilityLiveRegion="assertive"
                    className="text-red-500 mt-1"
                    style={{ paddingStart: scale(36), textAlign: isRTL ? 'right' : 'left' }}
                >
                    {error}
                </Text>
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    checkbox: {
        width: scale(20),
        height: scale(20),
        flexShrink: 0,
        borderRadius: scale(6),
        borderWidth: 1,
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
    },
});
