import React, { useCallback, useEffect, useState } from 'react';
import { Modal, StyleSheet, TextInput, View } from 'react-native';
import BottomSheet, {
    BottomSheetBackdrop,
    BottomSheetBackdropProps,
    BottomSheetView,
} from '@gorhom/bottom-sheet';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { Pressable } from 'react-native';
import { X } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
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
    onClose,
    onSave,
}: Props) {
    const palette = useColors();
    const { currentLanguage } = useLanguage();
    const insets = useSafeAreaInsets();
    const [draft, setDraft] = useState(initialValue);

    useEffect(() => {
        if (visible) setDraft(initialValue);
    }, [visible, initialValue]);

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
    const sheetHeight = scale(300) + insets.bottom;

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
                    enablePanDownToClose={!saving}
                    enableDynamicSizing={false}
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
                            <Pressable onPress={onClose} hitSlop={12} disabled={saving}>
                                <X size={scale(20)} color={palette.brand.text.subtitle} />
                            </Pressable>
                        </View>

                        <View style={styles.body}>
                            <TextInput
                                value={draft}
                                onChangeText={(value) => setDraft(trimToNonSpaceLimit(value, maxNonSpace))}
                                placeholder={placeholder}
                                placeholderTextColor={palette.brand.text.muted}
                                editable={!saving}
                                autoFocus
                                style={[
                                    styles.input,
                                    {
                                        borderColor: errorText ? palette.brand.accent.error : palette.brand.bg.border,
                                        color: palette.brand.text.body,
                                        fontFamily: inputFontFamily,
                                        textAlign: direction === 'rtl' ? 'right' : 'left',
                                        writingDirection: direction,
                                    },
                                ]}
                            />
                            <Text variant="caption" style={[styles.counter, { color: palette.brand.text.muted }]}>
                                {countNonSpace(draft)}/{maxNonSpace}
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
    body: {
        flex: 1,
        paddingHorizontal: scale(20),
    },
    input: {
        minHeight: scale(44),
        borderWidth: 1,
        borderRadius: scale(12),
        paddingHorizontal: scale(12),
        paddingVertical: 0,
        fontSize: scale(14),
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
