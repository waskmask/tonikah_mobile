import React from 'react';
import { View, Pressable, StyleSheet } from 'react-native';
import { Text } from './Text';
import { scale } from '@/hooks/useResponsive';
import { useTheme } from '@/hooks/useTheme';
import { useLanguage } from '@/hooks/useLanguage';

/** Field label with optional red asterisk */
export function FieldLabel({ text, required }: { text: string; required?: boolean }) {
    const { isRTL } = useLanguage();
    return (
        <View style={{ flexDirection: isRTL ? 'row-reverse' : 'row', marginBottom: scale(6), marginTop: scale(12) }}>
            <Text variant="body-sm" className="font-medium">{text}</Text>
            {required && <Text variant="body-sm" style={{ color: '#EF4444', marginLeft: isRTL ? 0 : 2, marginRight: isRTL ? 2 : 0 }}> *</Text>}
        </View>
    );
}

/** Error message text */
export function ErrorText({ text }: { text: string }) {
    const { isRTL } = useLanguage();
    return (
        <Text variant="body-sm" style={{ color: '#EF4444', marginTop: scale(4), textAlign: isRTL ? 'right' : 'left', paddingHorizontal: scale(4), marginBottom: scale(4) }}>
            {text}
        </Text>
    );
}

/** Pressable select field that looks like an input with icon on the right (flips in RTL) */
export function SelectField({
    value,
    placeholder,
    onPress,
    icon,
    hasError,
}: {
    value: string;
    placeholder: string;
    onPress: () => void;
    icon: React.ReactNode;
    hasError?: boolean;
}) {
    const { isDark } = useTheme();
    const { isRTL } = useLanguage();

    return (
        <Pressable
            onPress={onPress}
            style={[
                {
                    flexDirection: isRTL ? 'row-reverse' : 'row',
                    alignItems: 'center',
                    borderWidth: 1,
                    borderRadius: scale(12),
                    paddingHorizontal: scale(16),
                    height: scale(50),
                    gap: scale(10),
                    backgroundColor: isDark ? '#1E293B' : '#FFFFFF',
                    borderColor: hasError ? '#EF4444' : isDark ? '#334155' : '#E2E8F0',
                },
            ]}
        >
            <Text
                variant="body"
                numberOfLines={1}
                style={[
                    { flex: 1, textAlign: isRTL ? 'right' : 'left' },
                    value
                        ? { color: isDark ? '#E2E8F0' : '#0A0D14' }
                        : { color: isDark ? '#64748B' : '#9CA3AF' },
                ]}
            >
                {value || placeholder}
            </Text>
            {icon}
        </Pressable>
    );
}
