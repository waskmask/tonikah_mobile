import React, { useCallback, useEffect, useMemo, useRef } from 'react';
import { View, PanResponder, StyleSheet } from 'react-native';
import { Text } from './Text';
import { CheckCircle, Info, Lock, LockOpen, Warning, WarningCircle } from 'phosphor-react-native';
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
import { t } from '@/lib/profileDisplay';

export type ToastType = 'success' | 'error' | 'warning' | 'info';
export type ToastIcon = 'lock' | 'unlock';

export interface ToastProps {
    visible: boolean;
    message: string;
    type?: ToastType;
    onDismiss: () => void;
    duration?: number;
    icon?: ToastIcon;
}

const TOAST_ICONS = {
    success: CheckCircle,
    error: WarningCircle,
    warning: Warning,
    info: Info,
};

const CUSTOM_TOAST_ICONS = {
    lock: Lock,
    unlock: LockOpen,
};

export function Toast({ visible, message, type = 'info', onDismiss, duration = 4000, icon }: ToastProps) {
    const insets = useSafeAreaInsets();
    const { isRTL } = useLanguage();
    const colors = useColors();
    const translateY = useSharedValue(-150);
    const dismissRef = useRef(onDismiss);
    dismissRef.current = onDismiss;
    const heightRef = useRef(150);
    const dismissingRef = useRef(false);
    const toastStyle = colors.chrome.toast[type];
    const Icon = icon ? CUSTOM_TOAST_ICONS[icon] : TOAST_ICONS[type];

    const completeDismiss = useCallback(() => dismissRef.current(), []);
    const hideToast = useCallback(() => {
        if (dismissingRef.current) return;
        dismissingRef.current = true;
        translateY.value = withTiming(-heightRef.current, {
            duration: 220,
            easing: Easing.out(Easing.cubic),
        }, (finished) => {
            if (finished) runOnJS(completeDismiss)();
        });
    }, [completeDismiss, translateY]);

    const pan = useMemo(() => PanResponder.create({
        onMoveShouldSetPanResponder: (_, gesture) => !dismissingRef.current
            && gesture.dy < -8 && Math.abs(gesture.dy) > Math.abs(gesture.dx),
        onPanResponderMove: (_, gesture) => {
            if (!dismissingRef.current) translateY.value = Math.min(0, gesture.dy);
        },
        onPanResponderRelease: (_, gesture) => {
            if (dismissingRef.current) return;
            if (gesture.dy < -28 || (gesture.dy < -8 && gesture.vy < -0.5)) hideToast();
            else translateY.value = withSpring(0, { damping: 20, stiffness: 200 });
        },
        onPanResponderTerminationRequest: () => false,
        onPanResponderTerminate: () => {
            if (!dismissingRef.current) translateY.value = withSpring(0);
        },
    }), [hideToast, translateY]);

    useEffect(() => {
        dismissingRef.current = false;
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
    }, [visible, duration, message, type, hideToast, translateY]);

    const animatedStyle = useAnimatedStyle(() => ({
        transform: [{ translateY: translateY.value }],
    }));

    if (!visible && translateY.value <= -149) return null;

    return (
        <Animated.View
            onLayout={(event) => { heightRef.current = Math.max(150, event.nativeEvent.layout.height + 20); }}
            style={[
                styles.container,
                { paddingTop: insets.top + scale(10) },
                animatedStyle
            ]}
        >
                <View
                    {...pan.panHandlers}
                    accessible
                    accessibilityRole="alert"
                    accessibilityLiveRegion="assertive"
                    accessibilityLabel={message}
                    accessibilityActions={[{ name: 'dismiss', label: t('close', 'Close') }]}
                    onAccessibilityAction={(event) => {
                        if (event.nativeEvent.actionName === 'dismiss') hideToast();
                    }}
                    onAccessibilityEscape={hideToast}
                    style={[
                        styles.card,
                        {
                            backgroundColor: toastStyle.bg,
                        },
                    ]}
                >
                    <View style={[styles.cardInner, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
                        <View pointerEvents="none" style={[styles.accent, { backgroundColor: toastStyle.border }]} />
                        <View style={[styles.content, {
                            flexDirection: isRTL ? 'row-reverse' : 'row',
                            paddingLeft: scale(isRTL ? 12 : 10),
                            paddingRight: scale(isRTL ? 10 : 12),
                        }]}>
                    <Icon size={scale(24)} color={toastStyle.icon} />
                    <Text
                        variant="body-sm"
                        style={{
                            flex: 1,
                            color: toastStyle.text,
                            textAlign: isRTL ? 'right' : 'left',
                        }}
                    >
                        {message}
                    </Text>
                        </View>
                    </View>
                </View>
        </Animated.View>
    );
}

const styles = StyleSheet.create({
    container: {
        position: 'absolute',
        top: 0,
        width: '100%',
        paddingHorizontal: scale(16),
        zIndex: 1000,
        elevation: 1000,
    },
    card: {
        borderRadius: scale(12),
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.18,
        shadowRadius: 6,
        elevation: 4,
    },
    cardInner: {
        direction: 'ltr',
        borderRadius: scale(12),
        overflow: 'hidden',
    },
    content: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        padding: scale(12),
        gap: scale(10),
    },
    accent: {
        alignSelf: 'stretch',
        flexShrink: 0,
        width: scale(4),
    },
});
