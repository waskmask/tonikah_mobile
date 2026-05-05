import React, { useEffect } from 'react';
import { View, Pressable, StyleSheet } from 'react-native';
import { Text } from './Text';
import { AlertCircle, CheckCircle2, AlertTriangle, Info, X } from 'lucide-react-native';
import Animated, {
    useSharedValue,
    useAnimatedStyle,
    withTiming,
    withSpring,
    Easing,
    runOnJS
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { scale } from '@/hooks/useResponsive';
import { useLanguage } from '@/hooks/useLanguage';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface ToastProps {
    visible: boolean;
    message: string;
    type?: ToastType;
    onDismiss: () => void;
    duration?: number;
}

const TOAST_CONFIG = {
    success: {
        bg: 'bg-green-50 dark:bg-green-900/20',
        border: 'border-green-500',
        icon: CheckCircle2,
        iconColor: '#22C55E', // green-500
        textColor: 'text-green-800 dark:text-green-200'
    },
    error: {
        bg: 'bg-red-50 dark:bg-red-900/20',
        border: 'border-red-500',
        icon: AlertCircle,
        iconColor: '#EF4444', // red-500
        textColor: 'text-red-800 dark:text-red-200'
    },
    warning: {
        bg: 'bg-amber-50 dark:bg-amber-900/20',
        border: 'border-amber-500',
        icon: AlertTriangle,
        iconColor: '#F59E0B', // amber-500
        textColor: 'text-amber-800 dark:text-amber-200'
    },
    info: {
        bg: 'bg-blue-50 dark:bg-blue-900/20',
        border: 'border-blue-500',
        icon: Info,
        iconColor: '#3B82F6', // blue-500
        textColor: 'text-blue-800 dark:text-blue-200'
    }
};

export function Toast({ visible, message, type = 'info', onDismiss, duration = 4000 }: ToastProps) {
    const insets = useSafeAreaInsets();
    const { isRTL } = useLanguage();
    const translateY = useSharedValue(-150);

    useEffect(() => {
        if (visible) {
            translateY.value = withSpring(0, {
                damping: 15,
                stiffness: 100,
                mass: 0.8
            });

            if (duration > 0) {
                const timer = setTimeout(() => {
                    hideToast();
                }, duration);
                return () => clearTimeout(timer);
            }
        } else {
            hideToast();
        }
    }, [visible, duration]);

    const hideToast = () => {
        translateY.value = withTiming(-150, {
            duration: 300,
            easing: Easing.inOut(Easing.ease)
        }, (finished) => {
            if (finished) {
                runOnJS(onDismiss)();
            }
        });
    };

    const animatedStyle = useAnimatedStyle(() => {
        return {
            transform: [{ translateY: translateY.value }],
        };
    });

    if (!visible && translateY.value <= -149) return null;

    const config = TOAST_CONFIG[type];
    const Icon = config.icon;

    return (
        <Animated.View
            style={[
                styles.container,
                { paddingTop: insets.top + scale(10) },
                animatedStyle
            ]}
            className="absolute top-0 w-full px-4 z-50 elevation-5"
        >
            <Pressable onPress={hideToast} className="w-full shadow-sm">
                <View
                    className={`flex-row items-center p-4 rounded-xl border-s-4 shadow-sm backdrop-blur-md ${config.bg} ${config.border}`}
                    style={{ minHeight: scale(60) }}
                >
                    <Icon size={scale(24)} color={config.iconColor} />
                    <Text
                        variant="body-sm"
                        className={`flex-1 mx-3 ${config.textColor}`}
                        style={{ textAlign: isRTL ? 'right' : 'left' }}
                    >
                        {message}
                    </Text>
                    <Pressable onPress={hideToast} hitSlop={10} className="p-1 opacity-60">
                        <X size={scale(20)} color={config.iconColor} />
                    </Pressable>
                </View>
            </Pressable>
        </Animated.View>
    );
}

const styles = StyleSheet.create({
    container: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.15,
        shadowRadius: 8,
    }
});
