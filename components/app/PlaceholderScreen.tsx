import React from 'react';
import { View } from 'react-native';
import { Text } from '@/components/ui/Text';
import { useColors } from '@/hooks/useColors';
import { scale } from '@/hooks/useResponsive';
import { space } from '@/constants/uiTokens';

type PlaceholderScreenProps = {
    title: string;
    subtitle?: string;
};

export function PlaceholderScreen({ title, subtitle }: PlaceholderScreenProps) {
    const colors = useColors();

    return (
        <View
            style={{
                flex: 1,
                justifyContent: 'center',
                paddingHorizontal: space('lg'),
                backgroundColor: colors.brand.bg.surface,
            }}
        >
            <Text variant="h2" align="center" style={{ marginBottom: space('sm') }}>
                {title}
            </Text>
            <Text
                variant="body"
                align="center"
                style={{ color: colors.brand.text.subtitle, lineHeight: scale(24) }}
            >
                {subtitle || 'This section is ready in the app shell and will be built next.'}
            </Text>
        </View>
    );
}
