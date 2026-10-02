import React, { useEffect, useRef, useState } from 'react';
import {
    ActivityIndicator,
    Keyboard,
    Modal,
    Pressable,
    StatusBar,
    StyleSheet,
    TextInput,
    View,
} from 'react-native';
import { Image } from 'expo-image';
import { X } from '@/components/ui/icons/PhosphorCompat';
import { ArrowClockwise, ArrowCounterClockwise, Crop, NumberCircleOne, PaperPlaneTilt } from 'phosphor-react-native';
import Reanimated, { interpolate, useAnimatedStyle } from 'react-native-reanimated';
import {
    useKeyboardContext,
} from 'react-native-keyboard-controller';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { scale } from '@/hooks/useResponsive';
import { Text } from '@/components/ui/Text';
import { translateChatText } from '@/lib/chatDisplay';
import { ChatImageCropEditor, type ChatImageCropEditorRef } from '@/components/chat/ChatImageCropEditor';
import type { ImageSize } from '@/lib/chatImageCrop';

export const IMAGE_CAPTION_LIMIT = 500;

/** Opaque bar — prevents white flash through transparent layers during keyboard animation. */
const MEDIA_PREVIEW = { footer: '#18181A', field: '#252527', text: '#FFFFFF', placeholder: '#B8B8BE' };

type ChatColors = {
    primary: string;
    inverse: string;
    subtle: string;
};

type Props = {
    visible: boolean;
    uri: string | null;
    sourceSize?: ImageSize;
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
    onApplyCrop: (result: { uri: string; width: number; height: number }) => void;
    onCropError: () => void;
    onReset?: () => void;
    cropLabel?: string;
    resetLabel?: string;
    cancelLabel: string;
    rotateLabel: string;
    doneLabel: string;
};

