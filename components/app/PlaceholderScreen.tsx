import React from 'react';
import { View } from 'react-native';
import { Text } from '@/components/ui/Text';
import { useTheme } from '@/hooks/useTheme';
import { scale } from '@/hooks/useResponsive';

type PlaceholderScreenProps = {
    title: string;
    subtitle?: string;
};

export function PlaceholderScreen({ title, subtitle }: PlaceholderScreenProps) {
    const { isDark } = useTheme();

    return (
        <View
            style={{
                flex: 1,
                justifyContent: 'center',
                paddingHorizontal: scale(28),
                backgroundColor: isDark ? '#0F172A' : '#F8FAFC',
            }}
        >
            <Text variant="h2" align="center" style={{ marginBottom: scale(10) }}>
                {title}
            </Text>
            <Text
                variant="body"
                align="center"
                style={{ color: isDark ? '#94A3B8' : '#64748B', lineHeight: scale(24) }}
            >
                {subtitle || 'This section is ready in the app shell and will be built next.'}
            </Text>
        </View>
    );
}
