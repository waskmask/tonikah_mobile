import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Modal, Platform, StyleSheet, TextInput, useWindowDimensions, View } from 'react-native';
import BottomSheet, {
    BottomSheetBackdrop,
    BottomSheetBackdropProps,
    BottomSheetTextInput,
    BottomSheetView,
    useBottomSheetTimingConfigs,
} from '@gorhom/bottom-sheet';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { Pressable } from 'react-native';
import { ChevronLeft, ChevronRight, Trash2, X } from 'lucide-react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { Easing, SlideInLeft, SlideInRight } from 'react-native-reanimated';
import {
    KeyboardController,
    KeyboardAvoidingView,
    KeyboardAwareScrollView,
    useKeyboardState,
} from 'react-native-keyboard-controller';
import { Text } from './Text';
import { GradientButton } from './GradientButton';
import { UnderReviewPill } from '@/components/app/UnderReviewPill';
import { useColors } from '@/hooks/useColors';
import { useLanguage } from '@/hooks/useLanguage';
import { scale } from '@/hooks/useResponsive';
import { Typography } from '@/constants/typography';
import { t } from '@/lib/profileDisplay';
import { getTextDirection, localeTextDirection } from '@/lib/textDirection';
import { countNonSpace, trimToNonSpaceLimit } from '@/lib/profileValidation';
import { UnderlineTextInput } from './UnderlineTextInput';
import { ConfirmSheet } from './ConfirmSheet';

type Props = {
    visible: boolean;
    title: string;
    initialValue: string;
    placeholder: string;
    /** Non-space character cap; input is trimmed to it while typing. */
    maxNonSpace: number;
    saving?: boolean;
    pendingReview?: boolean;
    errorText?: string;
    multiline?: boolean;
    minInputHeight?: number;
    sanitizeValue?: (value: string) => string;
    countValue?: (value: string) => number;
    onDraftChange?: (value: string) => void;
    presentation?: 'sheet' | 'drawer';
    onClose: () => void;
    onSave: (value: string) => void;
};

/** Bottom-sheet text editor (web ProfileTextEditSheet equivalent): draft +
    counter + Save disabled until changed. Moderation handling stays with the
    parent (it owns the warning modal and re-submission). */
