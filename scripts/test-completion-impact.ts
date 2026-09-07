/**
 * Standalone assertions for the completion-impact distribution.
 * Run with: npm run test:impact
 */
import assert from 'node:assert/strict';
import {
    buildMissingImpactGroups,
    calculateWeightedMissingImpacts,
    MISSING_IMPACT_WEIGHTS,
} from '../lib/profileCompletionImpact';

const sections = [
    { rows: [{ completionKey: 'current_location' }, { completionKey: 'nationality' }, { completionKey: 'grew_up_in' }] },
    { rows: [{ completionKey: 'mother_tongue' }, { completionKey: 'languages_spoken' }, { completionKey: 'born_muslim' }] },
    { rows: [{ completionKey: 'height' }, { completionKey: 'complexion' }, { completionKey: 'ethnic_group' }] },
    { rows: [{ completionKey: 'marital_status' }, { completionKey: 'have_children' }, { completionKey: 'wants_children' }] },
    { rows: [{ completionKey: 'marriage_plan' }, { completionKey: 'relocation_plans' }] },
    { rows: [{ completionKey: 'education' }, { completionKey: 'occupation' }, { completionKey: undefined }, { completionKey: 'company' }, { completionKey: 'annual_income' }] },
    { rows: [{ completionKey: 'sect' }, { completionKey: 'maslak' }, { completionKey: 'is_practising' }, { completionKey: 'prayers' }] },
    { rows: [{ completionKey: 'smoking' }, { completionKey: 'alcohol' }] },
    { rows: [{ completionKey: 'profile_manager' }] },
];

const groups = buildMissingImpactGroups(sections);

function total(result: Record<string, number>) {
    return Object.values(result).reduce((sum, value) => sum + value, 0);
}

// -- Group building ----------------------------------------------------------
// media combines avatar+gallery; headline/bio/hobbies fixed; no duplicates
assert.equal(groups[0].id, 'media');
assert.deepEqual(groups[0].keys, ['avatar', 'gallery']);
const ids = groups.map((group) => group.id);
assert.equal(new Set(ids).size, ids.length, 'group ids must be unique');
assert.ok(ids.includes('profile_headline') && ids.includes('bio') && ids.includes('hobbies'));
// rows without completionKey are skipped
assert.ok(!ids.includes('undefined'));

// -- Sum invariant: badges always sum to round(100 - percent) ----------------
for (const percent of [0, 3, 37, 50, 61, 87, 99]) {
    const missing = ['avatar', 'bio', 'current_location', 'smoking', 'company', 'hobbies'];
    const result = calculateWeightedMissingImpacts(percent, missing, groups);
    assert.equal(
        total(result),
        Math.round(100 - percent),
        `sum must equal remaining percent at percent=${percent}`,
    );
}

// -- Everything missing ------------------------------------------------------
const allKeys = groups.flatMap((group) => group.keys);
const allMissing = calculateWeightedMissingImpacts(20, allKeys, groups);
assert.equal(total(allMissing), 80);
// every group gets at least 1 only if the math allows; values must be >= 1 when present
for (const value of Object.values(allMissing)) assert.ok(value >= 1);

// -- Single missing group takes the whole remainder --------------------------
const single = calculateWeightedMissingImpacts(87, ['smoking'], groups);
assert.deepEqual(single, { smoking: 13 });

// -- avatar OR gallery missing → one combined media badge --------------------
const mediaOnly = calculateWeightedMissingImpacts(90, ['gallery'], groups);
assert.deepEqual(mediaOnly, { media: 10 });
const mediaBoth = calculateWeightedMissingImpacts(90, ['gallery', 'avatar'], groups);
assert.deepEqual(mediaBoth, { media: 10 });

// -- Heavier weights get more ------------------------------------------------
const weighted = calculateWeightedMissingImpacts(40, ['bio', 'smoking'], groups);
assert.ok(weighted.bio > weighted.smoking, 'bio (40) must outrank smoking (12)');
assert.equal(total(weighted), 60);

// -- Edge cases --------------------------------------------------------------
assert.deepEqual(calculateWeightedMissingImpacts(100, ['bio'], groups), {}, 'nothing remaining');
assert.deepEqual(calculateWeightedMissingImpacts(50, [], groups), {}, 'no missing keys');
assert.deepEqual(calculateWeightedMissingImpacts(50, ['unknown_key'], groups), {}, 'unknown keys invisible');

// -- Weight table sanity -----------------------------------------------------
assert.equal(MISSING_IMPACT_WEIGHTS.avatar, 40);
assert.equal(MISSING_IMPACT_WEIGHTS.smoking, 12);

console.log('test-completion-impact: all assertions passed');
