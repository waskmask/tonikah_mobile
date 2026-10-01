import React from 'react';
import { StyleSheet, Text as RNText, View } from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { CrownSimple, GraduationCap, IdentificationBadge, MapPin, SealCheck, Users } from 'phosphor-react-native';
import { Text } from '@/components/ui/Text';
import { PressableScale } from '@/components/ui/PressableScale';
import { scale } from '@/hooks/useResponsive';
import {
    flagEmoji,
    firstProfileImage,
    formatDistanceKm,
    formatProfileLocation,
    isMembershipActive,
    isVerifiedProfile,
    profileCoordinates,
    profileAge,
    profileName,
    profileTags,
} from '@/lib/exploreProfile';
import { t } from '@/lib/profileDisplay';
import { useLanguage } from '@/hooks/useLanguage';
import { PROFILE_PLACEHOLDER_IMAGE } from '@/lib/profileAssets';

const PREVIEW_TOP_BADGES = __DEV__;

export function ExploreDeckCard({
    profile,
    viewerLat,
    viewerLng,
    onPress,
}: {
    profile: any;
    viewerLat?: number | null;
    viewerLng?: number | null;
    onPress: () => void;
}) {
    const { isRTL } = useLanguage();
    const image = firstProfileImage(profile);
    const name = profileName(profile) || t('not_set', 'Not set');
    const age = profileAge(profile);
    const location = formatProfileLocation(profile);
    const flag = flagEmoji(profile);
    const coordinates = profileCoordinates(profile);
    const distance = formatDistanceKm(viewerLat, viewerLng, coordinates?.lat, coordinates?.lng);
    const verified = isVerifiedProfile(profile);
    const membership = isMembershipActive(profile);
    const tags = profileTags(profile);

    return (
        <PressableScale
            onPress={onPress}
            activeScale={0.985}
            containerStyle={{ flex: 1 }}
            style={styles.card}
            accessibilityRole="button"
            accessibilityLabel={`${t('view_profile', 'View profile')}: ${name}${age ? `, ${age}` : ''}`}
            accessibilityHint={t('opens_profile', 'Opens this profile')}
        >
            <Image
                source={image ? { uri: image } : PROFILE_PLACEHOLDER_IMAGE}
                style={StyleSheet.absoluteFill}
                contentFit="cover"
                cachePolicy="memory-disk"
                transition={120}
            />
            <LinearGradient
                colors={['rgba(5,8,15,0.14)', 'rgba(5,8,15,0.0)', 'rgba(5,8,15,0.45)', 'rgba(5,8,15,0.96)']}
                locations={[0, 0.42, 0.72, 1]}
                style={StyleSheet.absoluteFill}
            />
            {membership || PREVIEW_TOP_BADGES ? (
                <View style={[styles.topBadge, styles.membershipBadge]}>
                    <CrownSimple size={scale(22)} color="#201B15" weight="fill" />
                </View>
            ) : null}
            {verified || PREVIEW_TOP_BADGES ? (
                <View style={[styles.topBadge, styles.verifiedBadge]}>
                    <View style={styles.layeredBadgeIcon}>
                        <SealCheck size={scale(24)} color="#F34B6F" weight="fill" style={styles.layeredBadgeFill} />
                        <SealCheck size={scale(26)} color="#FFFFFF" weight="light" style={styles.layeredBadgeOutline} />
                    </View>
                </View>
            ) : null}
            <View style={[styles.info, { alignItems: 'flex-start' }]}>
                {profile?.recently_active ? (
                    <View style={[styles.activeChip, { flexDirection: 'row' }]}>
                        <View style={styles.activeDot} />
                        <Text variant="caption" className="font-body-semi" style={{ color: '#FFFFFF' }}>
                            {t('recently_active', 'Recently active')}
                        </Text>
                    </View>
                ) : null}
                <Text variant="h2" numberOfLines={1} style={[styles.name, { textAlign: isRTL ? 'right' : 'left' }]}>
                    {name}{age ? `, ${age}` : ''}
                </Text>
                {location ? (
                    <View style={[styles.location, { flexDirection: 'row' }]}>
                        {flag ? <RNText style={styles.flag}>{flag}</RNText> : <MapPin size={scale(15)} color="#FFFFFF" />}
                        <Text variant="body-sm" className="font-body-semi" numberOfLines={1} style={{ color: '#FFFFFF', flexShrink: 1 }}>
                            {location}
                        </Text>
                        {distance ? (
                            <Text variant="body-sm" className="font-body-semi" numberOfLines={1} style={styles.distance}>
                                · {distance}
                            </Text>
                        ) : null}
                    </View>
                ) : null}
                {tags.length > 0 ? (
                    <View style={[styles.tags, { flexDirection: 'row' }]}>
                        {tags.map((tag) => (
                            <View key={tag.id} style={styles.tag}>
                                {tag.id === 'designation' ? <IdentificationBadge size={scale(14)} color="#FFFFFF" /> : null}
                                {tag.id === 'education' ? <GraduationCap size={scale(14)} color="#FFFFFF" /> : null}
                                {tag.id === 'ethnic_group' ? <Users size={scale(14)} color="#FFFFFF" /> : null}
                                <Text variant="caption" className="font-body-semi" numberOfLines={1} style={styles.tagText}>{tag.label}</Text>
                            </View>
                        ))}
                    </View>
                ) : null}
            </View>
        </PressableScale>
    );
}

