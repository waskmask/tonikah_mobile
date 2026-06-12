import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Text } from '@/components/ui/Text';
import { useTheme } from '@/hooks/useTheme';
import { scale } from '@/hooks/useResponsive';

type ProfileSetupHeaderProps = {
    title: string;
    subtitle: string;
};

export function ProfileSetupHeader({ title, subtitle }: ProfileSetupHeaderProps) {
    const { isDark } = useTheme();

    return (
        <View style={styles.container}>
            <Text variant="heading-sm" align="center" style={styles.title}>
                {title}
            </Text>
            <Text
                variant="body-sm"
                align="center"
                style={[
                    styles.subtitle,
                    { color: isDark ? '#94A3B8' : '#6B7280' },
                ]}
            >
                {subtitle}
            </Text>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        marginBottom: scale(18),
    },
    title: {
        fontSize: 24,
        lineHeight: 30,
    },
    subtitle: {
        marginTop: scale(8),
        fontSize: 15,
        lineHeight: 22,
    },
});

