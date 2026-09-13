import React from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { CloudOff, RefreshCw } from 'lucide-react-native';
import { Text } from '@/components/ui/Text';
import { PressableScale } from '@/components/ui/PressableScale';
import { useColors } from '@/hooks/useColors';
import { scale } from '@/hooks/useResponsive';

type InlineLoadErrorProps = {
    title: string;
    description: string;
    retryLabel: string;
    onRetry: () => void;
    retrying?: boolean;
};

export function InlineLoadError({
    title,
    description,
    retryLabel,
    onRetry,
    retrying = false,
}: InlineLoadErrorProps) {
    const colors = useColors();

    return (
        <View style={styles.wrap}>
            <View style={[styles.iconTile, { backgroundColor: colors.chrome.common.primaryTint }]}>
                <CloudOff size={scale(22)} color={colors.chrome.primary} strokeWidth={1.8} />
            </View>
            <Text variant="body" className="font-body-semi" align="center">
                {title}
            </Text>
            <Text
                variant="body-sm"
                align="center"
                style={[styles.description, { color: colors.brand.text.subtitle }]}
            >
                {description}
            </Text>
            <PressableScale
                onPress={onRetry}
                disabled={retrying}
                accessibilityRole="button"
                accessibilityLabel={retryLabel}
                accessibilityState={{ disabled: retrying, busy: retrying }}
                activeScale={0.96}
                style={[
                    styles.retryButton,
                    {
                        backgroundColor: colors.chrome.common.primaryTint,
                        borderColor: colors.chrome.primary,
                    },
                ]}
            >
                {retrying ? (
                    <ActivityIndicator size="small" color={colors.chrome.primary} />
                ) : (
                    <>
                        <RefreshCw size={scale(16)} color={colors.chrome.primary} />
                        <Text variant="body-sm" className="font-body-semi" style={{ color: colors.chrome.primary }}>
                            {retryLabel}
                        </Text>
                    </>
                )}
            </PressableScale>
        </View>
    );
}

const styles = StyleSheet.create({
    wrap: {
        alignItems: 'center',
        paddingHorizontal: scale(24),
        gap: scale(8),
    },
    iconTile: {
        width: scale(44),
        height: scale(44),
        borderRadius: scale(8),
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: scale(4),
    },
    description: {
        maxWidth: scale(280),
        lineHeight: scale(19),
    },
    retryButton: {
        minHeight: scale(40),
        borderWidth: 1,
        borderRadius: scale(8),
        paddingHorizontal: scale(16),
        marginTop: scale(8),
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: scale(7),
    },
});
