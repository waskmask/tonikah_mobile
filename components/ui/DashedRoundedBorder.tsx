import React, { useState } from 'react';
import { PixelRatio, StyleSheet, View } from 'react-native';
import Svg, { Rect } from 'react-native-svg';
import { scale } from '@/hooks/useResponsive';

type Props = {
    color: string;
    radius?: number;
    strokeWidth?: number;
};

/** SVG border avoids Android flattening rounded dashed borders into solid lines. */
export function DashedRoundedBorder({
    color,
    radius = 8,
    strokeWidth = 1.5,
}: Props) {
    const [size, setSize] = useState({ width: 0, height: 0 });
    const scaledStroke = PixelRatio.roundToNearestPixel(scale(strokeWidth));
    // Keep the full stroke inside the SVG viewport. A half-stroke inset leaves
    // the outer pixels clipped on Android, which makes the bottom edge lighter.
    const inset = scaledStroke;

    return (
        <View
            pointerEvents="none"
            style={StyleSheet.absoluteFill}
            onLayout={(event) => {
                const { width, height } = event.nativeEvent.layout;
                setSize((current) => current.width === width && current.height === height
                    ? current
                    : { width, height });
            }}
        >
            {size.width > scaledStroke && size.height > scaledStroke ? (
                <Svg width={size.width} height={size.height}>
                    <Rect
                        x={inset}
                        y={inset}
                        width={size.width - (inset * 2)}
                        height={size.height - (inset * 2)}
                        rx={scale(radius)}
                        fill="none"
                        stroke={color}
                        strokeWidth={scaledStroke}
                        strokeDasharray={[scale(6), scale(4)]}
                    />
                </Svg>
            ) : null}
        </View>
    );
}
