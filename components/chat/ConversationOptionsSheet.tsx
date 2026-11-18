import React, { useCallback, useEffect, useMemo } from 'react';
import { BackHandler, Pressable, StyleSheet, View, useWindowDimensions } from 'react-native';
import BottomSheet, { type BottomSheetBackdropProps, BottomSheetScrollView, BottomSheetView } from '@gorhom/bottom-sheet';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { X } from '@/components/ui/icons/PhosphorCompat';
import { Text } from '@/components/ui/Text';
import { GradientButton } from '@/components/ui/GradientButton';
import { scale } from '@/hooks/useResponsive';
import { useLanguage } from '@/hooks/useLanguage';

type Props = {
    visible: boolean;
    busy: boolean;
    confirming: boolean;
    title: string;
    message: string;
    confirmLabel: string;
    cancelLabel: string;
    closeLabel: string;
    colors: Record<string, string>;
    onClose: () => void;
    onCancel: () => void;
    onConfirm: () => void;
    children: React.ReactNode;
};

/** One inline host: no native-modal presentation/dismissal race on iOS. */
export function ConversationOptionsSheet({
    visible, busy, confirming, title, message, confirmLabel, cancelLabel,
    closeLabel, colors, onClose, onCancel, onConfirm, children,
}: Props) {
    const { height, fontScale } = useWindowDimensions();
    const insets = useSafeAreaInsets();
    const { isRTL } = useLanguage();
    const snapPoints = useMemo(() => [Math.max(1, Math.min(
        height - insets.top - scale(16),
        scale(320) * Math.max(1, fontScale) + insets.bottom,
    ))], [height, fontScale, insets.top, insets.bottom]);
    const close = useCallback(() => { if (!busy) onClose(); }, [busy, onClose]);
    const backdrop = useCallback((_props: BottomSheetBackdropProps) => (
        <Pressable
            style={styles.backdrop}
            accessibilityRole="button"
            accessibilityLabel={closeLabel}
            disabled={busy}
            onPress={close}
        />
    ), [busy, close, closeLabel]);

    useEffect(() => {
        if (!visible) return;
        const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
            close();
            return true;
        });
        return () => subscription.remove();
    }, [visible, close]);

    if (!visible) return null;
    return (
        <View style={styles.host} pointerEvents="box-none" accessibilityViewIsModal>
            <BottomSheet
                index={0}
                snapPoints={snapPoints}
                animateOnMount={false}
                enableDynamicSizing={false}
                enablePanDownToClose={!busy}
                onClose={close}
                backdropComponent={backdrop}
                backgroundStyle={{ backgroundColor: colors.card }}
                handleIndicatorStyle={{ backgroundColor: colors.muted }}
                style={{ direction: isRTL ? 'rtl' : 'ltr' }}
            >
                <BottomSheetView style={styles.content}>
                    <View style={[styles.header, { borderBottomColor: colors.border }]}>
                        <Text variant="body-sm" className="font-body-bold" style={[styles.title, { color: colors.text }]}>
                            {title}
                        </Text>
                        <Pressable accessibilityRole="button" accessibilityLabel={closeLabel} disabled={busy} onPress={close} style={styles.close} hitSlop={8}>
                            <X size={scale(20)} color={colors.text} />
                        </Pressable>
                    </View>
                    <BottomSheetScrollView contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + scale(16) }]}>
                        {confirming ? (
                            <View style={styles.confirmation}>
                                <Text variant="body" style={{ color: colors.text }}>{message}</Text>
                                <View style={styles.buttons}>
                                    <Pressable accessibilityRole="button" disabled={busy} onPress={onCancel} style={[styles.cancel, { borderColor: colors.border }]}>
                                        <Text variant="body-sm" className="font-body-semi" style={{ color: colors.text }}>{cancelLabel}</Text>
                                    </Pressable>
                                    <View style={styles.confirmButton}>
                                        <GradientButton title={confirmLabel} onPress={onConfirm} disabled={busy} loading={busy} widthMode="full" height={44} textSize={15} />
                                    </View>
                                </View>
                            </View>
                        ) : children}
                    </BottomSheetScrollView>
                </BottomSheetView>
            </BottomSheet>
        </View>
    );
}

const styles = StyleSheet.create({
    host: { position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, zIndex: 100, elevation: 20 },
    backdrop: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(0,0,0,0.4)' },
    content: { flex: 1 },
    header: { flexDirection: 'row', alignItems: 'center', gap: scale(12), paddingHorizontal: scale(20), paddingBottom: scale(12), borderBottomWidth: StyleSheet.hairlineWidth },
    title: { flex: 1, textAlign: 'left' },
    close: { width: scale(36), height: scale(36), alignItems: 'center', justifyContent: 'center' },
    scrollContent: { paddingHorizontal: scale(20), paddingTop: scale(12) },
    confirmation: { gap: scale(24) },
    buttons: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: scale(12) },
    cancel: { flexGrow: 1, minHeight: scale(44), paddingHorizontal: scale(16), paddingVertical: scale(10), borderWidth: StyleSheet.hairlineWidth, borderRadius: scale(8), alignItems: 'center', justifyContent: 'center' },
    confirmButton: { flexGrow: 1, minWidth: scale(140) },
});
