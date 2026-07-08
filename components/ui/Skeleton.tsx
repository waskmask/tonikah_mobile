import React, { useEffect } from 'react';
import { DimensionValue, StyleProp, ViewStyle } from 'react-native';
import Reanimated, { useAnimatedStyle, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';
import { useColors } from '@/hooks/useColors';
import { scale } from '@/hooks/useResponsive';

type SkeletonProps = {
    width?: DimensionValue;
    height?: DimensionValue;
    borderRadius?: number;
    style?: StyleProp<ViewStyle>;
};

/** Pulsing placeholder block for perceived-speed loading states. */
export function Skeleton({ width = '100%', height = scale(16), borderRadius = scale(8), style }: SkeletonProps) {
    const colors = useColors();
    const pulse = useSharedValue(0.6);

    useEffect(() => {
        pulse.value = withRepeat(withTiming(1, { duration: 700 }), -1, true);
    }, [pulse]);

    const animated = useAnimatedStyle(() => ({ opacity: pulse.value }));

    return (
        <Reanimated.View
            style={[
                { width, height, borderRadius, backgroundColor: colors.brand.bg.border },
                animated,
                style,
            ]}
        />
    );
}
