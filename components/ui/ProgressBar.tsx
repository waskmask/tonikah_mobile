import React from 'react';
import { StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Text } from '@/components/ui/Text';
import { scale } from '@/hooks/useResponsive';
import { useColors } from '@/hooks/useColors';
import { space } from '@/constants/uiTokens';

interface ProgressBarProps {
    currentStep: number;
    totalSteps?: number;
    showLabel?: boolean;
}

export function ProgressBar({ currentStep, totalSteps = 10, showLabel = true }: ProgressBarProps) {
    const colors = useColors();
    const track = colors.brand.bg.border;
    const gradient = [colors.chrome.primary, colors.chrome.primaryEnd] as [string, string];
    const percent = Math.round((currentStep / totalSteps) * 100);

    return (
        <View style={styles.wrapper}>
            <View style={styles.container}>
                {Array.from({ length: totalSteps }, (_, i) => {
                    const stepNum = i + 1;
                    const isCompleted = stepNum < currentStep;
                    const isCurrent = stepNum === currentStep;

                    return (
                        <View
                            key={stepNum}
                            style={[styles.segment, { backgroundColor: track }]}
                        >
                            {(isCompleted || isCurrent) && (
                                <LinearGradient
                                    colors={gradient}
                                    start={{ x: 0, y: 0 }}
                                    end={{ x: 1, y: 0 }}
                                    style={[
                                        StyleSheet.absoluteFill,
                                        { opacity: isCurrent ? 0.85 : 1 },
                                    ]}
                                />
                            )}
                        </View>
                    );
                })}
            </View>
            {showLabel ? (
                <Text
                    variant="caption"
                    align="center"
                    style={[styles.label, { color: colors.brand.text.subtitle }]}
                >
                    {`Step ${currentStep} of ${totalSteps} · ${percent}%`}
                </Text>
            ) : null}
        </View>
    );
}

const styles = StyleSheet.create({
    wrapper: {
        paddingBottom: space('xs'),
    },
    container: {
        flexDirection: 'row',
        gap: scale(4),
        paddingHorizontal: scale(20),
        paddingTop: scale(12),
        paddingBottom: scale(6),
    },
    segment: {
        flex: 1,
        height: scale(4),
        borderRadius: scale(2),
        overflow: 'hidden',
    },
    label: {
        fontSize: scale(12),
        lineHeight: scale(16),
    },
});
