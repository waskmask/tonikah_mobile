import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
    ActivityIndicator,
    Image as RNImage,
    Modal,
    PanResponder,
    Pressable,
    StatusBar,
    StyleSheet,
    View,
} from 'react-native';
import { Image } from 'expo-image';
import * as ImageManipulator from 'expo-image-manipulator';
import { ChevronLeft, ChevronRight, RotateCw } from 'lucide-react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Text } from '@/components/ui/Text';
import { GradientButton } from '@/components/ui/GradientButton';
import { useLanguage } from '@/hooks/useLanguage';
import { scale } from '@/hooks/useResponsive';

const EXPORT_WIDTH = 1080;
const EXPORT_HEIGHT = 1440;
const MIN_ZOOM = 1;
const MAX_ZOOM = 3;

type Size = {
    width: number;
    height: number;
};

type Offset = {
    x: number;
    y: number;
};

type PreviewTransform = {
    offset: Offset;
    zoom: number;
    rotation: number;
};

type Labels = {
    title: string;
    subtitle: string;
    preparing: string;
    upload: string;
    rotate: string;
};

type Props = {
    visible: boolean;
    imageUri: string;
    sourceSize?: Size;
    isDark: boolean;
    uploading: boolean;
    errorMessage?: string | null;
    labels: Labels;
    onClose: () => void;
    onUpload: (uri: string) => Promise<void>;
    onError: (message?: string) => void;
};

function clamp(value: number, min: number, max: number) {
    return Math.min(Math.max(value, min), max);
}

function sameSize(a: Size, b: Size) {
    return a.width === b.width && a.height === b.height;
}

function sameOffset(a: Offset, b: Offset) {
    return a.x === b.x && a.y === b.y;
}

function getMetrics(natural: Size, frame: Size, zoom: number) {
    if (!natural.width || !natural.height || !frame.width || !frame.height) {
        return {
            imageWidth: 0,
            imageHeight: 0,
            scale: 1,
            maxOffsetX: 0,
            maxOffsetY: 0,
        };
    }

    const baseScale = Math.max(frame.width / natural.width, frame.height / natural.height);
    const scaleValue = baseScale * zoom;
    const imageWidth = natural.width * scaleValue;
    const imageHeight = natural.height * scaleValue;

    return {
        imageWidth,
        imageHeight,
        scale: scaleValue,
        maxOffsetX: Math.max(0, (imageWidth - frame.width) / 2),
        maxOffsetY: Math.max(0, (imageHeight - frame.height) / 2),
    };
}

function getRotatedSize(natural: Size, rotation: number) {
    const quarterTurn = rotation % 180 !== 0;
    return quarterTurn
        ? { width: natural.height, height: natural.width }
        : natural;
}

function getRotatedMetrics(natural: Size, frame: Size, zoom: number, rotation: number) {
    const rotated = getRotatedSize(natural, rotation);
    const base = getMetrics(rotated, frame, zoom);
    const scaleValue = base.scale;

    return {
        ...base,
        imageWidth: natural.width * scaleValue,
        imageHeight: natural.height * scaleValue,
        visualWidth: rotated.width * scaleValue,
        visualHeight: rotated.height * scaleValue,
    };
}

function clampOffset(offset: Offset, natural: Size, frame: Size, zoom: number, rotation: number) {
    const metrics = getRotatedMetrics(natural, frame, zoom, rotation);
    return {
        x: clamp(offset.x, -metrics.maxOffsetX, metrics.maxOffsetX),
        y: clamp(offset.y, -metrics.maxOffsetY, metrics.maxOffsetY),
    };
}

