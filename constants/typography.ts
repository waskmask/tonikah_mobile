import { scale } from "@/hooks/useResponsive";

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
    // Font names as configured in tailwind.config.js / Root Layout
    font: {
        heading: {
            extra: "Manrope_800ExtraBold",
            bold: "Manrope_700Bold",
            semi: "Manrope_600SemiBold",
            medium: "Manrope_500Medium",
        },
        body: {
            regular: "Inter_400Regular",
            medium: "Inter_500Medium",
            semi: "Inter_600SemiBold",
        },
        arabic: {
            regular: "NotoSansArabic_400Regular",
            semi: "NotoSansArabic_600SemiBold",
            bold: "NotoSansArabic_700Bold",
        },
    },
};
