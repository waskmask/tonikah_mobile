import i18n from '@/lib/i18n';

export function translateApiError(
    messageKey?: string,
    params?: Record<string, string | number>
): string {
    if (!messageKey) {
        return i18n.exists('something_went_wrong')
            ? i18n.t('something_went_wrong')
            : i18n.t('api_errors.unknown_error');
    }

    const translationKey = `api_errors.${messageKey}`;

    if (i18n.exists(translationKey)) {
        return i18n.t(translationKey, params);
    }

    if (i18n.exists(messageKey)) {
        return i18n.t(messageKey, params);
    }

    if (i18n.exists('something_went_wrong')) {
        return i18n.t('something_went_wrong');
    }

    // Fallback
    return i18n.t('api_errors.unknown_error');
}
