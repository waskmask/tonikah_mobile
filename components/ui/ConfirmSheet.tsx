import React, { useCallback } from 'react';
import { ActivityIndicator, View, Pressable, Modal, StyleSheet } from 'react-native';
import BottomSheet, {
    BottomSheetBackdrop,
    BottomSheetBackdropProps,
    BottomSheetView,
} from '@gorhom/bottom-sheet';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { Text } from './Text';
import { GradientButton } from './GradientButton';
import { useColors } from '@/hooks/useColors';
import { useLanguage } from '@/hooks/useLanguage';
import { useHaptics } from '@/hooks/useHaptics';
import { scale } from '@/hooks/useResponsive';
import { X } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

interface ConfirmSheetProps {
    visible: boolean;
    onClose: () => void;
    onConfirm: () => void;
    onCancel?: () => void;
    title: string;
    message: string;
    confirmLabel: string;
    cancelLabel: string;
    confirmLoading?: boolean;
    cancelLoading?: boolean;
}

/** Branded confirmation dialog in the same bottom-sheet shell as the select
    sheets — replaces the native Alert for in-flow confirmations. */
export function ConfirmSheet({
    visible,
    onClose,
    onConfirm,
    onCancel,
    title,
    message,
    confirmLabel,
    cancelLabel,
    confirmLoading = false,
    cancelLoading = false,
}: ConfirmSheetProps) {
    const palette = useColors();
    const { isRTL } = useLanguage();
    const insets = useSafeAreaInsets();
    const { lightImpact } = useHaptics();
    const busy = confirmLoading || cancelLoading;

    const renderBackdrop = useCallback(
        (props: BottomSheetBackdropProps) => (
            <BottomSheetBackdrop
                {...props}
                appearsOnIndex={0}
                disappearsOnIndex={-1}
                pressBehavior={busy ? "none" : "close"}
                opacity={0.4}
            />
        ),
        [busy],
    );

    // Fixed height (dynamic sizing can measure content as 0 — see the select
    // sheets); generous enough for a 4-line message in verbose locales
    const sheetHeight = scale(240) + insets.bottom;

    return (
        <Modal
            visible={visible}
            transparent
            animationType="none"
            statusBarTranslucent
            navigationBarTranslucent
            hardwareAccelerated
            onRequestClose={() => {
                if (!busy) onClose();
            }}
        >
            <GestureHandlerRootView style={{ flex: 1 }}>
                <BottomSheet
                    snapPoints={[sheetHeight]}
                    index={0}
                    enablePanDownToClose={!busy}
                    enableDynamicSizing={false}
                    onClose={onClose}
                    backdropComponent={renderBackdrop}
                    backgroundStyle={{ backgroundColor: palette.chrome.common.card }}
                    handleIndicatorStyle={{ backgroundColor: palette.brand.text.muted }}
                >
                    <BottomSheetView style={{ flex: 1 }}>
                        <View style={styles.header}>
                            <Text variant="body-sm" className="font-body-bold" style={styles.sheetTitle}>
                                {title}
                            </Text>
                            <Pressable
                                onPress={onClose}
                                disabled={busy}
                                hitSlop={8}
                                style={styles.closeButton}
                            >
                                <X size={scale(20)} color={palette.brand.text.subtitle} />
                            </Pressable>
                        </View>

                        <Text
                            variant="body"
                            style={[
                                styles.message,
                                {
                                    color: palette.brand.text.body,
                                    textAlign: isRTL ? 'right' : 'left',
                                },
                            ]}
                        >
                            {message}
                        </Text>

                        <View
                            style={[
                                styles.buttons,
                                { flexDirection: 'row', paddingBottom: insets.bottom + scale(12) },
                            ]}
                        >
                            <Pressable
                                onPress={() => {
                                    lightImpact();
                                    (onCancel || onClose)();
                                }}
                                disabled={busy}
                                style={[
                                    styles.cancelButton,
                                    { borderColor: palette.brand.bg.border },
                                ]}
                            >
                                {cancelLoading ? (
                                    <ActivityIndicator size="small" color={palette.chrome.primary} />
                                ) : (
                                    <Text
                                        variant="body-sm"
                                        className="font-body-semi"
                                        style={{ fontSize: scale(15), color: palette.brand.text.body }}
                                    >
                                        {cancelLabel}
                                    </Text>
                                )}
                            </Pressable>
                            <View style={{ flex: 1 }}>
                                <GradientButton
                                    title={confirmLabel}
                                    onPress={onConfirm}
                                    loading={confirmLoading}
                                    disabled={busy}
                                    widthMode="full"
                                    height={40}
                                    textSize={15}
                                />
                            </View>
                        </View>
                    </BottomSheetView>
                </BottomSheet>
            </GestureHandlerRootView>
        </Modal>
    );
}

const styles = StyleSheet.create({
    header: {
        position: 'relative',
        minHeight: scale(48),
        justifyContent: 'center',
        paddingHorizontal: scale(20),
        paddingVertical: scale(12),
    },
    sheetTitle: {
        flex: 1,
        fontSize: 14,
        lineHeight: 18,
        paddingRight: scale(28),
    },
    closeButton: {
        position: 'absolute',
        top: scale(8),
        right: scale(8),
        width: scale(32),
        height: scale(32),
        alignItems: 'center',
        justifyContent: 'center',
    },
    message: {
        paddingHorizontal: scale(20),
        fontSize: scale(15),
        lineHeight: scale(22),
        flex: 1,
    },
    buttons: {
        alignItems: 'center',
        gap: scale(12),
        paddingHorizontal: scale(20),
        paddingTop: scale(12),
    },
    cancelButton: {
        flex: 1,
        height: scale(40),
        borderWidth: 1,
        borderRadius: 9999,
        alignItems: 'center',
        justifyContent: 'center',
    },
});
