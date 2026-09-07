/**
 * Weighted "+N%" completion-impact distribution, ported from the web app
 * (tonikah-frontend-next EditProfileClient). Distributes the remaining
 * percent (100 - percent) across the currently missing field groups
 * proportionally to their weight, using floor + largest-remainder rounding
 * so the badges always sum exactly to the remaining percent.
 */

export type MissingImpactGroup = {
    id: string;
    keys: string[];
    weight: number;
};

export const DEFAULT_MISSING_IMPACT_WEIGHT = 20;

export const MISSING_IMPACT_WEIGHTS: Record<string, number> = {
    avatar: 40,
    gallery: 40,
    profile_headline: 40,
    bio: 40,
    hobbies: 20,
    current_location: 30,
    nationality: 30,
    grew_up_in: 25,
    mother_tongue: 25,
    languages_spoken: 25,
    born_muslim: 25,
    i_usually_dress: 20,
    height: 25,
    complexion: 20,
    ethnic_group: 20,
    marital_status: 25,
    have_children: 20,
    wants_children: 20,
    marriage_plan: 25,
    relocation_plans: 20,
    education: 20,
    occupation: 20,
    company: 15,
    annual_income: 15,
    sect: 20,
    maslak: 20,
    is_practising: 20,
    prayers: 20,
    smoking: 12,
    alcohol: 12,
    profile_manager: 20,
};

/** Builds the badge groups: media (avatar+gallery) is one combined group,
    headline/bio/hobbies get their own, every other completion key from the
    section rows becomes a single-key group. */
export function buildMissingImpactGroups(
    sections: Array<{ rows: Array<{ completionKey?: string }> }>,
): MissingImpactGroup[] {
    const groups: MissingImpactGroup[] = [
        { id: 'media', keys: ['avatar', 'gallery'], weight: MISSING_IMPACT_WEIGHTS.avatar },
        { id: 'profile_headline', keys: ['profile_headline'], weight: MISSING_IMPACT_WEIGHTS.profile_headline },
        { id: 'bio', keys: ['bio'], weight: MISSING_IMPACT_WEIGHTS.bio },
        { id: 'hobbies', keys: ['hobbies'], weight: MISSING_IMPACT_WEIGHTS.hobbies },
    ];
    const usedKeys = new Set(groups.flatMap((group) => group.keys));

    for (const section of sections) {
        for (const row of section.rows) {
            if (!row.completionKey || usedKeys.has(row.completionKey)) continue;
            groups.push({
                id: row.completionKey,
                keys: [row.completionKey],
                weight: MISSING_IMPACT_WEIGHTS[row.completionKey] ?? DEFAULT_MISSING_IMPACT_WEIGHT,
            });
            usedKeys.add(row.completionKey);
        }
    }

    return groups;
}

/** Returns { groupId: +percent } for the visible missing groups.
    Values are >= 1 and sum to round(100 - percent). */
export function calculateWeightedMissingImpacts(
    percent: number,
    missingKeys: string[],
    groups: MissingImpactGroup[],
): Record<string, number> {
    const remainingPercent = Math.max(0, 100 - percent);
    if (remainingPercent <= 0 || missingKeys.length === 0) return {};

    const missingSet = new Set(missingKeys);
    const visibleMissingGroups = groups.filter((group) =>
        group.keys.some((key) => missingSet.has(key)),
    );
    if (!visibleMissingGroups.length) return {};

    const totalWeight = visibleMissingGroups.reduce((sum, group) => sum + group.weight, 0);
    if (totalWeight <= 0) return {};

    const ranked = visibleMissingGroups.map((group, index) => {
        const exact = (remainingPercent * group.weight) / totalWeight;
        const value = Math.floor(exact);
        return { group, index, value, remainder: exact - value };
    });

    const assigned = ranked.reduce((sum, item) => sum + item.value, 0);
    let leftover = Math.round(remainingPercent) - assigned;
    const byRemainder = [...ranked].sort((a, b) => {
        if (b.remainder !== a.remainder) return b.remainder - a.remainder;
        if (b.group.weight !== a.group.weight) return b.group.weight - a.group.weight;
        return a.index - b.index;
    });

    for (const item of byRemainder) {
        if (leftover <= 0) break;
        item.value += 1;
        leftover -= 1;
    }

    const result: Record<string, number> = {};
    for (const item of ranked) {
        if (item.value <= 0) continue;
        result[item.group.id] = item.value;
    }

    return result;
}
