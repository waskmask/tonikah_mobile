import React, { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Image as RNImage, PanResponder, StyleSheet, View } from 'react-native';
import { Image } from 'expo-image';
import * as ImageManipulator from 'expo-image-manipulator';
import { containedImageRect, cropPixels, dragCropRect, type CropHandle, type CropRect, type ImageSize } from '@/lib/chatImageCrop';
import { scale } from '@/hooks/useResponsive';

const FULL_CROP: CropRect = { x: 0, y: 0, width: 1, height: 1 };

export type ChatImageCropEditorRef = {
    rotate: () => void;
    save: () => Promise<void>;
};

type Props = {
    uri: string;
    sourceSize?: ImageSize;
    onDone: (result: { uri: string; width: number; height: number }) => void;
    onError: () => void;
    onBusyChange: (busy: boolean) => void;
};

export const ChatImageCropEditor = forwardRef<ChatImageCropEditorRef, Props>(function ChatImageCropEditor({
    uri,
    sourceSize,
    onDone,
    onError,
    onBusyChange,
}, ref) {
    const [natural, setNatural] = useState<ImageSize>(sourceSize || { width: 0, height: 0 });
    const [stage, setStage] = useState<ImageSize>({ width: 0, height: 0 });
    const [rotation, setRotation] = useState(0);
    const [crop, setCrop] = useState<CropRect>(FULL_CROP);
    const [busy, setBusy] = useState(false);
    const onErrorRef = useRef(onError);
    onErrorRef.current = onError;
    const dragStart = useRef(FULL_CROP);
    const cropRef = useRef(crop);
    const displaySizeRef = useRef<ImageSize>({ width: 0, height: 0 });
    cropRef.current = crop;

    useEffect(() => {
        setNatural(sourceSize || { width: 0, height: 0 });
        setRotation(0);
        setCrop(FULL_CROP);
        if (sourceSize?.width && sourceSize?.height) return;
        let active = true;
        RNImage.getSize(uri, (width, height) => {
            if (active) setNatural({ width, height });
        }, () => {
            if (active) onErrorRef.current();
        });
        return () => { active = false; };
    }, [uri, sourceSize?.width, sourceSize?.height]);

    const rotated: ImageSize = rotation % 180
        ? { width: natural.height, height: natural.width }
        : natural;
    const imageFrame = containedImageRect(stage, rotated);
    displaySizeRef.current = { width: imageFrame.width, height: imageFrame.height };

    const responders = useMemo(() => {
        const makeResponder = (handle: CropHandle) => PanResponder.create({
            onStartShouldSetPanResponder: () => true,
            onMoveShouldSetPanResponder: () => true,
            onPanResponderTerminationRequest: () => false,
            onPanResponderGrant: () => { dragStart.current = cropRef.current; },
            onPanResponderMove: (_, gesture) => {
                const next = dragCropRect(dragStart.current, handle, gesture.dx, gesture.dy, displaySizeRef.current);
                cropRef.current = next;
                setCrop(next);
            },
        });
        return {
            move: makeResponder('move'),
            topLeft: makeResponder('topLeft'),
            topRight: makeResponder('topRight'),
            bottomLeft: makeResponder('bottomLeft'),
            bottomRight: makeResponder('bottomRight'),
        };
    }, []);

    useImperativeHandle(ref, () => ({
        rotate: () => {
            if (busy) return;
            setRotation((value) => (value + 90) % 360);
            setCrop(FULL_CROP);
        },
        save: async () => {
            if (busy || !natural.width || !natural.height || !imageFrame.width) return;
            setBusy(true);
            onBusyChange(true);
            try {
                const pixels = cropPixels(cropRef.current, rotated);
                const resize = Math.max(pixels.width, pixels.height) > 1200
                    ? { resize: pixels.width >= pixels.height ? { width: 1200 } : { height: 1200 } }
                    : null;
                const result = await ImageManipulator.manipulateAsync(
                    uri,
                    [
                        ...(rotation ? [{ rotate: rotation }] : []),
                        { crop: pixels },
                        ...(resize ? [resize] : []),
                    ],
                    { compress: 0.82, format: ImageManipulator.SaveFormat.WEBP },
                );
                onDone({ uri: result.uri, width: result.width, height: result.height });
            } catch {
                onError();
            } finally {
                setBusy(false);
                onBusyChange(false);
            }
        },
    }), [busy, imageFrame.width, natural, onBusyChange, onDone, onError, rotated, rotation, uri]);

    const cropFrame = {
        left: crop.x * imageFrame.width,
        top: crop.y * imageFrame.height,
        width: crop.width * imageFrame.width,
        height: crop.height * imageFrame.height,
    };
    const fit = rotated.width ? imageFrame.width / rotated.width : 0;
    const originalWidth = natural.width * fit;
    const originalHeight = natural.height * fit;
    const handles: Array<{ name: Exclude<CropHandle, 'move'>; style: object; cornerStyle: object }> = [
        { name: 'topLeft', style: styles.topLeft, cornerStyle: styles.cornerTopLeft },
        { name: 'topRight', style: styles.topRight, cornerStyle: styles.cornerTopRight },
        { name: 'bottomLeft', style: styles.bottomLeft, cornerStyle: styles.cornerBottomLeft },
        { name: 'bottomRight', style: styles.bottomRight, cornerStyle: styles.cornerBottomRight },
    ];

    return (
        <View style={styles.stage} onLayout={(event) => {
            const { width, height } = event.nativeEvent.layout;
            setStage((current) => current.width === width && current.height === height ? current : { width, height });
        }}>
            {imageFrame.width > 0 ? (
                <View style={[styles.imageBounds, {
                    left: imageFrame.x,
                    top: imageFrame.y,
                    width: imageFrame.width,
                    height: imageFrame.height,
                }]}>
                    <Image
                        source={{ uri }}
                        // The frame already matches the source ratio; contain also enables preview downsampling.
                        contentFit="contain"
                        allowDownscaling
                        style={{
                            position: 'absolute',
                            left: (imageFrame.width - originalWidth) / 2,
                            top: (imageFrame.height - originalHeight) / 2,
                            width: originalWidth,
                            height: originalHeight,
                            transform: [{ rotate: `${rotation}deg` }],
                        }}
                    />
                    <View pointerEvents="none" style={[styles.shade, { left: 0, top: 0, right: 0, height: cropFrame.top }]} />
                    <View pointerEvents="none" style={[styles.shade, { left: 0, top: cropFrame.top + cropFrame.height, right: 0, bottom: 0 }]} />
                    <View pointerEvents="none" style={[styles.shade, { left: 0, top: cropFrame.top, width: cropFrame.left, height: cropFrame.height }]} />
                    <View pointerEvents="none" style={[styles.shade, { left: cropFrame.left + cropFrame.width, top: cropFrame.top, right: 0, height: cropFrame.height }]} />
                    <View style={[styles.selection, cropFrame]}>
                        <View style={StyleSheet.absoluteFill} {...responders.move.panHandlers} />
                        <View pointerEvents="none" style={[styles.gridLine, styles.verticalOne]} />
                        <View pointerEvents="none" style={[styles.gridLine, styles.verticalTwo]} />
                        <View pointerEvents="none" style={[styles.gridLine, styles.horizontalOne]} />
                        <View pointerEvents="none" style={[styles.gridLine, styles.horizontalTwo]} />
                        {handles.map(({ name, style, cornerStyle }) => (
                            <View key={name} style={[styles.handle, style]} {...responders[name].panHandlers}>
                                <View pointerEvents="none" style={[styles.corner, cornerStyle]} />
                            </View>
                        ))}
                    </View>
                </View>
            ) : <ActivityIndicator color="#FFFFFF" />}
        </View>
    );
});

