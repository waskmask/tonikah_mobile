import React, { useMemo, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, StyleSheet, View } from 'react-native';
import { Camera, Lock, X } from 'lucide-react-native';
import { Text } from '@/components/ui/Text';
import { useColors } from '@/hooks/useColors';
import { scale } from '@/hooks/useResponsive';
import { useToast } from '@/hooks/useToast';
import { galleryService } from '@/lib/galleryService';
import { GalleryRevealStatus } from '@/lib/chatService';
import { t } from '@/lib/profileDisplay';
import i18n from '@/lib/i18n';

/**
 * Owner-driven private gallery reveal, mirroring the web GalleryRevealControl:
 * shown in the conversation header when my gallery is private, opens a modal
 * with duration options (or expiry + "Stop sharing" when a grant is active).
 */

type DurationOption = {
    key: string;
    fallback: string;
    ttlHours?: number;
    noExpiry?: boolean;
};

const DURATIONS: DurationOption[] = [
    { key: 'gallery_reveal_duration_1h', fallback: '1 hour', ttlHours: 1 },
    { key: 'gallery_reveal_duration_12h', fallback: '12 hours', ttlHours: 12 },
    { key: 'gallery_reveal_duration_24h', fallback: '24 hours', ttlHours: 24 },
    { key: 'gallery_reveal_duration_7d', fallback: '7 days', ttlHours: 24 * 7 },
    { key: 'gallery_reveal_duration_30d', fallback: '30 days', ttlHours: 24 * 30 },
    { key: 'gallery_reveal_duration_no_limit', fallback: 'No time limit', noExpiry: true },
];

function formatAccessEnd(expiresAt: string | null | undefined) {
    if (!expiresAt) return null;
    const date = new Date(expiresAt);
    if (Number.isNaN(date.getTime())) return null;
    try {
        return new Intl.DateTimeFormat(i18n.language, { dateStyle: 'medium', timeStyle: 'short' }).format(date);
    } catch {
        return date.toLocaleString();
    }
}

