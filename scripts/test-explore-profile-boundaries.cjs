const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const read = (file) => fs.readFileSync(path.join(__dirname, '..', file), 'utf8');
const profile = read('components/profile/UserProfileView.tsx');
const explore = read('app/(tabs)/(main)/search.tsx');
const toast = read('components/ui/Toast.tsx');
const sheet = read('components/profile/UserProfileSheet.tsx');

// Source-contract checks: native gesture arbitration still needs an iPhone test.
const galleryStart = profile.indexOf('<ProfileGallery');
const galleryEnd = profile.indexOf('/>', galleryStart);
const edgeStart = profile.indexOf('<GestureDetector gesture={edgeDismissGesture}>');
assert.ok(galleryStart >= 0 && galleryEnd < edgeStart, 'Gallery must stay outside edge-close detector');
assert.match(profile, /Platform\.OS === 'ios' && mode === 'modal' && enableEdgeDismiss/);
assert.match(profile, /enableEdgeDismiss = false/);
assert.match(profile, /\.hitSlop\(\{ left: 0, width: 24 \}\)/);
assert.match(profile, /\.failOffsetY\(\[-12, 12\]\)/);
assert.match(profile, /!messageSheetOpen && !messageSending && lightboxIndex === null/);
assert.equal((profile.match(/onIntroSent\?\.\(id\)/g) || []).length, 2);
assert.match(explore, /onIntroSent=\{\(id\) => \{ contactedProfileRef\.current = id; \}\}/);
const close = explore.slice(explore.indexOf('const closeProfileSheet ='), explore.indexOf('const closeProfileSheet =') + 900);
assert.match(close, /contactedProfileRef\.current = null/);
assert.match(close, /items\.filter\(\(item\) => profileId\(item\) !== contactedId\)/);
assert.match(toast, /pointerEvents="box-none"/);
assert.match(toast, /onStartShouldSetPanResponder: \(\) => true/);
assert.match(toast, /gesture\.dy < -28/);
assert.match(sheet, /ToastProvider topOffset=\{scale\(52\)\}/);
console.log('Explore profile source-contract checks passed (gallery exclusion, gesture scope, deferred removal, toast touch boundaries).');
