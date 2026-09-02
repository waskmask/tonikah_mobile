import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, StyleSheet, TextInput, View } from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';
import { X } from 'lucide-react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { GradientButton } from '@/components/ui/GradientButton';
import { Text } from '@/components/ui/Text';
import { useColors } from '@/hooks/useColors';
import { useLanguage } from '@/hooks/useLanguage';
import { scale } from '@/hooks/useResponsive';
import { t } from '@/lib/profileDisplay';

type Props = {
    visible: boolean;
    busy: boolean;
    error: string;
    onClose: () => void;
    onRedeem: (code: string, pin: string) => void;
};

const cleanCode = (value: string) => value.toUpperCase().replace(/^TGC-/, '').replace(/[^A-Z0-9]/g, '').slice(0, 8);
const cleanPin = (value: string) => value.replace(/\D/g, '').slice(0, 4);

export function GiftCardRedemptionSheet({ visible, busy, error, onClose, onRedeem }: Props) {
    const colors = useColors();
    const { isRTL } = useLanguage();
    const pinRef = useRef<TextInput>(null);
    const [code, setCode] = useState('');
    const [pin, setPin] = useState('');

    useEffect(() => {
        if (!visible) {
            setCode('');
            setPin('');
        }
    }, [visible]);

    const canSubmit = code.length === 8 && pin.length === 4 && !busy;

    return (
        <Modal
            visible={visible}
            animationType='slide'
            presentationStyle='fullScreen'
            onRequestClose={() => {
                if (!busy) onClose();
            }}
        >
            <SafeAreaView style={[styles.screen, { backgroundColor: colors.brand.bg.surface }]} edges={['top', 'bottom']}>
                <View style={[styles.header, { borderBottomColor: colors.brand.bg.border }]}>
                    <Pressable
                        onPress={onClose}
                        disabled={busy}
                        hitSlop={10}
                        accessibilityRole='button'
                        accessibilityLabel={t('close', 'Close')}
                        style={[styles.close, { backgroundColor: colors.chrome.header.iconBackground }]}
                    >
                        <X size={scale(19)} color={colors.chrome.header.icon} />
                    </Pressable>
                    <Text variant='body' className='font-body-bold' style={styles.title} numberOfLines={1}>
                        {t('redeem_gift_card', 'Redeem gift card')}
                    </Text>
                    <View style={styles.close} />
                </View>

                <KeyboardAwareScrollView
                    style={styles.scroll}
                    contentContainerStyle={styles.content}
                    bottomOffset={scale(28)}
                    keyboardShouldPersistTaps='handled'
                >
                    <Text variant='body-sm' style={{ color: colors.brand.text.subtitle, lineHeight: scale(21) }}>
                        {t('gift_card_helper', 'Enter the gift card code and 4-digit PIN.')}
                    </Text>

                    <View style={styles.fieldGroup}>
                        <Text variant='body-sm' className='font-body-semi'>
                            {t('gift_card_code_label', 'Gift card code')}
                        </Text>
                        <View
                            style={[
                                styles.codeField,
                                { backgroundColor: colors.chrome.common.card, borderColor: error ? colors.brand.accent.error : colors.brand.bg.border },
                            ]}
                        >
                            <View style={[styles.prefix, { borderRightColor: colors.brand.bg.border }]}>
                                <Text variant='body-sm' className='font-body-bold'>TGC-</Text>
                            </View>
                            <TextInput
                                value={code}
                                onChangeText={(value) => setCode(cleanCode(value))}
                                placeholder='F0DC8BC7'
                                placeholderTextColor={colors.brand.text.muted}
                                autoCapitalize='characters'
                                autoCorrect={false}
                                maxLength={8}
                                returnKeyType='next'
                                onSubmitEditing={() => pinRef.current?.focus()}
                                textAlign={isRTL ? 'right' : 'left'}
                                style={[styles.input, { color: colors.brand.text.heading }]}
                            />
                        </View>
                    </View>

                    <View style={styles.fieldGroup}>
                        <Text variant='body-sm' className='font-body-semi'>
                            {t('gift_card_pin_label', '4-digit PIN')}
                        </Text>
                        <TextInput
                            ref={pinRef}
                            value={pin}
                            onChangeText={(value) => setPin(cleanPin(value))}
                            placeholder='1234'
                            placeholderTextColor={colors.brand.text.muted}
                            keyboardType='number-pad'
                            maxLength={4}
                            secureTextEntry
                            textContentType='oneTimeCode'
                            autoComplete='one-time-code'
                            textAlign='center'
                            style={[
                                styles.pinInput,
                                {
                                    color: colors.brand.text.heading,
                                    backgroundColor: colors.chrome.common.card,
                                    borderColor: error ? colors.brand.accent.error : colors.brand.bg.border,
                                },
                            ]}
                        />
                    </View>

                    {error ? (
                        <Text variant='body-sm' className='font-body-semi' style={{ color: colors.brand.accent.error }}>
                            {error}
                        </Text>
                    ) : null}
                </KeyboardAwareScrollView>

                <View style={[styles.footer, { borderTopColor: colors.brand.bg.border, backgroundColor: colors.brand.bg.surface }]}>
                    <GradientButton
                        title={busy ? t('redeeming_gift_card', 'Redeeming...') : t('redeem_gift_card', 'Redeem gift card')}
                        onPress={() => onRedeem(`TGC-${code}`, pin)}
                        disabled={!canSubmit}
                        loading={busy}
                        widthMode='full'
                        height={48}
                        textSize={15}
                    />
                </View>
            </SafeAreaView>
        </Modal>
    );
}

const styles = StyleSheet.create({
    screen: { flex: 1 },
    header: {
        minHeight: scale(56),
        borderBottomWidth: StyleSheet.hairlineWidth,
        paddingHorizontal: scale(12),
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    close: { width: scale(40), height: scale(40), borderRadius: scale(20), alignItems: 'center', justifyContent: 'center' },
    title: { flex: 1, textAlign: 'center', fontSize: scale(16) },
    scroll: { flex: 1 },
    content: { width: '100%', maxWidth: 560, alignSelf: 'center', padding: scale(20), gap: scale(22) },
    fieldGroup: { gap: scale(8) },
    codeField: { minHeight: scale(52), borderWidth: 1, borderRadius: scale(8), flexDirection: 'row', alignItems: 'center', overflow: 'hidden' },
    prefix: { height: '100%', justifyContent: 'center', paddingHorizontal: scale(14), borderRightWidth: 1 },
    input: { flex: 1, minWidth: 0, height: scale(52), paddingHorizontal: scale(12), fontSize: scale(16), fontWeight: '600', letterSpacing: 1.2 },
    pinInput: { height: scale(52), borderWidth: 1, borderRadius: scale(8), paddingHorizontal: scale(12), fontSize: scale(19), fontWeight: '700', letterSpacing: 5 },
    footer: { borderTopWidth: StyleSheet.hairlineWidth, paddingHorizontal: scale(20), paddingTop: scale(12), paddingBottom: scale(12) },
});
