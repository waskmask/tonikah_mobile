import React from 'react';
import Svg, { Path } from 'react-native-svg';

interface MosqueProps {
    size?: number;
    color?: string;
    strokeWidth?: number;
}

/** Mosque — lucide has no such icon, so this is a hand-drawn dome + arch door
    in the same 24×24 / 2px-stroke style as our lucide set. */
export function Mosque({ size = 24, color = 'currentColor', strokeWidth = 2 }: MosqueProps) {
    return (
        <Svg
            width={size}
            height={size}
            viewBox="0 0 24 24"
            fill="none"
            stroke={color}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeLinejoin="round"
        >
            <Path d="M3 21h18" />
            <Path d="M5 21v-6" />
            <Path d="M19 21v-6" />
            <Path d="M5 15h14" />
            <Path d="M8 15c0-3.5 1.7-5 4-6.5c2.3 1.5 4 3 4 6.5" />
            <Path d="M12 8.5V7" />
            <Path d="M10 21v-2a2 2 0 0 1 4 0v2" />
        </Svg>
    );
}
