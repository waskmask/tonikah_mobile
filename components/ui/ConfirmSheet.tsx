import React, { useCallback } from 'react';
import { View, Pressable, Modal, StyleSheet } from 'react-native';
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
    title: string;
    message: string;
    confirmLabel: string;
    cancelLabel: string;
}

/** Branded confirmation dialog in the same bottom-sheet shell as the select
    sheets — replaces the native Alert for in-flow confirmations. */
export function ConfirmSheet({
    visible,
    onClose,
    onConfirm,
    title,
    message,
    confirmLabel,
    cancelLabel,
}: ConfirmSheetProps) {
    const palette = useColors();
    const { isRTL } = useLanguage();
    const insets = useSafeAreaInsets();
    const { lightImpact } = useHaptics();

    const renderBackdrop = useCallback(
        (props: BottomSheetBackdropProps) => (
            <BottomSheetBackdrop
                {...props}
                appearsOnIndex={0}
                disappearsOnIndex={-1}
                pressBehavior="close"
                opacity={0.4}
            />
        ),
        [],
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
            onRequestClose={onClose}
        >
            <GestureHandlerRootView style={{ flex: 1 }}>
                <BottomSheet
                    snapPoints={[sheetHeight]}
                    index={0}
                    enablePanDownToClose
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
                            <Pressable onPress={onClose} hitSlop={12}>
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
                                    onClose();
                                }}
                                style={[
                                    styles.cancelButton,
                                    { borderColor: palette.brand.bg.border },
                                ]}
                            >
                                <Text
                                    variant="body-sm"
                                    className="font-body-semi"
                                    style={{ fontSize: scale(15), color: palette.brand.text.body }}
                                >
                                    {cancelLabel}
                                </Text>
                            </Pressable>
                            <View style={{ flex: 1 }}>
                                <GradientButton
                                    title={confirmLabel}
                                    onPress={onConfirm}
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
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: scale(20),
        paddingVertical: scale(12),
    },
    sheetTitle: {
        flex: 1,
        fontSize: 14,
        lineHeight: 18,
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
