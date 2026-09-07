import React from 'react';
import { ActivityIndicator, Modal, Pressable, StyleSheet, View } from 'react-native';
import { AlertCircle, X } from 'lucide-react-native';
import { Text } from '@/components/ui/Text';
import { GradientButton } from '@/components/ui/GradientButton';
import { useColors } from '@/hooks/useColors';
import { useLanguage } from '@/hooks/useLanguage';
import { scale } from '@/hooks/useResponsive';
import { t } from '@/lib/profileDisplay';
import {
    moderationIssueTranslationKeys,
    moderationTitleKeys,
    TextModerationWarning,
} from '@/lib/textModeration';

type Props = {
    warning: TextModerationWarning | null;
    submitting: boolean;
    onEdit: () => void;
    onClose?: () => void;
    onSubmitAnyway: () => void;
};

/** Native port of the Next.js TextModerationWarningModal: field-specific
    title, detected-issue pills, and short Edit / Submit actions where Submit
    resends the same payload with submitAnyway. */
export function TextModerationWarningModal({ warning, submitting, onEdit, onClose, onSubmitAnyway }: Props) {
    const palette = useColors();
    const { isRTL } = useLanguage();

    if (!warning) return null;

    const issueKeys = moderationIssueTranslationKeys(warning);
    const dismiss = onClose ?? onEdit;

    return (
        <Modal
            visible
            transparent
            animationType="fade"
            statusBarTranslucent
            navigationBarTranslucent
            hardwareAccelerated
            onRequestClose={submitting ? undefined : dismiss}
        >
            <View style={styles.overlay}>
                <View style={[styles.card, { backgroundColor: palette.chrome.common.card, borderColor: palette.brand.bg.border }]}>
                    <View style={[styles.headerRow, { flexDirection: 'row' }]}>
                        <View style={[styles.titleGroup, { flexDirection: 'row' }]}>
                            <View style={[styles.warnIcon, { backgroundColor: palette.chrome.common.dangerTint }]}>
                                <AlertCircle size={scale(17)} color={palette.brand.accent.error} />
                            </View>
                            <View style={styles.headerText}>
                                <Text
                                    variant="body"
                                    className="font-body-bold"
                                    style={{ fontSize: scale(16), textAlign: isRTL ? 'right' : 'left' }}
                                >
                                    {t(moderationTitleKeys[warning.field], 'This text needs review')}
                                </Text>
                                <Text
                                    variant="body-sm"
                                    style={{
                                        marginTop: scale(6),
                                        color: palette.brand.text.subtitle,
                                        lineHeight: scale(19),
                                        textAlign: isRTL ? 'right' : 'left',
                                    }}
                                >
                                    {t('moderation_text_warning_body', 'We found something that may need a human review before it appears on your profile.')}
                                </Text>
                            </View>
                        </View>
                        <Pressable
                            onPress={dismiss}
                            disabled={submitting}
                            accessibilityRole="button"
                            accessibilityLabel={t('close', 'Close')}
                            hitSlop={10}
                            style={styles.closeButton}
                        >
                            <X size={scale(17)} color={palette.brand.text.subtitle} />
                        </Pressable>
                    </View>

                    <View
                        style={[
                            styles.issuesBox,
                            {
                                borderColor: palette.chrome.common.dangerRing,
                                backgroundColor: palette.chrome.common.dangerTint,
                            },
                        ]}
                    >
                        <Text
                            variant="caption"
                            className="font-body-bold"
                            style={{
                                color: palette.brand.accent.error,
                                letterSpacing: 1.1,
                                textTransform: 'uppercase',
                                textAlign: isRTL ? 'right' : 'left',
                            }}
                        >
                            {t('moderation_text_detected', 'Detected')}
                        </Text>
                        <View style={[styles.pillsRow, { flexDirection: 'row' }]}>
                            {issueKeys.map((key) => (
                                <View
                                    key={key}
                                    style={[
                                        styles.pill,
                                        {
                                            borderColor: palette.chrome.common.dangerRing,
                                            backgroundColor: palette.chrome.common.card,
                                        },
                                    ]}
                                >
                                    <Text variant="caption" className="font-body-semi" style={{ fontSize: scale(11.5) }}>
                                        {t(key, key)}
                                    </Text>
                                </View>
                            ))}
                        </View>
                    </View>

                    <View style={[styles.buttons, { flexDirection: 'row' }]}>
                        <Pressable
                            onPress={onEdit}
                            disabled={submitting}
                            accessibilityRole="button"
                            style={[styles.editButton, { borderColor: palette.brand.bg.border, opacity: submitting ? 0.6 : 1 }]}
                        >
                            <Text variant="body-sm" className="font-body-semi" style={{ fontSize: scale(14) }} numberOfLines={1}>
                                {t('edit', 'Edit')}
                            </Text>
                        </Pressable>
                        <View style={styles.submitWrap}>
                            <GradientButton
                                title={t('submit', 'Submit')}
                                onPress={onSubmitAnyway}
                                loading={submitting}
                                disabled={submitting}
                                widthMode="full"
                                height={40}
                                textSize={14}
                            />
                        </View>
                    </View>
                </View>
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(14, 12, 9, 0.55)',
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: scale(18),
    },
    card: {
        width: '100%',
        maxWidth: scale(440),
        borderWidth: 1,
        borderRadius: scale(14),
        padding: scale(18),
    },
    headerRow: {
        alignItems: 'flex-start',
        gap: scale(8),
    },
    titleGroup: {
        flex: 1,
        minWidth: 0,
        alignItems: 'flex-start',
        gap: scale(6),
    },
    warnIcon: {
        width: scale(32),
        height: scale(32),
        borderRadius: scale(16),
        alignItems: 'center',
        justifyContent: 'center',
    },
    headerText: {
        flex: 1,
        minWidth: 0,
    },
    closeButton: {
        width: scale(28),
        height: scale(28),
        borderRadius: scale(14),
        alignItems: 'center',
        justifyContent: 'center',
    },
    issuesBox: {
        marginTop: scale(14),
        borderWidth: 1,
        borderRadius: scale(10),
        padding: scale(11),
        gap: scale(8),
    },
    pillsRow: {
        flexWrap: 'wrap',
        gap: scale(7),
    },
    pill: {
        borderWidth: 1,
        borderRadius: 9999,
        paddingHorizontal: scale(11),
        paddingVertical: scale(5),
    },
    buttons: {
        marginTop: scale(16),
        alignItems: 'center',
        gap: scale(10),
    },
    editButton: {
        flex: 1,
        height: scale(40),
        borderWidth: 1,
        borderRadius: 9999,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: scale(12),
    },
    submitWrap: {
        flex: 1.35,
    },
});
