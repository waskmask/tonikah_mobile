export const SUPPORTED_APP_LANGUAGES = [
    { code: 'en', translationKey: 'English', name: 'English', flag: '🇬🇧' },
    { code: 'ar', translationKey: 'Arabic', name: 'العربية', flag: '🇸🇦' },
    { code: 'de', translationKey: 'German', name: 'Deutsch', flag: '🇩🇪' },
    { code: 'es', translationKey: 'Spanish', name: 'Español', flag: '🇪🇸' },
    { code: 'fr', translationKey: 'French', name: 'Français', flag: '🇫🇷' },
    { code: 'id', translationKey: 'Indonesian', name: 'Bahasa Indonesia', flag: '🇮🇩' },
    { code: 'it', translationKey: 'Italian', name: 'Italiano', flag: '🇮🇹' },
    { code: 'pl', translationKey: 'Polish', name: 'Polski', flag: '🇵🇱' },
    { code: 'pt', translationKey: 'Portuguese', name: 'Português', flag: '🇵🇹' },
    { code: 'ru', translationKey: 'Russian', name: 'Русский', flag: '🇷🇺' },
    { code: 'tr', translationKey: 'Turkish', name: 'Türkçe', flag: '🇹🇷' },
] as const;

export const LANGUAGE_NAMES: Record<string, string> = Object.fromEntries(
    SUPPORTED_APP_LANGUAGES.map(({ code, name }) => [code, name]),
);

export function getLanguageName(language: string): string {
    return LANGUAGE_NAMES[language] || language;
}
