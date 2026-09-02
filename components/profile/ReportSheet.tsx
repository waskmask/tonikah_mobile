import React, { useCallback, useEffect, useState } from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';
import BottomSheet, {
    BottomSheetBackdrop,
    BottomSheetBackdropProps,
    BottomSheetTextInput,
    BottomSheetView,
} from '@gorhom/bottom-sheet';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { X } from 'lucide-react-native';
import { Text } from '@/components/ui/Text';
import { GradientButton } from '@/components/ui/GradientButton';
import { useColors } from '@/hooks/useColors';
import { useLanguage } from '@/hooks/useLanguage';
import { useHaptics } from '@/hooks/useHaptics';
import { toast } from '@/hooks/useToast';
import { scale } from '@/hooks/useResponsive';
import { Typography } from '@/constants/typography';
import { apiMessage, t } from '@/lib/profileDisplay';
import { reportsService, ReportEntityType } from '@/lib/reportsService';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const REASONS = ['spam', 'inappropriate', 'scam', 'harassment', 'other'] as const;
type Reason = (typeof REASONS)[number];

export type ReportTarget = {
    type: ReportEntityType;
    userId: string;
    imageUrl?: string;
    imageId?: string;
};

type Props = {
    target: ReportTarget | null;
    onClose: () => void;
};

/** Native port of the Next.js ReportModal: reason pills + optional description,
    posted to /reports as User or Image report. */
