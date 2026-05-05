import React from "react";
import { Text as RNText, TextProps as RNTextProps } from "react-native";
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

    const getVariantStyles = (): { fontFamily: string; fontSize: number; letterSpacing?: number; textTransform?: "uppercase" | "none" } => {
        switch (variant) {
            case "h1":
                return {
                    fontFamily: isArabicFamily ? Typography.font.arabic.bold : Typography.font.heading.extra,
                    fontSize: Typography.size["4xl"]
                };
            case "h2":
                return {
                    fontFamily: isArabicFamily ? Typography.font.arabic.bold : Typography.font.heading.bold,
                    fontSize: Typography.size["3xl"]
                };
            case "h3":
            case "heading-sm":
                return {
                    fontFamily: isArabicFamily ? Typography.font.arabic.semi : Typography.font.heading.semi,
                    fontSize: Typography.size["2xl"]
                };
            case "heading":
                return {
                    fontFamily: isArabicFamily ? Typography.font.arabic.bold : Typography.font.heading.bold,
                    fontSize: Typography.size["3xl"]
                };
            case "subtitle":
                return {
                    fontFamily: isArabicFamily ? Typography.font.arabic.regular : Typography.font.heading.medium,
                    fontSize: Typography.size.sm,
                    letterSpacing: 2,
                    textTransform: "uppercase"
                };
            case "body":
                return {
                    fontFamily: isArabicFamily ? Typography.font.arabic.regular : Typography.font.body.regular,
                    fontSize: Typography.size.base
                };
            case "body-sm":
                return {
                    fontFamily: isArabicFamily ? Typography.font.arabic.regular : Typography.font.body.regular,
                    fontSize: Typography.size.sm
                };
            case "caption":
                return {
                    fontFamily: isArabicFamily ? Typography.font.arabic.regular : Typography.font.body.regular,
                    fontSize: Typography.size.xs
                };
            case "button":
                return {
                    fontFamily: isArabicFamily ? Typography.font.arabic.semi : Typography.font.body.semi,
                    fontSize: Typography.size.lg
                };
            default:
                return {
                    fontFamily: isArabicFamily ? Typography.font.arabic.regular : Typography.font.body.regular,
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
                    fontSize: variantStyle.fontSize,
                    letterSpacing: variantStyle.letterSpacing,
                    textTransform: variantStyle.textTransform,
                },
                style
            ]}
            {...props}
        >
            {children}
        </RNText>
    );
};
