import React, { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Keyboard,
    Modal,
    Platform,
    Pressable,
    StatusBar,
    StyleSheet,
    TextInput,
    View,
} from 'react-native';
import { Image } from 'expo-image';
import { X } from '@/components/ui/icons/PhosphorCompat';
import { ArrowCounterClockwise, Crop, NumberCircleOne, PaperPlaneTilt } from 'phosphor-react-native';
import Reanimated, { interpolate, useAnimatedStyle } from 'react-native-reanimated';
import {
    AndroidSoftInputModes,
    KeyboardController,
    useKeyboardContext,
} from 'react-native-keyboard-controller';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { scale } from '@/hooks/useResponsive';
import { Text } from '@/components/ui/Text';
import { translateChatText } from '@/lib/chatDisplay';

export const IMAGE_CAPTION_LIMIT = 500;

/** Opaque bar — prevents white flash through transparent layers during keyboard animation. */
const MEDIA_PREVIEW = { footer: '#141C28', field: '#303945', text: '#FFFFFF' };

type ChatColors = {
    primary: string;
    inverse: string;
    subtle: string;
};

type Props = {
    visible: boolean;
    uri: string | null;
    caption: string;
    viewOnce: boolean;
    uploading: boolean;
    colors: ChatColors;
    // undefined on iOS where the system font is used
    inputFontFamily: string | undefined;
    isRTL: boolean;
    labels: {
        captionPlaceholder: string;
        closeA11y: string;
        viewOnceA11y: string;
        sendA11y: string;
    };
    onChangeCaption: (value: string) => void;
    onToggleViewOnce: () => void;
    onClose: () => void;
    onSend: () => void;
    onCrop?: () => void;
    onReset?: () => void;
    cropLabel?: string;
    resetLabel?: string;
};

