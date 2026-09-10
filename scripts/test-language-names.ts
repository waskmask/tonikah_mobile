import assert from 'node:assert/strict';
import { getLanguageName, LANGUAGE_NAMES, SUPPORTED_APP_LANGUAGES } from '../lib/languageNames';

assert.deepEqual(LANGUAGE_NAMES, {
    en: 'English',
    ar: 'العربية',
    de: 'Deutsch',
    es: 'Español',
    fr: 'Français',
    id: 'Bahasa Indonesia',
    it: 'Italiano',
    pl: 'Polski',
    pt: 'Português',
    ru: 'Русский',
    tr: 'Türkçe',
});
assert.equal(getLanguageName('unknown'), 'unknown');
assert.equal(SUPPORTED_APP_LANGUAGES.length, 11);
assert.equal(SUPPORTED_APP_LANGUAGES.find(({ code }) => code === 'ar')?.flag, '🇸🇦');
assert.equal(SUPPORTED_APP_LANGUAGES.find(({ code }) => code === 'id')?.flag, '🇮🇩');

console.log('language name tests passed');
