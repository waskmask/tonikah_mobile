import i18n from '@/lib/i18n';

export type FilterSelectKey =
    | 'country'
    | 'marital_status'
    | 'sect'
    | 'education'
    | 'ethnic_group'
    | 'born_muslim'
    | 'following';

export type ExploreFilterState = {
    ageMin: number;
    ageMax: number;
    heightMin: number;
    heightMax: number;
    country: string[];
    marital_status: string[];
    sect: string[];
    education: string[];
    ethnic_group: string[];
    born_muslim: string[];
    following: string[];
};

export type SelectOption = { value: string; label: string; key?: string };

export const DEFAULT_EXPLORE_FILTERS: ExploreFilterState = {
    ageMin: 18,
    ageMax: 80,
    heightMin: 120,
    heightMax: 220,
    country: [],
    marital_status: [],
    sect: [],
    education: [],
    ethnic_group: [],
    born_muslim: [],
    following: [],
};

export const FILTER_PARAM: Record<FilterSelectKey, string> = {
    country: 'country',
    marital_status: 'marital_status',
    sect: 'sect_id',
    education: 'edu_id',
    ethnic_group: 'ethnic_id',
    born_muslim: 'born_muslim',
    following: 'following_id',
};

export const SECT_FILTERS: Record<string, { following: string[] }> = {
    sunni: {
        following: ['ahle_hadith', 'ahle_sunnat', 'deobandi', 'barelvi', 'sufi', 'tabligi', 'other_sunni'],
    },
    shia: {
        following: ['ithna_ashari', 'bohra', 'ismaili', 'zaidi', 'just_shia', 'other_shia'],
    },
    ibadi: {
        following: ['ahle_hadith', 'ahle_sunnat', 'other_sunni'],
    },
};

export function buildExploreParams(state: ExploreFilterState): Record<string, string | number> {
    const params: Record<string, string | number> = {};
    if (state.ageMin > 18) params.age_min = state.ageMin;
    if (state.ageMax < 80) params.age_max = state.ageMax;
    if (state.heightMin > 120) params.h_min_cm = state.heightMin;
    if (state.heightMax < 220) params.h_max_cm = state.heightMax;
    (Object.keys(FILTER_PARAM) as FilterSelectKey[]).forEach((key) => {
        const values = state[key];
        if (values.length > 0) params[FILTER_PARAM[key]] = values.join(',');
    });
    return params;
}

export function activeExploreFilterCount(state: ExploreFilterState) {
    let count = 0;
    if (state.ageMin > 18 || state.ageMax < 80) count += 1;
    if (state.heightMin > 120 || state.heightMax < 220) count += 1;
    (Object.keys(FILTER_PARAM) as FilterSelectKey[]).forEach((key) => {
        if (state[key].length > 0) count += 1;
    });
    return count;
}

export function resetExploreFilters(): ExploreFilterState {
    return { ...DEFAULT_EXPLORE_FILTERS, country: [], marital_status: [], sect: [], education: [], ethnic_group: [], born_muslim: [], following: [] };
}

export function normalizeMasterKey(value?: string | null) {
    return String(value || '')
        .trim()
        .toLowerCase()
        .replace(/&/g, 'and')
        .replace(/[^a-z0-9]+/g, '_')
        .replace(/^_+|_+$/g, '');
}

export function masterOptions(items: any[] = [], namespace: 'common' | 'ethnic_group' = 'common'): SelectOption[] {
    return items.reduce<SelectOption[]>((acc, item) => {
            const value = String(item?._id || item?.id || item?.value_id || item?.value || '');
            if (!value) return acc;
            const key = normalizeMasterKey(item?.key || item?.label || item?.name || value);
            const fallback = String(item?.label || item?.name || key || value).replace(/_/g, ' ');
            const label = i18n.t(key, { ns: namespace, defaultValue: i18n.t(key, { defaultValue: fallback }) });
            acc.push({ value, label: String(label), key });
            return acc;
        }, []);
}

export function staticOptions(values: string[]): SelectOption[] {
    return values.map((value) => ({
        value,
        key: value,
        label: i18n.t(value, { defaultValue: value.replace(/_/g, ' ') }),
    }));
}

export function countryOptions(): SelectOption[] {
    const enCountries = require('../locales/en/countries.json') as Record<string, string>;
    return Object.keys(enCountries)
        .filter((key) => key.startsWith('c_'))
        .map((key) => {
            const iso = key.slice(2).toUpperCase();
            return {
                value: iso,
                key,
                label: i18n.t(key, { ns: 'countries', defaultValue: enCountries[key] }),
            };
        })
        .sort((a, b) => a.label.localeCompare(b.label));
}
