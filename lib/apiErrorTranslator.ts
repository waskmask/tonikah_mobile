import i18n from '@/lib/i18n';

export function translateApiError(
    messageKey?: string,
    params?: Record<string, string | number>
): string {
    if (!messageKey) return i18n.t('api_errors.unknown_error');

    const translationKey = `api_errors.${messageKey}`;

    if (i18n.exists(translationKey)) {
        return i18n.t(translationKey, params);
    }

    // Fallback
    return i18n.t('api_errors.unknown_error');
}
