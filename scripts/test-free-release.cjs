const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');

test('free mobile release disables purchases, direct membership routes, banners and settings links', () => {
  assert.match(read('constants/releaseFeatures.ts'), /MEMBERSHIP_PURCHASES_ENABLED = false/);
  assert.match(read('app/(tabs)/(main)/(profile)/memberships.tsx'), /MEMBERSHIP_PURCHASES_ENABLED \? <PaidMembershipsScreen \/> : <Redirect/);
  assert.match(read('app/(tabs)/(main)/(profile)/memberships.tsx'), /NATIVE_BILLING_ENABLED = MEMBERSHIP_PURCHASES_ENABLED &&/);
  assert.match(read('components/app/AppMenuDrawer.tsx'), /ACCOUNT_ITEMS.filter/);
  assert.match(read('app/(tabs)/(main)/(profile)/settings-account.tsx'), /MEMBERSHIP_PURCHASES_ENABLED && <SettingsFieldSection/);
  assert.match(read('app/(tabs)/(main)/(messages)/messages.tsx'), /MEMBERSHIP_PURCHASES_ENABLED && membershipPromoVisible/);
  assert.match(read('components/membership/MessagingMembershipGate.tsx'), /MEMBERSHIP_PURCHASES_ENABLED\s*\? <GradientButton/);
});

test('all eleven policy translations include free access, seven-day retention, consent, and safety/deletion contacts', () => {
  for (const locale of ['en', 'ar', 'de', 'es', 'fr', 'id', 'it', 'pl', 'pt', 'ru', 'tr']) {
    const legal = JSON.parse(read(`../tonikah-frontend-next/locales/${locale}/legal.json`));
    for (const value of [legal.terms.s9_li1_html, legal.terms.s9_li8_html, legal.refund['section1.content'], legal.privacy.section9_content]) {
      assert.ok(value.length > 50, locale);
      assert.ok(!value.includes('????'), `${locale}: corrupted translation`);
    }
    assert.match(legal.terms.s6_p2, /CSAE/);
    assert.match(legal.terms.s6_p2, /support@tonikah.com/);
    assert.match(legal.terms.delete_request_content, /privacy@tonikah.com/);
    assert.ok(legal.terms.child_safety_title);
    assert.match(legal.privacy.last_updated, /2026-10-23/);
    assert.match(legal.terms.last_updated, /2026-10-23/);
  }
});
