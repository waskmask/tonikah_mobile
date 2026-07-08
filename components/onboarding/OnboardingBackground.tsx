import React, { useEffect } from 'react';
import { Dimensions, StyleSheet, View } from 'react-native';
import Svg, {
    Circle,
    Defs,
    G,
    Path,
    Pattern,
    RadialGradient,
    Rect,
    Stop,
} from 'react-native-svg';
import Animated, {
    Easing,
    cancelAnimation,
    useAnimatedStyle,
    useSharedValue,
    withRepeat,
    withSequence,
    withTiming,
} from 'react-native-reanimated';
import { useReducedMotion } from '@/hooks/useReducedMotion';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

export type OnboardingTokens = {
    bg: string;
    /** Solid glow colour; alpha passed separately — react-native-svg ignores
        the alpha channel of rgba() in stopColor. */
    glowColor: string;
    glowOpacity: number;
    line: string;
    lattice: string;
};

type Props = {
    tokens: OnboardingTokens;
    /** 0.5 on the splash slide, 0.85 on content slides */
    medallionOpacity: number;
};

/**
 * Shared backdrop for the onboarding flow (design handoff: "Arch" direction):
 * warm base fill → radial glow → tiled 8-point-star lattice → floating
 * Moorish arch medallion anchored bottom-centre.
 */
export function OnboardingBackground({ tokens, medallionOpacity }: Props) {
    const reduceMotion = useReducedMotion();
    const float = useSharedValue(0);
    const opacity = useSharedValue(medallionOpacity);

    useEffect(() => {
        opacity.value = withTiming(medallionOpacity, { duration: 350 });
    }, [medallionOpacity, opacity]);

    useEffect(() => {
        if (reduceMotion) {
            float.value = 0;
            return;
        }
        // Gentle continuous float: ±14px over 7.5s
        float.value = withRepeat(
            withSequence(
                withTiming(-14, { duration: 3750, easing: Easing.inOut(Easing.quad) }),
                withTiming(0, { duration: 3750, easing: Easing.inOut(Easing.quad) }),
            ),
            -1,
            false,
        );
        return () => cancelAnimation(float);
    }, [reduceMotion, float]);

    const medallionStyle = useAnimatedStyle(() => ({
        opacity: opacity.value,
        transform: [{ translateY: float.value }],
    }));

    const medallionHeight = SCREEN_HEIGHT * 0.66;
    const medallionWidth = medallionHeight * (300 / 400);

    return (
        <View style={[StyleSheet.absoluteFill, { backgroundColor: tokens.bg }]} pointerEvents="none">
            {/* Radial warm glow */}
            <Svg width={SCREEN_WIDTH} height={SCREEN_HEIGHT} style={StyleSheet.absoluteFill}>
                <Defs>
                    <RadialGradient id="tn-glow" cx="50%" cy="34%" rx="60%" ry="40%">
                        <Stop offset="0" stopColor={tokens.glowColor} stopOpacity={tokens.glowOpacity} />
                        <Stop offset="0.62" stopColor={tokens.glowColor} stopOpacity="0" />
                    </RadialGradient>
                    <Pattern id="tn-star" width="86" height="86" patternUnits="userSpaceOnUse">
                        <G fill="none" stroke={tokens.lattice} strokeWidth="1.1">
                            <Rect x="24" y="24" width="38" height="38" />
                            <Rect x="24" y="24" width="38" height="38" transform="rotate(45 43 43)" />
                        </G>
                    </Pattern>
                </Defs>
                <Rect x="0" y="0" width={SCREEN_WIDTH} height={SCREEN_HEIGHT} fill="url(#tn-glow)" />
                {/* Geometric lattice watermark */}
                <Rect x="0" y="0" width={SCREEN_WIDTH} height={SCREEN_HEIGHT} fill="url(#tn-star)" />
            </Svg>

            {/* Arch medallion, bottom-centre, slow float */}
            <Animated.View
                style={[
                    {
                        position: 'absolute',
                        bottom: -SCREEN_HEIGHT * 0.03,
                        left: (SCREEN_WIDTH - medallionWidth) / 2,
                        width: medallionWidth,
                        height: medallionHeight,
                    },
                    medallionStyle,
                ]}
            >
                <Svg viewBox="0 0 300 400" width="100%" height="100%">
                    <G
                        fill="none"
                        stroke={tokens.line}
                        strokeWidth="2.4"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                    >
                        <Path d="M40,398 L40,168 C40,78 88,28 150,28 C212,28 260,78 260,168 L260,398" />
                        <Path d="M64,398 L64,172 C64,94 106,50 150,50 C194,50 236,94 236,172 L236,398" />
                        <Rect x="112" y="86" width="76" height="76" rx="8" />
                        <Rect x="112" y="86" width="76" height="76" rx="8" transform="rotate(45 150 124)" />
                        <Circle cx="150" cy="124" r="12" />
                        <Path d="M150,210 L150,398" strokeDasharray="2 14" />
                    </G>
                    <Circle cx="150" cy="30" r="4.5" fill={tokens.line} />
                </Svg>
            </Animated.View>
        </View>
    );
}
