// Single brand family: Plus Jakarta Sans for all Latin text on BOTH platforms
// (closest open match to the web app's Proxima Nova). Hierarchy comes from
// weight + size, not family switching. Arabic always uses Noto Sans Arabic.
const jakarta = {
    regular: "PlusJakartaSans_400Regular",
    medium: "PlusJakartaSans_500Medium",
    semi: "PlusJakartaSans_600SemiBold",
    bold: "PlusJakartaSans_700Bold",
    extra: "PlusJakartaSans_800ExtraBold",
};

export const Typography = {
    size: {
        xs: 12,
        sm: 14,
        base: 16,
        lg: 18,
        xl: 20,
        "2xl": 24,
        "3xl": 30,
        "4xl": 36,
    },
    lineHeight: {
        xs: 16,
        sm: 20,
        base: 24,
        lg: 24,
        xl: 28,
        "2xl": 32,
        "3xl": 38,
        "4xl": 44,
    },
    font: {
        heading: {
            extra: jakarta.extra,
            bold: jakarta.bold,
            semi: jakarta.semi,
            medium: jakarta.medium,
        },
        body: {
            regular: jakarta.regular,
            medium: jakarta.medium,
            semi: jakarta.semi,
            bold: jakarta.bold,
        },
        arabic: {
            regular: "NotoSansArabic_400Regular",
            semi: "NotoSansArabic_600SemiBold",
            bold: "NotoSansArabic_700Bold",
        },
    },
};
