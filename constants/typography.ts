import { Platform } from "react-native";

const iosSystemFont = undefined;
const androidBody = {
    regular: "Inter_400Regular",
    medium: "Inter_500Medium",
    semi: "Inter_600SemiBold",
    bold: "Inter_700Bold",
};
const androidHeading = {
    extra: "Manrope_800ExtraBold",
    bold: "Manrope_700Bold",
    semi: "Manrope_600SemiBold",
    medium: "Manrope_500Medium",
};

const platformFont = (androidFont: string) => (Platform.OS === "ios" ? iosSystemFont : androidFont);

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
    // iOS uses the native SF Pro system font by leaving fontFamily unset.
    // Android uses bundled Inter/Manrope. Arabic always uses Noto Sans Arabic.
    font: {
        heading: {
            extra: platformFont(androidHeading.extra),
            bold: platformFont(androidHeading.bold),
            semi: platformFont(androidHeading.semi),
            medium: platformFont(androidHeading.medium),
        },
        body: {
            regular: platformFont(androidBody.regular),
            medium: platformFont(androidBody.medium),
            semi: platformFont(androidBody.semi),
            bold: platformFont(androidBody.bold),
        },
        arabic: {
            regular: "NotoSansArabic_400Regular",
            semi: "NotoSansArabic_600SemiBold",
            bold: "NotoSansArabic_700Bold",
        },
    },
};
