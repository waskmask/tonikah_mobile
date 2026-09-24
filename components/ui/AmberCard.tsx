import React, { type ReactNode } from 'react';
import { StyleSheet, type StyleProp, View, type ViewStyle } from 'react-native';
import { useTheme } from '@/hooks/useTheme';
import { scale } from '@/hooks/useResponsive';

export type AmberCardPalette = {
    background: string;
    foreground: string;
    border: string;
    icon: string;
    iconBackground: string;
};

export const AMBER_CARD_PALETTES: Record<'light' | 'dark', AmberCardPalette> = {
    light: {
        background: '#FFFBEB',
        foreground: '#201B15',
        border: '#201B15',
        icon: '#92400E',
        iconBackground: '#FFFFFF',
    },
    dark: {
        background: '#3A2D1B',
        foreground: '#FFF9ED',
        border: '#FFF9ED',
        icon: '#92400E',
        iconBackground: '#FFFFFF',
    },
};

export function useAmberCardPalette() {
    const { isDark } = useTheme();
    return AMBER_CARD_PALETTES[isDark ? 'dark' : 'light'];
}

type AmberCardProps = {
    children: ReactNode;
    style?: StyleProp<ViewStyle>;
    backgroundColor?: string;
};

export function AmberCard({ children, style, backgroundColor }: AmberCardProps) {
    const palette = useAmberCardPalette();

    return (
        <View
            style={[
                styles.card,
                { backgroundColor: backgroundColor ?? palette.background },
                style,
            ]}
        >
            {children}
        </View>
    );
}

const styles = StyleSheet.create({
    card: {
        borderRadius: scale(8),
    },
});
