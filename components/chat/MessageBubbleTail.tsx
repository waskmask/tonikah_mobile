import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import MaskedView from '@react-native-masked-view/masked-view';
import Svg, { Path } from 'react-native-svg';
import { scale } from '@/hooks/useResponsive';
import { imageBubbleTailPath } from '@/lib/chatBubbleTail';

export const BUBBLE_TAIL_WIDTH = scale(6);

export function ImageTailMask({
    enabled,
    width,
    height,
    mine,
    children,
}: {
    enabled: boolean;
    width: number;
    height: number;
    mine: boolean;
    children: React.ReactNode;
}) {
    if (!enabled) return <>{children}</>;
    return (
        <MaskedView
            style={{ width, height }}
            maskElement={
                <Svg width={width} height={height}>
                    <Path d={imageBubbleTailPath(width, height, mine, scale(14), BUBBLE_TAIL_WIDTH)} fill="#000000" />
                </Svg>
            }
        >
            {children}
        </MaskedView>
    );
}

export function SolidBubbleTail({ mine, color, borderColor }: { mine: boolean; color: string; borderColor: string }) {
    const [size, setSize] = useState({ width: 0, height: 0 });
    const inset = StyleSheet.hairlineWidth / 2;
    return (
        <View pointerEvents="none" style={StyleSheet.absoluteFill} onLayout={({ nativeEvent: { layout } }) => {
            setSize((current) => current.width === layout.width && current.height === layout.height
                ? current : { width: layout.width, height: layout.height });
        }}>
            {size.width > 0 && size.height > 0 && <Svg width={size.width} height={size.height}>
                <Path
                    d={imageBubbleTailPath(size.width - inset * 2, size.height - inset * 2, mine, scale(14), BUBBLE_TAIL_WIDTH, inset, inset)}
                    fill={color}
                    stroke={borderColor}
                    strokeWidth={StyleSheet.hairlineWidth}
                />
            </Svg>}
        </View>
    );
}