export function ImageAttachmentComposer({
    visible,
    uri,
    sourceSize,
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
    onApplyCrop,
    onCropError,
    onReset,
    cropLabel,
    resetLabel,
    cancelLabel,
    rotateLabel,
    doneLabel,
}: Props) {
    const insets = useSafeAreaInsets();
    const bottomInset = Math.max(insets.bottom, scale(8));
    const { reanimated } = useKeyboardContext();
    const [footerHeight, setFooterHeight] = useState(scale(80));
    const [imageState, setImageState] = useState<'loading' | 'ready' | 'error'>('loading');
    const [imageAttempt, setImageAttempt] = useState(0);
    const [keyboardVisible, setKeyboardVisible] = useState(false);
    const [cropMode, setCropMode] = useState(false);
    const [cropBusy, setCropBusy] = useState(false);
    const cropEditorRef = useRef<ChatImageCropEditorRef>(null);

    useEffect(() => {
        setImageState('loading');
        setImageAttempt(0);
    }, [uri]);

    useEffect(() => {
        if (!visible) setCropMode(false);
    }, [visible]);

    useEffect(() => {
        const show = Keyboard.addListener('keyboardDidShow', () => setKeyboardVisible(true));
        const hide = Keyboard.addListener('keyboardDidHide', () => setKeyboardVisible(false));
        return () => { show.remove(); hide.remove(); };
    }, []);

    const handleClose = () => {
        if (cropMode) {
            if (!cropBusy) setCropMode(false);
            return;
        }
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

    // height is negative when the keyboard is open -> bar moves up by the keyboard height.
    const barLiftStyle = useAnimatedStyle(() => ({
        transform: [{ translateY: cropMode ? 0 : reanimated.height.value }],
    }));

    const barPadStyle = useAnimatedStyle(() => ({
        paddingBottom: cropMode ? bottomInset : interpolate(reanimated.progress.value, [0, 1], [bottomInset, 0]),
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
                <View style={[styles.imageStage, { paddingTop: insets.top + scale(8), paddingBottom: footerHeight + scale(8) }]} collapsable={false}>
                    {cropMode && uri ? (
                        <ChatImageCropEditor
                            ref={cropEditorRef}
                            uri={uri}
                            sourceSize={sourceSize}
                            onDone={(result) => { setCropMode(false); onApplyCrop(result); }}
                            onError={onCropError}
                            onBusyChange={setCropBusy}
                        />
                    ) : (
                        <Pressable onPress={Keyboard.dismiss} style={styles.imageCanvas}>
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
                    )}
                </View>

                {!cropMode && <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={labels.closeA11y}
                    onPress={handleClose}
                    disabled={uploading}
                    style={[styles.closeButton, { top: insets.top + scale(10) }]}
                >
                    <X size={scale(22)} color="#FFFFFF" strokeWidth={2.6} />
                </Pressable>}
                {!cropMode && <View style={[styles.editToolbar, { top: insets.top + scale(10) }]}>
                    {!!onCrop && <Pressable accessibilityRole="button" accessibilityLabel={cropLabel || 'Crop'} onPress={() => { Keyboard.dismiss(); onCrop(); setCropMode(true); }} disabled={uploading || imageState !== 'ready'} style={styles.editButton}>
                        <Crop size={scale(21)} color={imageState === 'ready' ? MEDIA_PREVIEW.text : colors.subtle} />
                    </Pressable>}
                    {!!onReset && <Pressable accessibilityRole="button" accessibilityLabel={resetLabel || 'Reset'} onPress={onReset} disabled={uploading} style={styles.editButton}>
                        <ArrowCounterClockwise size={scale(21)} color={MEDIA_PREVIEW.text} />
                    </Pressable>}
                </View>}

                <Reanimated.View style={[styles.barWrap, barLiftStyle]} collapsable={false}>
                    <Reanimated.View style={[styles.bar, barPadStyle]} onLayout={(event) => setFooterHeight(event.nativeEvent.layout.height)} collapsable={false}>
                        {cropMode ? (
                            <View style={[styles.cropActions, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
                                <Pressable accessibilityRole="button" onPress={() => setCropMode(false)} disabled={cropBusy} style={styles.cropTextButton}>
                                    <Text style={styles.cropActionText}>{cancelLabel}</Text>
                                </Pressable>
                                <Pressable accessibilityRole="button" accessibilityLabel={rotateLabel} onPress={() => cropEditorRef.current?.rotate()} disabled={cropBusy} style={styles.cropRotateButton}>
                                    <ArrowClockwise size={scale(24)} color={MEDIA_PREVIEW.text} />
                                </Pressable>
                                <Pressable accessibilityRole="button" onPress={() => void cropEditorRef.current?.save()} disabled={cropBusy} style={[styles.cropTextButton, styles.cropDoneButton]}>
                                    {cropBusy ? <ActivityIndicator color={MEDIA_PREVIEW.text} /> : <Text style={styles.cropDoneText}>{doneLabel}</Text>}
                                </Pressable>
                            </View>
                        ) : <View style={styles.composer}>
                            <View style={[styles.captionPill, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
                                <TextInput
                                    value={caption}
                                    onChangeText={(value) => onChangeCaption(value.slice(0, IMAGE_CAPTION_LIMIT))}
                                    editable={!uploading}
                                    maxLength={IMAGE_CAPTION_LIMIT}
                                    placeholder={labels.captionPlaceholder}
                                    placeholderTextColor={MEDIA_PREVIEW.placeholder}
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
                        </View>}
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
    imageCanvas: { flex: 1 },
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
    cropActions: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: scale(64), paddingHorizontal: scale(20), backgroundColor: MEDIA_PREVIEW.footer },
    cropTextButton: { minWidth: scale(72), minHeight: scale(48), justifyContent: 'center' },
    cropDoneButton: { alignItems: 'flex-end' },
    cropRotateButton: { width: scale(48), height: scale(48), alignItems: 'center', justifyContent: 'center' },
    cropActionText: { color: MEDIA_PREVIEW.text, fontSize: scale(15) },
    cropDoneText: { color: '#F34B6F', fontSize: scale(15), fontWeight: '600' },
    captionPill: { flex: 1, minHeight: scale(44), maxHeight: scale(120), borderRadius: scale(22), backgroundColor: MEDIA_PREVIEW.field, borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(255,255,255,0.38)', alignItems: 'flex-end' },
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
