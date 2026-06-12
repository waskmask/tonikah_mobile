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
}

export const Input: React.FC<InputProps> = ({
    label,
    error,
    leftIcon,
    rightIcon,
    containerStyle = "",
    onFocus,
    onBlur,
    ...props
}) => {
    const [isFocused, setIsFocused] = useState(false);
    const { currentLanguage, isRTL } = useLanguage();
    const { isDark } = useTheme();
    const inputFontFamily = currentLanguage === "ar" ? Typography.font.arabic.regular : Typography.font.body.regular;

    return (
        <View className={`mb-3 w-full ${containerStyle}`}>
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
                        borderWidth: 1,
                        borderRadius: scale(12),
                        overflow: 'hidden',
                        paddingHorizontal: scale(16),
                        height: scale(48),
                        backgroundColor: isDark ? '#1E293B' : '#FFFFFF',
                        borderColor: error
                            ? '#EF4444'
                            : isFocused
                                ? '#F34B6F'
                                : isDark ? '#334155' : '#E2E8F0',
                    },
                ]}
            >
                {leftIcon && (
                    <View style={{ [isRTL ? 'marginLeft' : 'marginRight']: scale(10) }}>
                        {leftIcon}
                    </View>
                )}

                <TextInput
                    placeholderTextColor={isDark ? '#64748B' : '#9CA3AF'}
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
                        fontSize: scale(14),
                        fontFamily: inputFontFamily,
                        color: isDark ? '#E2E8F0' : '#0A0D14',
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
                <Text variant="caption" style={{ color: '#EF4444', marginTop: scale(4), marginLeft: scale(4) }}>
                    {error}
                </Text>
            )}
        </View>
    );
};
