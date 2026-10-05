import React, { useEffect, useRef } from 'react';
import { ActivityIndicator, Modal, Pressable, StyleSheet, View } from 'react-native';
import { Text } from '@/components/ui/Text';
import { Trash2, Undo2 } from '@/components/ui/icons/PhosphorCompat';
import { scale } from '@/hooks/useResponsive';

type DeleteChoice = 'delete' | 'unsend' | null;

export function MessageDeleteDialog({
    visible,
    title,
    deleteLabel,
    unsendLabel,
    cancelLabel,
    busyChoice,
    error,
    colors,
    onDelete,
    onUnsend,
    onClose,
}: {
    visible: boolean;
    title: string;
    deleteLabel: string;
    unsendLabel: string;
    cancelLabel: string;
    busyChoice: DeleteChoice;
    error: string;
    colors: { card: string; text: string; muted: string; danger: string; border: string };
    onDelete: () => void;
    onUnsend: () => void;
    onClose: () => void;
}) {
    const busy = busyChoice !== null;
    const shownAtRef = useRef(Number.POSITIVE_INFINITY);
    const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    useEffect(() => () => {
        if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
    }, []);
    const requestClose = () => {
        if (busy || Date.now() - shownAtRef.current <= 400 || closeTimerRef.current) return;
        closeTimerRef.current = setTimeout(() => {
            closeTimerRef.current = null;
            onClose();
        }, 100);
    };

    return (
        <Modal
            visible={visible}
            transparent
            animationType="fade"
            statusBarTranslucent
            navigationBarTranslucent
            onShow={() => { shownAtRef.current = Date.now(); }}
            onDismiss={() => { shownAtRef.current = Number.POSITIVE_INFINITY; }}
            onRequestClose={requestClose}
        >
            <View style={styles.layer}>
                <Pressable style={StyleSheet.absoluteFill} onPress={requestClose} accessibilityLabel={cancelLabel} />
                <View style={[styles.dialog, { backgroundColor: colors.card, borderColor: colors.border }]}>
                    <Text variant="body" className="font-body-bold" style={[styles.title, { color: colors.text }]}>{title}</Text>
                    <Pressable accessibilityRole="button" disabled={busy} onPress={onDelete} style={[styles.choice, { borderTopColor: colors.border }]}>
                        {busyChoice === 'delete' ? <ActivityIndicator size="small" color={colors.danger} /> : <Trash2 size={scale(21)} color={colors.danger} />}
                        <Text variant="body" style={[styles.choiceLabel, { color: colors.text }]}>{deleteLabel}</Text>
                    </Pressable>
                    <Pressable accessibilityRole="button" disabled={busy} onPress={onUnsend} style={[styles.choice, { borderTopColor: colors.border }]}>
                        {busyChoice === 'unsend' ? <ActivityIndicator size="small" color={colors.danger} /> : <Undo2 size={scale(21)} color={colors.danger} />}
                        <Text variant="body" style={[styles.choiceLabel, { color: colors.text }]}>{unsendLabel}</Text>
                    </Pressable>
                    {!!error && <Text variant="caption" style={[styles.error, { color: colors.danger }]}>{error}</Text>}
                    <Pressable accessibilityRole="button" disabled={busy} onPress={requestClose} style={[styles.cancel, { borderTopColor: colors.border }]}>
                        <Text variant="body-sm" className="font-body-semi" style={{ color: colors.muted }}>{cancelLabel}</Text>
                    </Pressable>
                </View>
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    layer: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: scale(24), backgroundColor: 'rgba(0,0,0,0.42)' },
    dialog: { width: '100%', maxWidth: scale(360), borderWidth: StyleSheet.hairlineWidth, borderRadius: scale(8), overflow: 'hidden' },
    title: { fontSize: scale(17), lineHeight: scale(23), paddingHorizontal: scale(20), paddingVertical: scale(20) },
    choice: { minHeight: scale(54), borderTopWidth: StyleSheet.hairlineWidth, flexDirection: 'row', alignItems: 'center', gap: scale(14), paddingHorizontal: scale(20) },
    choiceLabel: { flex: 1, fontSize: scale(15), lineHeight: scale(21) },
    error: { paddingHorizontal: scale(20), paddingVertical: scale(8), fontSize: scale(12) },
    cancel: { minHeight: scale(48), borderTopWidth: StyleSheet.hairlineWidth, alignItems: 'center', justifyContent: 'center' },
});