export function ImageAttachmentComposer({
    visible,
    uri,
    caption,
    viewOnce,
    uploading,
    colors,
    inputFontFamily,
    isRTL,
    labels,
    onChangeCaption,
    onToggleViewOnce,
    onClose,
    onSend,
    onCrop,
    onReset,
    cropLabel,
    resetLabel,
}: Props) {
    const insets = useSafeAreaInsets();
    const bottomInset = Math.max(insets.bottom, scale(8));
    const { reanimated } = useKeyboardContext();
    const [footerHeight, setFooterHeight] = useState(scale(80));
    const [imageState, setImageState] = useState<'loading' | 'ready' | 'error'>('loading');
    const [imageAttempt, setImageAttempt] = useState(0);
    const [keyboardVisible, setKeyboardVisible] = useState(false);

    useEffect(() => {
        setImageState('loading');
        setImageAttempt(0);
    }, [uri]);

    useEffect(() => {
        const show = Keyboard.addListener('keyboardDidShow', () => setKeyboardVisible(true));
        const hide = Keyboard.addListener('keyboardDidHide', () => setKeyboardVisible(false));
        return () => { show.remove(); hide.remove(); };
    }, []);

    const handleClose = () => {
        if (keyboardVisible) {
            Keyboard.dismiss();
            return;
        }
        onClose();
    };

    const handleSend = () => {
        if (uploading || imageState !== 'ready') return;
        onSend();
    };

    useEffect(() => {
        // Keep the image preview fixed while its caption keyboard is open.
        if (!visible || Platform.OS !== 'android') return;
        KeyboardController.setInputMode(AndroidSoftInputModes.SOFT_INPUT_ADJUST_NOTHING);
        return () => {
            KeyboardController.setInputMode(AndroidSoftInputModes.SOFT_INPUT_ADJUST_RESIZE);
        };
    }, [visible]);

    // height is negative when the keyboard is open -> bar moves up by the keyboard height.
    const barLiftStyle = useAnimatedStyle(() => ({
        transform: [{ translateY: reanimated.height.value }],
    }));

    const barPadStyle = useAnimatedStyle(() => ({
        paddingBottom: interpolate(reanimated.progress.value, [0, 1], [bottomInset, 0]),
    }));

    return (
        <Modal
            visible={visible}
            animationType="fade"
            statusBarTranslucent
            onRequestClose={handleClose}
        >
            <StatusBar barStyle="light-content" backgroundColor="#000000" />
            <View style={styles.root} collapsable={false}>
                {/* Image fills the screen via flex; the composer floats over it (absolute), so
                    opening the keyboard never resizes the image. ADJUST_NOTHING keeps it fixed. */}
                <Pressable
                    onPress={Keyboard.dismiss}
                    style={[styles.imageStage, { paddingTop: insets.top + scale(8), paddingBottom: footerHeight + scale(8) }]}
                    collapsable={false}
                >
                    {!!uri && (
                        <Image
                            key={`${uri}:${imageAttempt}`}
                            source={{ uri }}
                            style={styles.image}
                            contentFit="contain"
                            transition={0}
                            onLoad={() => setImageState('ready')}
                            onError={() => setImageState('error')}
                        />
                    )}
                    {imageState === 'loading' && <ActivityIndicator style={styles.imageStatus} color={MEDIA_PREVIEW.text} />}
                    {imageState === 'error' && (
                        <View style={styles.imageError}>
                            <Text style={{ color: MEDIA_PREVIEW.text }}>{translateChatText('image_unavailable', 'Could not open this image.')}</Text>
                            <Pressable onPress={() => { setImageState('loading'); setImageAttempt((value) => value + 1); }} style={styles.retryButton}>
                                <Text style={{ color: MEDIA_PREVIEW.text }}>{translateChatText('retry', 'Retry')}</Text>
                            </Pressable>
                        </View>
                    )}
                </Pressable>

                <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={labels.closeA11y}
                    onPress={handleClose}
                    disabled={uploading}
                    style={[styles.closeButton, { top: insets.top + scale(10) }]}
                >
                    <X size={scale(22)} color="#FFFFFF" strokeWidth={2.6} />
                </Pressable>
                <View style={[styles.editToolbar, { top: insets.top + scale(10) }]}>
                    {!!onCrop && <Pressable accessibilityRole="button" accessibilityLabel={cropLabel || 'Crop'} onPress={onCrop} disabled={uploading || imageState !== 'ready'} style={styles.editButton}>
                        <Crop size={scale(21)} color={imageState === 'ready' ? MEDIA_PREVIEW.text : colors.subtle} />
                    </Pressable>}
                    {!!onReset && <Pressable accessibilityRole="button" accessibilityLabel={resetLabel || 'Reset'} onPress={onReset} disabled={uploading} style={styles.editButton}>
                        <ArrowCounterClockwise size={scale(21)} color={MEDIA_PREVIEW.text} />
                    </Pressable>}
                </View>

                <Reanimated.View style={[styles.barWrap, barLiftStyle]} collapsable={false}>
                    <Reanimated.View style={[styles.bar, barPadStyle]} onLayout={(event) => setFooterHeight(event.nativeEvent.layout.height)} collapsable={false}>
                        <View style={styles.composer}>
                            <View style={[styles.captionPill, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
                                <TextInput
                                    value={caption}
                                    onChangeText={(value) => onChangeCaption(value.slice(0, IMAGE_CAPTION_LIMIT))}
                                    editable={!uploading}
                                    maxLength={IMAGE_CAPTION_LIMIT}
                                    placeholder={labels.captionPlaceholder}
                                    placeholderTextColor={colors.subtle}
                                    style={[styles.captionInput, { fontFamily: inputFontFamily, textAlign: isRTL ? 'right' : 'left' }]}
                                    multiline
                                />
                                <Pressable
                                    accessibilityRole="button"
                                    accessibilityLabel={labels.viewOnceA11y}
                                    accessibilityState={{ selected: viewOnce }}
                                    onPress={onToggleViewOnce}
                                    disabled={uploading}
                                    style={styles.viewOnceButton}
                                >
                                    <NumberCircleOne size={scale(24)} color={viewOnce ? colors.primary : '#DEDEE2'} weight={viewOnce ? 'fill' : 'regular'} />
                                </Pressable>
                            </View>

                            <Pressable
                                accessibilityRole="button"
                                accessibilityLabel={labels.sendA11y}
                                onPress={handleSend}
                                disabled={uploading || imageState !== 'ready'}
                                style={[
                                    styles.sendButton,
                                    { backgroundColor: colors.primary },
                                ]}
                            >
                                {uploading
                                    ? <ActivityIndicator color={colors.inverse} size="small" />
                                    : <PaperPlaneTilt size={scale(20)} color={imageState === 'ready' ? colors.inverse : colors.subtle} weight="fill" />}
                            </Pressable>
                        </View>
                    </Reanimated.View>
                </Reanimated.View>
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    root: {
        flex: 1,
        backgroundColor: '#000000',
    },
    imageStage: {
        flex: 1,
    },
    image: {
        flex: 1,
        width: '100%',
    },
    imageStatus: { position: 'absolute', alignSelf: 'center', top: '50%' },
    imageError: { position: 'absolute', alignSelf: 'center', top: '44%', alignItems: 'center', gap: scale(12) },
    retryButton: { paddingHorizontal: scale(20), paddingVertical: scale(10), borderRadius: scale(8), backgroundColor: MEDIA_PREVIEW.field },
    closeButton: {
        position: 'absolute',
        left: scale(12),
        width: scale(42),
        height: scale(42),
        borderRadius: scale(21),
        backgroundColor: 'rgba(16, 16, 17,0.55)',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 2,
    },
    editToolbar: { position: 'absolute', right: scale(12), zIndex: 2, flexDirection: 'row', gap: scale(8) },
    editButton: { width: scale(42), height: scale(42), borderRadius: scale(21), backgroundColor: 'rgba(16,16,17,0.55)', alignItems: 'center', justifyContent: 'center' },
    barWrap: {
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: 0,
    },
    bar: {
        backgroundColor: MEDIA_PREVIEW.footer,
        elevation: 0,
        shadowOpacity: 0,
    },
    composer: {
        flexDirection: 'row',
        alignItems: 'flex-end',
        gap: scale(8),
        paddingHorizontal: scale(10),
        paddingVertical: scale(10),
        backgroundColor: MEDIA_PREVIEW.footer,
    },
    captionPill: { flex: 1, minHeight: scale(44), maxHeight: scale(120), borderRadius: scale(22), backgroundColor: MEDIA_PREVIEW.field, alignItems: 'flex-end' },
    viewOnceButton: {
        width: scale(44),
        height: scale(44),
        alignItems: 'center',
        justifyContent: 'center',
    },
    captionInput: {
        flex: 1,
        minHeight: scale(44),
        maxHeight: scale(120),
        paddingHorizontal: scale(14),
        paddingTop: scale(10),
        paddingBottom: scale(10),
        fontSize: scale(15),
        lineHeight: scale(20),
        color: MEDIA_PREVIEW.text,
    },
    sendButton: {
        width: scale(44),
        height: scale(44),
        borderRadius: scale(22),
        alignItems: 'center',
        justifyContent: 'center',
    },
    sendDisabled: {
        opacity: 0.55,
    },
});
