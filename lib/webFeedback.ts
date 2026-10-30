import { Linking, Platform } from 'react-native';
import Constants from 'expo-constants';
import * as Application from 'expo-application';
import * as WebBrowser from 'expo-web-browser';
import { Config } from '@/constants/config';

const SUPPORTED_LOCALES = new Set(['ar', 'de', 'en', 'es', 'fr', 'id', 'it', 'pl', 'pt', 'ru', 'tr']);

function supportedVersion(value: unknown): value is string {
    return typeof value === 'string' && value.length <= 40
        && /^\d+\.\d+\.\d+(?:[-+][a-zA-Z0-9.-]+)?$/.test(value);
}

export function getWebFeedbackUrl(language: string) {
    const locale = SUPPORTED_LOCALES.has(language) ? language : 'en';
    // Construct from the configured origin, never from account data or a return URL.
    const url = new URL(`/${locale}/feedback`, new URL(Config.WEB_APP_ORIGIN).origin);
    if (['ios', 'android', 'web'].includes(Platform.OS)) {
        url.searchParams.set('platform', Platform.OS);
    }
    const version = [Constants.expoConfig?.version, Application.nativeApplicationVersion].find(supportedVersion);
    if (version) url.searchParams.set('appVersion', version);
    return url.toString();
}

export async function openWebFeedback(language: string) {
    const url = getWebFeedbackUrl(language);
    try {
        const result = await WebBrowser.openBrowserAsync(url);
        if (result.type !== 'locked') return;
    } catch {
        // Devices without an in-app browser can still use their default browser.
    }
    if (await Linking.canOpenURL(url)) {
        await Linking.openURL(url);
        return;
    }
    throw new Error('feedback_browser_unavailable');
}
