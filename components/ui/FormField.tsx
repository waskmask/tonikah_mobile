import React from 'react';
import { View, Pressable, StyleSheet, Keyboard } from 'react-native';
import { Text } from './Text';
import { scale } from '@/hooks/useResponsive';
import { useTheme } from '@/hooks/useTheme';
import { useLanguage } from '@/hooks/useLanguage';
import { Typography } from '@/constants/typography';

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

/** Error message text — rendered absolutely inside the gap below the field so
    it never pushes the layout */
export function ErrorText({ text }: { text: string }) {
    const { isRTL } = useLanguage();
    return (
        <View style={{ height: 0, zIndex: 1 }} pointerEvents="none">
            <Text
                variant="caption"
                numberOfLines={1}
                style={{
                    position: 'absolute',
                    top: scale(3),
                    left: scale(6),
                    right: scale(6),
                    color: '#EF4444',
                    fontSize: scale(11),
                    textAlign: isRTL ? 'right' : 'left',
                }}
            >
                {text}
            </Text>
        </View>
    );
}

/** Pressable select field that looks like an input with icon on the right (flips in RTL) */
export function SelectField({
    value,
    placeholder,
    onPress,
    icon,
    hasError,
    required,
}: {
    value: string;
    placeholder: string;
    onPress: () => void;
    icon: React.ReactNode;
    hasError?: boolean;
    /** Appends an asterisk to the placeholder (labels were removed from the flow) */
    required?: boolean;
}) {
    const { isDark } = useTheme();
    const { isRTL, currentLanguage } = useLanguage();
    // Mirror the auth Input exactly: 14pt; placeholder regular (light),
    // selected value semibold (600 — Jakarta's 500 reads too close to 400)
    const valueFont = currentLanguage === 'ar'
        ? (value ? Typography.font.arabic.semi : Typography.font.arabic.regular)
        : value ? Typography.font.body.semi : Typography.font.body.regular;

    return (
        <Pressable
            // Blur any focused TextInput and wait for the keyboard to actually
            // hide before opening: otherwise Android sizes the modal window to
            // the keyboard-shrunken screen and the sheet floats mid-air. Also
            // prevents the input refocus-on-modal-close loop.
            onPress={() => {
                if (Keyboard.isVisible()) {
                    Keyboard.dismiss();
                    setTimeout(onPress, 150);
                } else {
                    onPress();
                }
            }}
            style={[
                {
                    flexDirection: isRTL ? 'row-reverse' : 'row',
                    alignItems: 'center',
                    // Underline style matching the auth Input: bottom border only
                    borderBottomWidth: 1,
                    paddingHorizontal: scale(6),
                    height: scale(44),
                    // Labels are gone — fields need their own breathing room
                    // (error text renders absolutely inside this gap)
                    marginTop: scale(22),
                    gap: scale(10),
                    backgroundColor: 'transparent',
                    borderBottomColor: hasError ? '#EF4444' : isDark ? '#3A332B' : '#E8E1D6',
                },
            ]}
        >
            <Text
                variant="body"
                numberOfLines={1}
                style={[
                    {
                        flex: 1,
                        textAlign: isRTL ? 'right' : 'left',
                        fontSize: scale(14),
                        fontFamily: valueFont,
                    },
                    value
                        ? { color: isDark ? '#E8E1D6' : '#201B15' }
                        : { color: isDark ? '#A99C8D' : '#5C5348' },
                ]}
            >
                {value || (required ? `${placeholder} *` : placeholder)}
            </Text>
            {icon}
        </Pressable>
    );
}