export function GalleryRevealControl({
    conversationId,
    otherName,
    status,
    onChanged,
}: {
    conversationId: string;
    otherName: string;
    status?: GalleryRevealStatus | null;
    onChanged: () => void;
}) {
    const colors = useColors();
    const toast = useToast();
    const [open, setOpen] = useState(false);
    const [busy, setBusy] = useState(false);
    const [selectedKey, setSelectedKey] = useState(DURATIONS[3].key);

    const activeGrant = status?.myGrant ?? null;
    const accessEnd = formatAccessEnd(activeGrant?.expiresAt);
    const selectedDuration = useMemo(
        () => DURATIONS.find((item) => item.key === selectedKey) ?? DURATIONS[3],
        [selectedKey],
    );

    if (!status?.canReveal) return null;

    const chat = (key: string, fallback: string, options?: Record<string, any>) => t(`chat:${key}`, fallback, options);

    const reveal = async () => {
        if (!status.viewerId || busy) return;
        setBusy(true);
        const res = await galleryService.createGrant({
            viewerId: status.viewerId,
            conversationId,
            scope: 'all',
            ttlHours: selectedDuration.ttlHours,
            noExpiry: selectedDuration.noExpiry === true,
        });
        setBusy(false);
        if (res.success) {
            setOpen(false);
            toast.show(chat('gallery_reveal_success', 'Photos revealed'), 'success');
            onChanged();
        } else {
            toast.show(chat('gallery_reveal_error', 'Could not reveal photos. Please try again.'), 'error');
        }
    };

    const revoke = async () => {
        if (!activeGrant?.id || busy) return;
        setBusy(true);
        const res = await galleryService.revokeGrant(activeGrant.id, conversationId);
        setBusy(false);
        if (res.success) {
            setOpen(false);
            toast.show(chat('gallery_revoke_success', 'Photo access ended'), 'success');
            onChanged();
        } else {
            toast.show(chat('gallery_revoke_error', 'Could not stop sharing. Please try again.'), 'error');
        }
    };

    const pillLabel = activeGrant
        ? chat('gallery_revealed_status', 'Photos revealed')
        : chat('gallery_reveal_photos', 'Reveal photos');

    return (
        <>
            <Pressable
                onPress={() => setOpen(true)}
                accessibilityRole="button"
                accessibilityLabel={pillLabel}
                hitSlop={6}
                style={[
                    styles.headerButton,
                    activeGrant
                        ? { backgroundColor: 'rgba(16,185,129,0.14)' }
                        : { backgroundColor: 'rgba(56,189,248,0.14)' },
                ]}
            >
                {activeGrant
                    ? <Camera size={scale(18)} color="#059669" strokeWidth={2.4} />
                    : <Lock size={scale(18)} color="#0284C7" strokeWidth={2.4} />}
            </Pressable>

            <Modal visible={open} transparent animationType="fade" onRequestClose={() => !busy && setOpen(false)}>
                <Pressable style={styles.backdrop} onPress={() => !busy && setOpen(false)}>
                    <Pressable
                        style={[styles.card, { backgroundColor: colors.chrome.common.card, borderColor: colors.brand.bg.border }]}
                        onPress={() => undefined}
                    >
                        <View style={styles.cardHeader}>
                            <View style={[styles.cardIcon, { backgroundColor: 'rgba(56,189,248,0.14)' }]}>
                                <Camera size={scale(22)} color="#0284C7" />
                            </View>
                            <Pressable onPress={() => !busy && setOpen(false)} hitSlop={8} style={styles.cardClose}>
                                <X size={scale(18)} color={colors.brand.text.subtitle} />
                            </Pressable>
                        </View>

                        <Text variant="h3" style={{ marginTop: scale(12) }}>
                            {activeGrant
                                ? chat('gallery_revealed_title', 'Private photos are revealed')
                                : chat('gallery_reveal_title', 'Reveal private photos')}
                        </Text>
                        <Text variant="body-sm" style={{ marginTop: scale(7), color: colors.brand.text.subtitle }}>
                            {activeGrant
                                ? chat('gallery_revealed_description', '{{name}} can currently view your private gallery.', { name: otherName })
                                : chat('gallery_reveal_description', 'Grant {{name}} access to your private gallery for a limited time.', { name: otherName })}
                        </Text>

                        {activeGrant ? (
                            <View style={[styles.expiryBox, { borderColor: colors.brand.bg.border, backgroundColor: colors.brand.bg.surface }]}>
                                <Text variant="body-sm" className="font-body-semi" style={{ color: colors.brand.text.subtitle }}>
                                    {accessEnd
                                        ? chat('gallery_access_ends', 'Access ends: {{date}}', { date: accessEnd })
                                        : chat('gallery_access_no_expiry', 'Access does not expire')}
                                </Text>
                            </View>
                        ) : (
                            <View style={styles.durationGrid}>
                                {DURATIONS.map((option) => {
                                    const selected = selectedKey === option.key;
                                    return (
                                        <Pressable
                                            key={option.key}
                                            onPress={() => setSelectedKey(option.key)}
                                            style={[
                                                styles.durationPill,
                                                {
                                                    borderColor: selected ? colors.chrome.common.textStrong : colors.brand.bg.border,
                                                    backgroundColor: selected ? colors.brand.bg.surface : colors.chrome.common.card,
                                                },
                                            ]}
                                        >
                                            <Text
                                                variant="body-sm"
                                                className="font-body-bold"
                                                align="center"
                                                style={{ color: selected ? colors.chrome.common.textStrong : colors.brand.text.subtitle }}
                                            >
                                                {chat(option.key, option.fallback)}
                                            </Text>
                                        </Pressable>
                                    );
                                })}
                            </View>
                        )}

                        <View style={styles.actionsRow}>
                            <Pressable
                                onPress={() => !busy && setOpen(false)}
                                disabled={busy}
                                style={[styles.actionButton, { borderWidth: 1, borderColor: colors.brand.bg.border, backgroundColor: colors.chrome.common.card }]}
                            >
                                <Text variant="body-sm" className="font-body-bold" style={{ color: colors.chrome.common.textStrong }}>
                                    {t('close', 'Close')}
                                </Text>
                            </Pressable>
                            <Pressable
                                onPress={activeGrant ? revoke : reveal}
                                disabled={busy}
                                style={[styles.actionButton, { backgroundColor: colors.chrome.common.textStrong, opacity: busy ? 0.65 : 1 }]}
                            >
                                {busy ? (
                                    <ActivityIndicator size="small" color={colors.chrome.common.card} />
                                ) : (
                                    <Text variant="body-sm" className="font-body-bold" style={{ color: colors.chrome.common.card }}>
                                        {activeGrant
                                            ? chat('gallery_stop_sharing', 'Stop sharing')
                                            : chat('gallery_reveal_photos', 'Reveal photos')}
                                    </Text>
                                )}
                            </Pressable>
                        </View>
                    </Pressable>
                </Pressable>
            </Modal>
        </>
    );
}

const styles = StyleSheet.create({
    headerButton: {
        width: scale(36),
        height: scale(36),
        borderRadius: scale(18),
        alignItems: 'center',
        justifyContent: 'center',
    },
    backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center', padding: scale(18) },
    card: { width: '100%', maxWidth: scale(420), borderRadius: scale(16), borderWidth: StyleSheet.hairlineWidth, padding: scale(18) },
    cardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    cardIcon: { width: scale(46), height: scale(46), borderRadius: scale(23), alignItems: 'center', justifyContent: 'center' },
    cardClose: { width: scale(34), height: scale(34), borderRadius: scale(17), alignItems: 'center', justifyContent: 'center' },
    expiryBox: { marginTop: scale(14), borderRadius: scale(12), borderWidth: 1, paddingHorizontal: scale(14), paddingVertical: scale(11) },
    durationGrid: { marginTop: scale(14), flexDirection: 'row', flexWrap: 'wrap', gap: scale(8) },
    durationPill: {
        width: '48.4%',
        minHeight: scale(42),
        borderRadius: scale(21),
        borderWidth: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: scale(10),
    },
    actionsRow: { marginTop: scale(16), flexDirection: 'row', gap: scale(8) },
    actionButton: { flex: 1, minHeight: scale(44), borderRadius: scale(22), alignItems: 'center', justifyContent: 'center' },
});
