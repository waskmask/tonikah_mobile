import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { receiptFileName, receiptPurchaseId, receiptSupportUrl } from '../lib/membershipReceipt';

assert.equal(receiptPurchaseId('507f1f77bcf86cd799439011'), '507f1f77bcf86cd799439011');
for (const invalid of ['', '../receipt', 'pay_abc123', '2026-10-06', 'g'.repeat(24)]) {
    assert.equal(receiptPurchaseId(invalid), null);
}
assert.equal(receiptFileName('INV/2026:123'), 'INV_2026_123.pdf');
assert.equal(receiptFileName(''), 'membership-receipt.pdf');
assert.ok(receiptFileName('a'.repeat(500)).length <= 104);
assert.equal(new URL(receiptSupportUrl('apple_iap')).hostname, 'support.apple.com');
assert.equal(new URL(receiptSupportUrl('google_play')).hostname, 'support.google.com');
assert.equal(new URL(receiptSupportUrl('stripe')).hostname, 'tonikah.com');
const keys = ['title', 'view', 'save', 'pending', 'unavailable', 'error', 'download_error', 'store_help', 'web_help', 'store', 'web'];
for (const locale of ['en', 'ar', 'de', 'es', 'fr', 'id', 'it', 'pl', 'pt', 'ru', 'tr']) {
    const data = JSON.parse(readFileSync(new URL(`../locales/${locale}/common.json`, import.meta.url), 'utf8'));
    for (const key of keys) assert.ok(data[`membership_receipt_${key}`], `${locale}: ${key}`);
}
console.log('Receipt helpers and all 11 locale translations passed.');
