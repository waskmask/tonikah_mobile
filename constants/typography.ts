import { Platform } from "react-native";

// Single brand family: Plus Jakarta Sans for all Latin text on BOTH platforms
// (closest open match to the web app's Proxima Nova). Hierarchy comes from
// weight + size, not family switching. Arabic always uses Noto Sans Arabic.
const nativeFontName = (androidAndWeb: string, ios: string) =>
    Platform.OS === "ios" ? ios : androidAndWeb;

const jakarta = {
    regular: nativeFontName("PlusJakartaSans_400Regular", "PlusJakartaSans-Regular"),
    medium: nativeFontName("PlusJakartaSans_500Medium", "PlusJakartaSans-Medium"),
    semi: nativeFontName("PlusJakartaSans_600SemiBold", "PlusJakartaSans-SemiBold"),
    bold: nativeFontName("PlusJakartaSans_700Bold", "PlusJakartaSans-Bold"),
    extra: nativeFontName("PlusJakartaSans_800ExtraBold", "PlusJakartaSans-ExtraBold"),
};

const ARABIC_SCRIPT_REGEX = /[\u0600-\u06ff\u0750-\u077f\u0870-\u089f\u08a0-\u08ff\ufb50-\ufdff\ufe70-\ufeff]/u;

export function textUsesArabicScript(value: unknown): boolean {
    return ARABIC_SCRIPT_REGEX.test(String(value ?? ''));
}

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
            regular: nativeFontName("NotoSansArabic_400Regular", "NotoSansArabic-Regular"),
            semi: nativeFontName("NotoSansArabic_600SemiBold", "NotoSansArabic-SemiBold"),
            bold: nativeFontName("NotoSansArabic_700Bold", "NotoSansArabic-Bold"),
        },
    },
};

export type TypographyWeight = 'regular' | 'medium' | 'semi' | 'bold' | 'extra';

/** Select a loaded family from the text's script, independently of app locale. */
export function fontFamilyForText(value: unknown, weight: TypographyWeight = 'regular'): string {
    if (textUsesArabicScript(value)) {
        if (weight === 'bold' || weight === 'extra') return Typography.font.arabic.bold;
        if (weight === 'medium' || weight === 'semi') return Typography.font.arabic.semi;
        return Typography.font.arabic.regular;
    }

    if (weight === 'extra') return Typography.font.heading.extra;
    if (weight === 'bold') return Typography.font.body.bold;
    if (weight === 'semi') return Typography.font.body.semi;
    if (weight === 'medium') return Typography.font.body.medium;
    return Typography.font.body.regular;
}
