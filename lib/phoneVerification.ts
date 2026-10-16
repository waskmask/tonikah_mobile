import { getCountries, parsePhoneNumberFromString, type CountryCode } from 'libphonenumber-js/max';

export function defaultPhoneCountry(phone?: string, locationCountry?: string, region?: string | null): CountryCode {
    const saved = parsePhoneNumberFromString(phone || '')?.country;
    const supported = getCountries();
    for (const candidate of [saved, locationCountry, region]) {
        const code = candidate?.trim().toUpperCase() as CountryCode;
        if (supported.includes(code)) return code;
    }
    return 'US';
}

export function asciiDigits(value: string) {
    return value.replace(/[\u0660-\u0669\u06f0-\u06f9]/g, (char) =>
        String(char.charCodeAt(0) - (char.charCodeAt(0) >= 0x06f0 ? 0x06f0 : 0x0660)));
}

export function normalizeVerificationPhone(value: string, country: CountryCode): string | null {
    const input = asciiDigits(value).trim();
    if (!/^[+\d\s().-]+$/.test(input)) return null;
    const phone = parsePhoneNumberFromString(input, { defaultCountry: country, extract: false });
    return phone?.isValid() && !phone.ext ? phone.number : null;
}

export function phoneInput(value: string, country: CountryCode) {
    const input = asciiDigits(value).trim();
    const international = input.startsWith('+') ? parsePhoneNumberFromString(input) : undefined;
    if (international?.isValid() && international.country && !international.ext) {
        return { country: international.country, number: international.nationalNumber as string };
    }
    return { country, number: input.replace(/\D/g, '').slice(0, 15) };
}

export function secondsRemaining(deadline: string | number | undefined, now = Date.now()) {
    if (!deadline) return 0;
    const end = typeof deadline === 'number' ? deadline : Date.parse(deadline);
    return Number.isFinite(end) ? Math.max(0, Math.ceil((end - now) / 1000)) : 0;
}

export type PhoneChallenge = { challengeId: string; expiresAt: string; resendAt: string; number: string };

export function readPhoneChallenge(result: Record<string, unknown>, number: string): PhoneChallenge | null {
    if (result.success !== true || typeof result.challengeId !== 'string' ||
        typeof result.expiresAt !== 'string' || typeof result.resendAt !== 'string' ||
        !Number.isFinite(Date.parse(result.expiresAt)) || !Number.isFinite(Date.parse(result.resendAt))) return null;
    return { challengeId: result.challengeId, expiresAt: result.expiresAt, resendAt: result.resendAt, number };
}

export function phoneErrorKey(message?: string) {
    const keys: Record<string, string> = {
        invalid_phone_number: 'invalid_number', invalid_phone_code: 'invalid_code',
        phone_code_invalid_or_expired: 'invalid_code', phone_number_unavailable: 'unavailable_number',
        phone_verification_rate_limited: 'rate_limit', phone_code_send_failed: 'send_failed',
        phone_verification_unavailable: 'unavailable', paid_membership_required: 'paid',
        email_verification_required: 'email', phone_already_verified: 'already_verified',
        network_error: 'network', request_timeout: 'network',
    };
    return keys[message || ''] || 'failed';
}
