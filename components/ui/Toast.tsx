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
import { useColors } from '@/hooks/useColors';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface ToastProps {
    visible: boolean;
    message: string;
    type?: ToastType;
    onDismiss: () => void;
    duration?: number;
}

const TOAST_ICONS = {
    success: CheckCircle2,
    error: AlertCircle,
    warning: AlertTriangle,
    info: Info,
};

export function Toast({ visible, message, type = 'info', onDismiss, duration = 4000 }: ToastProps) {
    const insets = useSafeAreaInsets();
    const { isRTL } = useLanguage();
    const colors = useColors();
    const translateY = useSharedValue(-150);
    const toastStyle = colors.chrome.toast[type];
    const Icon = TOAST_ICONS[type];

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

    const animatedStyle = useAnimatedStyle(() => ({
        transform: [{ translateY: translateY.value }],
    }));

    if (!visible && translateY.value <= -149) return null;

    return (
        <Animated.View
            style={[
                styles.container,
                { paddingTop: insets.top + scale(10) },
                animatedStyle
            ]}
        >
            <Pressable onPress={hideToast} style={styles.pressable}>
                <View
                    style={[
                        styles.card,
                        {
                            minHeight: scale(60),
                            backgroundColor: toastStyle.bg,
                            borderLeftColor: toastStyle.border,
                        },
                    ]}
                >
                    <Icon size={scale(24)} color={toastStyle.icon} />
                    <Text
                        variant="body-sm"
                        style={{
                            flex: 1,
                            marginHorizontal: scale(12),
                            color: toastStyle.text,
                            textAlign: isRTL ? 'right' : 'left',
                        }}
                    >
                        {message}
                    </Text>
                    <Pressable onPress={hideToast} hitSlop={10} style={styles.dismiss}>
                        <X size={scale(20)} color={toastStyle.icon} />
                    </Pressable>
                </View>
            </Pressable>
        </Animated.View>
    );
}

const styles = StyleSheet.create({
    container: {
        position: 'absolute',
        top: 0,
        width: '100%',
        paddingHorizontal: scale(16),
        zIndex: 50,
        elevation: 5,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.15,
        shadowRadius: 8,
    },
    pressable: {
        width: '100%',
    },
    card: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: scale(16),
        borderRadius: scale(12),
        borderLeftWidth: scale(4),
    },
    dismiss: {
        padding: scale(4),
        opacity: 0.7,
    },
});