export function ReportSheet({ target, onClose }: Props) {
    const palette = useColors();
    const { currentLanguage, isRTL } = useLanguage();
    const insets = useSafeAreaInsets();
    const { lightImpact } = useHaptics();
    const [reason, setReason] = useState<Reason | null>(null);
    const [description, setDescription] = useState('');
    const [submitting, setSubmitting] = useState(false);

    const inputFontFamily = currentLanguage === 'ar' ? Typography.font.arabic.regular : Typography.font.body.regular;

    useEffect(() => {
        if (target) {
            setReason(null);
            setDescription('');
            setSubmitting(false);
        }
    }, [target]);

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

    if (!target) return null;

    const title = target.type === 'Image'
        ? t('report_title_image', 'Report photo')
        : t('report_title_profile', 'Report profile');

    const reasonLabels: Record<Reason, string> = {
        spam: t('report_reason_spam', 'Spam'),
        inappropriate: t('report_reason_inappropriate', 'Inappropriate content'),
        scam: t('report_reason_scam', 'Scam or fraud'),
        harassment: t('report_reason_harassment', 'Harassment'),
        other: t('report_reason_other', 'Other'),
    };

    const submit = async () => {
        if (!reason) {
            toast.show(t('report_missing_fields', 'Please select a reason.'), 'error');
            return;
        }
        setSubmitting(true);
        const res = await reportsService.create({
            entityType: target.type,
            entityId: target.type === 'Image' ? target.imageId || target.userId : target.userId,
            reason,
            description,
            imageUrl: target.imageUrl,
        });
        setSubmitting(false);
        if (res.success) {
            toast.show(t('report_success', 'Report submitted. Thank you.'), 'success');
            onClose();
        } else {
            toast.show(apiMessage(res.message || 'report_missing_fields'), 'error');
        }
    };

    const sheetHeight = scale(430) + insets.bottom;

    return (
        <Modal
            visible
            transparent
            animationType="none"
            statusBarTranslucent
            navigationBarTranslucent
            hardwareAccelerated
            onRequestClose={submitting ? undefined : onClose}
        >
            <GestureHandlerRootView style={{ flex: 1 }}>
                <BottomSheet
                    snapPoints={[sheetHeight]}
                    index={0}
                    enablePanDownToClose={!submitting}
                    enableDynamicSizing={false}
                    onClose={onClose}
                    backdropComponent={renderBackdrop}
                    backgroundStyle={{ backgroundColor: palette.chrome.common.card }}
                    handleIndicatorStyle={{ backgroundColor: palette.brand.text.muted }}
                    keyboardBehavior="extend"
                    keyboardBlurBehavior="restore"
                    android_keyboardInputMode="adjustResize"
                >
                    <BottomSheetView style={{ flex: 1 }}>
                        <View style={styles.header}>
                            <Text variant="body-sm" className="font-body-bold" style={styles.sheetTitle}>
                                {title}
                            </Text>
                            <Pressable onPress={onClose} hitSlop={12} disabled={submitting}>
                                <X size={scale(20)} color={palette.brand.text.subtitle} />
                            </Pressable>
                        </View>

                        <Text variant="caption" className="font-body-semi" style={[styles.label, { color: palette.brand.text.subtitle, textAlign: isRTL ? 'right' : 'left' }]}>
                            {t('report_reason', 'Reason')}
                        </Text>
                        <View style={[styles.reasons, { flexDirection: 'row' }]}>
                            {REASONS.map((value) => {
                                const active = reason === value;
                                return (
                                    <Pressable
                                        key={value}
                                        onPress={() => {
                                            lightImpact();
                                            setReason(value);
                                        }}
                                        style={[
                                            styles.reasonChip,
                                            {
                                                borderColor: active ? palette.chrome.primary : palette.brand.bg.border,
                                                backgroundColor: active ? palette.chrome.common.primaryTint : 'transparent',
                                            },
                                        ]}
                                    >
                                        <Text
                                            variant="caption"
                                            className="font-body-semi"
                                            style={{ color: active ? palette.chrome.primary : palette.brand.text.body }}
                                        >
                                            {reasonLabels[value]}
                                        </Text>
                                    </Pressable>
                                );
                            })}
                        </View>

                        <Text variant="caption" className="font-body-semi" style={[styles.label, { color: palette.brand.text.subtitle, textAlign: isRTL ? 'right' : 'left' }]}>
                            {t('report_description', 'Details (optional)')}
                        </Text>
                        <BottomSheetTextInput
                            value={description}
                            onChangeText={(value) => setDescription(value.slice(0, 500))}
                            placeholder={t('report_description_ph', 'Add any details that help us review this report.')}
                            placeholderTextColor={palette.brand.text.muted}
                            multiline
                            textAlignVertical="top"
                            style={[
                                styles.description,
                                {
                                    borderColor: palette.brand.bg.border,
                                    color: palette.brand.text.body,
                                    fontFamily: inputFontFamily,
                                    textAlign: isRTL ? 'right' : 'left',
                                },
                            ]}
                        />

                        <View style={[styles.footer, { paddingBottom: insets.bottom + scale(12) }]}>
                            <GradientButton
                                title={submitting ? t('report_submitting', 'Submitting...') : t('report_submit', 'Submit report')}
                                onPress={() => void submit()}
                                loading={submitting}
                                disabled={submitting || !reason}
                                widthMode="full"
                                height={40}
                                textSize={14}
                            />
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
    label: {
        paddingHorizontal: scale(20),
        marginTop: scale(6),
        letterSpacing: 0.6,
        textTransform: 'uppercase',
    },
    reasons: {
        flexWrap: 'wrap',
        gap: scale(8),
        paddingHorizontal: scale(20),
        marginTop: scale(8),
        marginBottom: scale(4),
    },
    reasonChip: {
        borderWidth: 1,
        borderRadius: 9999,
        paddingHorizontal: scale(12),
        paddingVertical: scale(7),
    },
    description: {
        marginTop: scale(8),
        marginHorizontal: scale(20),
        minHeight: scale(88),
        borderWidth: 1,
        borderRadius: scale(12),
        paddingHorizontal: scale(12),
        paddingVertical: scale(10),
        fontSize: scale(14),
    },
    footer: {
        flex: 1,
        justifyContent: 'flex-end',
        paddingHorizontal: scale(20),
        paddingTop: scale(12),
    },
});
