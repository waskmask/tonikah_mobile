import React from 'react';
import { Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Bookmark, Lock, MapPin, ShieldCheck, X } from 'lucide-react-native';
import { Text } from '@/components/ui/Text';
import { useLanguage } from '@/hooks/useLanguage';
import { useTheme } from '@/hooks/useTheme';
import { scale } from '@/hooks/useResponsive';
import { displayText, profileImage, t, translateCountry } from '@/lib/profileDisplay';
import { PROFILE_PLACEHOLDER_IMAGE } from '@/lib/profileAssets';

type ProfileListCardProps = {
    item: any;
    onPress: () => void;
    onFavorite?: () => void;
    onSkip?: () => void;
    favoriteLabel?: string;
    actionTone?: 'primary' | 'danger' | 'neutral';
};

export function ProfileListCard({ item, onPress, onFavorite, onSkip, favoriteLabel, actionTone = 'primary' }: ProfileListCardProps) {
    const { isRTL } = useLanguage();
    const { isDark } = useTheme();
    const { width } = useWindowDimensions();
    const image = profileImage(item);
    const cardWidth = Math.floor((width - scale(28) - scale(10)) / 2);
    const location = item.location
        ? [item.location.city, translateCountry(item.location.country)].filter(Boolean).join(' - ')
        : [item.city, translateCountry(item.country)].filter(Boolean).join(' - ');
    const name = item.profileName || item.username || t('not_set', 'Not set');
    const age = item.age || item.profile?.age;
    const verified = Boolean(item.verified?.selfie || item.verified_profile);
    const pills = [
        displayText(Array.isArray(item.nationality) ? item.nationality[0] : item.nationality),
        displayText(item.designation?.label || item.designation),
        displayText(item.education?.label || item.education),
        displayText(Array.isArray(item.ethnic_group) ? item.ethnic_group[0] : item.ethnic_group),
    ].filter(Boolean).slice(0, 3);
    const actionColor = actionTone === 'danger' ? '#EF4444' : actionTone === 'neutral' ? (isDark ? '#CBD5E1' : '#475569') : '#F34B6F';

    return (
        <Pressable
            onPress={onPress}
            style={[
                styles.card,
                {
                    width: cardWidth,
                    backgroundColor: isDark ? '#111827' : '#FFFFFF',
                    borderColor: isDark ? '#334155' : '#E2E8F0',
                },
            ]}
        >
            <View style={[styles.imageWrap, { backgroundColor: isDark ? '#1E293B' : '#F1F5F9' }]}>
                <Image source={image ? { uri: image } : PROFILE_PLACEHOLDER_IMAGE} style={StyleSheet.absoluteFill} contentFit="cover" />
                <LinearGradient
                    colors={['rgba(15,23,42,0.04)', 'rgba(15,23,42,0.18)', 'rgba(15,23,42,0.82)']}
                    locations={[0, 0.48, 1]}
                    style={StyleSheet.absoluteFill}
                />
                {item.privacy === 'private' && (
                    <View style={[styles.lockBadge, { left: isRTL ? scale(8) : undefined, right: isRTL ? undefined : scale(8) }]}>
                        <Lock size={scale(12)} color="#FFFFFF" />
                    </View>
                )}
                {verified && (
                    <View style={[styles.verifiedBadge, { left: isRTL ? scale(8) : undefined, right: isRTL ? undefined : scale(8) }]}>
                        <ShieldCheck size={scale(13)} color="#FFFFFF" />
                    </View>
                )}
                <View style={styles.overlayContent}>
                    <Text numberOfLines={1} style={[styles.name, { textAlign: isRTL ? 'right' : 'left' }]}>
                        {name}{age ? `, ${age}` : ''}
                    </Text>
                    {location ? (
                        <View style={[styles.metaRow, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
                            <MapPin size={scale(11)} color="#E2E8F0" />
                            <Text numberOfLines={1} style={[styles.location, { textAlign: isRTL ? 'right' : 'left' }]}>
                                {location}
                            </Text>
                        </View>
                    ) : null}
                    {pills.length ? (
                        <View style={[styles.pillRow, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
                            {pills.map((pill, index) => (
                                <View key={`${String(item.id || item._id || name)}-${pill}-${index}`} style={styles.pill}>
                                    <Text numberOfLines={1} style={styles.pillText}>{pill}</Text>
                                </View>
                            ))}
                        </View>
                    ) : null}
                </View>
            </View>

            {(onFavorite || onSkip) && (
                <View style={[styles.actions, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
                    {onSkip && (
                        <Pressable onPress={onSkip} style={[styles.actionButton, { borderColor: isDark ? '#334155' : '#E2E8F0' }]}>
                            <X size={scale(16)} color={isDark ? '#CBD5E1' : '#475569'} />
                            <Text variant="caption" numberOfLines={1}>{t('skip', 'Skip')}</Text>
                        </Pressable>
                    )}
                    {onFavorite && (
                        <Pressable
                            onPress={onFavorite}
                            style={[
                                styles.actionButton,
                                {
                                    borderColor: actionColor,
                                    backgroundColor: actionTone === 'primary' ? '#F34B6F' : 'transparent',
                                },
                            ]}
                        >
                            <Bookmark size={scale(15)} color={actionTone === 'primary' ? '#FFFFFF' : actionColor} />
                            <Text variant="caption" numberOfLines={1} style={{ color: actionTone === 'primary' ? '#FFFFFF' : actionColor }}>
                                {favoriteLabel || t('favourited', 'Favourited')}
                            </Text>
                        </Pressable>
                    )}
                </View>
            )}
        </Pressable>
    );
}

const styles = StyleSheet.create({
    card: {
        borderWidth: 1,
        borderRadius: scale(14),
        overflow: 'hidden',
        marginBottom: scale(10),
    },
    imageWrap: {
        aspectRatio: 0.72,
        overflow: 'hidden',
        alignItems: 'center',
        justifyContent: 'center',
    },
    lockBadge: {
        position: 'absolute',
        top: scale(8),
        width: scale(24),
        height: scale(24),
        borderRadius: scale(12),
        backgroundColor: 'rgba(15,23,42,0.76)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    verifiedBadge: {
        position: 'absolute',
        top: scale(8),
        width: scale(24),
        height: scale(24),
        borderRadius: scale(12),
        backgroundColor: 'rgba(5,150,105,0.88)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    overlayContent: {
        position: 'absolute',
        left: scale(10),
        right: scale(10),
        bottom: scale(10),
    },
    name: {
        color: '#FFFFFF',
        fontSize: scale(18),
        lineHeight: scale(22),
        fontWeight: '800',
    },
    metaRow: {
        alignItems: 'center',
        gap: scale(3),
        marginTop: scale(4),
    },
    location: {
        flex: 1,
        color: '#E2E8F0',
        fontSize: scale(11),
        lineHeight: scale(15),
        fontWeight: '600',
    },
    pillRow: {
        flexWrap: 'wrap',
        gap: scale(5),
        marginTop: scale(8),
    },
    pill: {
        maxWidth: '100%',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.24)',
        backgroundColor: 'rgba(15,23,42,0.34)',
        borderRadius: scale(999),
        paddingHorizontal: scale(8),
        paddingVertical: scale(3),
    },
    pillText: {
        color: '#FFFFFF',
        fontSize: scale(10),
        lineHeight: scale(13),
        fontWeight: '700',
    },
    actions: {
        gap: scale(7),
        padding: scale(8),
        paddingTop: scale(7),
    },
    actionButton: {
        flex: 1,
        minHeight: scale(34),
        borderWidth: 1,
        borderRadius: scale(999),
        alignItems: 'center',
        justifyContent: 'center',
        flexDirection: 'row',
        gap: scale(5),
        paddingHorizontal: scale(8),
    },
});
