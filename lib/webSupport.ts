import { Linking } from 'react-native';
import { Config } from '@/constants/config';

const SUPPORTED_WEB_LOCALES = new Set([
    'ar',
    'de',
    'en',
    'es',
    'fr',
    'id',
    'it',
    'pl',
    'pt',
    'ru',
    'tr',
]);

export function getWebSupportUrl(language: string) {
    const locale = SUPPORTED_WEB_LOCALES.has(language) ? language : 'en';
    const origin = Config.WEB_APP_ORIGIN.replace(/\/$/, '');
    return `${origin}/${locale}/support`;
}

export async function openWebSupport(language: string) {
    await Linking.openURL(getWebSupportUrl(language));
}
