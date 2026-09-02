import React, { useCallback, useMemo } from 'react';
import { ActivityIndicator, Modal, Platform, Pressable, StyleSheet, View } from 'react-native';
import BottomSheet, {
    BottomSheetBackdrop,
    type BottomSheetBackdropProps,
    BottomSheetView,
} from '@gorhom/bottom-sheet';
import { Apple, CreditCard, Play, X } from 'lucide-react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { PressableScale } from '@/components/ui/PressableScale';
import { Text } from '@/components/ui/Text';
import { useColors } from '@/hooks/useColors';
import { useLanguage } from '@/hooks/useLanguage';
import { scale } from '@/hooks/useResponsive';
import { t } from '@/lib/profileDisplay';

export type MembershipPaymentChoice = {
    kind: 'apple_iap' | 'google_play' | 'external_web';
    label: string;
    description: string;
    price?: string;
    disabled?: boolean;
};

type MembershipPaymentSheetProps = {
    visible: boolean;
    planName: string;
    choices: MembershipPaymentChoice[];
    busyChoice?: MembershipPaymentChoice['kind'] | null;
    onClose: () => void;
    onChoose: (choice: MembershipPaymentChoice) => void;
};

export function MembershipPaymentSheet({
    visible,
    planName,
    choices,
    busyChoice,
    onClose,
    onChoose,
}: MembershipPaymentSheetProps) {
    const colors = useColors();
    const { isRTL } = useLanguage();
    const insets = useSafeAreaInsets();
    const snapPoints = useMemo(
        () => [scale(238 + Math.max(choices.length, 1) * 76) + insets.bottom],
        [choices.length, insets.bottom],
    );
    const renderBackdrop = useCallback(
        (props: BottomSheetBackdropProps) => (
            <BottomSheetBackdrop
                {...props}
                appearsOnIndex={0}
                disappearsOnIndex={-1}
                opacity={0.42}
                pressBehavior={busyChoice ? 'none' : 'close'}
            />
        ),
        [busyChoice],
    );

    return (
        <Modal
            visible={visible}
            transparent
            animationType='none'
            statusBarTranslucent
            navigationBarTranslucent
            hardwareAccelerated
            onRequestClose={() => {
                if (!busyChoice) onClose();
            }}
        >
            <GestureHandlerRootView style={styles.fill}>
                <BottomSheet
                    index={0}
                    snapPoints={snapPoints}
                    enableDynamicSizing={false}
                    enablePanDownToClose={!busyChoice}
                    onClose={onClose}
                    backdropComponent={renderBackdrop}
                    backgroundStyle={{ backgroundColor: colors.chrome.common.card }}
                    handleIndicatorStyle={{ backgroundColor: colors.brand.text.muted }}
                >
                    <BottomSheetView style={[styles.content, { paddingBottom: insets.bottom + scale(16) }]}>
                        <View style={[styles.header, { flexDirection: 'row' }]}>
                            <View style={styles.heading}>
                                <Text variant='h3' style={styles.title}>
                                    {t('choose_payment_method', 'Choose how to pay')}
                                </Text>
                                <Text variant='body-sm' style={{ color: colors.brand.text.subtitle }}>
                                    {planName}
                                </Text>
                            </View>
                            <Pressable
                                onPress={onClose}
                                disabled={Boolean(busyChoice)}
                                hitSlop={12}
                                accessibilityRole='button'
                                accessibilityLabel={t('close', 'Close')}
                                style={[styles.close, { backgroundColor: colors.brand.bg.surface }]}
                            >
                                <X size={scale(19)} color={colors.brand.text.subtitle} />
                            </Pressable>
                        </View>

                        <View style={styles.choices}>
                            {choices.map((choice) => {
                                const busy = busyChoice === choice.kind;
                                return (
                                    <PressableScale
                                        key={choice.kind}
                                        onPress={() => onChoose(choice)}
                                        disabled={choice.disabled || Boolean(busyChoice)}
                                        accessibilityRole='button'
                                        accessibilityLabel={choice.label}
                                        style={[
                                            styles.choice,
                                            {
                                                borderColor: colors.brand.bg.border,
                                                backgroundColor: colors.brand.bg.primary,
                                                opacity: choice.disabled ? 0.5 : 1,
                                                flexDirection: 'row',
                                            },
                                        ]}
                                    >
                                        <View style={[styles.choiceIcon, { backgroundColor: colors.chrome.common.primaryTint }]}>
                                            {busy ? (
                                                <ActivityIndicator size='small' color={colors.chrome.primary} />
                                            ) : choice.kind === 'apple_iap' ? (
                                                <Apple size={scale(20)} color={colors.chrome.primary} />
                                            ) : choice.kind === 'google_play' ? (
                                                <Play size={scale(20)} color={colors.chrome.primary} fill={colors.chrome.primary} />
                                            ) : (
                                                <CreditCard size={scale(20)} color={colors.chrome.primary} />
                                            )}
                                        </View>
                                        <View style={styles.choiceCopy}>
                                            <Text variant='body' className='font-body-semi'>
                                                {busy ? t('processing_payment', 'Processing payment...') : choice.label}
                                            </Text>
                                            <Text
                                                variant='caption'
                                                numberOfLines={2}
                                                style={{ color: colors.brand.text.subtitle }}
                                            >
                                                {choice.description}
                                            </Text>
                                        </View>
                                        {choice.price ? (
                                            <Text
                                                variant='body-sm'
                                                className='font-body-bold'
                                                style={{ color: busy ? colors.brand.text.muted : colors.brand.text.heading }}
                                            >
                                                {choice.price}
                                            </Text>
                                        ) : null}
                                    </PressableScale>
                                );
                            })}
                        </View>

                        <Text
                            variant='caption'
                            style={[styles.note, { color: colors.brand.text.muted, textAlign: isRTL ? 'right' : 'left' }]}
                        >
                            {Platform.OS === 'ios'
                                ? t('payment_choice_ios_note', 'App Store purchases are handled by Apple. Card payments open secure web checkout.')
                                : t('payment_choice_android_note', 'Google Play purchases are handled by Google. Card payments open secure web checkout.')}
                        </Text>
                    </BottomSheetView>
                </BottomSheet>
            </GestureHandlerRootView>
        </Modal>
    );
}

const styles = StyleSheet.create({
    fill: { flex: 1 },
    content: {
        flex: 1,
        paddingHorizontal: scale(18),
    },
    header: {
        alignItems: 'flex-start',
        justifyContent: 'space-between',
        gap: scale(12),
        paddingTop: scale(8),
        paddingBottom: scale(16),
    },
    heading: { flex: 1, gap: scale(3) },
    title: { fontSize: scale(19) },
    close: {
        width: scale(38),
        height: scale(38),
        borderRadius: scale(19),
        alignItems: 'center',
        justifyContent: 'center',
    },
    choices: { gap: scale(10) },
    choice: {
        minHeight: scale(68),
        borderWidth: 1,
        borderRadius: scale(8),
        paddingHorizontal: scale(12),
        paddingVertical: scale(10),
        alignItems: 'center',
        gap: scale(11),
    },
    choiceIcon: {
        width: scale(40),
        height: scale(40),
        borderRadius: scale(8),
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
    },
    choiceCopy: { flex: 1, minWidth: 0, gap: scale(2) },
    note: {
        marginTop: scale(14),
        lineHeight: scale(18),
    },
});
