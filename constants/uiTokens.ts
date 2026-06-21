import { scale } from "@/hooks/useResponsive";
import { Spacing } from "@/constants/spacing";

type SpacingKey = Exclude<keyof typeof Spacing, "borderRadius">;
type RadiusKey = keyof typeof Spacing.borderRadius;

export function space(key: SpacingKey) {
    return scale(Spacing[key] as number);
}

export function radius(key: RadiusKey) {
    const value = Spacing.borderRadius[key];
    return value === 9999 ? 9999 : scale(value);
}

export const BadgeSize = {
    sm: {
        minWidth: scale(16),
        height: scale(16),
        borderRadius: scale(8),
        paddingHorizontal: scale(3),
        borderWidth: 1.5,
        fontSize: scale(9),
        lineHeight: scale(11),
    },
    md: {
        minWidth: scale(18),
        height: scale(18),
        borderRadius: scale(9),
        paddingHorizontal: scale(4),
        borderWidth: 2,
        fontSize: scale(10),
        lineHeight: scale(12),
    },
    lg: {
        minWidth: scale(20),
        height: scale(20),
        borderRadius: scale(10),
        paddingHorizontal: scale(5),
        borderWidth: 0,
        fontSize: scale(10),
        lineHeight: scale(12),
    },
} as const;

export const HeaderTokens = {
    minHeight: scale(48),
    paddingHorizontal: scale(14),
    iconButtonSize: scale(38),
    iconButtonRadius: scale(13),
    brandFontSize: scale(21),
    brandLineHeight: scale(24),
    actionGap: scale(10),
} as const;

export function formatBadgeCount(count: number) {
    if (count > 99) return "99+";
    if (count > 9) return "9+";
    return String(count);
}

export const ProfileSetupTokens = {
    scrollContent: {
        padding: scale(20),
        paddingBottom: scale(110),
    },
} as const;
