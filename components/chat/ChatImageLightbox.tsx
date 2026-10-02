import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Modal, PixelRatio, Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, { runOnJS, useAnimatedReaction, useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
import { RefreshCw, X } from '@/components/ui/icons/PhosphorCompat';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { cacheChatMedia } from '@/lib/chatMediaCache';
import type { MessageMedia } from '@/lib/chatService';
import { t } from '@/lib/profileDisplay';

export type ChatImagePreview = {
    userId: string;
    conversationId: string;
    messageId: string;
    media: MessageMedia;
    initialUri: string;
};

export function ChatImageLightbox({ preview, onClose, onCached }: { preview: ChatImagePreview; onClose: () => void; onCached: (uri: string) => void }) {
    const { width, height } = useWindowDimensions();
    const insets = useSafeAreaInsets();
    const headerHeight = insets.top + 58;
    const [imageUri, setImageUri] = useState(preview.initialUri);
    const hasLocalImage = preview.initialUri.startsWith('file://') || !!preview.media.localUri;
    const [loading, setLoading] = useState(!hasLocalImage);
    const [fullReady, setFullReady] = useState(hasLocalImage);
    const [error, setError] = useState(false);
    const [retry, setRetry] = useState(0);
    const [headerHidden, setHeaderHidden] = useState(false);
    const zoom = useSharedValue(1);
    const zoomStart = useSharedValue(1);
    const maxZoom = useSharedValue(2);
    const fittedWidth = useSharedValue(width);
    const fittedHeight = useSharedValue(height);
    const x = useSharedValue(0);
    const y = useSharedValue(0);
    const startX = useSharedValue(0);
    const startY = useSharedValue(0);
    const dismissY = useSharedValue(0);
    const entrance = useSharedValue(0);

    useEffect(() => {
        entrance.value = withTiming(1, { duration: 180 });
    }, [entrance]);

    useEffect(() => {
        let active = true;
        if (hasLocalImage && retry === 0) return;
        setLoading(true);
        setError(false);
        void cacheChatMedia({
            userId: preview.userId,
            conversationId: preview.conversationId,
            messageId: preview.messageId,
            media: preview.media,
            kind: 'image',
        }).then(({ uri }) => {
            if (active) {
                setFullReady(false);
                setImageUri(uri);
                onCached(uri);
            }
        }).catch(() => {
            if (active) setError(true);
        }).finally(() => {
            if (active) setLoading(false);
        });
        return () => { active = false; };
    }, [hasLocalImage, onCached, preview, retry]);

    const pinch = Gesture.Pinch()
        .onStart(() => {
            zoomStart.value = zoom.value;
        })
        .onUpdate((event) => {
            zoom.value = Math.max(1, Math.min(maxZoom.value, zoomStart.value * event.scale));
        })
        .onEnd(() => {
            zoomStart.value = zoom.value;
            const maxX = Math.max(0, (fittedWidth.value * zoom.value - width) / 2);
            const maxY = Math.max(0, (fittedHeight.value * zoom.value - height) / 2);
            x.value = withSpring(Math.max(-maxX, Math.min(maxX, x.value)));
            y.value = withSpring(Math.max(-maxY, Math.min(maxY, y.value)));
        });

    const pan = Gesture.Pan()
        .maxPointers(1)
        .minDistance(5)
        .onStart(() => {
            startX.value = x.value;
            startY.value = y.value;
        })
        .onUpdate((event) => {
            if (zoom.value > 1.01) {
                const maxX = Math.max(0, (fittedWidth.value * zoom.value - width) / 2);
                const maxY = Math.max(0, (fittedHeight.value * zoom.value - height) / 2);
                x.value = Math.max(-maxX, Math.min(maxX, startX.value + event.translationX));
                y.value = Math.max(-maxY, Math.min(maxY, startY.value + event.translationY));
            } else if (event.translationY > 0 && Math.abs(event.translationY) > Math.abs(event.translationX)) {
                dismissY.value = event.translationY;
            }
        })
        .onEnd((event) => {
            if (zoom.value > 1.01) return;
            if (event.translationY > 96 || (event.translationY > 48 && event.velocityY > 700)) {
                dismissY.value = withTiming(height, { duration: 150 });
            } else {
                dismissY.value = withSpring(0, { damping: 18, stiffness: 220 });
            }
        });

    const doubleTap = Gesture.Tap()
        .numberOfTaps(2)
        .maxDelay(260)
        .onEnd((event, success) => {
            if (!success) return;
            if (zoom.value > 1.01) {
                zoom.value = withTiming(1, { duration: 180 });
                zoomStart.value = 1;
                x.value = withTiming(0, { duration: 180 });
                y.value = withTiming(0, { duration: 180 });
                return;
            }
            const targetZoom = maxZoom.value;
            const maxX = Math.max(0, (fittedWidth.value * targetZoom - width) / 2);
            const maxY = Math.max(0, (fittedHeight.value * targetZoom - height) / 2);
            zoom.value = withTiming(targetZoom, { duration: 180 });
            zoomStart.value = targetZoom;
            x.value = withTiming(Math.max(-maxX, Math.min(maxX, -(event.x - width / 2) * (targetZoom - 1))), { duration: 180 });
            y.value = withTiming(Math.max(-maxY, Math.min(maxY, -(event.y - height / 2) * (targetZoom - 1))), { duration: 180 });
        });

    const imageStyle = useAnimatedStyle(() => ({
        opacity: 0.78 + entrance.value * 0.22,
        transform: [
            { translateX: x.value },
            { translateY: y.value + dismissY.value },
            { scale: zoom.value * (1.025 - entrance.value * 0.025) },
        ],
    }));
    const backdropStyle = useAnimatedStyle(() => ({
        opacity: 1 - Math.min(dismissY.value / Math.max(height * 0.5, 1), 0.8),
    }));
    const headerStyle = useAnimatedStyle(() => {
        const imageTop = (height - fittedHeight.value * zoom.value) / 2 + y.value + dismissY.value;
        const overlap = Math.max(0, Math.min(1, (headerHeight - imageTop) / 40));
        const zoomed = Math.max(0, Math.min(1, (zoom.value - 1) * 4));
        return { opacity: (1 - overlap * zoomed) * (1 - Math.min(dismissY.value / 140, 1)) };
    });
    useAnimatedReaction(
        () => {
            const imageTop = (height - fittedHeight.value * zoom.value) / 2 + y.value + dismissY.value;
            return zoom.value > 1.01 && imageTop <= headerHeight;
        },
        (hidden, previous) => {
            if (hidden !== previous) runOnJS(setHeaderHidden)(hidden);
        },
    );
    useAnimatedReaction(
        () => dismissY.value >= height * 0.98,
        (dismissed, previous) => {
            if (dismissed && !previous) runOnJS(onClose)();
        },
    );
    return (
        <Modal visible transparent animationType="none" onRequestClose={onClose}>
            <GestureHandlerRootView style={styles.root}>
                <View style={styles.root}>
                    <Animated.View style={[styles.backdrop, backdropStyle]} />
                    <GestureDetector gesture={Gesture.Simultaneous(pinch, Gesture.Race(doubleTap, pan))}>
                        <Animated.View style={[styles.imageFrame, imageStyle]}>
                            <Image
                                source={{ uri: imageUri }}
                                placeholder={preview.initialUri ? { uri: preview.initialUri } : undefined}
                                style={styles.image}
                                contentFit="contain"
                                cachePolicy="memory-disk"
                                blurRadius={fullReady ? 0 : 8}
                                transition={180}
                                onLoad={(event) => {
                                    setError(false);
                                    if (imageUri.startsWith('file://') || preview.media.localUri === imageUri) setFullReady(true);
                                    const sourceWidth = event.source.width;
                                    const sourceHeight = event.source.height;
                                    if (!sourceWidth || !sourceHeight) return;
                                    const fit = Math.min(width / sourceWidth, height / sourceHeight);
                                    fittedWidth.value = sourceWidth * fit;
                                    fittedHeight.value = sourceHeight * fit;
                                    maxZoom.value = Math.max(2, Math.min(8, 1 / (fit * PixelRatio.get())));
                                }}
                                onError={() => {
                                    if (!loading) setError(true);
                                }}
                            />
                        </Animated.View>
                    </GestureDetector>
                    <Animated.View style={[styles.header, { height: headerHeight, paddingTop: insets.top }, headerStyle]} pointerEvents={headerHidden ? 'none' : 'box-none'}>
                        <LinearGradient
                            pointerEvents="none"
                            colors={['rgba(0,0,0,0.82)', 'rgba(0,0,0,0)']}
                            style={styles.headerShade}
                        />
                        <Pressable
                            onPress={onClose}
                            accessibilityRole="button"
                            accessibilityLabel={t('close', 'Close')}
                            hitSlop={10}
                            style={styles.closeButton}
                        >
                            <X size={23} color="#FFFFFF" />
                        </Pressable>
                    </Animated.View>
                    {!fullReady && !error && <View pointerEvents="none" style={styles.status}><View style={styles.statusBadge}><ActivityIndicator color="#FFFFFF" /></View></View>}
                    {error && (
                        <Pressable
                            accessibilityRole="button"
                            accessibilityLabel={t('btn_try_again', 'Try Again')}
                            onPress={() => setRetry((value) => value + 1)}
                            style={styles.retry}
                        >
                            <RefreshCw size={22} color="#FFFFFF" />
                        </Pressable>
                    )}
                </View>
            </GestureHandlerRootView>
        </Modal>
    );
}

const styles = StyleSheet.create({
    root: { flex: 1 },
    backdrop: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, backgroundColor: '#000000' },
    imageFrame: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    image: { width: '100%', height: '100%' },
    header: { position: 'absolute', top: 0, left: 0, right: 0, zIndex: 3, paddingHorizontal: 16, justifyContent: 'center', alignItems: 'flex-start' },
    headerShade: { position: 'absolute', top: 0, left: 0, right: 0, bottom: -24 },
    closeButton: { width: 42, height: 42, borderRadius: 21, backgroundColor: 'rgba(255,255,255,0.14)', alignItems: 'center', justifyContent: 'center' },
    status: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, alignItems: 'center', justifyContent: 'center' },
    statusBadge: { width: 48, height: 48, borderRadius: 24, backgroundColor: 'rgba(0,0,0,0.58)', alignItems: 'center', justifyContent: 'center' },
    retry: { position: 'absolute', top: '50%', alignSelf: 'center', marginTop: -24, width: 48, height: 48, borderRadius: 24, backgroundColor: 'rgba(0,0,0,0.68)', alignItems: 'center', justifyContent: 'center' },
});
