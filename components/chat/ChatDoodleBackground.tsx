import React, { memo } from 'react';
import { StyleSheet } from 'react-native';
import Svg, { Circle, Defs, G, Path, Pattern, Rect } from 'react-native-svg';

type ChatDoodleBackgroundProps = {
    /** Stroke color of the doodles (pick a muted tone per theme). */
    color: string;
    opacity?: number;
    /** Multiplier on the 256pt base tile (smaller = denser, finer doodles). */
    tileScale?: number;
};

/**
 * Chat wallpaper: a 256pt doodle tile repeated via SVG <Pattern>.
 * Pure vector, bundled in JS — no asset, nothing fetched, renders once.
 */
export const ChatDoodleBackground = memo(function ChatDoodleBackground({
    color,
    opacity = 0.14,
    tileScale = 0.55,
}: ChatDoodleBackgroundProps) {
    return (
        <Svg style={StyleSheet.absoluteFill} pointerEvents="none">
            <Defs>
                <Pattern
                    id="chat-doodle"
                    patternUnits="userSpaceOnUse"
                    width={256 * tileScale}
                    height={256 * tileScale}
                >
                    <G
                        transform={`scale(${tileScale})`}
                        fill="none"
                        stroke={color}
                        strokeWidth={3}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        opacity={opacity}
                    >
                        {/* heart */}
                        <Path d="M40 36c-5-9-19-8-21 3-2 10 9 17 21 26 12-9 23-16 21-26-2-11-16-12-21-3z" />
                        {/* chat bubble */}
                        <Path d="M150 24h44a10 10 0 0 1 10 10v22a10 10 0 0 1-10 10h-24l-12 10v-10h-8a10 10 0 0 1-10-10V34a10 10 0 0 1 10-10z" />
                        {/* small star */}
                        <Path d="M104 70l3 8 8 3-8 3-3 8-3-8-8-3 8-3z" />
                        {/* flower */}
                        <Circle cx={220} cy={150} r={7} />
                        <Circle cx={220} cy={132} r={7} />
                        <Circle cx={220} cy={168} r={7} />
                        <Circle cx={204} cy={141} r={7} />
                        <Circle cx={236} cy={141} r={7} />
                        <Circle cx={204} cy={159} r={7} />
                        <Circle cx={236} cy={159} r={7} />
                        {/* crescent moon */}
                        <Path d="M60 150a22 22 0 1 0 22 34 26 26 0 0 1-22-34z" />
                        {/* sparkle */}
                        <Path d="M140 130l4 11 11 4-11 4-4 11-4-11-11-4 11-4z" />
                        {/* ring */}
                        <Circle cx={30} cy={220} r={12} />
                        <Circle cx={30} cy={220} r={5} />
                        {/* paper plane */}
                        <Path d="M120 210l60-24-18 48-12-16z" />
                        <Path d="M162 218l-12 16" />
                        {/* tiny hearts */}
                        <Path d="M226 60c-2.5-4.5-9.5-4-10.5 1.5-1 5 4.5 8.5 10.5 13 6-4.5 11.5-8 10.5-13-1-5.5-8-6-10.5-1.5z" />
                        <Path d="M96 236c-2.5-4.5-9.5-4-10.5 1.5-1 5 4.5 8.5 10.5 13 6-4.5 11.5-8 10.5-13-1-5.5-8-6-10.5-1.5z" />
                        {/* dots */}
                        <Circle cx={12} cy={96} r={2.5} />
                        <Circle cx={196} cy={102} r={2.5} />
                        <Circle cx={248} cy={236} r={2.5} />
                        <Circle cx={140} cy={88} r={2.5} />
                    </G>
                </Pattern>
            </Defs>
            <Rect x="0" y="0" width="100%" height="100%" fill="url(#chat-doodle)" />
        </Svg>
    );
});
