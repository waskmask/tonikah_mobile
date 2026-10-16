import React, { useState } from 'react';
import { Modal, Pressable, StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import { CalendarDots, Camera, CheckCircle, Phone, SealCheck } from 'phosphor-react-native';

import { Text } from '@/components/ui/Text';
import { useColors } from '@/hooks/useColors';
import { useLanguage } from '@/hooks/useLanguage';
import { scale } from '@/hooks/useResponsive';
import { t } from '@/lib/profileDisplay';
import {
    getProfileVerificationFlags,
    hasProfileVerification,
    ProfileVerificationFlags,
    ProfileVerificationSource,
} from '@/lib/profileVerification';

type Props = {
    profile?: ProfileVerificationSource;
    verification?: ProfileVerificationFlags;
    size?: number;
    fillColor?: string;
    outlineColor?: string;
    style?: StyleProp<ViewStyle>;
};

export function ProfileVerificationBadge({
    profile,
    verification,
    size = scale(26),
    fillColor,
    outlineColor,
    style,
}: Props) {
    const colors = useColors();
    const { isRTL } = useLanguage();
    const [open, setOpen] = useState(false);
    const flags = verification ?? getProfileVerificationFlags(profile);
    const checks = [
        flags.phone ? {
            key: 'phone',
            Icon: Phone,
            title: t('verification_whatsapp_title', 'WhatsApp number verified'),
            description: t('verification_whatsapp_description', 'The WhatsApp number linked to this profile has been confirmed.'),
        } : null,
        flags.selfie ? {
            key: 'selfie',
            Icon: Camera,
            title: t('verification_selfie_title', 'Selfie verified'),
            description: t('verification_selfie_description', 'A live selfie was matched with this profile\u2019s primary photo.'),
        } : null,
        flags.age ? {
            key: 'age',
            Icon: CalendarDots,
            title: t('verification_age_title', 'Age verified'),
            description: t('verification_age_description', 'The age shown on this profile was confirmed using an accepted identity document.'),
        } : null,
    ].filter((item): item is NonNullable<typeof item> => item !== null);

    if (!hasProfileVerification(flags)) return null;

    const badgeFill = fillColor ?? colors.chrome.primary;
    const badgeOutline = outlineColor ?? colors.chrome.common.inverseText;

    return (
        <>
            <Pressable
                accessibilityRole="button"
                accessibilityLabel={t('verification_details_title', 'Verification details')}
                hitSlop={scale(10)}
                onPress={(event) => {
                    event.stopPropagation();
                    setOpen(true);
                }}
                style={[styles.badge, { width: size, height: size }, style]}
            >
                <View pointerEvents="none" style={{ width: size, height: size }}>
                    <SealCheck
                        size={size - scale(2)}
                        color={badgeFill}
                        weight="fill"
                        style={{ position: 'absolute', top: scale(1), left: scale(1) }}
                    />
                    <SealCheck size={size} color={badgeOutline} weight="light" style={StyleSheet.absoluteFill} />
                </View>
            </Pressable>

            <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
                <Pressable style={styles.backdrop} onPress={() => setOpen(false)}>
                    <Pressable
                        accessibilityViewIsModal
                        style={[styles.card, { backgroundColor: colors.chrome.common.card, borderColor: colors.brand.bg.border }]}
                        onPress={() => undefined}
                    >
                        <Text variant="h3" style={{ color: colors.brand.text.heading, textAlign: isRTL ? 'right' : 'left' }}>
                            {t('verification_details_title', 'Verification details')}
                        </Text>

                        <View style={styles.checks}>
                            {checks.map(({ key, Icon, title, description }) => (
                                <View
                                    key={key}
                                    style={[
                                        styles.checkRow,
                                        { flexDirection: isRTL ? 'row-reverse' : 'row' },
                                        { backgroundColor: colors.chrome.common.cardAlt, borderColor: colors.brand.bg.border },
                                    ]}
                                >
                                    <View style={[styles.checkIcon, { backgroundColor: colors.chrome.common.primaryTint }]}>
                                        <Icon size={scale(20)} color={colors.chrome.primary} weight="regular" />
                                        <CheckCircle
                                            size={scale(12)}
                                            color={colors.chrome.primary}
                                            weight="fill"
                                            style={styles.checkMark}
                                        />
                                    </View>
                                    <View style={styles.checkCopy}>
                                        <Text variant="body-sm" className="font-body-bold" style={{ color: colors.brand.text.heading, textAlign: isRTL ? 'right' : 'left' }}>
                                            {title}
                                        </Text>
                                        <Text variant="caption" style={[styles.description, { color: colors.brand.text.subtitle, textAlign: isRTL ? 'right' : 'left' }]}>
                                            {description}
                                        </Text>
                                    </View>
                                </View>
                            ))}
                        </View>

                        <Pressable
                            accessibilityRole="button"
                            onPress={() => setOpen(false)}
                            style={[styles.closeButton, { backgroundColor: colors.chrome.common.textStrong }]}
                        >
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
    badge: {
        flexShrink: 0,
        alignItems: 'center',
        justifyContent: 'center',
    },
    backdrop: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        alignItems: 'center',
        justifyContent: 'center',
        padding: scale(18),
    },
    card: {
        width: '100%',
        maxWidth: scale(420),
        borderRadius: scale(16),
        borderWidth: StyleSheet.hairlineWidth,
        padding: scale(18),
    },
    checks: {
        marginTop: scale(16),
        gap: scale(10),
    },
    checkRow: {
        minHeight: scale(76),
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: scale(12),
        borderRadius: scale(10),
        borderWidth: StyleSheet.hairlineWidth,
        padding: scale(12),
    },
    checkIcon: {
        width: scale(40),
        height: scale(40),
        borderRadius: scale(8),
        alignItems: 'center',
        justifyContent: 'center',
    },
    checkMark: {
        position: 'absolute',
        right: scale(-2),
        bottom: scale(-2),
    },
    checkCopy: {
        flex: 1,
        minWidth: 0,
    },
    description: {
        marginTop: scale(3),
        lineHeight: scale(18),
    },
    closeButton: {
        marginTop: scale(16),
        minHeight: scale(44),
        borderRadius: scale(22),
        alignItems: 'center',
        justifyContent: 'center',
    },
});
