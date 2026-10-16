import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { asciiDigits, defaultPhoneCountry, normalizeVerificationPhone, phoneInput, phoneErrorKey, readPhoneChallenge, secondsRemaining } from '../lib/phoneVerification';
import { getCountries } from 'libphonenumber-js/max';
import { isVerifiedProfile } from '../lib/profileVerification';

assert.equal(isVerifiedProfile(undefined), false);
assert.equal(isVerifiedProfile({}), false);
assert.equal(isVerifiedProfile({ phone: { verified: true } }), true);
assert.equal(isVerifiedProfile({ phone: { verified: false } }), false);
for (const key of ['phone', 'age', 'selfie']) {
    assert.equal(isVerifiedProfile({ verified: { [key]: true } }), true);
    assert.equal(isVerifiedProfile({ verified_account: { [key]: true } }), true);
    assert.equal(isVerifiedProfile({ verified: { [key]: false } }), false);
}
assert.equal(isVerifiedProfile({ verified: {}, verified_account: { age: true } }), true);
assert.equal(isVerifiedProfile({ verified: true }), false);
assert.equal(isVerifiedProfile(JSON.parse('{"verified":{"id":true},"verified_profile":true}')), false);
assert.equal(isVerifiedProfile(JSON.parse('{"verified":{"phone":"false"}}')), false);

assert.equal(defaultPhoneCountry(undefined, 'de', 'US'), 'DE');
assert.equal(defaultPhoneCountry('+442079460018', 'DE', 'US'), 'GB');
assert.equal(defaultPhoneCountry(undefined, 'invalid', 'FR'), 'FR');
assert.equal(defaultPhoneCountry(undefined, undefined, null), 'US');

assert.equal(normalizeVerificationPhone('415 555 2671', 'US'), '+14155552671');
assert.deepEqual(phoneInput('415 abc (555)-2671', 'US'), { country: 'US', number: '4155552671' });
assert.deepEqual(phoneInput('+44 20 7946 0018', 'US'), { country: 'GB', number: '2079460018' });
assert.deepEqual(phoneInput('', 'DE'), { country: 'DE', number: '' });
assert.equal(phoneInput('1234567890123456789', 'US').number.length, 15);
assert.equal(phoneInput('\u0660\u0661\u0662\u0663', 'US').number, '0123');
const pasted = phoneInput('+44 20 7946 0018', 'US');
assert.equal(normalizeVerificationPhone(pasted.number, pasted.country), '+442079460018');
assert.equal(normalizeVerificationPhone('+44 20 7946 0018', 'US'), '+442079460018');
assert.equal(normalizeVerificationPhone('020 7946 0018', 'GB'), '+442079460018');
assert.equal(normalizeVerificationPhone('', 'US'), null);
assert.equal(normalizeVerificationPhone('123', 'US'), null);
assert.equal(normalizeVerificationPhone('call +14155552671', 'US'), null);
assert.equal(normalizeVerificationPhone('+14155552671 ext 123', 'US'), null);
assert.equal(normalizeVerificationPhone('+١٤١٥٥٥٥٢٦٧١', 'US'), '+14155552671');
assert.equal(asciiDigits('٠١٢٣٤٥'), '012345');
assert.equal(asciiDigits('۰۱۲۳۴۵'), '012345');

const now = Date.parse('2026-10-10T12:00:00Z');
assert.equal(secondsRemaining(now + 300000, now), 300);
assert.equal(secondsRemaining(now + 300000, now + 301000), 0);
assert.equal(secondsRemaining(now + 300000, now + 65000), 235);
assert.equal(secondsRemaining('invalid', now), 0);
assert.equal(secondsRemaining(undefined, now), 0);
const payload = { success: true, challengeId: 'test', expiresAt: new Date(now + 300000).toISOString(), resendAt: new Date(now + 60000).toISOString() };
assert.equal(readPhoneChallenge(payload, '+14155552671')?.number, '+14155552671');
assert.equal(readPhoneChallenge({ ...payload, success: false }, '+14155552671'), null);
assert.equal(readPhoneChallenge({ ...payload, expiresAt: 'invalid' }, '+14155552671'), null);
assert.equal(readPhoneChallenge({}, '+14155552671'), null);
assert.equal(phoneErrorKey('phone_verification_rate_limited'), 'rate_limit');
assert.equal(phoneErrorKey('phone_code_invalid_or_expired'), 'invalid_code');
assert.equal(phoneErrorKey('network_error'), 'network');
assert.equal(phoneErrorKey('private server error'), 'failed');

const languages = ['en', 'ar', 'de', 'es', 'fr', 'id', 'it', 'pl', 'pt', 'ru', 'tr'];
const english = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'locales/en/common.json'), 'utf8')).phone_verification;
for (const language of languages) {
    const countries = JSON.parse(fs.readFileSync(path.join(process.cwd(), `locales/${language}/countries.json`), 'utf8'));
    for (const country of getCountries()) {
        const name = countries[`c_${country.toLowerCase()}`] || countries[country] || countries[country.toLowerCase()];
        assert.ok(typeof name === 'string' && name.length > 2, `Missing country name: ${language}/${country}`);
    }
    const resources = JSON.parse(fs.readFileSync(path.join(process.cwd(), `locales/${language}/common.json`), 'utf8'));
    const strings = resources.phone_verification;
    assert.deepEqual(Object.keys(strings).sort(), Object.keys(english).sort(), `Locale keys: ${language}`);
    for (const key of Object.keys(english)) {
        assert.equal(typeof strings[key], 'string');
        assert.ok(strings[key].length > 0);
        assert.deepEqual(strings[key].match(/\{\{\w+\}\}/g), english[key].match(/\{\{\w+\}\}/g), `${language}: ${key}`);
    }
    for (const key of ['title', 'selfie', 'selfie_description', 'age', 'age_description', 'phone']) {
        assert.equal(typeof resources.verifications_page[key], 'string', `${language}: verifications_page.${key}`);
        assert.ok(resources.verifications_page[key].trim().length > 0);
    }
    for (const key of ['continue', 'account_email', 'search', 'badge_verified', 'no_results_found', 'options_load_error', 'btn_try_again']) {
        assert.equal(typeof resources[key], 'string', `${language}: ${key}`);
        assert.ok(resources[key].trim().length > 0);
    }
}
for (const file of ['app/(tabs)/(main)/(profile)/verifications.tsx', 'app/(tabs)/(main)/(profile)/phone-verification.tsx']) {
    const source = fs.readFileSync(path.join(process.cwd(), file), 'utf8');
    assert.doesNotMatch(source, /#[0-9a-f]{3,8}\b/i, `${file}: use theme tokens instead of literal colors`);
}
console.log('Phone verification checks passed: parsing, numeric codes, timers, responses, errors and 11 locales.');
