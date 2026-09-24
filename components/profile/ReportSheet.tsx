import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Keyboard as RNKeyboard, Modal, Pressable, StyleSheet, View } from 'react-native';
import BottomSheet, {
    BottomSheetBackdrop,
    BottomSheetBackdropProps,
    BottomSheetFooter,
    BottomSheetFooterProps,
    BottomSheetScrollView,
    BottomSheetScrollViewMethods,
    BottomSheetTextInput,
} from '@gorhom/bottom-sheet';
import { Check, ChevronLeft, ChevronRight, Keyboard as KeyboardIcon, X } from 'lucide-react-native';
import { Image } from 'expo-image';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { useKeyboardState } from 'react-native-keyboard-controller';
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
import {
    REPORT_DETAIL_DESCRIPTION_FALLBACKS,
    REPORT_DETAIL_FALLBACKS,
    REPORT_REASON_DESCRIPTION_FALLBACKS,
    REPORT_REASON_FALLBACKS,
    ReportReason,
    ReportReasonDetail,
    reportDetails,
    reportReasons,
} from '@/lib/reportTaxonomy';
import { usersService } from '@/lib/usersService';

export type ReportTarget = {
    type: ReportEntityType;
    userId: string;
    imageUrl?: string;
    imageId?: string;
};

type Props = {
    target: ReportTarget | null;
    onClose: () => void;
    onOpened?: () => void;
    onBlocked?: (userId: string) => void;
    embedded?: boolean;
};

const DESCRIPTION_MAX = 500;
const OTHER_MIN_NON_SPACE = 30;

