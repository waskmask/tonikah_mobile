import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { CaretLeft, CaretRight } from 'phosphor-react-native';
import { scale } from '@/hooks/useResponsive';
import { useColors } from '@/hooks/useColors';
import { useLanguage } from '@/hooks/useLanguage';
import { t } from '@/lib/profileDisplay';
import { space } from '@/constants/uiTokens';

interface ProgressBarProps {
    currentStep: number;
    totalSteps?: number;
    showLabel?: boolean;
}

// Segments only — no step text anywhere in the flow by design
export function ProgressBar({ currentStep, totalSteps = 10 }: ProgressBarProps) {
    const colors = useColors();
    const { isRTL } = useLanguage();
    const track = colors.brand.bg.border;
    const gradient = [colors.brand.gradient.start, colors.brand.gradient.end] as [string, string];

    return (
        <View style={styles.wrapper}>
            {currentStep > 1 ? (
                <Pressable
                    onPress={() => router.replace(`/(profile-setup)/step${currentStep - 1}` as any)}
                    accessibilityRole="button"
                    accessibilityLabel={t('back', 'Back')}
                    hitSlop={10}
                    style={[styles.backButton, isRTL ? styles.backButtonRtl : styles.backButtonLtr]}
                >
                    {isRTL
                        ? <CaretRight size={scale(22)} color={colors.chrome.header.icon} weight="bold" />
                        : <CaretLeft size={scale(22)} color={colors.chrome.header.icon} weight="bold" />}
                </Pressable>
            ) : null}
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
        </View>
    );
}

const styles = StyleSheet.create({
    wrapper: {
        paddingBottom: space('xs'),
        minHeight: scale(44),
        justifyContent: 'flex-end',
    },
    backButton: {
        position: 'absolute',
        top: scale(2),
        width: scale(40),
        height: scale(34),
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1,
    },
    backButtonLtr: { left: scale(8) },
    backButtonRtl: { right: scale(8) },
    container: {
        flexDirection: 'row',
        gap: scale(4),
        paddingHorizontal: scale(20),
        paddingTop: scale(36),
        paddingBottom: scale(6),
    },
    segment: {
        flex: 1,
        height: scale(4),
        borderRadius: scale(2),
        overflow: 'hidden',
    },
});
