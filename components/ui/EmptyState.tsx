import React from 'react';
import { ActivityIndicator, StyleSheet, View, type ViewStyle } from 'react-native';
import { Text } from '@/components/ui/Text';
import { PressableScale } from '@/components/ui/PressableScale';
import { useColors } from '@/hooks/useColors';
import { BRAND_PRIMARY } from '@/constants/Colors';
import { scale } from '@/hooks/useResponsive';

type EmptyStateAction = {
    label: string;
    onPress: () => void;
    variant?: 'primary' | 'secondary';
    disabled?: boolean;
    loading?: boolean;
};

type EmptyStateProps = {
    /** Lucide icon element; sized/tinted by the caller (recommended: size scale(30), brand primary). */
    icon: React.ReactNode;
    title: string;
    description?: string;
    actions?: EmptyStateAction[];
    style?: ViewStyle;
};

/**
 * Shared empty-state layout: icon in a soft tinted disc, title, one-line
 * explanation and optional CTA row. Keeps every "nothing here yet" screen
 * visually consistent.
 */
export function EmptyState({ icon, title, description, actions, style }: EmptyStateProps) {
    const colors = useColors();

    return (
        <View style={[styles.wrap, style]}>
            <View style={[styles.iconHalo, { backgroundColor: colors.chrome.common.primaryGlow }]}>
                <View style={[styles.iconDisc, { backgroundColor: colors.chrome.common.primaryTint }]}>
                    {icon}
                </View>
            </View>
            <Text variant="h3" align="center" style={styles.title}>
                {title}
            </Text>
            {description ? (
                <Text variant="body-sm" align="center" style={[styles.description, { color: colors.brand.text.subtitle }]}>
                    {description}
                </Text>
            ) : null}
            {actions?.length ? (
                <View style={styles.actions}>
                    {actions.map((action) => {
                        const secondary = action.variant === 'secondary';
                        return (
                            <PressableScale
                                key={action.label}
                                onPress={action.onPress}
                                disabled={action.disabled}
                                activeScale={0.95}
                                accessibilityRole="button"
                                accessibilityLabel={action.label}
                                style={[
                                    styles.button,
                                    action.disabled ? styles.buttonDisabled : null,
                                    secondary
                                        ? { backgroundColor: 'transparent', borderWidth: 1, borderColor: BRAND_PRIMARY }
                                        : { backgroundColor: BRAND_PRIMARY },
                                ]}
                            >
                                {action.loading ? (
                                    <ActivityIndicator
                                        size="small"
                                        color={secondary ? colors.chrome.primary : colors.chrome.common.inverseText}
                                    />
                                ) : (
                                    <Text
                                        variant="body-sm"
                                        className="font-body-semi"
                                        style={{ color: secondary ? colors.chrome.primary : colors.chrome.common.inverseText }}
                                    >
                                        {action.label}
                                    </Text>
                                )}
                            </PressableScale>
                        );
                    })}
                </View>
            ) : null}
        </View>
    );
}

const styles = StyleSheet.create({
    wrap: {
        alignItems: 'center',
        paddingHorizontal: scale(28),
    },
    iconHalo: {
        width: scale(96),
        height: scale(96),
        borderRadius: scale(48),
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: scale(18),
    },
    iconDisc: {
        width: scale(68),
        height: scale(68),
        borderRadius: scale(34),
        alignItems: 'center',
        justifyContent: 'center',
    },
    title: {
        maxWidth: scale(280),
    },
    description: {
        marginTop: scale(8),
        maxWidth: scale(300),
        lineHeight: scale(20),
    },
    actions: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: scale(10),
        marginTop: scale(20),
    },
    button: {
        borderRadius: 999,
        paddingHorizontal: scale(20),
        paddingVertical: scale(11),
        minHeight: scale(44),
        alignItems: 'center',
        justifyContent: 'center',
    },
    buttonDisabled: {
        opacity: 0.65,
    },
});