export function ReportSheet({ target, onClose, onOpened, onBlocked, embedded = false }: Props) {
    const palette = useColors();
    const { currentLanguage, isRTL } = useLanguage();
    const insets = useSafeAreaInsets();
    const keyboardVisible = useKeyboardState((state) => state.isVisible);
    const { lightImpact } = useHaptics();
    const scrollRef = useRef<BottomSheetScrollViewMethods>(null);
    const primaryActionRef = useRef<() => void>(() => undefined);
    const didNotifyOpenRef = useRef(false);
    const [step, setStep] = useState<'reason' | 'detail'>('reason');
    const [reason, setReason] = useState<ReportReason | null>(null);
    const [reasonDetail, setReasonDetail] = useState<ReportReasonDetail | null>(null);
    const [description, setDescription] = useState('');
    const [blockAfterReport, setBlockAfterReport] = useState(false);
    const [submitting, setSubmitting] = useState(false);

    const inputFontFamily = currentLanguage === 'ar' ? Typography.font.arabic.regular : Typography.font.body.regular;
    const targetKey = target
        ? `${target.type}:${target.userId}:${target.imageId || ''}:${target.imageUrl || ''}`
        : null;
    const reasons = useMemo(() => target ? reportReasons(target.type) : [], [target]);
    const details = useMemo(() => target ? reportDetails(target.type, reason) : [], [reason, target]);
    const nonSpaceLength = description.replace(/\s/g, '').length;
    const otherValid = reason !== 'other' || nonSpaceLength >= OTHER_MIN_NON_SPACE;
    const canSubmit = Boolean(reason && (reason === 'other' || reasonDetail) && otherValid);

    useEffect(() => {
        if (!target) return;
        didNotifyOpenRef.current = false;
        setStep('reason');
        setReason(null);
        setReasonDetail(null);
        setDescription('');
        setBlockAfterReport(false);
        setSubmitting(false);
    }, [targetKey]);

    const handleSheetChange = useCallback((index: number) => {
        if (index < 0 || didNotifyOpenRef.current) return;
        didNotifyOpenRef.current = true;
        onOpened?.();
    }, [onOpened]);

    useEffect(() => {
        if (!keyboardVisible || step !== 'detail') return;
        const timer = setTimeout(() => {
            scrollRef.current?.scrollToEnd({ animated: true });
        }, 300);
        return () => clearTimeout(timer);
    }, [keyboardVisible, step]);

    const snapPoints = useMemo(() => ['100%'], []);
    const renderBackdrop = useCallback(
        (props: BottomSheetBackdropProps) => (
            <BottomSheetBackdrop
                {...props}
                appearsOnIndex={0}
                disappearsOnIndex={-1}
                opacity={0.5}
                pressBehavior={submitting ? 'none' : 'close'}
            />
        ),
        [submitting],
    );

    const entityTitle = target?.type === 'Image'
        ? t('report_title_image', 'Report reason')
        : t('report_title_profile', 'Report profile');
    const selectedReasonLabel = reason ? t(`report_reason_v2_${reason}`, REPORT_REASON_FALLBACKS[reason]) : '';

    const selectReason = (value: ReportReason) => {
        lightImpact();
        setReason(value);
        setReasonDetail(null);
        setDescription('');
    };

    const selectDetail = (value: ReportReasonDetail) => {
        lightImpact();
        setReasonDetail(value);
    };

    const handlePrimaryAction = () => {
        if (step === 'reason') {
            if (!reason) return;
            setStep('detail');
            return;
        }
        void submit();
    };

    const submit = async () => {
        if (!target || !canSubmit || !reason || submitting) return;
        setSubmitting(true);
        const res = await reportsService.create({
            entityType: target.type,
            entityId: target.type === 'Image' ? target.imageId || target.userId : target.userId,
            reportedUserId: target.type === 'Image' ? target.userId : undefined,
            reason,
            reasonDetail: reason === 'other' ? undefined : reasonDetail || undefined,
            reportVersion: 2,
            description: description.trim(),
            imageUrl: target.imageUrl,
        });

        if (!res.success) {
            setSubmitting(false);
            toast.show(apiMessage(res.message || 'report_missing_fields'), 'error');
            return;
        }

        if (blockAfterReport) {
            const blockRes = await usersService.block(target.userId);
            setSubmitting(false);
            if (blockRes.success) {
                const successMessage = t('report_success_blocked', 'Your report was submitted and the user was blocked.');
                onClose();
                onBlocked?.(target.userId);
                setTimeout(() => toast.show(successMessage, 'success'), 120);
                return;
            }
            toast.show(t('report_success_block_failed', 'Report submitted, but we could not block this user.'), 'warning');
            onClose();
            return;
        }

        setSubmitting(false);
        toast.show(t('report_success_message', 'Thank you. Our safety team will review your report.'), 'success');
        onClose();
    };

    primaryActionRef.current = handlePrimaryAction;
    const renderFooter = useCallback(
        (props: BottomSheetFooterProps) => (
            <BottomSheetFooter
                {...props}
                bottomInset={Math.max(0, insets.bottom - scale(12))}
                style={{ backgroundColor: palette.brand.bg.surface }}
            >
                <View style={[styles.footer, { backgroundColor: palette.brand.bg.surface }]}>
                    <View style={styles.footerRow}>
                        {keyboardVisible ? (
                            <Pressable
                                onPress={RNKeyboard.dismiss}
                                style={[styles.keyboardDismissButton, { borderColor: palette.brand.bg.border }]}
                                accessibilityRole="button"
                                accessibilityLabel={t('close_keyboard', 'Close keyboard')}
                            >
                                <KeyboardIcon size={scale(20)} color={palette.brand.text.subtitle} />
                                <ChevronRight
                                    size={scale(12)}
                                    color={palette.brand.text.subtitle}
                                    style={styles.keyboardDismissChevron}
                                />
                            </Pressable>
                        ) : null}
                        <View style={styles.footerPrimaryAction}>
                            <GradientButton
                                title={step === 'reason' ? t('continue', 'Continue') : submitting ? t('report_submitting', 'Submitting report...') : t('report_submit', 'Submit report')}
                                onPress={() => primaryActionRef.current()}
                                loading={submitting}
                                disabled={submitting || (step === 'reason' ? !reason : !canSubmit)}
                                widthMode="full"
                                height={44}
                                textSize={15}
                                containerStyle={styles.drawerSaveButton}
                            />
                        </View>
                    </View>
                </View>
            </BottomSheetFooter>
        ),
        [canSubmit, insets.bottom, keyboardVisible, palette.brand.bg.border, palette.brand.bg.surface, palette.brand.text.subtitle, reason, step, submitting],
    );

    if (!target) return null;

    const sheet = (
        <BottomSheet
            index={0}
            snapPoints={snapPoints}
            topInset={insets.top}
            enableDynamicSizing={false}
            enablePanDownToClose={!submitting}
            enableOverDrag={false}
            animateOnMount
            onChange={handleSheetChange}
            onClose={onClose}
            backdropComponent={renderBackdrop}
            footerComponent={renderFooter}
            backgroundStyle={{ backgroundColor: palette.brand.bg.surface }}
            handleIndicatorStyle={{ backgroundColor: palette.brand.text.muted }}
            keyboardBehavior="interactive"
            keyboardBlurBehavior="restore"
            android_keyboardInputMode="adjustResize"
        >
            <SafeAreaView edges={[]} style={styles.container}>
                <View style={[styles.header, { borderBottomColor: palette.brand.bg.border }]}>
                    <View style={styles.headerSide}>
                        {step === 'detail' ? (
                            <Pressable onPress={() => setStep('reason')} hitSlop={12} disabled={submitting} accessibilityRole="button" accessibilityLabel={t('back', 'Back')}>
                                {isRTL
                                    ? <ChevronRight size={scale(22)} color={palette.chrome.common.textStrong} />
                                    : <ChevronLeft size={scale(22)} color={palette.chrome.common.textStrong} />}
                            </Pressable>
                        ) : null}
                    </View>
                    <Text variant="body" className="font-body-bold" align="center" style={styles.sheetTitle}>{entityTitle}</Text>
                    <View style={[styles.headerSide, styles.headerSideEnd]}>
                        <Pressable onPress={onClose} hitSlop={12} disabled={submitting} accessibilityRole="button" accessibilityLabel={t('close', 'Close')}>
                            <X size={scale(21)} color={palette.brand.text.subtitle} />
                        </Pressable>
                    </View>
                </View>

                <BottomSheetScrollView
                    ref={scrollRef}
                    style={styles.scroll}
                    contentContainerStyle={styles.scrollContent}
                    keyboardShouldPersistTaps="always"
                    keyboardDismissMode="on-drag"
                >
                    <View style={styles.scrollBody}>
                    {step === 'reason' && target.type === 'Image' && target.imageUrl ? (
                        <View style={styles.previewRow}>
                            <Image source={{ uri: target.imageUrl }} style={styles.previewImage} contentFit="cover" cachePolicy="memory-disk" />
                            <View style={styles.previewText}>
                                <Text variant="body-sm" className="font-body-semi">{t('report_photo_preview', 'Reporting this image')}</Text>
                                <Text variant="caption" style={{ color: palette.brand.text.subtitle }}>{t('report_photo_preview_hint', 'Only this photo will be attached to the report.')}</Text>
                            </View>
                        </View>
                    ) : null}

                    {step === 'reason' ? (
                        <>
                            {target.type !== 'Image' ? (
                                <Text variant="h3" className="font-heading" style={styles.stepTitle}>
                                    {t('report_profile_reason_prompt', 'Why are you reporting this profile?')}
                                </Text>
                            ) : null}
                            <View style={styles.optionList}>
                                {reasons.map((value) => (
                                    <ReportOptionRow
                                        key={value}
                                        active={reason === value}
                                        title={t(`report_reason_v2_${value}`, REPORT_REASON_FALLBACKS[value])}
                                        onPress={() => selectReason(value)}
                                    />
                                ))}
                            </View>
                        </>
                    ) : (
                        <>
                            <Text variant="h3" className="font-heading" style={styles.stepTitle}>{selectedReasonLabel}</Text>
                            {reason === 'other' ? (
                                <Text variant="body-sm" style={[styles.stepHelper, { color: palette.brand.text.subtitle }]}>{t('report_other_prompt', 'Tell us what happened so our safety team can review it.')}</Text>
                            ) : (
                                <>
                                    <Text variant="body-sm" style={[styles.stepHelper, { color: palette.brand.text.subtitle }]}>
                                        {reason ? t(`report_reason_desc_${reason}`, REPORT_REASON_DESCRIPTION_FALLBACKS[reason]) : ''}
                                    </Text>
                                    <View style={styles.optionList}>
                                        {details.map((value) => (
                                            <ReportOptionRow
                                                key={value}
                                                active={reasonDetail === value}
                                                title={t(`report_detail_${value}`, REPORT_DETAIL_FALLBACKS[value])}
                                                description={t(`report_detail_desc_${value}`, REPORT_DETAIL_DESCRIPTION_FALLBACKS[value])}
                                                onPress={() => selectDetail(value)}
                                            />
                                        ))}
                                    </View>
                                </>
                            )}

                            <Text variant="body-sm" className="font-body-semi" style={styles.editorLabel}>
                                {reason === 'other' ? t('report_description_required', 'Details') : t('report_description', 'Additional details (optional)')}
                            </Text>
                            <BottomSheetTextInput
                                value={description}
                                onChangeText={(value) => setDescription(value.slice(0, DESCRIPTION_MAX))}
                                placeholder={t('report_description_ph', 'Add any details that help us review this report.')}
                                placeholderTextColor={palette.brand.text.muted}
                                multiline
                                onFocus={() => {
                                    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 300);
                                }}
                                textAlignVertical="top"
                                style={[styles.description, { color: palette.brand.text.body, borderBottomColor: palette.chrome.primary, fontFamily: inputFontFamily, textAlign: isRTL ? 'right' : 'left' }]}
                            />
                            <View style={styles.countRow}>
                                {reason === 'other' ? (
                                    <Text variant="caption" style={{ color: otherValid ? palette.brand.text.muted : palette.brand.accent.error }}>{t('report_other_minimum', 'Minimum 30 non-space characters')}</Text>
                                ) : <View />}
                                <Text variant="caption" style={{ color: palette.brand.text.muted }}>{description.length}/{DESCRIPTION_MAX}</Text>
                            </View>

                            <Pressable
                                onPress={() => { lightImpact(); setBlockAfterReport((current) => !current); }}
                                style={styles.blockRow}
                                accessibilityRole="checkbox"
                                accessibilityState={{ checked: blockAfterReport }}
                            >
                                <View style={[styles.checkbox, { borderColor: blockAfterReport ? palette.chrome.primary : palette.brand.bg.border }, blockAfterReport && { backgroundColor: palette.chrome.primary }]}>
                                    {blockAfterReport ? <Check size={scale(13)} color={palette.chrome.common.inverseText} strokeWidth={3} /> : null}
                                </View>
                                <View style={styles.blockText}>
                                    <Text variant="body-sm" className="font-body-semi">{t('report_block_after', 'Block this user after reporting')}</Text>
                                    <Text variant="caption" style={{ color: palette.brand.text.subtitle }}>{t('report_block_after_hint', 'They will no longer be able to contact or view you.')}</Text>
                                </View>
                            </Pressable>
                        </>
                    )}
                    </View>
                </BottomSheetScrollView>

            </SafeAreaView>
        </BottomSheet>
    );

    if (embedded) {
        return <View style={styles.embeddedHost}>{sheet}</View>;
    }

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
            <GestureHandlerRootView style={styles.container}>{sheet}</GestureHandlerRootView>
        </Modal>
    );
}

