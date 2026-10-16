import React, { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet } from 'react-native';
import { Info } from '@/components/ui/icons/PhosphorCompat';
import { Trans } from 'react-i18next';
import { normalizeProfileManager } from '@/lib/profileManager';
import { Text } from '@/components/ui/Text';
import { t } from '@/lib/profileDisplay';
import { useColors } from '@/hooks/useColors';
import { scale } from '@/hooks/useResponsive';

/**
 * Non-pink pill shown above profile names when the profile is managed by a
 * family member (profile_manager !== "self"). Tapping opens an info modal —
 * parity with the web ProfileManagerBadge.
 */
export function ProfileManagerBadge({ label, profileName, manager, onDark = false }: { label?: string | null; profileName: string; manager?: string | null; onDark?: boolean }) {
    const colors = useColors();
    const [open, setOpen] = useState(false);

    if (!label) return null;
    const managerKey = normalizeProfileManager(manager);
    const relationship = ['father', 'mother', 'brother', 'sister', 'relative', 'friend'].includes(managerKey) ? managerKey : 'other';

    const pillBackground = onDark ? 'rgba(0,0,0,0.38)' : colors.chrome.common.blueTint;
    const pillBorder = onDark ? 'rgba(255,255,255,0.25)' : colors.chrome.common.blueRing;
    const pillText = onDark ? colors.chrome.common.inverseText : colors.chrome.common.blueAction;

    return (
        <>
            <Pressable
                onPress={() => setOpen(true)}
                accessibilityRole="button"
                accessibilityLabel={t('profile_manager_info_title', 'About the profile manager')}
                style={[styles.pill, { backgroundColor: pillBackground, borderColor: pillBorder }]}
            >
                <Text variant="caption" className="font-body-bold" numberOfLines={1} style={{ color: pillText, flexShrink: 1 }}>
                    {label}
                </Text>
                <Info size={scale(12)} color={pillText} strokeWidth={2.6} />
            </Pressable>

            <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
                <Pressable style={styles.backdrop} onPress={() => setOpen(false)}>
                    <Pressable style={[styles.card, { backgroundColor: colors.chrome.common.card, borderColor: colors.brand.bg.border }]} onPress={() => undefined}>
                        <ScrollView bounces={false}>
                        <Text variant="h3">
                            {t('profile_manager_info_title', 'About the profile manager')}
                        </Text>
                        <Text variant="body-sm" style={{ marginTop: scale(8), color: colors.brand.text.subtitle }}>
                            <Trans
                                ns="common"
                                i18nKey={`profile_manager_messages.${relationship}`}
                                components={{ name: <Text variant="body-sm" className="font-body-bold" style={{ color: colors.brand.text.subtitle }}>{profileName}</Text> }}
                            />
                        </Text>
                        </ScrollView>
                        <Pressable accessibilityRole="button" onPress={() => setOpen(false)} style={[styles.closeButton, { backgroundColor: colors.chrome.common.textStrong }]}>
                            <Text variant="body-sm" className="font-body-bold" style={{ color: colors.chrome.common.card }}>
                                {t('close', 'Close')}
                            </Text>
                        </Pressable>
                    </Pressable>
                </Pressable>
            </Modal>
        </>
    );
}

const styles = StyleSheet.create({
    pill: {
        alignSelf: 'flex-start',
        flexDirection: 'row',
        alignItems: 'center',
        gap: scale(5),
        borderRadius: scale(999),
        borderWidth: 1,
        paddingHorizontal: scale(11),
        paddingVertical: scale(6),
        maxWidth: '100%',
    },
    backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center', padding: scale(18) },
    card: { width: '100%', maxWidth: scale(420), maxHeight: '90%', borderRadius: scale(16), borderWidth: StyleSheet.hairlineWidth, padding: scale(18) },
    closeButton: { marginTop: scale(16), minHeight: scale(44), borderRadius: scale(22), alignItems: 'center', justifyContent: 'center' },
});
