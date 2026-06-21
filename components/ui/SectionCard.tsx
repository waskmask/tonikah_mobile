import React from 'react';
import { Pressable, StyleSheet, View, type ViewStyle } from 'react-native';
import { Text } from '@/components/ui/Text';
import { useColors } from '@/hooks/useColors';
import { radius, space } from '@/constants/uiTokens';
import { scale } from '@/hooks/useResponsive';

type SectionCardProps = {
    title?: string;
    actionLabel?: string;
    onAction?: () => void;
    children: React.ReactNode;
    style?: ViewStyle;
};

export function SectionCard({ title, actionLabel, onAction, children, style }: SectionCardProps) {
    const colors = useColors();
    const surface = colors.brand.bg.primary;
    const border = colors.brand.bg.border;
    const primary = colors.chrome.primary;

    return (
        <View style={[styles.card, { backgroundColor: surface, borderColor: border }, style]}>
            {title ? (
                <View style={styles.header}>
                    <Text variant="h3" style={[styles.title, { fontSize: scale(18) }]}>
                        {title}
                    </Text>
                    {actionLabel && onAction ? (
                        <Pressable onPress={onAction} hitSlop={8}>
                            <Text variant="caption" className="font-body-semi" style={{ color: primary }}>
                                {actionLabel}
                            </Text>
                        </Pressable>
                    ) : null}
                </View>
            ) : null}
            {children}
        </View>
    );
}

const styles = StyleSheet.create({
    card: {
        borderWidth: StyleSheet.hairlineWidth,
        borderRadius: radius('lg'),
        padding: space('md'),
        marginBottom: space('md'),
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: space('sm'),
        marginBottom: space('sm'),
    },
    title: {
        flex: 1,
    },
});