const styles = StyleSheet.create({
    stage: { flex: 1, width: '90%', alignSelf: 'center', justifyContent: 'center', alignItems: 'center' },
    imageBounds: { position: 'absolute' },
    shade: { position: 'absolute', backgroundColor: 'rgba(0,0,0,0.53)' },
    selection: { position: 'absolute', borderColor: '#FFFFFF', borderWidth: 1.5 },
    gridLine: { position: 'absolute', backgroundColor: 'rgba(255,255,255,0.42)' },
    verticalOne: { left: '33.33%', top: 0, bottom: 0, width: StyleSheet.hairlineWidth },
    verticalTwo: { left: '66.66%', top: 0, bottom: 0, width: StyleSheet.hairlineWidth },
    horizontalOne: { top: '33.33%', left: 0, right: 0, height: StyleSheet.hairlineWidth },
    horizontalTwo: { top: '66.66%', left: 0, right: 0, height: StyleSheet.hairlineWidth },
    handle: { position: 'absolute', width: scale(44), height: scale(44) },
    topLeft: { left: 0, top: 0 },
    topRight: { right: 0, top: 0 },
    bottomLeft: { left: 0, bottom: 0 },
    bottomRight: { right: 0, bottom: 0 },
    corner: { position: 'absolute', width: scale(17), height: scale(17), borderColor: '#FFFFFF' },
    cornerTopLeft: { left: 0, top: 0, borderTopWidth: 3, borderLeftWidth: 3 },
    cornerTopRight: { right: 0, top: 0, borderTopWidth: 3, borderRightWidth: 3 },
    cornerBottomLeft: { left: 0, bottom: 0, borderBottomWidth: 3, borderLeftWidth: 3 },
    cornerBottomRight: { right: 0, bottom: 0, borderBottomWidth: 3, borderRightWidth: 3 },
});