function ReportOptionRow({ active, title, description, onPress }: { active: boolean; title: string; description?: string; onPress: () => void }) {
    const palette = useColors();
    return (
        <Pressable onPress={onPress} style={[styles.optionRow, { borderBottomColor: palette.brand.bg.border }]} accessibilityRole="radio" accessibilityState={{ selected: active }}>
            <View style={styles.optionText}>
                <Text variant="body-sm" className="font-body-semi" style={{ color: palette.chrome.common.textStrong }}>{title}</Text>
                {description ? <Text variant="caption" style={[styles.optionDescription, { color: palette.brand.text.subtitle }]}>{description}</Text> : null}
            </View>
            <View style={[styles.radio, { borderColor: active ? palette.chrome.primary : palette.brand.text.muted }]}>
                {active ? <View style={[styles.radioDot, { backgroundColor: palette.chrome.primary }]} /> : null}
            </View>
        </Pressable>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    embeddedHost: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, zIndex: 100 },
    header: { height: scale(56), borderBottomWidth: StyleSheet.hairlineWidth, flexDirection: 'row', alignItems: 'center', paddingHorizontal: scale(20) },
    headerSide: { width: scale(36), alignItems: 'flex-start', justifyContent: 'center' },
    headerSideEnd: { alignItems: 'flex-end' },
    sheetTitle: { flex: 1, fontSize: scale(16), lineHeight: scale(21) },
    scroll: { flex: 1 },
    scrollContent: { flexGrow: 1, paddingBottom: scale(96) },
    scrollBody: { flexGrow: 1, paddingHorizontal: scale(20), paddingTop: scale(12) },
    previewRow: { flexDirection: 'row', alignItems: 'center', gap: scale(12), marginBottom: scale(18) },
    previewImage: { width: scale(54), height: scale(72), borderRadius: scale(6) },
    previewText: { flex: 1, gap: scale(3) },
    stepTitle: { fontSize: scale(18), lineHeight: scale(24), marginBottom: scale(5) },
    stepHelper: { lineHeight: scale(20), marginBottom: scale(10) },
    optionList: { width: '100%' },
    optionRow: { minHeight: scale(64), borderBottomWidth: StyleSheet.hairlineWidth, flexDirection: 'row', alignItems: 'center', gap: scale(14), paddingVertical: scale(12) },
    optionText: { flex: 1, minWidth: 0 },
    optionDescription: { lineHeight: scale(18), marginTop: scale(3) },
    radio: { width: scale(22), height: scale(22), borderRadius: scale(11), borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
    radioDot: { width: scale(12), height: scale(12), borderRadius: scale(6) },
    editorLabel: { marginTop: scale(20), marginBottom: scale(6) },
    description: { minHeight: scale(92), borderBottomWidth: 1, paddingHorizontal: scale(6), paddingVertical: scale(8), fontSize: scale(14), lineHeight: scale(21) },
    countRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: scale(6) },
    blockRow: { flexDirection: 'row', alignItems: 'flex-start', gap: scale(12), paddingVertical: scale(18) },
    checkbox: { width: scale(22), height: scale(22), borderRadius: scale(4), borderWidth: 1.5, alignItems: 'center', justifyContent: 'center', marginTop: scale(1) },
    blockText: { flex: 1, gap: scale(3) },
    footer: { paddingHorizontal: scale(26), paddingTop: scale(12), paddingBottom: scale(12) },
    footerRow: { flexDirection: 'row', alignItems: 'center', gap: scale(10) },
    footerPrimaryAction: { flex: 1, minWidth: 0 },
    keyboardDismissButton: { width: scale(44), height: scale(44), borderRadius: scale(22), borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
    keyboardDismissChevron: { position: 'absolute', right: scale(4), bottom: scale(3), transform: [{ rotate: '90deg' }] },
    drawerSaveButton: { height: scale(44) },
});
