export function receiptPurchaseId(id: string): string | null {
    return /^[a-f\d]{24}$/i.test(id) ? id : null;
}

export function receiptSupportUrl(provider?: string): string {
    if (provider === 'apple_iap' || provider === 'apple') return 'https://support.apple.com/118212';
    if (provider === 'google_play') return 'https://support.google.com/googleplay/answer/2850369';
    return 'https://tonikah.com/app/memberships';
}

export function receiptFileName(documentNumber: string): string {
    return `${documentNumber.replace(/[^A-Za-z0-9._-]/g, '_').slice(0, 100) || 'membership-receipt'}.pdf`;
}
