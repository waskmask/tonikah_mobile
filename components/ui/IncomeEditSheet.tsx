import React, { useCallback, useEffect, useState } from 'react';
import { Modal, Pressable, StyleSheet, TextInput, View } from 'react-native';
import BottomSheet, {
    BottomSheetBackdrop,
    BottomSheetBackdropProps,
    BottomSheetView,
} from '@gorhom/bottom-sheet';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { X } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Text } from './Text';
import { GradientButton } from './GradientButton';
import { useColors } from '@/hooks/useColors';
import { scale } from '@/hooks/useResponsive';
import { t } from '@/lib/profileDisplay';
import { formatAmount } from '@/lib/profileValidation';

type Props = {
    visible: boolean;
    title: string;
    initialCurrency: string;
    initialAmount: string;
    currencies: string[];
    saving?: boolean;
    errorText?: string;
    onClose: () => void;
    onSave: (currency: string, amount: string) => void;
};

/** Bottom-sheet annual-income editor: currency chips + amount input + Save
    disabled until changed. Validation and saving stay with the parent. */
export function IncomeEditSheet({
    visible,
    title,
    initialCurrency,
    initialAmount,
    currencies,
    saving = false,
    errorText,
    onClose,
    onSave,
}: Props) {
    const palette = useColors();
    const insets = useSafeAreaInsets();
    const [currency, setCurrency] = useState(initialCurrency);
    const [amount, setAmount] = useState(initialAmount);

    useEffect(() => {
        if (visible) {
            setCurrency(initialCurrency);
            setAmount(initialAmount);
        }
    }, [visible, initialCurrency, initialAmount]);

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

    const dirty = currency !== initialCurrency || amount.trim() !== initialAmount.trim();
    const sheetHeight = scale(360) + insets.bottom;

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
                            <Text variant="body-sm" className="font-body-bold" style={styles.title}>
                                {title}
                            </Text>
                            <Pressable onPress={onClose} hitSlop={12} disabled={saving}>
                                <X size={scale(20)} color={palette.brand.text.subtitle} />
                            </Pressable>
                        </View>

                        <View style={styles.body}>
                            <Text variant="caption" className="font-body-semi" style={{ color: palette.brand.text.subtitle }}>
                                {t('select_currency', 'Select currency')}
                            </Text>
                            <View style={styles.chipWrap}>
                                {currencies.map((code) => {
                                    const active = code === currency;
                                    return (
                                        <Pressable
                                            key={code}
                                            onPress={() => setCurrency(code)}
                                            disabled={saving}
                                            accessibilityRole="button"
                                            accessibilityState={{ selected: active }}
                                            style={[
                                                styles.chip,
                                                active
                                                    ? { backgroundColor: palette.chrome.primary, borderColor: palette.chrome.primary }
                                                    : { backgroundColor: 'transparent', borderColor: palette.brand.bg.border },
                                            ]}
                                        >
                                            <Text
                                                variant="caption"
                                                className="font-body-semi"
                                                style={{ color: active ? palette.chrome.common.inverseText : palette.brand.text.body }}
                                            >
                                                {code}
                                            </Text>
                                        </Pressable>
                                    );
                                })}
                            </View>

                            <Text
                                variant="caption"
                                className="font-body-semi"
                                style={{ color: palette.brand.text.subtitle, marginTop: scale(14) }}
                            >
                                {t('amount', 'Amount')}
                            </Text>
                            <TextInput
                                value={amount}
                                onChangeText={(value) => setAmount(formatAmount(value))}
                                placeholder={t('amount', 'Amount')}
                                placeholderTextColor={palette.brand.text.muted}
                                keyboardType="numeric"
                                maxLength={12}
                                editable={!saving}
                                style={[
                                    styles.input,
                                    {
                                        borderColor: errorText ? palette.brand.accent.error : palette.brand.bg.border,
                                        color: palette.brand.text.body,
                                    },
                                ]}
                            />
                            {errorText ? (
                                <Text variant="caption" style={{ color: palette.brand.accent.error, marginTop: scale(4) }}>
                                    {errorText}
                                </Text>
                            ) : null}
                        </View>

                        <View style={[styles.footer, { paddingBottom: insets.bottom + scale(12) }]}>
                            <GradientButton
                                title={t('save', 'Save')}
                                onPress={() => onSave(currency, amount)}
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
    title: {
        flex: 1,
        minWidth: 0,
        fontSize: scale(14),
        lineHeight: scale(18),
    },
    body: {
        flex: 1,
        paddingHorizontal: scale(20),
    },
    chipWrap: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: scale(8),
        marginTop: scale(8),
    },
    chip: {
        borderWidth: 1,
        borderRadius: scale(999),
        paddingHorizontal: scale(14),
        paddingVertical: scale(7),
    },
    input: {
        marginTop: scale(8),
        minHeight: scale(44),
        borderWidth: 1,
        borderRadius: scale(12),
        paddingHorizontal: scale(12),
        paddingVertical: 0,
        fontSize: scale(14),
        writingDirection: 'ltr',
        textAlign: 'left',
    },
    footer: {
        paddingHorizontal: scale(20),
        paddingTop: scale(8),
    },
});
