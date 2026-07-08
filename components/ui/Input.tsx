import React, { useState } from "react";
import { TextInput, View, TextInputProps, NativeSyntheticEvent, TextInputFocusEventData } from "react-native";
import { Text } from "./Text";
import { scale } from "@/hooks/useResponsive";
import { useLanguage } from "@/hooks/useLanguage";
import { useTheme } from "@/hooks/useTheme";
import { Typography } from "@/constants/typography";

interface InputProps extends TextInputProps {
    label?: string;
    error?: string;
    leftIcon?: React.ReactNode;
    rightIcon?: React.ReactNode;
    containerStyle?: string;
    /** Appends an asterisk to the placeholder (forms drop labels, placeholder carries it) */
    required?: boolean;
}

export const Input: React.FC<InputProps> = ({
    label,
    error,
    leftIcon,
    rightIcon,
    containerStyle = "",
    required,
    placeholder,
    onFocus,
    onBlur,
    ...props
}) => {
    const [isFocused, setIsFocused] = useState(false);
    const { currentLanguage, isRTL } = useLanguage();
    const { isDark } = useTheme();
    // Placeholder can't be styled separately in RN, but it only shows while the
    // field is empty — so swap the whole font: regular (light) when empty,
    // semibold (600 — Jakarta's 500 reads too close to 400) once typed.
    const hasValue = Boolean(props.value && String(props.value).length > 0);
    const inputFontFamily = currentLanguage === "ar"
        ? (hasValue ? Typography.font.arabic.semi : Typography.font.arabic.regular)
        : hasValue ? Typography.font.body.semi : Typography.font.body.regular;

    return (
        // containerStyle replaces the default bottom margin when provided
        <View className={`w-full ${containerStyle || 'mb-3'}`}>
            {label && (
                <Text variant="body-sm" className="font-medium mb-1.5 ml-1">
                    {label}
                </Text>
            )}
            <View
                style={[
                    {
                        flexDirection: isRTL ? 'row-reverse' : 'row',
                        alignItems: 'center',
                        // Underline style: bottom border only, transparent fill
                        borderBottomWidth: isFocused ? 1.5 : 1,
                        paddingHorizontal: scale(6),
                        height: scale(44),
                        backgroundColor: 'transparent',
                        borderBottomColor: error
                            ? '#EF4444'
                            : isFocused
                                ? '#F34B6F'
                                : isDark ? '#3A332B' : '#E8E1D6',
                    },
                ]}
            >
                {leftIcon && (
                    <View style={{ [isRTL ? 'marginLeft' : 'marginRight']: scale(10) }}>
                        {leftIcon}
                    </View>
                )}

                <TextInput
                    // Darker placeholder for readability; weight stays light via the
                    // regular input font (RN can't style placeholder weight separately)
                    placeholder={required && placeholder ? `${placeholder} *` : placeholder}
                    placeholderTextColor={isDark ? '#A99C8D' : '#5C5348'}
                    onFocus={(e: any) => {
                        setIsFocused(true);
                        onFocus?.(e);
                    }}
                    onBlur={(e: any) => {
                        setIsFocused(false);
                        onBlur?.(e);
                    }}
                    style={{
                        flex: 1,
                        // Fill the full row height so the entire field is tappable,
                        // not just the text line
                        height: '100%',
                        textAlignVertical: 'center',
                        fontSize: scale(14),
                        // Android TextInput ships with default vertical padding that
                        // pushes the text away from the underline
                        paddingVertical: 0,
                        fontFamily: inputFontFamily,
                        color: isDark ? '#E8E1D6' : '#201B15',
                        textAlign: isRTL ? 'right' : 'left',
                        writingDirection: isRTL ? 'rtl' : 'ltr',
                    }}
                    {...props}
                />

                {rightIcon && (
                    <View style={{ [isRTL ? 'marginRight' : 'marginLeft']: scale(10) }}>
                        {rightIcon}
                    </View>
                )}
            </View>

            {error && (
                // Absolute inside the gap below — never pushes the layout
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
                        }}
                    >
                        {error}
                    </Text>
                </View>
            )}
        </View>
    );
};
