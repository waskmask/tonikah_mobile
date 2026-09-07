import { displayText, t, toKey } from '@/lib/profileDisplay';

/** Emoji lookups + chip labels for hobbies and faith-in-daily-life values.
    Shared by My Profile (UserProfileView) and Edit Profile chip sections. */

export const HOBBY_EMOJI: Record<string, string> = {
    sports: '\u{1F3C6}',
    reading: '\u{1F4DA}',
    reading_quran: '\u{1F4D6}',
    traveling: '\u{2708}\u{FE0F}',
    travel: '\u{2708}\u{FE0F}',
    cooking: '\u{1F373}',
    baking: '\u{1F9C1}',
    music: '\u{1F3B5}',
    art: '\u{1F3A8}',
    painting: '\u{1F3A8}',
    drawing: '\u{270F}\u{FE0F}',
    photography: '\u{1F4F8}',
    gaming: '\u{1F3AE}',
    video_games: '\u{1F3AE}',
    fitness: '\u{1F4AA}',
    gym: '\u{1F4AA}',
    running: '\u{1F3C3}',
    hiking: '\u{1F97E}',
    swimming: '\u{1F3CA}',
    cycling: '\u{1F6B4}',
    yoga: '\u{1F9D8}',
    meditation: '\u{1F9D8}',
    football: '\u{26BD}',
    soccer: '\u{26BD}',
    basketball: '\u{1F3C0}',
    cricket: '\u{1F3CF}',
    tennis: '\u{1F3BE}',
    chess: '\u{265F}\u{FE0F}',
    horse_riding: '\u{1F40E}',
    fishing: '\u{1F3A3}',
    writing: '\u{270D}\u{FE0F}',
    calligraphy: '\u{1F58B}\u{FE0F}',
    vlogging: '\u{1F3A5}',
    diy: '\u{1F6E0}\u{FE0F}',
    gardening: '\u{1F331}',
    fashion: '\u{1F457}',
    investing: '\u{1F4C8}',
    volunteering: '\u{1F91D}',
    animals_pets: '\u{1F43E}',
    animals_and_pets: '\u{1F43E}',
    pets: '\u{1F43E}',
    movies: '\u{1F3AC}',
    netflix: '\u{1F4FA}',
    podcasts: '\u{1F399}\u{FE0F}',
    poetry: '\u{1F4DC}',
    technology: '\u{1F4BB}',
    coding: '\u{1F4BB}',
    teaching: '\u{1F468}\u{200D}\u{1F3EB}',
    dancing: '\u{1F483}',
    singing: '\u{1F3A4}',
};

export const FAITH_EMOJI: Record<string, string> = {
    prays_5_times: '\u{1F932}',
    prays_5_times_a_day: '\u{1F932}',
    prays_on_time: '\u{23F1}\u{FE0F}',
    prays_sometimes: '\u{1F932}',
    jummah_regular: '\u{1F54C}',
    regular_for_friday_prayer: '\u{1F54C}',
    quran_recitation: '\u{1F4D6}',
    recites_quran: '\u{1F4D6}',
    recites_qur_an: '\u{1F4D6}',
    dhikr_regular: '\u{1F319}',
    regular_in_dhikr: '\u{1F319}',
    fasts_ramadan: '\u{1F319}',
    fasts_in_ramadan: '\u{1F319}',
    fasts_sunnah: '\u{1F319}',
    gives_sadaqah: '\u{1F49D}',
    zakat_conscious: '\u{1F4B0}',
    careful_about_zakat: '\u{1F4B0}',
    completed_umrah: '\u{1F54B}',
    plans_umrah: '\u{1F54B}',
    plans_to_perform_umrah: '\u{1F54B}',
    completed_hajj: '\u{1F54B}',
    plans_hajj: '\u{1F54B}',
    plans_to_perform_hajj: '\u{1F54B}',
    halal_earnings_priority: '\u{2705}',
    prioritizes_halal_earnings: '\u{2705}',
    avoids_interest_riba: '\u{1F6AB}',
    avoids_interest: '\u{1F6AB}',
    avoids_alcohol: '\u{1F6AB}',
    avoids_smoking: '\u{1F6AB}',
    modest_lifestyle: '\u{1F33F}',
    lives_a_modest_lifestyle: '\u{1F33F}',
    honest_trustworthy: '\u{1F48E}',
    honest_and_trustworthy: '\u{1F48E}',
    kind_soft_spoken: '\u{1F497}',
    kind_and_soft_spoken: '\u{1F497}',
    patient_calm_temper: '\u{1F343}',
    patient_and_calm: '\u{1F343}',
    respectful: '\u{1F64F}',
    respectful_to_others: '\u{1F64F}',
    growth_in_deen: '\u{1F331}',
    focused_on_growing_in_deen: '\u{1F331}',
    family_oriented: '\u{1F46A}',
    close_to_family: '\u{1F46A}',
    values_marriage: '\u{1F48D}',
    community_minded: '\u{1F30D}',
    balances_deen_dunya: '\u{2696}\u{FE0F}',
    balances_deen_and_duniya: '\u{2696}\u{FE0F}',
    attends_mosque: '\u{1F54C}',
    studies_hadith: '\u{1F4DC}',
    modest_dressing: '\u{1F9D5}',
    islamic_lectures: '\u{1F399}\u{FE0F}',
    learns_islam: '\u{1F4DA}',
};

export function profileFieldSlug(value: any) {
    const raw = String(
        typeof value === 'object' && value !== null
            ? value.label || value.name || value.title || value.value || value.value_id || ''
            : value || '',
    ).trim();
    return toKey(raw);
}

export function emojiChipItem(value: any, type: 'faith' | 'hobby') {
    const slug = profileFieldSlug(value);
    const fallback = displayText(value);
    const label = type === 'hobby' ? t(`hobby_${slug}`, fallback) : t(slug, fallback);
    const emoji = type === 'hobby' ? HOBBY_EMOJI[slug] || '\u{2728}' : FAITH_EMOJI[slug] || '\u{1F319}';
    return { label, emoji, slug };
}
