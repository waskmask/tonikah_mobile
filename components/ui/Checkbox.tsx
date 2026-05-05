import React, { useEffect } from 'react';
import { View, Pressable, StyleSheet } from 'react-native';
import { Text } from './Text';
import { Check } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
    useSharedValue,
    useAnimatedStyle,
    withSpring,
    interpolateColor,
    withTiming
} from 'react-native-reanimated';
import { scale } from '@/hooks/useResponsive';
import { useLanguage } from '@/hooks/useLanguage';

interface CheckboxProps {
    checked: boolean;
    onChange: (checked: boolean) => void;
    label: React.ReactNode;
    error?: string;
    disabled?: boolean;
}

export function Checkbox({ checked, onChange, label, error, disabled }: CheckboxProps) {
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
            transform: [{ scale: scaleAnim.value }],
            opacity: scaleAnim.value,
        };
    });

    const boxStyle = useAnimatedStyle(() => {
        const defaultColor = checked ? 'transparent' : '#D1D5DB'; // gray-300
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
                className={`flex-row items-start ${disabled ? 'opacity-50' : ''}`}
                style={{ gap: scale(12) }}
            >
                {/* Checkbox Box */}
                <Animated.View
                    className="w-6 h-6 rounded-md border-2 items-center justify-center overflow-hidden bg-white dark:bg-slate-800"
                    style={[boxStyle, { marginTop: scale(2) }]}
                >
                    {checked && (
                        <Animated.View style={[StyleSheet.absoluteFillObject, checkStyle]}>
                            <LinearGradient
                                colors={['#FE8A7B', '#F34B6F']}
                                start={{ x: 0, y: 0 }}
                                end={{ x: 1, y: 1 }}
                                style={StyleSheet.absoluteFillObject}
                            />
                        </Animated.View>
                    )}
                    <Animated.View style={checkStyle}>
                        <Check size={scale(14)} color="#FFFFFF" strokeWidth={3} />
                    </Animated.View>
                </Animated.View>

                {/* Label */}
                <View className="flex-1">
                    {typeof label === 'string' ? (
                        <Text variant="body-sm" className="leading-5 text-gray-700 dark:text-gray-300 flex-wrap text-left">
                            {label}
                        </Text>
                    ) : (
                        <View className="flex-row flex-wrap items-start justify-start">
                            {label}
                        </View>
                    )}
                </View>
            </Pressable>

            {/* Error Message */}
            {error && (
                <Text
                    variant="caption"
                    className="text-red-500 mt-1"
                    style={{ paddingInlineStart: scale(36) }}
                >
                    {error}
                </Text>
            )}
        </View>
    );
}
