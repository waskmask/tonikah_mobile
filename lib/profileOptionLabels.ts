export function formatProfileOptionLabel(label: string, locale = 'en'): string {
    const value = label.replace(/_/g, ' ').trim();

    if (!value) return '';

    return value.replace(/\p{L}[\p{L}\p{M}'.-]*/gu, (word) => {
        const [first = '', ...rest] = Array.from(word);
        return `${first.toLocaleUpperCase(locale)}${rest.join('')}`;
    });
}