const styles = StyleSheet.create({
    card: {
        flex: 1,
        minHeight: scale(360),
        borderRadius: scale(22),
        overflow: 'hidden',
        backgroundColor: '#0A0A0A',
    },
    topBadge: {
        position: 'absolute',
        top: scale(14),
        width: scale(34),
        height: scale(34),
        borderRadius: scale(17),
        alignItems: 'center',
        justifyContent: 'center',
    },
    membershipBadge: {
        left: scale(14),
        backgroundColor: '#F1CA71',
    },
    verifiedBadge: {
        right: scale(14),
        backgroundColor: 'transparent',
    },
    layeredBadgeIcon: {
        width: scale(26),
        height: scale(26),
    },
    layeredBadgeFill: {
        position: 'absolute',
        top: scale(1),
        left: scale(1),
    },
    layeredBadgeOutline: {
        position: 'absolute',
        top: 0,
        left: 0,
    },
    info: {
        position: 'absolute',
        left: scale(22),
        right: scale(22),
        bottom: scale(24),
    },
    activeChip: {
        alignSelf: 'flex-start',
        flexDirection: 'row',
        alignItems: 'center',
        gap: scale(6),
        borderRadius: scale(999),
        backgroundColor: 'rgba(0,0,0,0.38)',
        paddingHorizontal: scale(9),
        paddingVertical: scale(4),
        marginBottom: scale(8),
    },
    activeDot: {
        width: scale(7),
        height: scale(7),
        borderRadius: scale(4),
        backgroundColor: '#34D399',
    },
    name: {
        color: '#FFFFFF',
        fontSize: scale(27),
        lineHeight: scale(34),
    },
    location: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: scale(6),
        marginTop: scale(6),
        flexWrap: 'wrap',
    },
    flag: {
        fontSize: scale(15),
        lineHeight: scale(18),
    },
    distance: { color: 'rgba(255,255,255,0.78)' },
    // All tags render; long sets wrap to a second row instead of a +N counter
    tags: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: scale(7),
        marginTop: scale(10),
    },
    tag: {
        maxWidth: '100%',
        flexDirection: 'row',
        alignItems: 'center',
        gap: scale(5),
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.18)',
        borderRadius: scale(999),
        backgroundColor: 'rgba(0,0,0,0.36)',
        paddingHorizontal: scale(11),
        paddingVertical: scale(6),
        justifyContent: 'center',
    },
    // Android bakes extra ascent into the glyph box (includeFontPadding),
    // which reads as the text sitting low inside the pill
    tagText: {
        flexShrink: 1,
        color: '#FFFFFF',
        includeFontPadding: false,
        lineHeight: scale(14),
        textAlignVertical: 'center',
    },
});