export function GalleryCropModal({
    visible,
    imageUri,
    sourceSize,
    isDark,
    uploading,
    errorMessage,
    labels,
    onClose,
    onUpload,
    onError,
}: Props) {
    const insets = useSafeAreaInsets();
    const { isRTL } = useLanguage();
    const dragStart = useRef({ x: 0, y: 0, offsetX: 0, offsetY: 0 });
    const sliderOriginXRef = useRef(0);
    const pendingZoomRef = useRef<number | null>(null);
    const zoomFrameRef = useRef<number | null>(null);
    const [natural, setNatural] = useState<Size>({ width: 0, height: 0 });
    const [frame, setFrame] = useState<Size>({ width: 0, height: 0 });
    const [offset, setOffset] = useState<Offset>({ x: 0, y: 0 });
    const [zoom, setZoom] = useState(1);
    const [rotation, setRotation] = useState(0);
    const [sliderWidth, setSliderWidth] = useState(0);
    const [processing, setProcessing] = useState(false);
    const initializedImageRef = useRef<string | null>(null);
    const submittedPreviewRef = useRef<PreviewTransform | null>(null);
    const interactionRef = useRef({ natural, frame, offset, zoom, rotation, sliderWidth });
    interactionRef.current = { natural, frame, offset, zoom, rotation, sliderWidth };

    // Same pairs as the app theme tokens (see edit-profile themeColors)
    const backgroundColor = isDark ? '#101011' : '#FFFFFF';
    const textStrong = isDark ? '#E5E5E7' : '#201B15';
    const textMuted = isDark ? '#B0B0B5' : '#7D7266';
    const surface = isDark ? '#1D1D1F' : '#FFFFFF';
    const border = isDark ? '#303033' : '#EEEEEE';
    const busy = uploading || processing;
    const submittedPreview = busy ? submittedPreviewRef.current : null;
    const previewOffset = submittedPreview?.offset ?? offset;
    const previewZoom = submittedPreview?.zoom ?? zoom;
    const previewRotation = submittedPreview?.rotation ?? rotation;
    const metrics = useMemo(() => getRotatedMetrics(natural, frame, zoom, rotation), [frame, natural, rotation, zoom]);
    const previewMetrics = useMemo(
        () => getRotatedMetrics(natural, frame, previewZoom, previewRotation),
        [frame, natural, previewRotation, previewZoom],
    );
    const zoomPercent = ((previewZoom - MIN_ZOOM) / (MAX_ZOOM - MIN_ZOOM)) * 100;

    useEffect(() => {
        if (!visible) {
            if (zoomFrameRef.current !== null) {
                cancelAnimationFrame(zoomFrameRef.current);
                zoomFrameRef.current = null;
            }
            pendingZoomRef.current = null;
            initializedImageRef.current = null;
            submittedPreviewRef.current = null;
            return;
        }
        if (initializedImageRef.current === imageUri) return;
        initializedImageRef.current = imageUri;
        submittedPreviewRef.current = null;
        setOffset((current) => sameOffset(current, { x: 0, y: 0 }) ? current : { x: 0, y: 0 });
        setZoom((current) => current === 1 ? current : 1);
        setRotation((current) => current === 0 ? current : 0);
        setProcessing((current) => current ? false : current);

        if (sourceSize?.width && sourceSize?.height) {
            setNatural((current) => sameSize(current, sourceSize) ? current : sourceSize);
            return;
        }

        if (imageUri) {
            RNImage.getSize(
                imageUri,
                (width, height) => setNatural((current) => {
                    const next = { width, height };
                    return sameSize(current, next) ? current : next;
                }),
                () => setNatural((current) => sameSize(current, { width: 0, height: 0 })
                    ? current
                    : { width: 0, height: 0 })
            );
        }
    }, [imageUri, sourceSize?.height, sourceSize?.width, visible]);

    useEffect(() => {
        setOffset((current) => {
            const next = clampOffset(current, natural, frame, zoom, rotation);
            return sameOffset(current, next) ? current : next;
        });
    }, [frame, natural, rotation]);

    useEffect(() => () => {
        if (zoomFrameRef.current !== null) cancelAnimationFrame(zoomFrameRef.current);
    }, []);

    const panResponder = useMemo(
        () =>
            PanResponder.create({
                onStartShouldSetPanResponder: () => true,
                onMoveShouldSetPanResponder: () => true,
                onPanResponderGrant: (event) => {
                    const current = interactionRef.current;
                    dragStart.current = {
                        x: event.nativeEvent.pageX,
                        y: event.nativeEvent.pageY,
                        offsetX: current.offset.x,
                        offsetY: current.offset.y,
                    };
                },
                onPanResponderMove: (event) => {
                    const current = interactionRef.current;
                    const next = {
                        x: dragStart.current.offsetX + event.nativeEvent.pageX - dragStart.current.x,
                        y: dragStart.current.offsetY + event.nativeEvent.pageY - dragStart.current.y,
                    };
                    const clamped = clampOffset(
                        next,
                        current.natural,
                        current.frame,
                        current.zoom,
                        current.rotation,
                    );
                    setOffset((previous) => sameOffset(previous, clamped) ? previous : clamped);
                },
            }),
        []
    );

    const sliderPanResponder = useMemo(
        () =>
            PanResponder.create({
                onStartShouldSetPanResponder: () => true,
                onStartShouldSetPanResponderCapture: () => true,
                onMoveShouldSetPanResponder: () => true,
                onMoveShouldSetPanResponderCapture: () => true,
                onPanResponderTerminationRequest: () => false,
                onPanResponderGrant: (event) => {
                    sliderOriginXRef.current = event.nativeEvent.pageX - event.nativeEvent.locationX;
                    setZoomFromPageX(event.nativeEvent.pageX);
                },
                onPanResponderMove: (event) => {
                    setZoomFromPageX(event.nativeEvent.pageX);
                },
            }),
        []
    );

    function setZoomFromPageX(pageX: number) {
        const width = interactionRef.current.sliderWidth;
        if (!width) return;
        const percent = clamp((pageX - sliderOriginXRef.current) / width, 0, 1);
        const next = MIN_ZOOM + percent * (MAX_ZOOM - MIN_ZOOM);
        pendingZoomRef.current = next;
        if (zoomFrameRef.current !== null) return;

        zoomFrameRef.current = requestAnimationFrame(() => {
            zoomFrameRef.current = null;
            const queuedZoom = pendingZoomRef.current;
            pendingZoomRef.current = null;
            if (queuedZoom === null) return;

            const current = interactionRef.current;
            interactionRef.current = { ...current, zoom: queuedZoom };
            setZoom((value) => Math.abs(value - queuedZoom) < 0.0001 ? value : queuedZoom);
            setOffset((value) => {
                const clamped = clampOffset(
                    value,
                    current.natural,
                    current.frame,
                    queuedZoom,
                    current.rotation,
                );
                return sameOffset(value, clamped) ? value : clamped;
            });
        });
    }

    function rotateImage() {
        setRotation((current) => (current + 90) % 360);
        setOffset({ x: 0, y: 0 });
    }

    async function cropAndUpload() {
        if (!imageUri || !natural.width || !natural.height || !frame.width || !frame.height || busy) return;

        submittedPreviewRef.current = {
            offset: { ...offset },
            zoom,
            rotation,
        };
        setProcessing(true);

        try {
            const cropScale = metrics.scale || 1;
            const rotatedNatural = getRotatedSize(natural, rotation);
            const originX = ((metrics.visualWidth - frame.width) / 2 - offset.x) / cropScale;
            const originY = ((metrics.visualHeight - frame.height) / 2 - offset.y) / cropScale;
            const width = frame.width / cropScale;
            const height = frame.height / cropScale;

            const crop = {
                originX: Math.round(clamp(originX, 0, rotatedNatural.width - 1)),
                originY: Math.round(clamp(originY, 0, rotatedNatural.height - 1)),
                width: Math.round(clamp(width, 1, rotatedNatural.width)),
                height: Math.round(clamp(height, 1, rotatedNatural.height)),
            };

            if (crop.originX + crop.width > rotatedNatural.width) crop.width = rotatedNatural.width - crop.originX;
            if (crop.originY + crop.height > rotatedNatural.height) crop.height = rotatedNatural.height - crop.originY;

            const result = await ImageManipulator.manipulateAsync(
                imageUri,
                [
                    ...(rotation ? [{ rotate: rotation }] : []),
                    { crop },
                    { resize: { width: EXPORT_WIDTH, height: EXPORT_HEIGHT } },
                ],
                { compress: 0.92, format: ImageManipulator.SaveFormat.JPEG }
            );

            await onUpload(result.uri);
        } catch (error: any) {
            onError(error?.message);
        } finally {
            submittedPreviewRef.current = null;
            setProcessing(false);
        }
    }

    return (
        <Modal
            visible={visible}
            animationType="slide"
            presentationStyle="fullScreen"
            transparent={false}
            statusBarTranslucent
            navigationBarTranslucent
            onRequestClose={busy ? undefined : onClose}
        >
            <View style={[styles.screen, { backgroundColor }]}>
            <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={backgroundColor} translucent />
            <SafeAreaView style={styles.safeArea} edges={['top']}>
                <View style={styles.header}>
                    <View style={styles.backWrap}>
                        <Pressable
                            onPress={onClose}
                            disabled={busy}
                            style={({ pressed }) => [styles.backButton, pressed && !busy ? styles.pressed : null]}
                            accessibilityRole="button"
                            accessibilityLabel={labels.title}
                        >
                            {isRTL
                                ? <ChevronRight size={scale(23)} color={textStrong} />
                                : <ChevronLeft size={scale(23)} color={textStrong} />}
                        </Pressable>
                    </View>
                    <View style={styles.headerText}>
                        <Text variant="body" className="font-body-bold" align="center">
                            {labels.title}
                        </Text>
                        <Text variant="caption" align="center" style={{ color: textMuted }}>
                            {labels.subtitle}
                        </Text>
                    </View>
                    <View style={styles.headerSpacer} />
                </View>

                <View style={styles.cropArea}>
                    <View
                        style={[styles.cropFrame, { backgroundColor: surface }]}
                        pointerEvents={busy ? 'none' : 'auto'}
                        onLayout={(event) => {
                            const { width, height } = event.nativeEvent.layout;
                            setFrame((current) => {
                                const next = { width, height };
                                return sameSize(current, next) ? current : next;
                            });
                        }}
                        {...panResponder.panHandlers}
                    >
                        {imageUri && previewMetrics.imageWidth ? (
                            <View
                                style={[
                                    styles.cropImageWrap,
                                    {
                                        width: previewMetrics.imageWidth,
                                        height: previewMetrics.imageHeight,
                                        left: frame.width / 2 - previewMetrics.imageWidth / 2 + previewOffset.x,
                                        top: frame.height / 2 - previewMetrics.imageHeight / 2 + previewOffset.y,
                                        transform: [
                                            { rotate: `${previewRotation}deg` },
                                        ],
                                    },
                                ]}
                            >
                                <Image
                                    source={{ uri: imageUri }}
                                    style={StyleSheet.absoluteFill}
                                    contentFit="cover"
                                />
                            </View>
                        ) : (
                            <View style={styles.preparing}>
                                <ActivityIndicator color="#F34B6F" />
                                <Text variant="caption" style={{ marginTop: scale(8), color: textMuted }}>
                                    {labels.preparing}
                                </Text>
                            </View>
                        )}
                        <View pointerEvents="none" style={styles.gridLineH1} />
                        <View pointerEvents="none" style={styles.gridLineH2} />
                        <View pointerEvents="none" style={styles.gridLineV1} />
                        <View pointerEvents="none" style={styles.gridLineV2} />
                        <View pointerEvents="none" style={styles.frameRing} />
                    </View>
                </View>

                <View style={styles.controls}>
                    <View
                        style={styles.sliderHitArea}
                        pointerEvents={busy ? 'none' : 'auto'}
                        onLayout={(event) => {
                            const width = event.nativeEvent.layout.width;
                            setSliderWidth((current) => current === width ? current : width);
                        }}
                        {...sliderPanResponder.panHandlers}
                    >
                        <View pointerEvents="none" style={[styles.zoomTrack, { backgroundColor: border }]}>
                            <View style={[styles.zoomFill, { width: `${zoomPercent}%` }]} />
                            <View
                                style={[
                                    styles.zoomThumb,
                                    {
                                        left: `${zoomPercent}%`,
                                        borderColor: isDark ? '#303033' : textStrong,
                                        backgroundColor: isDark ? '#E5E5E7' : '#FFFFFF',
                                    },
                                ]}
                            />
                        </View>
                    </View>
                    <Pressable
                        onPress={rotateImage}
                        disabled={busy}
                        style={[styles.rotateButton, { borderColor: border }]}
                        accessibilityLabel={labels.rotate}
                    >
                        <RotateCw size={scale(22)} color={textStrong} />
                    </Pressable>
                </View>

                {errorMessage ? (
                    <View style={styles.errorBox}>
                        <Text variant="body-sm" align="center" style={styles.errorText}>
                            {errorMessage}
                        </Text>
                    </View>
                ) : null}

                <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, scale(14)) }]}>
                    <GradientButton
                        title={labels.upload}
                        onPress={cropAndUpload}
                        loading={busy}
                        disabled={busy || !metrics.imageWidth}
                        widthMode="full"
                        height={40}
                        textSize={15}
                    />
                </View>
            </SafeAreaView>
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    screen: {
        flex: 1,
    },
    safeArea: {
        flex: 1,
    },
    header: {
        minHeight: scale(92),
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: scale(16),
        paddingTop: scale(14),
    },
    backWrap: {
        position: 'absolute',
        // 3.5 + 10.5 (chevron inset inside its 44pt button) = 14dp edge→icon;
        // 'start' flips to the right edge under native RTL
        start: scale(3.5),
        top: scale(22),
        zIndex: 2,
        alignItems: 'flex-start',
    },
    backButton: {
        width: scale(44),
        height: scale(44),
        borderRadius: scale(22),
        alignItems: 'center',
        justifyContent: 'center',
    },
    pressed: {
        opacity: 0.65,
    },
    headerText: {
        gap: scale(4),
        maxWidth: scale(470),
        paddingHorizontal: scale(46),
    },
    headerSpacer: {
        width: scale(44),
    },
    cropArea: {
        flex: 1,
        justifyContent: 'center',
        paddingHorizontal: scale(22),
        paddingTop: scale(8),
    },
    cropFrame: {
        width: '100%',
        maxWidth: scale(360),
        aspectRatio: 3 / 4,
        alignSelf: 'center',
        borderRadius: scale(14),
        overflow: 'hidden',
    },
    cropImageWrap: {
        position: 'absolute',
    },
    preparing: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
    },
    frameRing: {
        ...StyleSheet.absoluteFill,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.55)',
        borderRadius: scale(14),
    },
    gridLineH1: {
        position: 'absolute',
        left: 0,
        right: 0,
        top: '33.333%',
        borderTopWidth: 1,
        borderColor: 'rgba(255,255,255,0.36)',
    },
    gridLineH2: {
        position: 'absolute',
        left: 0,
        right: 0,
        top: '66.666%',
        borderTopWidth: 1,
        borderColor: 'rgba(255,255,255,0.36)',
    },
    gridLineV1: {
        position: 'absolute',
        top: 0,
        bottom: 0,
        left: '33.333%',
        borderLeftWidth: 1,
        borderColor: 'rgba(255,255,255,0.36)',
    },
    gridLineV2: {
        position: 'absolute',
        top: 0,
        bottom: 0,
        left: '66.666%',
        borderLeftWidth: 1,
        borderColor: 'rgba(255,255,255,0.36)',
    },
    controls: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: scale(20),
        paddingHorizontal: scale(48),
        paddingBottom: scale(18),
    },
    rotateButton: {
        width: scale(40),
        height: scale(40),
        borderRadius: scale(20),
        borderWidth: 1,
        borderColor: '#E8E1D6',
        alignItems: 'center',
        justifyContent: 'center',
    },
    sliderHitArea: {
        flex: 1,
        height: scale(44),
        justifyContent: 'center',
    },
    zoomTrack: {
        width: '100%',
        height: scale(6),
        borderRadius: scale(3),
    },
    zoomFill: {
        height: '100%',
        borderRadius: scale(3),
        backgroundColor: '#F34B6F',
    },
    zoomThumb: {
        position: 'absolute',
        top: scale(-11),
        marginLeft: scale(-14),
        width: scale(28),
        height: scale(28),
        borderRadius: scale(14),
        borderWidth: 1,
        backgroundColor: '#FFFFFF',
        shadowColor: '#101011',
        shadowOpacity: 0.14,
        shadowRadius: 4,
        shadowOffset: { width: 0, height: 2 },
        elevation: 2,
    },
    footer: {
        paddingHorizontal: scale(20),
    },
    errorBox: {
        paddingHorizontal: scale(24),
        paddingBottom: scale(12),
    },
    errorText: {
        color: '#E11D48',
        lineHeight: scale(20),
    },
});
