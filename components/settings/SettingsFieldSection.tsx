import React from 'react';
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { Text } from '@/components/ui/Text';
import { useColors } from '@/hooks/useColors';
import { useLanguage } from '@/hooks/useLanguage';
import { scale } from '@/hooks/useResponsive';

type SettingsFieldSectionProps = {
    title?: string;
    actionLabel?: string;
    onAction?: () => void;
    children: React.ReactNode;
    contentInset?: boolean;
    style?: StyleProp<ViewStyle>;
};

/** Full-width settings section. Rows provide their own shared 16pt edge inset. */
export function SettingsFieldSection({
    title,
    actionLabel,
    onAction,
    children,
    contentInset = false,
    style,
}: SettingsFieldSectionProps) {
    const colors = useColors();
    const { isRTL } = useLanguage();

    return (
        <View style={[styles.section, { borderColor: colors.brand.bg.border }, style]}>
            {title ? (
                <View style={[styles.header, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
                    <Text variant="h3" style={[styles.title, { textAlign: isRTL ? 'right' : 'left' }]}>
                        {title}
                    </Text>
                    {actionLabel && onAction ? (
                        <Pressable onPress={onAction} hitSlop={8}>
                            <Text
                                variant="caption"
                                className="font-body-semi"
                                style={{ color: colors.chrome.primary }}
                            >
                                {actionLabel}
                            </Text>
                        </Pressable>
                    ) : null}
                </View>
            ) : null}
            <View
                style={[
                    contentInset ? styles.insetContent : undefined,
                    contentInset && !title ? styles.untitledInsetContent : undefined,
                ]}
            >
                {children}
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    section: {
        borderBottomWidth: StyleSheet.hairlineWidth,
    },
    header: {
        minHeight: scale(44),
        paddingHorizontal: scale(16),
        paddingTop: scale(18),
        paddingBottom: scale(6),
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: scale(12),
    },
    title: {
        flex: 1,
        fontSize: scale(18),
        lineHeight: scale(24),
    },
    insetContent: {
        paddingHorizontal: scale(16),
        paddingBottom: scale(16),
    },
    untitledInsetContent: {
        paddingTop: scale(18),
    },
});
