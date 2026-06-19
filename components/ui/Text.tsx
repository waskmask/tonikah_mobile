import React from "react";
import { Text as RNText, TextProps as RNTextProps, TextStyle } from "react-native";
import { useLanguage } from "@/hooks/useLanguage";
import { Typography } from "@/constants/typography";

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

export const Text: React.FC<TextProps> = ({
    variant = "body",
    children,
    className = "",
    align,
    style,
    ...props
}) => {
    const { currentLanguage, isRTL } = useLanguage();
    const isArabicFamily = currentLanguage === "ar";
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
                    fontSize: Typography.size["4xl"]
                };
            case "h2":
                return {
                    ...font(isArabicFamily ? Typography.font.arabic.bold : Typography.font.heading.bold, "700"),
                    fontSize: Typography.size["3xl"]
                };
            case "h3":
            case "heading-sm":
                return {
                    ...font(isArabicFamily ? Typography.font.arabic.semi : Typography.font.heading.semi, "600"),
                    fontSize: Typography.size["2xl"]
                };
            case "heading":
                return {
                    ...font(isArabicFamily ? Typography.font.arabic.bold : Typography.font.heading.bold, "700"),
                    fontSize: Typography.size["3xl"]
                };
            case "subtitle":
                return {
                    ...font(isArabicFamily ? Typography.font.arabic.regular : Typography.font.heading.medium, "500"),
                    fontSize: Typography.size.sm,
                    letterSpacing: 2,
                    textTransform: "uppercase"
                };
            case "body":
                return {
                    ...font(isArabicFamily ? Typography.font.arabic.regular : Typography.font.body.regular, "400"),
                    fontSize: Typography.size.base
                };
            case "body-sm":
                return {
                    ...font(isArabicFamily ? Typography.font.arabic.regular : Typography.font.body.regular, "400"),
                    fontSize: Typography.size.sm
                };
            case "caption":
                return {
                    ...font(isArabicFamily ? Typography.font.arabic.regular : Typography.font.body.regular, "400"),
                    fontSize: Typography.size.xs
                };
            case "button":
                return {
                    ...font(isArabicFamily ? Typography.font.arabic.semi : Typography.font.body.semi, "600"),
                    fontSize: Typography.size.lg
                };
            default:
                return {
                    ...font(isArabicFamily ? Typography.font.arabic.regular : Typography.font.body.regular, "400"),
                    fontSize: Typography.size.base
                };
        }
    };

    const variantStyle = getVariantStyles();

    const colorClass = variant === "subtitle" ? "text-brand-text-subtitle" :
        variant === "caption" ? "text-brand-text-muted" :
            variant === "button" ? "text-white" :
                (variant === "h1" || variant === "h2" || variant === "h3" || variant === "heading" || variant === "heading-sm") ? "text-brand-text-heading" : "text-brand-text-body";

    const alignmentClass = align === "center" ? "text-center" :
        align === "right" ? (isRTL ? "text-left" : "text-right") :
            align === "left" ? (isRTL ? "text-right" : "text-left") : "";

    return (
        <RNText
            className={`${colorClass} ${alignmentClass} ${className}`}
            style={[
                {
                    fontFamily: variantStyle.fontFamily,
                    fontWeight: variantStyle.fontWeight,
                    fontSize: variantStyle.fontSize,
                    letterSpacing: variantStyle.letterSpacing,
                    textTransform: variantStyle.textTransform,
                },
                fontOverride(),
                style
            ]}
            {...props}
        >
            {children}
        </RNText>
    );
};
