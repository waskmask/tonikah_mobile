import { cleanProfileTextForSave } from '@/lib/profileValidation';

/**
 * Partner-preference editing rules and payload serialization, mirroring the
 * web app's PartnerPreferenceClient exactly — both clients must send the same
 * shapes to PATCH /profile/partner-preference.
 */

export const PP_AGE_MIN = 18;
export const PP_AGE_MAX = 80;
export const PP_HEIGHT_MIN_CM = 130;
export const PP_HEIGHT_MAX_CM = 213;
export const PP_MAX_SELECTIONS = 5;
export const PP_ABOUT_MAX = 200;

export const PP_MARITAL_OPTIONS = [
    'never_married',
    'divorced',
    'separated',
    'widowed',
    'annulled',
    'married',
] as const;

/** Web-exact ft'in" formatter (float inches, round, carry 12" → +1ft). */
export function cmToFtIn(cm: number): string {
    const totalInches = cm / 2.54;
    let ft = Math.floor(totalInches / 12);
    let inches = Math.round(totalInches % 12);
    if (inches === 12) {
        ft += 1;
        inches = 0;
    }
    return `${ft}'${inches}"`;
}

/** Height display + payload label, char-for-char like the web. */
export function formatHeightLabel(cm: number): string {
    return `${cmToFtIn(cm)} (${cm} cm)`;
}

export function clamp(value: number, min: number, max: number) {
    return Math.min(max, Math.max(min, value));
}

/** Unicode code-point count (emoji-safe), matching web's Array.from. */
export function countCharacters(value: string) {
    return Array.from(value).length;
}

export function trimToCharacterLimit(value: string, limit: number) {
    const chars = Array.from(value);
    return chars.length <= limit ? value : chars.slice(0, limit).join('');
}

export type PartnerPrefState = {
    ageFrom: number;
    ageTo: number;
    heightFrom: number;
    heightTo: number;
    marital: string[];
    languages: string[];
    ethnic: string[];
    about: string;
};

export const defaultPartnerPrefState = (): PartnerPrefState => ({
    ageFrom: PP_AGE_MIN,
    ageTo: PP_AGE_MAX,
    heightFrom: PP_HEIGHT_MIN_CM,
    heightTo: PP_HEIGHT_MAX_CM,
    marital: [],
    languages: [],
    ethnic: [],
    about: '',
});

type RawPartnerPref = {
    height?: { from?: { cm?: number | null }; to?: { cm?: number | null } };
    age?: { from?: number | null; to?: number | null };
    marital_status?: string[] | string;
    about_partner?: string;
    languages_spoken?: string[];
    ethnic_group?: Array<{ value_id?: string }>;
    ethnic_group_ids?: string[];
} | null | undefined;

/** Server → editor state: clamps ranges, drops "married" for non-female
    users, dedupes ethnic ids from both shapes, trims about (web-exact). */
export function hydratePartnerPrefState(
    pref: RawPartnerPref,
    gender: string,
    editableAbout: string,
): PartnerPrefState {
    const p = pref || {};
    const isFemale = gender.toLowerCase() === 'female';

    const ageFrom = typeof p.age?.from === 'number' ? clamp(p.age.from, PP_AGE_MIN, PP_AGE_MAX - 1) : PP_AGE_MIN;
    const ageTo = typeof p.age?.to === 'number' ? clamp(p.age.to, PP_AGE_MIN + 1, PP_AGE_MAX) : PP_AGE_MAX;
    const heightFrom = typeof p.height?.from?.cm === 'number'
        ? clamp(p.height.from.cm, PP_HEIGHT_MIN_CM, PP_HEIGHT_MAX_CM - 1)
        : PP_HEIGHT_MIN_CM;
    const heightTo = typeof p.height?.to?.cm === 'number'
        ? clamp(p.height.to.cm, PP_HEIGHT_MIN_CM + 1, PP_HEIGHT_MAX_CM)
        : PP_HEIGHT_MAX_CM;

    const rawMarital = Array.isArray(p.marital_status)
        ? p.marital_status
        : p.marital_status
            ? [p.marital_status]
            : [];
    const marital = rawMarital
        .map((value) => String(value).trim())
        .filter(Boolean)
        // Male users cannot prefer "married" women; female users can (co-wife)
        .filter((value) => value !== 'married' || isFemale);

    const languages = Array.isArray(p.languages_spoken) ? p.languages_spoken.filter(Boolean) : [];

    const ethnicIds: string[] = [];
    if (Array.isArray(p.ethnic_group_ids)) ethnicIds.push(...p.ethnic_group_ids);
    if (Array.isArray(p.ethnic_group)) {
        for (const entry of p.ethnic_group) {
            if (entry?.value_id) ethnicIds.push(String(entry.value_id));
        }
    }
    const ethnic = [...new Set(ethnicIds.map((value) => String(value).trim()).filter(Boolean))];

    const about = trimToCharacterLimit(editableAbout || p.about_partner || '', PP_ABOUT_MAX);

    return { ageFrom, ageTo, heightFrom, heightTo, marital, languages, ethnic, about };
}

/** Stable serialization for dirty tracking (arrays sorted, about trimmed). */
export function serializePartnerPrefState(state: PartnerPrefState): string {
    return JSON.stringify({
        ageFrom: state.ageFrom,
        ageTo: state.ageTo,
        heightFrom: state.heightFrom,
        heightTo: state.heightTo,
        marital: [...state.marital].sort(),
        languages: [...state.languages].sort(),
        ethnic: [...state.ethnic].sort(),
        about: state.about.trim(),
    });
}

/** Web-exact PATCH payload; full ranges serialize as null ("no preference"). */
export function buildPartnerPrefPayload(state: PartnerPrefState) {
    const ageAny = state.ageFrom === PP_AGE_MIN && state.ageTo === PP_AGE_MAX;
    const heightAny = state.heightFrom === PP_HEIGHT_MIN_CM && state.heightTo === PP_HEIGHT_MAX_CM;

    return {
        age: ageAny ? { from: null, to: null } : { from: state.ageFrom, to: state.ageTo },
        height: heightAny
            ? { from: { cm: null, label: '' }, to: { cm: null, label: '' } }
            : {
                from: { cm: state.heightFrom, label: formatHeightLabel(state.heightFrom) },
                to: { cm: state.heightTo, label: formatHeightLabel(state.heightTo) },
            },
        marital_status: state.marital,
        languages_spoken: state.languages,
        ethnic_group_ids: state.ethnic,
        about_partner: trimToCharacterLimit(cleanProfileTextForSave(state.about), PP_ABOUT_MAX),
    };
}
