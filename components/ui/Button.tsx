import React from "react";
import { TouchableOpacity, ActivityIndicator } from "react-native";
import { Text } from "./Text";

interface ButtonProps {
    title: string;
    onPress: () => void;
    variant?: "primary" | "secondary" | "outline" | "ghost" | "link";
    size?: "sm" | "md" | "lg";
    loading?: boolean;
    disabled?: boolean;
    className?: string;
}

export const Button: React.FC<ButtonProps> = ({
    title,
    onPress,
    variant = "primary",
    size = "md",
    loading = false,
    disabled = false,
    className = "",
}) => {
    const getVariantStyles = () => {
        switch (variant) {
            case "primary": return "bg-primary";
            case "secondary": return "bg-brand-bg-surface border border-brand-bg-border";
            case "outline": return "bg-transparent border border-primary";
            case "ghost": return "bg-transparent";
            case "link": return "bg-transparent p-0";
            default: return "bg-primary";
        }
    };

    const getTextVariant = () => (variant === "link" ? "body-sm" : "button");
    const getTextColor = () => {
        if (variant === "primary") return "text-white";
        if (variant === "secondary") return "text-brand-text-body";
        if (variant === "outline") return "text-primary";
        if (variant === "link") return "text-brand-accent-link";
        return "text-brand-text-body";
    };

    const getPadding = () => {
        if (variant === "link") return "p-0";
        if (size === "sm") return "py-2 px-4";
        if (size === "lg") return "py-5 px-8";
        return "py-4 px-6";
    };

    return (
        <TouchableOpacity
            onPress={onPress}
            disabled={disabled || loading}
            activeOpacity={0.7}
            className={`rounded-full flex-row items-center justify-center ${getVariantStyles()} ${getPadding()} ${disabled ? "opacity-50" : ""} ${className}`}
        >
            {loading ? (
                <ActivityIndicator color={variant === "primary" ? "#FFFFFF" : "#F34B6F"} />
            ) : (
                <Text variant={getTextVariant()} className={`${getTextColor()} font-bold`}>
                    {title}
                </Text>
            )}
        </TouchableOpacity>
    );
};
