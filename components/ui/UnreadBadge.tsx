import React from "react";
import { StyleSheet, Text as RNText, View, type ViewStyle } from "react-native";
import { BadgeSize, formatBadgeCount } from "@/constants/uiTokens";
import { useColors } from "@/hooks/useColors";

type BadgeVariant = keyof typeof BadgeSize;

type UnreadBadgeProps = {
    count: number;
    variant?: BadgeVariant;
    borderColor?: string;
    style?: ViewStyle;
};

export function UnreadBadge({
    count,
    variant = "md",
    borderColor,
    style,
}: UnreadBadgeProps) {
    const colors = useColors();
    const tokens = BadgeSize[variant];

    if (count <= 0) return null;

    return (
        <View
            style={[
                styles.base,
                {
                    minWidth: tokens.minWidth,
                    height: tokens.height,
                    borderRadius: tokens.borderRadius,
                    paddingHorizontal: tokens.paddingHorizontal,
                    borderWidth: tokens.borderWidth,
                    borderColor: borderColor ?? colors.chrome.badge.border,
                    backgroundColor: colors.chrome.badge.background,
                },
                style,
            ]}
        >
            <RNText
                numberOfLines={1}
                style={{
                    color: colors.chrome.badge.text,
                    fontSize: tokens.fontSize,
                    lineHeight: tokens.lineHeight,
                    fontWeight: "700",
                    includeFontPadding: false,
                    textAlign: "center",
                }}
            >
                {formatBadgeCount(count)}
            </RNText>
        </View>
    );
}

const styles = StyleSheet.create({
    base: {
        alignItems: "center",
        justifyContent: "center",
    },
});
