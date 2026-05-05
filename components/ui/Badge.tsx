import React from "react";
import { View } from "react-native";
import { Text } from "./Text";

interface BadgeProps {
    label: string;
    variant?: 'success' | 'warning' | 'error' | 'info';
    className?: string;
}

export const Badge: React.FC<BadgeProps> = ({
    label,
    variant = 'info',
    className = ""
}) => {
    const getVariantStyles = () => {
        switch (variant) {
            case 'success': return "bg-brand-accent-success/10 border-brand-accent-success/20 text-brand-accent-success";
            case 'warning': return "bg-brand-accent-warning/10 border-brand-accent-warning/20 text-brand-accent-warning";
            case 'error': return "bg-brand-accent-error/10 border-brand-accent-error/20 text-brand-accent-error";
            case 'info': return "bg-brand-accent-link/10 border-brand-accent-link/20 text-brand-accent-link";
            default: return "bg-brand-accent-link/10 border-brand-accent-link/20 text-brand-accent-link";
        }
    };

    const styles = getVariantStyles().split(' ');
    const bgStyles = styles.filter(s => s.startsWith('bg-') || s.startsWith('border-')).join(' ');
    const textStyle = styles.filter(s => s.startsWith('text-')).join(' ');

    return (
        <View
            className={`rounded-full border px-3 py-1 self-start items-center justify-center ${bgStyles} ${className}`}
        >
            <Text variant="caption" className={`${textStyle} font-bold`}>
                {label}
            </Text>
        </View>
    );
};
