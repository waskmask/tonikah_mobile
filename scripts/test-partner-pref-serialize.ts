/**
 * Standalone assertions for partner-preference hydration + payload
 * serialization (web-contract parity). Run with: npm run test:ppref
 */
import assert from 'node:assert/strict';
import {
    buildPartnerPrefPayload,
    cmToFtIn,
    defaultPartnerPrefState,
    formatHeightLabel,
    hydratePartnerPrefState,
    serializePartnerPrefState,
    trimToCharacterLimit,
    countCharacters,
    PP_ABOUT_MAX,
} from '../lib/partnerPreference';

// -- cmToFtIn (web-exact incl. 12" carry) ------------------------------------
assert.equal(cmToFtIn(170), `5'7"`);
assert.equal(cmToFtIn(130), `4'3"`);
assert.equal(cmToFtIn(213), `7'0"`);
assert.equal(cmToFtIn(182), `6'0"`); // 71.65in → round(11.65)=12 → carry
assert.equal(formatHeightLabel(170), `5'7" (170 cm)`);

// -- Full ranges serialize as "no preference" nulls --------------------------
const anyPayload = buildPartnerPrefPayload(defaultPartnerPrefState());
assert.deepEqual(anyPayload.age, { from: null, to: null });
assert.deepEqual(anyPayload.height, { from: { cm: null, label: '' }, to: { cm: null, label: '' } });
assert.deepEqual(anyPayload.marital_status, []);
assert.deepEqual(anyPayload.languages_spoken, []);
assert.deepEqual(anyPayload.ethnic_group_ids, []);
assert.equal(anyPayload.about_partner, '');

// -- Non-default ranges carry numbers + web-format labels --------------------
const state = {
    ...defaultPartnerPrefState(),
    ageFrom: 25,
    ageTo: 34,
    heightFrom: 155,
    heightTo: 180,
    marital: ['never_married'],
    languages: ['arabic', 'urdu'],
    ethnic: ['abc123'],
    about: '  Kind and practising.  ',
};
const payload = buildPartnerPrefPayload(state);
assert.deepEqual(payload.age, { from: 25, to: 34 });
assert.equal(payload.height.from.cm, 155);
assert.equal(payload.height.from.label, `${cmToFtIn(155)} (155 cm)`);
assert.equal(payload.height.to.label, `${cmToFtIn(180)} (180 cm)`);
assert.equal(payload.about_partner, 'Kind and practising.');
assert.deepEqual(payload.languages_spoken, ['arabic', 'urdu']); // raw slugs, untranslated

// -- Hydration clamps out-of-range server values -----------------------------
const clamped = hydratePartnerPrefState(
    { age: { from: 5, to: 200 }, height: { from: { cm: 90 }, to: { cm: 400 } } },
    'male',
    '',
);
assert.equal(clamped.ageFrom, 18);
assert.equal(clamped.ageTo, 80);
assert.equal(clamped.heightFrom, 130);
assert.equal(clamped.heightTo, 213);

// -- Married gender rule ------------------------------------------------------
const maleState = hydratePartnerPrefState({ marital_status: ['married', 'divorced'] }, 'male', '');
assert.deepEqual(maleState.marital, ['divorced']);
const femaleState = hydratePartnerPrefState({ marital_status: ['married', 'divorced'] }, 'female', '');
assert.deepEqual(femaleState.marital, ['married', 'divorced']);
// string form also accepted
const stringMarital = hydratePartnerPrefState({ marital_status: 'widowed' }, 'male', '');
assert.deepEqual(stringMarital.marital, ['widowed']);

// -- Ethnic id dedupe across both server shapes ------------------------------
const ethnicState = hydratePartnerPrefState(
    { ethnic_group_ids: ['a', 'b'], ethnic_group: [{ value_id: 'b' }, { value_id: 'c' }, {}] },
    'male',
    '',
);
assert.deepEqual(ethnicState.ethnic, ['a', 'b', 'c']);

// -- Candidate text wins over approved text ----------------------------------
const aboutState = hydratePartnerPrefState({ about_partner: 'old approved' }, 'male', 'new candidate');
assert.equal(aboutState.about, 'new candidate');

// -- About cap is code points (emoji-safe) -----------------------------------
const emoji = '😀'.repeat(PP_ABOUT_MAX + 10);
assert.equal(countCharacters(trimToCharacterLimit(emoji, PP_ABOUT_MAX)), PP_ABOUT_MAX);

// -- Serialization: order-insensitive arrays, trimmed about ------------------
const a = serializePartnerPrefState({ ...state, languages: ['urdu', 'arabic'], about: 'x ' });
const b = serializePartnerPrefState({ ...state, languages: ['arabic', 'urdu'], about: 'x' });
assert.equal(a, b);
const c = serializePartnerPrefState({ ...state, ageFrom: 26 });
assert.notEqual(a, c);

console.log('test-partner-pref-serialize: all assertions passed');
