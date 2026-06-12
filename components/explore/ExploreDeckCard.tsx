import React from 'react';
import { Pressable, StyleSheet, Text as RNText, View } from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Crown, MapPin, ShieldCheck } from 'lucide-react-native';
import { Text } from '@/components/ui/Text';
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
import { PROFILE_PLACEHOLDER_IMAGE } from '@/lib/profileAssets';

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
    const image = firstProfileImage(profile);
    const name = profileName(profile) || t('not_set', 'Not set');
    const age = profileAge(profile);
    const location = formatProfileLocation(profile, true);
    const flag = flagEmoji(profile);
    const coordinates = profileCoordinates(profile);
    const distance = formatDistanceKm(viewerLat, viewerLng, coordinates?.lat, coordinates?.lng);
    const verified = isVerifiedProfile(profile);
    const membership = isMembershipActive(profile);
    const tags = profileTags(profile);

    return (
        <Pressable onPress={onPress} style={styles.card}>
            <Image source={image ? { uri: image } : PROFILE_PLACEHOLDER_IMAGE} style={StyleSheet.absoluteFill} contentFit="cover" />
            <LinearGradient
                colors={['rgba(5,8,15,0.16)', 'rgba(5,8,15,0.08)', 'rgba(5,8,15,0.92)']}
                locations={[0, 0.45, 1]}
                style={StyleSheet.absoluteFill}
            />
            <View style={styles.badges}>
                {verified ? (
                    <View style={styles.topBadge}>
                        <ShieldCheck size={scale(18)} color="#FFFFFF" fill="#3D63F3" />
                    </View>
                ) : null}
                {membership ? (
                    <View style={styles.topBadge}>
                        <Crown size={scale(18)} color="#FFFFFF" fill="#F34B6F" />
                    </View>
                ) : null}
            </View>
            <View style={styles.info}>
                {profile?.recently_active ? (
                    <View style={styles.activeChip}>
                        <View style={styles.activeDot} />
                        <Text variant="caption" className="font-body-semi" style={{ color: '#FFFFFF' }}>
                            {t('recently_active', 'Recently active')}
                        </Text>
                    </View>
                ) : null}
                <Text variant="h2" style={styles.name}>
                    {name}{age ? `, ${age}` : ''}
                </Text>
                {location ? (
                    <View style={styles.location}>
                        {flag ? <RNText style={styles.flag}>{flag}</RNText> : <MapPin size={scale(15)} color="#FFFFFF" />}
                        <Text variant="body-sm" className="font-body-semi" numberOfLines={1} style={{ color: '#FFFFFF', flexShrink: 1 }}>
                            {location}
                        </Text>
                        {distance ? (
                            <Text variant="body-sm" className="font-body-semi" numberOfLines={1} style={styles.distance}>
                                · {distance} {t('away', 'away')}
                            </Text>
                        ) : null}
                    </View>
                ) : null}
                {tags.length > 0 ? (
                    <View style={styles.tags}>
                        {tags.map((tag) => (
                            <View key={tag} style={styles.tag}>
                                <Text variant="caption" className="font-body-semi" numberOfLines={1} style={{ color: '#FFFFFF' }}>{tag}</Text>
                            </View>
                        ))}
                    </View>
                ) : null}
            </View>
        </Pressable>
    );
}

const styles = StyleSheet.create({
    card: {
        flex: 1,
        minHeight: scale(360),
        borderBottomLeftRadius: scale(12),
        borderBottomRightRadius: scale(12),
        overflow: 'hidden',
        backgroundColor: '#0A0A0A',
    },
    badges: {
        position: 'absolute',
        right: scale(14),
        top: scale(84),
        gap: scale(8),
    },
    topBadge: {
        width: scale(34),
        height: scale(34),
        borderRadius: scale(17),
        backgroundColor: 'rgba(0,0,0,0.48)',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.25)',
        alignItems: 'center',
        justifyContent: 'center',
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
        fontSize: scale(29),
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
    tags: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: scale(7),
        marginTop: scale(12),
    },
    tag: {
        maxWidth: '100%',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.18)',
        borderRadius: scale(999),
        backgroundColor: 'rgba(0,0,0,0.36)',
        paddingHorizontal: scale(11),
        paddingVertical: scale(6),
    },
});