export function TextEditSheet({
    visible,
    title,
    initialValue,
    placeholder,
    maxNonSpace,
    saving = false,
    pendingReview = false,
    errorText,
    multiline = false,
    minInputHeight,
    sanitizeValue,
    countValue = countNonSpace,
    onDraftChange,
    presentation = 'sheet',
    onClose,
    onSave,
}: Props) {
    const palette = useColors();
    const { currentLanguage, isRTL } = useLanguage();
    const insets = useSafeAreaInsets();
    const { height: windowHeight } = useWindowDimensions();
    const keyboardState = useKeyboardState();
    const keyboardVisible = keyboardState.isVisible;
    const [draft, setDraft] = useState(initialValue);
    const [inputFocused, setInputFocused] = useState(false);
    const [discardConfirmationVisible, setDiscardConfirmationVisible] = useState(false);
    const drawerInputRef = useRef<TextInput>(null);
    const drawerFocusTimersRef = useRef<Array<ReturnType<typeof setTimeout>>>([]);
    const animationConfigs = useBottomSheetTimingConfigs({
        duration: 220,
        easing: Easing.bezier(0.32, 0.72, 0, 1),
    });

    useEffect(() => {
        if (visible) setDraft(initialValue);
    }, [visible, initialValue]);

    const clearDrawerFocusTimers = useCallback(() => {
        drawerFocusTimersRef.current.forEach(clearTimeout);
        drawerFocusTimersRef.current = [];
    }, []);

    const focusDrawerInput = useCallback(() => {
        clearDrawerFocusTimers();
        const focus = () => {
            const input = drawerInputRef.current;
            if (!input) return;
            input.focus();
        };

        // Android can retain focus on an input inside a hidden Modal without
        // reopening the IME. Focus after the native window is visible, then
        // retry with a fresh blur/focus only when the keyboard stayed hidden.
        drawerFocusTimersRef.current = [
            setTimeout(focus, Platform.OS === 'android' ? 80 : 20),
            setTimeout(() => {
                const input = drawerInputRef.current;
                if (!input || KeyboardController.isVisible()) return;
                input.blur();
                drawerFocusTimersRef.current.push(setTimeout(focus, 40));
            }, 320),
        ];
    }, [clearDrawerFocusTimers]);

    useEffect(() => {
        if (!visible || presentation !== 'drawer') {
            clearDrawerFocusTimers();
            drawerInputRef.current?.blur();
        }

        return clearDrawerFocusTimers;
    }, [clearDrawerFocusTimers, presentation, visible]);

    const renderBackdrop = useCallback(
        (props: BottomSheetBackdropProps) => (
            <BottomSheetBackdrop
                {...props}
                appearsOnIndex={0}
                disappearsOnIndex={-1}
                pressBehavior={saving ? 'none' : 'close'}
                opacity={0.4}
            />
        ),
        [saving],
    );

    const direction = getTextDirection(draft, localeTextDirection(currentLanguage));
    const inputFontFamily = currentLanguage === 'ar' ? Typography.font.arabic.regular : Typography.font.body.regular;
    const dirty = draft.trim() !== initialValue.trim();
    const sheetHeight = Math.min(
        scale(multiline ? 420 : 300) + insets.bottom,
        windowHeight * 0.86,
    );
    const drawerFooterBottomPadding = keyboardVisible
        ? scale(12)
        : Math.max(insets.bottom, scale(12));
    const updateDraft = (value: string) => {
        const next = sanitizeValue
            ? sanitizeValue(value)
            : trimToNonSpaceLimit(value, maxNonSpace);
        setDraft(next);
        onDraftChange?.(next);
    };
    const requestDrawerClose = () => {
        if (saving) return;
        if (dirty) {
            setDiscardConfirmationVisible(true);
            return;
        }
        onClose();
    };

    if (presentation === 'drawer') {
        const drawerEntering = isRTL
            ? SlideInLeft.duration(220).easing(Easing.bezier(0.32, 0.72, 0, 1))
            : SlideInRight.duration(220).easing(Easing.bezier(0.32, 0.72, 0, 1));
        const drawerInput = (
            <UnderlineTextInput
                ref={drawerInputRef}
                value={draft}
                onChangeText={updateDraft}
                placeholder={placeholder}
                placeholderTextColor={palette.brand.text.muted}
                editable={!saving}
                showSoftInputOnFocus
                multiline={multiline}
                scrollEnabled={multiline}
                minInputHeight={minInputHeight ?? scale(multiline ? 150 : 44)}
                error={Boolean(errorText)}
                style={[
                    multiline && styles.drawerMultilineInput,
                    {
                        borderBottomWidth: 0,
                        fontFamily: inputFontFamily,
                        textAlign: direction === 'rtl' ? 'right' : 'left',
                        writingDirection: direction,
                    },
                ]}
            />
        );
        const drawerInputStatus = (
            <>
                <Text variant="caption" style={[styles.counter, { color: palette.brand.text.muted }]}>
                    {countValue(draft)}/{maxNonSpace}
                </Text>
                {errorText ? (
                    <Text variant="caption" style={[styles.error, { color: palette.brand.accent.error }]}>
                        {errorText}
                    </Text>
                ) : null}
            </>
        );

        return (
            <Modal
                visible={visible}
                transparent={false}
                animationType="none"
                statusBarTranslucent
                hardwareAccelerated
                onShow={focusDrawerInput}
                onRequestClose={requestDrawerClose}
            >
                <View style={[styles.drawer, { backgroundColor: palette.brand.bg.surface }]}>
                    <Animated.View
                        entering={drawerEntering}
                        style={[styles.drawer, { backgroundColor: palette.brand.bg.surface }]}
                    >
                    <KeyboardAvoidingView
                        behavior="height"
                        automaticOffset
                        style={styles.drawer}
                    >
                    <SafeAreaView edges={['top']} style={styles.drawerSafeArea}>
                        <View style={[styles.drawerHeader, { borderBottomColor: palette.brand.bg.border }]}>
                            <View style={styles.drawerHeaderSide}>
                                <Pressable
                                    onPress={requestDrawerClose}
                                    disabled={saving}
                                    accessibilityRole="button"
                                    accessibilityLabel={t('back', 'Back')}
                                    style={styles.drawerHeaderAction}
                                >
                                    {isRTL ? (
                                        <ChevronRight size={22} color={palette.brand.text.body} />
                                    ) : (
                                        <ChevronLeft size={22} color={palette.brand.text.body} />
                                    )}
                                </Pressable>
                            </View>
                            <View style={styles.drawerTitleGroup}>
                                <Text variant="body-sm" className="font-body-bold" numberOfLines={1} style={styles.drawerTitle}>
                                    {title}
                                </Text>
                            </View>
                            <View style={[styles.drawerHeaderSide, styles.drawerHeaderSideEnd]}>
                                {pendingReview ? <UnderReviewPill iconOnly /> : null}
                                {draft.length > 0 ? (
                                    <Pressable
                                        onPress={() => updateDraft('')}
                                        disabled={saving}
                                        accessibilityRole="button"
                                        accessibilityLabel={t('clear', 'Clear')}
                                        style={styles.drawerHeaderAction}
                                    >
                                        <Trash2 size={scale(19)} color={palette.brand.text.body} />
                                    </Pressable>
                                ) : null}
                            </View>
                        </View>

                        {multiline ? (
                            <View style={styles.drawerMultilineBody}>
                                {drawerInput}
                                <View style={styles.drawerMultilineStatus}>
                                    {drawerInputStatus}
                                </View>
                            </View>
                        ) : (
                            <KeyboardAwareScrollView
                                style={styles.drawerBody}
                                contentContainerStyle={styles.drawerBodyContent}
                                keyboardShouldPersistTaps="always"
                                keyboardDismissMode="on-drag"
                                bottomOffset={scale(24)}
                            >
                                {drawerInput}
                                {drawerInputStatus}
                            </KeyboardAwareScrollView>
                        )}

                        <View
                            style={[
                                styles.drawerFooter,
                                {
                                    backgroundColor: palette.brand.bg.surface,
                                    borderTopColor: palette.brand.bg.border,
                                    paddingBottom: drawerFooterBottomPadding,
                                },
                            ]}
                        >
                            <GradientButton
                                title={t('save', 'Save')}
                                onPress={() => onSave(draft)}
                                loading={saving}
                                disabled={!dirty || saving}
                                widthMode="full"
                                height={44}
                                textSize={15}
                                containerStyle={styles.drawerSaveButton}
                            />
                        </View>
                    </SafeAreaView>
                    </KeyboardAvoidingView>
                    </Animated.View>
                    <ConfirmSheet
                        visible={discardConfirmationVisible}
                        onClose={() => setDiscardConfirmationVisible(false)}
                        onCancel={() => {
                            setDiscardConfirmationVisible(false);
                            onClose();
                        }}
                        onConfirm={() => {
                            setDiscardConfirmationVisible(false);
                            onSave(draft);
                        }}
                        title={t('unsaved_changes_title', 'Unsaved changes')}
                        message={t('unsaved_changes_message', 'Save your changes before leaving?')}
                        confirmLabel={t('save', 'Save')}
                        cancelLabel={t('discard', 'Discard')}
                    />
                </View>
            </Modal>
        );
    }

    return (
        <Modal
            visible={visible}
            transparent
            animationType="none"
            statusBarTranslucent
            navigationBarTranslucent
            hardwareAccelerated
            onRequestClose={saving ? () => undefined : onClose}
        >
            <GestureHandlerRootView style={{ flex: 1 }}>
                <BottomSheet
                    snapPoints={[sheetHeight]}
                    index={0}
                    animationConfigs={animationConfigs}
                    enablePanDownToClose={!saving}
                    enableDynamicSizing={false}
                    keyboardBehavior="interactive"
                    keyboardBlurBehavior="restore"
                    android_keyboardInputMode="adjustResize"
                    onClose={onClose}
                    backdropComponent={renderBackdrop}
                    backgroundStyle={{ backgroundColor: palette.chrome.common.card }}
                    handleIndicatorStyle={{ backgroundColor: palette.brand.text.muted }}
                >
                    <BottomSheetView style={{ flex: 1 }}>
                        <View style={styles.header}>
                            <View style={styles.titleRow}>
                                <Text variant="body-sm" className="font-body-bold" style={styles.title}>
                                    {title}
                                </Text>
                                {pendingReview ? <UnderReviewPill /> : null}
                            </View>
                            <View style={styles.headerActions}>
                                {draft.length > 0 ? (
                                    <Pressable
                                        onPress={() => updateDraft('')}
                                        hitSlop={10}
                                        disabled={saving}
                                        accessibilityRole="button"
                                        accessibilityLabel={t('clear', 'Clear')}
                                        style={styles.iconButton}
                                    >
                                        <Trash2 size={scale(19)} color={palette.brand.accent.error} />
                                    </Pressable>
                                ) : null}
                                <Pressable
                                    onPress={onClose}
                                    hitSlop={10}
                                    disabled={saving}
                                    accessibilityRole="button"
                                    accessibilityLabel={t('close', 'Close')}
                                    style={styles.iconButton}
                                >
                                    <X size={scale(20)} color={palette.brand.text.subtitle} />
                                </Pressable>
                            </View>
                        </View>

                        <View style={styles.body}>
                            <BottomSheetTextInput
                                value={draft}
                                onChangeText={updateDraft}
                                placeholder={placeholder}
                                placeholderTextColor={palette.brand.text.muted}
                                editable={!saving}
                                autoFocus
                                onFocus={() => setInputFocused(true)}
                                onBlur={() => setInputFocused(false)}
                                multiline={multiline}
                                textAlignVertical={multiline ? 'top' : 'center'}
                                style={[
                                    styles.input,
                                    multiline && styles.multilineInput,
                                    {
                                        minHeight: minInputHeight ?? scale(multiline ? 150 : 44),
                                        borderBottomColor: errorText
                                            ? palette.brand.accent.error
                                            : inputFocused
                                                ? palette.chrome.primary
                                                : palette.brand.bg.border,
                                        borderBottomWidth: inputFocused ? 1.5 : 1,
                                        color: palette.brand.text.body,
                                        fontFamily: inputFontFamily,
                                        textAlign: direction === 'rtl' ? 'right' : 'left',
                                        writingDirection: direction,
                                    },
                                ]}
                            />
                            <Text variant="caption" style={[styles.counter, { color: palette.brand.text.muted }]}>
                                {countValue(draft)}/{maxNonSpace}
                            </Text>
                            {errorText ? (
                                <Text variant="caption" style={[styles.error, { color: palette.brand.accent.error }]}>
                                    {errorText}
                                </Text>
                            ) : null}
                        </View>

                        <View style={[styles.footer, { paddingBottom: insets.bottom + scale(12) }]}>
                            <GradientButton
                                title={t('save', 'Save')}
                                onPress={() => onSave(draft)}
                                loading={saving}
                                disabled={!dirty || saving}
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
    drawer: { flex: 1 },
    drawerSafeArea: { flex: 1 },
    drawerHeader: {
        minHeight: scale(56),
        paddingHorizontal: scale(12),
        borderBottomWidth: StyleSheet.hairlineWidth,
        flexDirection: 'row',
        alignItems: 'center',
        gap: scale(8),
    },
    drawerHeaderAction: {
        width: scale(40),
        height: scale(40),
        alignItems: 'center',
        justifyContent: 'center',
    },
    drawerHeaderSide: {
        width: scale(80),
        flexDirection: 'row',
        alignItems: 'center',
    },
    drawerHeaderSideEnd: {
        justifyContent: 'flex-end',
        gap: scale(4),
    },
    drawerTitleGroup: {
        flex: 1,
        minWidth: 0,
        alignItems: 'center',
        justifyContent: 'center',
    },
    drawerTitle: { flexShrink: 1, fontSize: scale(16), lineHeight: scale(21), textAlign: 'center' },
    drawerBody: { flex: 1 },
    drawerBodyContent: {
        flexGrow: 1,
        paddingHorizontal: scale(20),
        paddingTop: scale(12),
        paddingBottom: scale(24),
    },
    drawerMultilineBody: {
        flex: 1,
        minHeight: 0,
        paddingHorizontal: scale(20),
        paddingTop: scale(12),
        paddingBottom: scale(4),
    },
    drawerMultilineInput: {
        flex: 1,
        minHeight: scale(150),
    },
    drawerMultilineStatus: {
        flexShrink: 0,
        minHeight: scale(22),
    },
    drawerFooter: {
        flexShrink: 0,
        paddingHorizontal: scale(26),
        paddingTop: scale(12),
        paddingBottom: scale(12),
    },
    drawerSaveButton: {
        height: scale(44),
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: scale(20),
        paddingVertical: scale(12),
        gap: scale(10),
    },
    titleRow: {
        flex: 1,
        minWidth: 0,
        flexDirection: 'row',
        alignItems: 'center',
        gap: scale(8),
        flexWrap: 'wrap',
    },
    title: {
        fontSize: scale(14),
        lineHeight: scale(18),
        flexShrink: 1,
    },
    headerActions: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: scale(4),
    },
    iconButton: {
        width: scale(36),
        height: scale(36),
        alignItems: 'center',
        justifyContent: 'center',
    },
    body: {
        flex: 1,
        paddingHorizontal: scale(20),
    },
    input: {
        minHeight: scale(44),
        borderBottomWidth: 1,
        paddingHorizontal: scale(6),
        paddingVertical: 0,
        fontSize: scale(14),
        lineHeight: scale(21),
        includeFontPadding: false,
        backgroundColor: 'transparent',
    },
    multilineInput: {
        paddingVertical: scale(8),
    },
    counter: {
        marginTop: scale(4),
        textAlign: 'right',
        writingDirection: 'ltr',
    },
    error: {
        marginTop: scale(4),
    },
    footer: {
        paddingHorizontal: scale(20),
        paddingTop: scale(8),
    },
});
