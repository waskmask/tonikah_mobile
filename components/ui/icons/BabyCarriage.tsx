import React from 'react';
import Svg, { Path } from 'react-native-svg';

interface BabyCarriageProps {
    size?: number;
    color?: string;
    strokeWidth?: number;
}

/** Baby carriage / stroller — lucide has no such icon, so this is Tabler's
    `baby-carriage` (MIT), same 24×24 / 2px-stroke style as our lucide set. */
export function BabyCarriage({ size = 24, color = 'currentColor', strokeWidth = 2 }: BabyCarriageProps) {
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
            <Path d="M6 19a2 2 0 1 0 4 0a2 2 0 1 0 -4 0" />
            <Path d="M16 19a2 2 0 1 0 4 0a2 2 0 1 0 -4 0" />
            <Path d="M2 5h2.5l1.632 4.897a6 6 0 0 0 5.693 4.103h2.675a5.5 5.5 0 0 0 0 -11h-.5v6" />
            <Path d="M6 9h14" />
            <Path d="M9 17l1 -3" />
            <Path d="M16 14l1 3" />
        </Svg>
    );
}
