import React from 'react';
import { View, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { scale } from '@/hooks/useResponsive';
import { useTheme } from '@/hooks/useTheme';

interface ProgressBarProps {
    currentStep: number;
    totalSteps?: number;
}

export function ProgressBar({ currentStep, totalSteps = 9 }: ProgressBarProps) {
    const { isDark } = useTheme();

    return (
        <View style={styles.container}>
            {Array.from({ length: totalSteps }, (_, i) => {
                const stepNum = i + 1;
                const isCompleted = stepNum < currentStep;
                const isCurrent = stepNum === currentStep;

                return (
                    <View
                        key={stepNum}
                        style={[
                            styles.segment,
                            {
                                backgroundColor: isDark ? '#334155' : '#E2E8F0',
                            },
                        ]}
                    >
                        {(isCompleted || isCurrent) && (
                            <LinearGradient
                                colors={['#FE8A7B', '#F34B6F']}
                                start={{ x: 0, y: 0 }}
                                end={{ x: 1, y: 0 }}
                                style={[
                                    StyleSheet.absoluteFillObject,
                                    { opacity: isCurrent ? 0.7 : 1 },
                                ]}
                            />
                        )}
                    </View>
                );
            })}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flexDirection: 'row',
        gap: scale(4),
        paddingHorizontal: scale(20),
        paddingVertical: scale(12),
    },
    segment: {
        flex: 1,
        height: scale(4),
        borderRadius: scale(2),
        overflow: 'hidden',
    },
});
