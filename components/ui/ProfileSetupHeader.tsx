import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Text } from '@/components/ui/Text';
import { useColors } from '@/hooks/useColors';
import { scale } from '@/hooks/useResponsive';
import { space } from '@/constants/uiTokens';

type ProfileSetupHeaderProps = {
    title: string;
    subtitle: string;
    step?: number;
    totalSteps?: number;
};

export function ProfileSetupHeader({ title, subtitle, step, totalSteps = 10 }: ProfileSetupHeaderProps) {
    const colors = useColors();

    return (
        <View style={styles.container}>
            {typeof step === 'number' ? (
                <Text
                    variant="caption"
                    align="center"
                    className="font-body-semi"
                    style={{ color: colors.chrome.primary, marginBottom: space('xs') }}
                >
                    {`Step ${step} / ${totalSteps}`}
                </Text>
            ) : null}
            <Text variant="heading-sm" align="center" style={styles.title}>
                {title}
            </Text>
            <Text
                variant="body-sm"
                align="center"
                style={[styles.subtitle, { color: colors.brand.text.subtitle }]}
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
        fontSize: scale(24),
        lineHeight: scale(30),
    },
    subtitle: {
        marginTop: space('sm'),
        fontSize: scale(15),
        lineHeight: scale(22),
    },
});
