import { calculateAge, cleanProfileMultilineText, cleanProfileText, displayText, listText, profileImage, translateCountry, translateNamespace } from '@/lib/profileDisplay';

export type GalleryLike = {
    uuid?: string;
    isPrimary?: boolean;
    sort_index?: number;
    urls?: { avatar?: string; original?: string; small?: string; thumb?: string; blur?: string };
    url?: string;
    image?: string;
    avatar?: string;
};

export function profileId(profile: any) {
    return String(profile?.id || profile?._id || profile?.user_id || profile?.username || '');
}

export function profileName(profile: any) {
    return String(profile?.profileName || profile?.name || profile?.username || '').trim();
}

export function profileAge(profile: any) {
    return profile?.age ?? calculateAge(profile?.dob);
}

export function isVerifiedProfile(profile: any) {
    const verified = profile?.verified || profile?.verified_account;
    return Boolean(
        profile?.verified_profile ||
        verified === true ||
        verified?.selfie ||
        (verified?.id && verified?.age && verified?.selfie)
    );
}

export function isMembershipActive(profile: any) {
    const membership = profile?.membership || profile?.membership_status || profile?.membershipStatus;
    if (profile?.isPremium || profile?.premium || profile?.has_active_membership) return true;
    if (!membership) return false;
    if (typeof membership === 'string') return ['active', 'trialing', 'paid'].includes(membership.toLowerCase());
    return Boolean(membership.active || membership.isActive || membership.status === 'active');
}

export function normalizeGallery(profile: any): GalleryLike[] {
    const raw = profile?.gallery || profile?.gallery_images || profile?.photos || profile?.images || [];
    const items = Array.isArray(raw) ? raw : [];
    return [...items].sort((a, b) => {
        if (a?.isPrimary && !b?.isPrimary) return -1;
        if (!a?.isPrimary && b?.isPrimary) return 1;
        return (a?.sort_index ?? 0) - (b?.sort_index ?? 0);
    });
}

export function imageUrl(item?: GalleryLike | any) {
    return profileImage(item);
}

export function firstProfileImage(profile: any) {
    const gallery = normalizeGallery(profile);
    return imageUrl(gallery[0]) || profileImage(profile);
}

function scalar(value: any) {
    if (value == null) return '';
    if (typeof value === 'string' || typeof value === 'number') return String(value).trim();
    if (typeof value === 'object') {
        return String(value.label || value.name || value.key || value.value || value.value_id || value.slug || value._id || '').trim();
    }
    return '';
}

function countryIso(profile: any) {
    const loc = profile?.current_location || profile?.location || {};
    const candidates = [
        profile?.country_iso,
        profile?.countryCode,
        profile?.country_code,
        loc.country_iso,
        loc.countryCode,
        loc.country_code,
        loc.country,
        profile?.country,
    ];
    for (const item of candidates) {
        const value = scalar(item);
        if (/^[a-z]{2}$/i.test(value)) return value.toUpperCase();
    }
    return '';
}

export function flagEmoji(profile: any) {
    const iso = countryIso(profile);
    if (!/^[A-Z]{2}$/.test(iso)) return '';
    return iso
        .split('')
        .map((char) => String.fromCodePoint(127397 + char.charCodeAt(0)))
        .join('');
}

export function profileCoordinates(profile: any): { lat: number; lng: number } | null {
    const loc = profile?.current_location || profile?.location || profile || {};
    const geo = loc?.geo?.coordinates || profile?.geo?.coordinates;
    const lat = Number(
        loc.lat ??
        loc.latitude ??
        profile?.lat ??
        profile?.latitude ??
        (Array.isArray(geo) ? geo[1] : undefined)
    );
    const lng = Number(
        loc.lng ??
        loc.longitude ??
        profile?.lng ??
        profile?.longitude ??
        (Array.isArray(geo) ? geo[0] : undefined)
    );
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
    return { lat, lng };
}

export function formatDistanceKm(
    viewerLat?: number | null,
    viewerLng?: number | null,
    profileLat?: number | null,
    profileLng?: number | null,
) {
    if (viewerLat == null || viewerLng == null || profileLat == null || profileLng == null) return '';
    const R = 6371;
    const toRad = (deg: number) => (deg * Math.PI) / 180;
    const dLat = toRad(profileLat - viewerLat);
    const dLng = toRad(profileLng - viewerLng);
    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(toRad(viewerLat)) *
        Math.cos(toRad(profileLat)) *
        Math.sin(dLng / 2) *
        Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const km = R * c;
    if (!Number.isFinite(km)) return '';
    if (km < 1) return '<1 km';
    if (km < 10) {
        const rounded = Math.round(km * 10) / 10;
        return `${String(rounded).replace(/\.0$/, '')} km`;
    }
    return `${Math.round(km)} km`;
}

export function formatProfileLocation(profile: any, includeState = false) {
    const loc = profile?.current_location || profile?.location || {};
    const city = scalar(loc.city || profile?.city);
    const state = includeState ? scalar(loc.state || profile?.state) : '';
    const country = scalar(countryIso(profile) || loc.country || profile?.country || profile?.country_iso);
    const place = [city, state].filter(Boolean).join(', ');
    return [place, translateCountry(country)].filter(Boolean).join(' · ');
}

export function profileTags(profile: any) {
    const nationality = Array.isArray(profile?.nationality)
        ? profile.nationality.slice(0, 2).map((item: any) => translateCountry(scalar(item))).filter(Boolean).join(' · ')
        : '';
    const designation = translateNamespace('designations', scalar(profile?.designation?.label || profile?.designation));
    const education = displayText(scalar(profile?.education?.label || profile?.education));
    const ethnic = Array.isArray(profile?.ethnic_group)
        ? profile.ethnic_group.map((item: any) => translateNamespace('ethnic_group', scalar(item))).filter(Boolean).join(', ')
        : translateNamespace('ethnic_group', scalar(profile?.ethnic_group));
    return [nationality, designation, education, ethnic].filter(Boolean).slice(0, 3);
}

export function profileSummaryLine(profile: any) {
    return listText([
        displayText(profile?.designation?.label || profile?.designation),
        displayText(profile?.education?.label || profile?.education),
        ...(profile?.languages_spoken || []).map(displayText),
    ]);
}

export function headlineText(profile: any) {
    return cleanProfileText(profile?.profile_headline);
}

export function bioText(profile: any) {
    return cleanProfileMultilineText(profile?.bio);
}
