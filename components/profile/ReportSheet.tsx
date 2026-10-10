import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Keyboard as RNKeyboard, Modal, Platform, Pressable, StyleSheet, View } from 'react-native';
import BottomSheet, {
    BottomSheetBackdrop,
    BottomSheetBackdropProps,
    BottomSheetFooter,
    BottomSheetFooterProps,
    BottomSheetScrollView,
    BottomSheetScrollViewMethods,
    BottomSheetTextInput,
} from '@gorhom/bottom-sheet';
import { ImagePlus, X } from '@/components/ui/icons/PhosphorCompat';
import { CaretLeft, CaretRight, Check } from 'phosphor-react-native';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { SafeAreaProvider, SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { Text } from '@/components/ui/Text';
import { GradientButton } from '@/components/ui/GradientButton';
import { useColors } from '@/hooks/useColors';
import { useLanguage } from '@/hooks/useLanguage';
import { useHaptics } from '@/hooks/useHaptics';
import { toast, ToastProvider } from '@/hooks/useToast';
import { scale } from '@/hooks/useResponsive';
import { Typography } from '@/constants/typography';
import { apiMessage, t } from '@/lib/profileDisplay';
import { reportsService, ReportEntityType, ReportScreenshot } from '@/lib/reportsService';
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
import { reportEditorVisibility } from '@/lib/reportEditorVisibility';

export type ReportTarget = {
    type: ReportEntityType;
    userId: string;
    imageUrl?: string;
    imageId?: string;
    messageId?: string;
    messageType?: 'text' | 'image' | 'voice' | 'system';
    messagePreview?: string;
    messageMediaUrl?: string;
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
const MAX_SCREENSHOTS = 3;
const MAX_SCREENSHOT_BYTES = 5 * 1024 * 1024;
const SCREENSHOT_MIME_TYPES = new Set<ReportScreenshot['type']>(['image/jpeg', 'image/png', 'image/webp']);

export function ReportSheet(props: Props) {
    const requestClose = useRef<() => void>(() => undefined);
    if (!props.target) return null;

    const content = <ReportSheetContent {...props} requestClose={requestClose} />;
    if (props.embedded) return content;

    return (
        <Modal visible transparent animationType="none" statusBarTranslucent navigationBarTranslucent
            hardwareAccelerated onRequestClose={() => requestClose.current()}>
            <SafeAreaProvider>
                <GestureHandlerRootView style={styles.container}>{content}</GestureHandlerRootView>
            </SafeAreaProvider>
        </Modal>
    );
}

function ReportSheetContent({ target, onClose, onOpened, onBlocked, embedded = false, requestClose }: Props & {
    requestClose: React.MutableRefObject<() => void>;
}) {
    const palette = useColors();
    const { currentLanguage, isRTL } = useLanguage();
    const insets = useSafeAreaInsets();
    const { lightImpact } = useHaptics();
    const scrollRef = useRef<BottomSheetScrollViewMethods>(null);
    const editorRef = useRef<View>(null);
    const viewportRef = useRef<View>(null);
    const footerRef = useRef<View>(null);
    const editorFocusedRef = useRef(false);
    const scrollOffsetRef = useRef(0);
    const keyboardTopRef = useRef<number | undefined>(undefined);
    const revealFrameRef = useRef<number | null>(null);
    const revealVersionRef = useRef(0);
    const [bottomOverlap, setBottomOverlap] = useState(0);
    const primaryActionRef = useRef<() => void>(() => undefined);
    const didNotifyOpenRef = useRef(false);
    const [step, setStep] = useState<'reason' | 'detail'>('reason');
    const [reason, setReason] = useState<ReportReason | null>(null);
    const [reasonDetail, setReasonDetail] = useState<ReportReasonDetail | null>(null);
    const [description, setDescription] = useState('');
    const [blockAfterReport, setBlockAfterReport] = useState(false);
    const [screenshots, setScreenshots] = useState<ReportScreenshot[]>([]);
    const [submitting, setSubmitting] = useState(false);

    const inputFontFamily = currentLanguage === 'ar' ? Typography.font.arabic.regular : Typography.font.body.regular;
    const targetKey = target
        ? `${target.type}:${target.userId}:${target.imageId || ''}:${target.messageId || ''}:${target.imageUrl || ''}`
        : null;
    const reasons = useMemo(() => target ? reportReasons(target.type) : [], [target]);
    const details = useMemo(() => target ? reportDetails(target.type, reason) : [], [reason, target]);
    const nonSpaceLength = description.replace(/\s/g, '').length;
    const otherValid = reason !== 'other' || nonSpaceLength >= OTHER_MIN_NON_SPACE;
    const canSubmit = Boolean(reason && (reason === 'other' || reasonDetail) && otherValid);

    useEffect(() => {
        if (!target) return;
        didNotifyOpenRef.current = false;
        editorFocusedRef.current = false;
        scrollOffsetRef.current = 0;
        setBottomOverlap(0);
        setStep('reason');
        setReason(null);
        setReasonDetail(null);
        setDescription('');
        setBlockAfterReport(false);
        setScreenshots([]);
        setSubmitting(false);
    }, [targetKey]);

    const handleSheetChange = useCallback((index: number) => {
        if (index < 0 || didNotifyOpenRef.current) return;
        didNotifyOpenRef.current = true;
        onOpened?.();
    }, [onOpened]);

    const revealEditor = useCallback(() => {
        if (!editorFocusedRef.current) return;
        const version = ++revealVersionRef.current;
        viewportRef.current?.measureInWindow((_x, viewportTop, _width, viewportHeight) => {
            editorRef.current?.measureInWindow((_editorX, editorTop, _editorWidth, editorHeight) => {
                footerRef.current?.measureInWindow((_footerX, footerTop, _footerWidth, footerHeight) => {
                    if (!editorFocusedRef.current || version !== revealVersionRef.current || viewportHeight <= 0 || editorHeight <= 0) return;
                    const result = reportEditorVisibility({
                        viewportTop, viewportHeight, editorTop, editorHeight,
                        scrollOffset: scrollOffsetRef.current,
                        keyboardTop: keyboardTopRef.current,
                        footerTop: footerHeight > 0 ? footerTop : undefined,
                        gap: scale(12),
                    });
                    setBottomOverlap(current => Math.abs(current - result.bottomOverlap) > 1 ? result.bottomOverlap : current);
                    if (Math.abs(result.scrollOffset - scrollOffsetRef.current) > 1) {
                        scrollRef.current?.scrollTo({ y: result.scrollOffset, animated: true });
                    }
                });
            });
        });
    }, []);

    const scheduleRevealEditor = useCallback(() => {
        if (revealFrameRef.current !== null) cancelAnimationFrame(revealFrameRef.current);
        revealFrameRef.current = requestAnimationFrame(() => {
            revealFrameRef.current = null;
            revealEditor();
        });
    }, [revealEditor]);

    useEffect(() => {
        const shown = RNKeyboard.addListener('keyboardDidShow', event => {
            keyboardTopRef.current = event.endCoordinates.screenY;
            scheduleRevealEditor();
        });
        const changed = RNKeyboard.addListener('keyboardDidChangeFrame', event => {
            keyboardTopRef.current = event.endCoordinates.height > 0 ? event.endCoordinates.screenY : undefined;
            scheduleRevealEditor();
        });
        const hidden = RNKeyboard.addListener('keyboardDidHide', () => {
            keyboardTopRef.current = undefined;
            setBottomOverlap(0);
        });
        return () => {
            shown.remove();
            changed.remove();
            hidden.remove();
            editorFocusedRef.current = false;
            revealVersionRef.current++;
            if (revealFrameRef.current !== null) cancelAnimationFrame(revealFrameRef.current);
        };
    }, [scheduleRevealEditor]);

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
        : target?.type === 'ChatMessage'
            ? t('chat:report_message_title', 'Report message')
            : t('report_title_profile', 'Report profile');
    const translateReportText = (key: string, fallback: string) => target?.type === 'ChatMessage'
        ? t(`chat:${key}`, t(key, fallback))
        : t(key, fallback);
    const selectedReasonLabel = reason
        ? translateReportText(`report_reason_v2_${reason}`, REPORT_REASON_FALLBACKS[reason])
        : '';

    const selectReason = (value: ReportReason) => {
        lightImpact();
        setReason(value);
        setReasonDetail(null);
        setDescription('');
    };

    const selectDetail = (value: ReportReasonDetail) => {
        RNKeyboard.dismiss();
        lightImpact();
        setReasonDetail(value);
    };

    const closeSheet = useCallback(() => {
        RNKeyboard.dismiss();
        onClose();
    }, [onClose]);

    requestClose.current = () => { if (!submitting) closeSheet(); };

    const pickScreenshots = async () => {
        const remaining = MAX_SCREENSHOTS - screenshots.length;
        if (remaining <= 0) {
            toast.show(t('chat:report_screenshot_max', 'You can attach up to 3 screenshots.'), 'info');
            return;
        }

        RNKeyboard.dismiss();
        let result;
        try {
            result = await ImagePicker.launchImageLibraryAsync({
                mediaTypes: ['images'],
                allowsEditing: false,
                allowsMultipleSelection: true,
                selectionLimit: remaining,
                quality: 0.9,
                exif: false,
                preferredAssetRepresentationMode: ImagePicker.UIImagePickerPreferredAssetRepresentationMode.Compatible,
            });
        } catch {
            toast.show(t('chat:attachment_failed', 'Could not open photos. Please try again.'), 'error');
            return;
        }
        if (result.canceled) return;

        let invalidType = false;
        let tooLarge = false;
        const selected: ReportScreenshot[] = [];
        for (const asset of result.assets) {
            const rawMime = String(asset.mimeType || '').toLowerCase();
            const extension = String(asset.fileName || asset.uri).split(/[?#]/)[0].split('.').pop()?.toLowerCase();
            const inferredMime = extension === 'jpg' || extension === 'jpeg'
                ? 'image/jpeg'
                : extension === 'png'
                    ? 'image/png'
                    : extension === 'webp'
                        ? 'image/webp'
                        : '';
            const mime = rawMime === 'image/jpg' ? 'image/jpeg' : rawMime || inferredMime;
            if (!SCREENSHOT_MIME_TYPES.has(mime as ReportScreenshot['type'])) {
                invalidType = true;
                continue;
            }
            if (asset.fileSize && asset.fileSize > MAX_SCREENSHOT_BYTES) {
                tooLarge = true;
                continue;
            }
            selected.push({
                uri: asset.uri,
                name: asset.fileName || `report-screenshot-${Date.now()}-${selected.length + 1}.${mime.split('/')[1]}`,
                type: mime as ReportScreenshot['type'],
                size: asset.fileSize,
            });
        }

        if (invalidType) toast.show(t('chat:report_screenshot_type', 'Use a JPEG, PNG, or WebP image.'), 'error');
        if (tooLarge) toast.show(t('chat:report_screenshot_size', 'Each screenshot must be 5 MB or smaller.'), 'error');
        if (selected.length) {
            setScreenshots((current) => [...current, ...selected].slice(0, MAX_SCREENSHOTS));
        }
    };

    const handlePrimaryAction = () => {
        if (step === 'reason') {
            if (!reason) return;
            setStep('detail');
            return;
        }
        RNKeyboard.dismiss();
        void submit();
    };

    const submit = async () => {
        if (!target || !canSubmit || !reason || submitting) return;
        setSubmitting(true);
        let res;
        try {
            res = await reportsService.create({
                entityType: target.type,
                entityId: target.type === 'Image'
                    ? target.imageId || target.userId
                    : target.type === 'ChatMessage'
                        ? target.messageId || ''
                        : target.userId,
                reportedUserId: target.type === 'Image' ? target.userId : undefined,
                reason,
                reasonDetail: reason === 'other' ? undefined : reasonDetail || undefined,
                reportVersion: 2,
                description: description.trim(),
                imageUrl: target.imageUrl,
                screenshots: target.type === 'ChatMessage' ? screenshots : undefined,
            });
        } catch {
            setSubmitting(false);
            toast.show(t('network_error', 'No internet connection. Please check and try again.'), 'error');
            return;
        }

        if (!res.success) {
            setSubmitting(false);
            const errorMessage = res.message === 'report_screenshot_too_large'
                ? t('chat:report_screenshot_size', 'Each screenshot must be 5 MB or smaller.')
                : res.message === 'report_screenshot_limit'
                    ? t('chat:report_screenshot_max', 'You can attach up to 3 screenshots.')
                    : res.message === 'invalid_evidence_type'
                        ? t('chat:report_screenshot_type', 'Use a JPEG, PNG, or WebP image.')
                        : apiMessage(res.message || 'report_missing_fields');
            toast.show(errorMessage, 'error');
            return;
        }

        if (blockAfterReport) {
            let blocked = false;
            try {
                blocked = (await usersService.block(target.userId)).success;
            } catch {
                // The report is already saved; still show the partial-success result.
            }
            setSubmitting(false);
            if (blocked) {
                const successMessage = t('report_success_blocked', 'Your report was submitted and the user was blocked.');
                onClose();
                onBlocked?.(target.userId);
                setTimeout(() => toast.show(successMessage, 'success'), 250);
                return;
            }
            onClose();
            setTimeout(() => toast.show(t('report_success_block_failed', 'Report submitted, but we could not block this user.'), 'warning'), 250);
            return;
        }

        setSubmitting(false);
        onClose();
        setTimeout(() => toast.show(t('report_success_message', 'Thank you. Our safety team will review your report.'), 'success'), 250);
    };

    primaryActionRef.current = handlePrimaryAction;
    const renderFooter = useCallback(
        (props: BottomSheetFooterProps) => (
            <BottomSheetFooter
                {...props}
                bottomInset={Platform.OS === 'ios' ? insets.bottom : Math.max(0, insets.bottom - scale(12))}
                style={{ backgroundColor: palette.brand.bg.surface }}
            >
                <View ref={footerRef} collapsable={false} onLayout={scheduleRevealEditor} style={[styles.footer, { backgroundColor: palette.brand.bg.surface }]}>
                    <GradientButton
                        title={step === 'reason' ? t('continue', 'Continue') : submitting ? t('report_submitting', 'Submitting report...') : t('report_submit', 'Submit report')}
                        onPress={() => primaryActionRef.current()}
                        loading={submitting}
                        disabled={submitting || (step === 'reason' ? !reason : !canSubmit)}
                        widthMode="full"
                        size="compact"
                        containerStyle={styles.drawerSaveButton}
                    />
                </View>
            </BottomSheetFooter>
        ),
        [canSubmit, insets.bottom, palette.brand.bg.surface, reason, step, submitting, scheduleRevealEditor],
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
            onClose={closeSheet}
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
                            <Pressable onPress={() => { RNKeyboard.dismiss(); setStep('reason'); }} hitSlop={12} disabled={submitting} accessibilityRole="button" accessibilityLabel={t('back', 'Back')}>
                                {isRTL
                                    ? <CaretRight size={scale(22)} color={palette.chrome.common.textStrong} weight="bold" />
                                    : <CaretLeft size={scale(22)} color={palette.chrome.common.textStrong} weight="bold" />}
                            </Pressable>
                        ) : null}
                    </View>
                    <Text variant="body" className="font-body-bold" align="center" style={styles.sheetTitle}>{entityTitle}</Text>
                    <View style={[styles.headerSide, styles.headerSideEnd]}>
                        <Pressable onPress={closeSheet} hitSlop={12} disabled={submitting} accessibilityRole="button" accessibilityLabel={t('close', 'Close')}>
                            <X size={scale(21)} color={palette.brand.text.subtitle} />
                        </Pressable>
                    </View>
                </View>

                <View ref={viewportRef} collapsable={false} style={styles.scroll} onLayout={scheduleRevealEditor}>
                <BottomSheetScrollView
                    ref={scrollRef}
                    style={styles.scroll}
                    contentContainerStyle={[styles.scrollContent, { paddingBottom: scale(96) + bottomOverlap }]}
                    onScroll={event => { scrollOffsetRef.current = event.nativeEvent.contentOffset.y; }}
                    onContentSizeChange={scheduleRevealEditor}
                    keyboardShouldPersistTaps="never"
                    keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
                >
                    <View style={styles.scrollBody}>
                    <Pressable onPress={RNKeyboard.dismiss} style={StyleSheet.absoluteFill} accessible={false} />
                    {step === 'reason' && target.type === 'Image' && target.imageUrl ? (
                        <View style={styles.previewRow}>
                            <Image source={{ uri: target.imageUrl }} style={styles.previewImage} contentFit="cover" cachePolicy="memory-disk" />
                            <View style={styles.previewText}>
                                <Text variant="body-sm" className="font-body-semi">{t('report_photo_preview', 'Reporting this image')}</Text>
                                <Text variant="caption" style={{ color: palette.brand.text.subtitle }}>{t('report_photo_preview_hint', 'Only this photo will be attached to the report.')}</Text>
                            </View>
                        </View>
                    ) : null}

                    {step === 'reason' && target.type === 'ChatMessage' ? (
                        <View style={[styles.messagePreview, { backgroundColor: palette.chrome.common.card, borderColor: palette.brand.bg.border }]}>
                            {target.messageType === 'image' && target.messageMediaUrl ? (
                                <Image source={{ uri: target.messageMediaUrl }} style={styles.messagePreviewImage} contentFit="cover" cachePolicy="memory-disk" />
                            ) : null}
                            <View style={styles.previewText}>
                                <Text variant="body-sm" className="font-body-semi">{t('chat:reporting_message', 'Reporting this message')}</Text>
                                <Text variant="caption" numberOfLines={3} style={{ color: palette.brand.text.subtitle }}>
                                    {target.messagePreview || t('chat:report_message_media_fallback', 'Media message')}
                                </Text>
                            </View>
                        </View>
                    ) : null}

                    {step === 'reason' ? (
                        <>
                            {target.type !== 'Image' ? (
                                <Text variant="h3" className="font-heading" style={styles.stepTitle}>
                                    {target.type === 'ChatMessage'
                                        ? t('chat:report_message_reason_prompt', 'Why are you reporting this message?')
                                        : t('report_profile_reason_prompt', 'Why are you reporting this profile?')}
                                </Text>
                            ) : null}
                            <View style={styles.optionList}>
                                {reasons.map((value) => (
                                    <ReportOptionRow
                                        key={value}
                                        active={reason === value}
                                        title={translateReportText(`report_reason_v2_${value}`, REPORT_REASON_FALLBACKS[value])}
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
                                        {reason ? translateReportText(`report_reason_desc_${reason}`, REPORT_REASON_DESCRIPTION_FALLBACKS[reason]) : ''}
                                    </Text>
                                    <View style={styles.optionList}>
                                        {details.map((value) => (
                                            <ReportOptionRow
                                                key={value}
                                                active={reasonDetail === value}
                                                title={translateReportText(`report_detail_${value}`, REPORT_DETAIL_FALLBACKS[value])}
                                                description={translateReportText(`report_detail_desc_${value}`, REPORT_DETAIL_DESCRIPTION_FALLBACKS[value])}
                                                onPress={() => selectDetail(value)}
                                            />
                                        ))}
                                    </View>
                                </>
                            )}

                            {(reason === 'other' || reasonDetail) ? (
                                <View ref={editorRef} collapsable={false} onLayout={scheduleRevealEditor}>
                                    <Text variant="body-sm" className="font-body-semi" style={styles.editorLabel}>
                                        {reason === 'other' ? t('report_description_required', 'Details') : t('report_description', 'Additional details (optional)')}
                                    </Text>
                                    <BottomSheetTextInput
                                        value={description}
                                        onChangeText={(value) => setDescription(value.slice(0, DESCRIPTION_MAX))}
                                        placeholder={t('report_description_ph', 'Add any details that help us review this report.')}
                                        placeholderTextColor={palette.brand.text.muted}
                                        multiline
                                        scrollEnabled
                                        onFocus={() => {
                                            editorFocusedRef.current = true;
                                            keyboardTopRef.current = RNKeyboard.metrics()?.screenY;
                                            scheduleRevealEditor();
                                        }}
                                        onBlur={() => { editorFocusedRef.current = false; revealVersionRef.current++; }}
                                        textAlignVertical="top"
                                        style={[styles.description, { color: palette.brand.text.body, borderBottomColor: palette.chrome.primary, fontFamily: inputFontFamily, textAlign: isRTL ? 'right' : 'left' }]}
                                    />
                                    <View style={styles.countRow}>
                                        {reason === 'other' ? (
                                            <Text variant="caption" style={{ color: otherValid ? palette.brand.text.muted : palette.brand.accent.error }}>{t('report_other_minimum', 'Minimum 30 non-space characters')}</Text>
                                        ) : <View />}
                                        <Text variant="caption" style={{ color: palette.brand.text.muted }}>{description.length}/{DESCRIPTION_MAX}</Text>
                                    </View>
                                </View>
                            ) : null}

                            {target.type === 'ChatMessage' ? (
                                <View style={styles.evidenceSection}>
                                    <Text variant="body-sm" className="font-body-semi">{t('chat:report_screenshots', 'Screenshots (optional)')}</Text>
                                    <Text variant="caption" style={{ color: palette.brand.text.subtitle }}>
                                        {t('chat:report_screenshots_hint', 'Add up to 3 relevant screenshots. The reported message is saved automatically.')}
                                    </Text>
                                    <View style={styles.screenshotRow}>
                                        {screenshots.map((screenshot, index) => (
                                            <View key={`${screenshot.uri}:${index}`} style={styles.screenshotPreviewWrap}>
                                                <Image source={{ uri: screenshot.uri }} style={styles.screenshotPreview} contentFit="cover" />
                                                <Pressable
                                                    onPress={() => setScreenshots((current) => current.filter((_, itemIndex) => itemIndex !== index))}
                                                    style={styles.removeScreenshot}
                                                    accessibilityRole="button"
                                                    accessibilityLabel={t('chat:remove_screenshot', 'Remove screenshot')}
                                                >
                                                    <X size={scale(13)} color="#FFFFFF" />
                                                </Pressable>
                                            </View>
                                        ))}
                                        {screenshots.length < MAX_SCREENSHOTS ? (
                                            <Pressable
                                                onPress={() => void pickScreenshots()}
                                                style={[styles.addScreenshot, { borderColor: palette.brand.bg.border }]}
                                                accessibilityRole="button"
                                                accessibilityLabel={t('chat:add_screenshots', 'Add screenshots')}
                                            >
                                                <ImagePlus size={scale(20)} color={palette.chrome.primary} />
                                                <Text variant="caption" className="font-body-semi" align="center" style={{ color: palette.chrome.primary }}>
                                                    {t('chat:add_screenshots', 'Add screenshots')}
                                                </Text>
                                            </Pressable>
                                        ) : null}
                                    </View>
                                </View>
                            ) : null}

                            <Pressable
                                onPress={() => { RNKeyboard.dismiss(); lightImpact(); setBlockAfterReport((current) => !current); }}
                                style={styles.blockRow}
                                accessibilityRole="checkbox"
                                accessibilityState={{ checked: blockAfterReport }}
                            >
                                <View style={[styles.checkbox, { borderColor: blockAfterReport ? palette.chrome.primary : palette.brand.text.muted }, blockAfterReport && { backgroundColor: palette.chrome.primary }]}>
                                    {blockAfterReport ? <Check size={scale(12)} color={palette.chrome.common.inverseText} weight="bold" style={styles.checkboxCheck} /> : null}
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
                </View>

            </SafeAreaView>
        </BottomSheet>
    );

    if (embedded) {
        return <View style={styles.embeddedHost}>{sheet}<ToastProvider /></View>;
    }

    return <>{sheet}<ToastProvider /></>;
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
    messagePreview: { flexDirection: 'row', alignItems: 'center', gap: scale(12), borderWidth: StyleSheet.hairlineWidth, borderRadius: scale(8), padding: scale(12), marginBottom: scale(18) },
    messagePreviewImage: { width: scale(52), height: scale(52), borderRadius: scale(6) },
    stepTitle: { fontSize: scale(18), lineHeight: scale(24), marginBottom: scale(5) },
    stepHelper: { lineHeight: scale(20), marginBottom: scale(10) },
    optionList: { width: '100%' },
    optionRow: { minHeight: scale(64), borderBottomWidth: StyleSheet.hairlineWidth, flexDirection: 'row', alignItems: 'center', gap: scale(14), paddingVertical: scale(12) },
    optionText: { flex: 1, minWidth: 0 },
    optionDescription: { lineHeight: scale(18), marginTop: scale(3) },
    radio: { width: scale(22), height: scale(22), borderRadius: scale(11), borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
    radioDot: { width: scale(12), height: scale(12), borderRadius: scale(6) },
    editorLabel: { marginTop: scale(20), marginBottom: scale(6) },
    description: { minHeight: scale(92), maxHeight: scale(160), borderBottomWidth: 1, paddingHorizontal: scale(6), paddingVertical: scale(8), fontSize: scale(14), lineHeight: scale(21) },
    countRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: scale(6) },
    evidenceSection: { gap: scale(5), paddingTop: scale(18) },
    screenshotRow: { flexDirection: 'row', flexWrap: 'wrap', gap: scale(10), paddingTop: scale(6) },
    screenshotPreviewWrap: { position: 'relative' },
    screenshotPreview: { width: scale(64), height: scale(64), borderRadius: scale(6) },
    removeScreenshot: { position: 'absolute', top: scale(3), right: scale(3), width: scale(22), height: scale(22), borderRadius: scale(11), alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.72)' },
    addScreenshot: { width: scale(94), height: scale(64), borderWidth: 1, borderStyle: 'dashed', borderRadius: scale(6), alignItems: 'center', justifyContent: 'center', gap: scale(3), paddingHorizontal: scale(6) },
    blockRow: { flexDirection: 'row', alignItems: 'flex-start', gap: scale(12), paddingVertical: scale(18) },
    checkbox: { width: scale(20), height: scale(20), borderRadius: scale(6), borderWidth: 1, alignItems: 'center', justifyContent: 'center', marginTop: scale(1) },
    checkboxCheck: { transform: [{ translateX: 0.5 }] },
    blockText: { flex: 1, gap: scale(3) },
    footer: { paddingHorizontal: scale(26), paddingTop: scale(12), paddingBottom: Platform.OS === 'ios' ? 0 : scale(12) },
    drawerSaveButton: { height: scale(40) },
});
