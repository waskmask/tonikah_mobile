import assert from 'node:assert/strict';
import { membershipSavingsPercent } from '../lib/membershipSavings';
import type { MembershipPlan } from '../lib/membershipService';
import type { NativeStoreProduct } from '../lib/nativeMembershipPurchase';

const plan = (slug: string, days: number, amount: number): MembershipPlan => ({
    id: slug, slug, displayName: slug, durationDays: days, features: [], checkoutEnabled: true,
    price: { region: 'IN', currency: 'INR', amountMinor: amount, formatted: '' },
});
const monthly = plan('gold', 30, 49900);
const quarterly = plan('gold_3m', 90, 134900);
assert.equal(membershipSavingsPercent(monthly, monthly, {}), null);
assert.equal(membershipSavingsPercent(quarterly, monthly, {}), 10);
assert.equal(membershipSavingsPercent(plan('gold_6m', 180, 254900), monthly, {}), 15);
assert.equal(membershipSavingsPercent(quarterly, undefined, {}), null);
assert.equal(membershipSavingsPercent(plan('no-saving', 90, 160000), monthly, {}), null);
assert.equal(membershipSavingsPercent(plan('invalid', 90, NaN), monthly, {}), null);
assert.equal(membershipSavingsPercent({ ...quarterly, price: { ...quarterly.price!, currency: 'EUR' } }, monthly, {}), null);
const product = (price: number): NativeStoreProduct => ({ id: 'sku', title: '', description: '', displayPrice: '', type: 'in-app', price, currency: 'USD' });
assert.equal(membershipSavingsPercent(quarterly, monthly, { gold: product(10), gold_3m: product(24) }), 20);
assert.equal(membershipSavingsPercent(quarterly, monthly, { gold: product(10) }), null);
assert.equal(membershipSavingsPercent(plan('annual', 365, 449100), monthly, {}), 25);
console.log('Membership savings tests passed');
