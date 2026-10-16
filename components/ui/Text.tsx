import React from "react";
import { StyleSheet, Text as RNText, TextProps as RNTextProps, TextStyle } from "react-native";
import { textUsesArabicScript, Typography } from "@/constants/typography";

export type TextVariant =
    | "h1"
    | "h2"
    | "h3"
    | "heading"
    | "heading-sm"
    | "subtitle"
    | "body"
    | "body-sm"
    | "caption"
    | "button";

interface TextProps extends RNTextProps {
    variant?: TextVariant;
    children: React.ReactNode;
    className?: string;
    align?: "left" | "center" | "right";
}

function textFromNode(node: React.ReactNode): string {
    if (typeof node === "string" || typeof node === "number") return String(node);
    if (Array.isArray(node)) return node.map(textFromNode).join("");
    if (React.isValidElement<{ children?: React.ReactNode }>(node)) {
        return textFromNode(node.props.children);
    }
    return "";
}

export const Text: React.FC<TextProps> = ({
    variant = "body",
    children,
    className = "",
    align,
    style,
    ...props
}) => {
    const isArabicFamily = textUsesArabicScript(textFromNode(children));
    const font = (fontFamily: string | undefined, fontWeight: TextStyle["fontWeight"]): TextStyle => ({
        fontFamily,
        fontWeight: fontFamily ? undefined : fontWeight,
    });

    const fontOverride = (): TextStyle => {
        if (className.includes("font-body-bold")) {
            return font(isArabicFamily ? Typography.font.arabic.bold : Typography.font.body.bold, "700");
        }
        if (className.includes("font-body-semi")) {
            return font(isArabicFamily ? Typography.font.arabic.semi : Typography.font.body.semi, "600");
        }
        if (className.includes("font-body-medium")) {
            return font(isArabicFamily ? Typography.font.arabic.semi : Typography.font.body.medium, "500");
        }
        if (className.includes("font-heading-extra")) {
            return font(isArabicFamily ? Typography.font.arabic.bold : Typography.font.heading.extra, "800");
        }
        if (className.includes("font-heading-semi")) {
            return font(isArabicFamily ? Typography.font.arabic.semi : Typography.font.heading.semi, "600");
        }
        if (className.includes("font-heading-medium")) {
            return font(isArabicFamily ? Typography.font.arabic.semi : Typography.font.heading.medium, "500");
        }
        if (className.includes("font-heading")) {
            return font(isArabicFamily ? Typography.font.arabic.bold : Typography.font.heading.bold, "700");
        }
        return {};
    };

    const getVariantStyles = (): TextStyle => {
        switch (variant) {
            case "h1":
                return {
                    ...font(isArabicFamily ? Typography.font.arabic.bold : Typography.font.heading.extra, "800"),
                    fontSize: Typography.size["4xl"],
                    lineHeight: Typography.lineHeight["4xl"],
                    letterSpacing: 0,
                };
            case "h2":
                return {
                    ...font(isArabicFamily ? Typography.font.arabic.bold : Typography.font.heading.bold, "700"),
                    fontSize: Typography.size["3xl"],
                    lineHeight: Typography.lineHeight["3xl"],
                    letterSpacing: 0,
                };
            case "h3":
            case "heading-sm":
                return {
                    ...font(isArabicFamily ? Typography.font.arabic.semi : Typography.font.heading.semi, "600"),
                    fontSize: Typography.size["2xl"],
                    lineHeight: Typography.lineHeight["2xl"],
                    letterSpacing: 0,
                };
            case "heading":
                return {
                    ...font(isArabicFamily ? Typography.font.arabic.bold : Typography.font.heading.bold, "700"),
                    fontSize: Typography.size["3xl"],
                    lineHeight: Typography.lineHeight["3xl"],
                    letterSpacing: 0,
                };
            case "subtitle":
                return {
                    ...font(isArabicFamily ? Typography.font.arabic.regular : Typography.font.heading.medium, "500"),
                    fontSize: Typography.size.sm,
                    lineHeight: Typography.lineHeight.sm,
                    letterSpacing: 0,
                    textTransform: "uppercase"
                };
            case "body":
                return {
                    ...font(isArabicFamily ? Typography.font.arabic.regular : Typography.font.body.regular, "400"),
                    fontSize: Typography.size.base,
                    lineHeight: Typography.lineHeight.base,
                    letterSpacing: 0,
                };
            case "body-sm":
                return {
                    ...font(isArabicFamily ? Typography.font.arabic.regular : Typography.font.body.regular, "400"),
                    fontSize: Typography.size.sm,
                    lineHeight: Typography.lineHeight.sm,
                    letterSpacing: 0,
                };
            case "caption":
                return {
                    ...font(isArabicFamily ? Typography.font.arabic.regular : Typography.font.body.regular, "400"),
                    fontSize: Typography.size.xs,
                    lineHeight: Typography.lineHeight.xs,
                    letterSpacing: 0,
                };
            case "button":
                return {
                    ...font(isArabicFamily ? Typography.font.arabic.semi : Typography.font.body.semi, "600"),
                    fontSize: Typography.size.lg,
                    lineHeight: Typography.lineHeight.lg,
                    letterSpacing: 0,
                };
            default:
                return {
                    ...font(isArabicFamily ? Typography.font.arabic.regular : Typography.font.body.regular, "400"),
                    fontSize: Typography.size.base,
                    lineHeight: Typography.lineHeight.base,
                    letterSpacing: 0,
                };
        }
    };

    const variantStyle = getVariantStyles();
    const resolvedStyle = StyleSheet.flatten([variantStyle, fontOverride(), style]);
    // Arabic ascenders and marks need more room than compact Latin line boxes.
    const arabicLineHeight = resolvedStyle.fontFamily?.startsWith('NotoSansArabic')
        ? Math.max(resolvedStyle.lineHeight ?? 0, Math.ceil((resolvedStyle.fontSize ?? 16) * 1.6))
        : undefined;

    const colorClass = variant === "subtitle" ? "text-brand-text-subtitle" :
        variant === "caption" ? "text-brand-text-muted" :
            variant === "button" ? "text-white" :
                (variant === "h1" || variant === "h2" || variant === "h3" || variant === "heading" || variant === "heading-sm") ? "text-brand-text-heading" : "text-brand-text-body";

    const alignmentClass = align === "center" ? "text-center" :
        align === "right" ? "text-right" :
            align === "left" ? "text-left" : "";

    return (
        <RNText
            className={`${colorClass} ${alignmentClass} ${className}`}
            style={[
                {
                    fontFamily: variantStyle.fontFamily,
                    fontWeight: variantStyle.fontWeight,
                    fontSize: variantStyle.fontSize,
                    lineHeight: variantStyle.lineHeight,
                    letterSpacing: variantStyle.letterSpacing,
                    textTransform: variantStyle.textTransform,
                },
                fontOverride(),
                style,
                arabicLineHeight === undefined ? undefined : { lineHeight: arabicLineHeight }
            ]}
            {...props}
        >
            {children}
        </RNText>
    );
};
