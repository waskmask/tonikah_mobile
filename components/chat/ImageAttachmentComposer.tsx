import React, { useEffect } from 'react';
import {
    ActivityIndicator,
    Modal,
    Platform,
    Pressable,
    StatusBar,
    StyleSheet,
    TextInput,
    View,
} from 'react-native';
import { Image } from 'expo-image';
import { Send, X } from 'lucide-react-native';
import Reanimated, { interpolate, useAnimatedStyle } from 'react-native-reanimated';
import {
    AndroidSoftInputModes,
    KeyboardController,
    useKeyboardContext,
} from 'react-native-keyboard-controller';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ViewOnceIcon } from '@/components/chat/ViewOnceIcon';
import { scale } from '@/hooks/useResponsive';

export const IMAGE_CAPTION_LIMIT = 500;

/** Opaque bar — prevents white flash through transparent layers during keyboard animation. */
const FOOTER_BG = '#141C28';

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
}: Props) {
    const insets = useSafeAreaInsets();
    const bottomInset = Math.max(insets.bottom, scale(8));
    const { reanimated } = useKeyboardContext();

    useEffect(() => {
        // Opened from the conversation screen, which already runs ADJUST_NOTHING.
        // Re-assert it for the modal window but let the parent screen own resetting it,
        // so closing the modal doesn't clobber the conversation keyboard behavior.
        if (!visible || Platform.OS !== 'android') return;
        KeyboardController.setInputMode(AndroidSoftInputModes.SOFT_INPUT_ADJUST_NOTHING);
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
            onRequestClose={onClose}
        >
            <StatusBar barStyle="light-content" backgroundColor="#000000" />
            <View style={styles.root} collapsable={false}>
                {/* Image fills the screen via flex; the composer floats over it (absolute), so
                    opening the keyboard never resizes the image. ADJUST_NOTHING keeps it fixed. */}
                <View
                    style={[styles.imageStage, { paddingTop: insets.top + scale(8), paddingBottom: scale(80) }]}
                    collapsable={false}
                >
                    {!!uri && (
                        <Image
                            source={{ uri }}
                            style={styles.image}
                            contentFit="contain"
                            transition={0}
                        />
                    )}
                </View>

                <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={labels.closeA11y}
                    onPress={onClose}
                    disabled={uploading}
                    style={[styles.closeButton, { top: insets.top + scale(10) }]}
                >
                    <X size={scale(22)} color="#FFFFFF" strokeWidth={2.6} />
                </Pressable>

                <Reanimated.View style={[styles.barWrap, barLiftStyle]} collapsable={false}>
                    <Reanimated.View style={[styles.bar, barPadStyle]} collapsable={false}>
                        <View style={styles.composer}>
                            <Pressable
                                accessibilityRole="button"
                                accessibilityLabel={labels.viewOnceA11y}
                                accessibilityState={{ selected: viewOnce }}
                                onPress={onToggleViewOnce}
                                disabled={uploading}
                                style={styles.viewOnceButton}
                            >
                                <ViewOnceIcon
                                    size={scale(36)}
                                    color={viewOnce ? colors.primary : '#D8CFC2'}
                                    active={viewOnce}
                                />
                            </Pressable>

                            <TextInput
                                value={caption}
                                onChangeText={(value) => onChangeCaption(value.slice(0, IMAGE_CAPTION_LIMIT))}
                                editable={!uploading}
                                maxLength={IMAGE_CAPTION_LIMIT}
                                placeholder={labels.captionPlaceholder}
                                placeholderTextColor={colors.subtle}
                                style={[
                                    styles.captionInput,
                                    {
                                        fontFamily: inputFontFamily,
                                        textAlign: isRTL ? 'right' : 'left',
                                    },
                                ]}
                                multiline
                            />

                            <Pressable
                                accessibilityRole="button"
                                accessibilityLabel={labels.sendA11y}
                                onPress={onSend}
                                disabled={uploading || !uri}
                                style={[
                                    styles.sendButton,
                                    { backgroundColor: colors.primary },
                                    (uploading || !uri) && styles.sendDisabled,
                                ]}
                            >
                                {uploading
                                    ? <ActivityIndicator color={colors.inverse} size="small" />
                                    : <Send size={scale(18)} color={colors.inverse} />}
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
    closeButton: {
        position: 'absolute',
        left: scale(12),
        width: scale(42),
        height: scale(42),
        borderRadius: scale(21),
        backgroundColor: 'rgba(24, 19, 14,0.55)',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 2,
    },
    barWrap: {
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: 0,
    },
    bar: {
        backgroundColor: FOOTER_BG,
        elevation: 0,
        shadowOpacity: 0,
    },
    composer: {
        flexDirection: 'row',
        alignItems: 'flex-end',
        gap: scale(8),
        paddingHorizontal: scale(10),
        paddingVertical: scale(10),
        backgroundColor: FOOTER_BG,
    },
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
        borderRadius: scale(22),
        paddingHorizontal: scale(14),
        paddingTop: scale(10),
        paddingBottom: scale(10),
        fontSize: scale(15),
        lineHeight: scale(20),
        color: '#FFFFFF',
        backgroundColor: 'rgba(255,255,255,0.12)',
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
