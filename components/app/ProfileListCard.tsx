import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Image } from 'expo-image';
import { Heart, Lock, MapPin, ShieldCheck, X } from 'lucide-react-native';
import { Text } from '@/components/ui/Text';
import { useLanguage } from '@/hooks/useLanguage';
import { useTheme } from '@/hooks/useTheme';
import { scale } from '@/hooks/useResponsive';
import { displayText, listText, profileImage, t, translateCountry } from '@/lib/profileDisplay';
import { PROFILE_PLACEHOLDER_IMAGE } from '@/lib/profileAssets';

type ProfileListCardProps = {
    item: any;
    onPress: () => void;
    onFavorite?: () => void;
    onSkip?: () => void;
    favoriteLabel?: string;
};

export function ProfileListCard({ item, onPress, onFavorite, onSkip, favoriteLabel }: ProfileListCardProps) {
    const { isRTL } = useLanguage();
    const { isDark } = useTheme();
    const image = profileImage(item);
    const location = item.location
        ? [item.location.city, translateCountry(item.location.country)].filter(Boolean).join(' - ')
        : [item.city, translateCountry(item.country)].filter(Boolean).join(' - ');
    const name = item.profileName || item.username || t('not_set', 'Not set');
    const verified = Boolean(item.verified?.selfie || item.verified_profile);

    return (
        <Pressable
            onPress={onPress}
            style={[styles.card, { backgroundColor: isDark ? '#111827' : '#FFFFFF', borderColor: isDark ? '#334155' : '#E2E8F0' }]}
        >
            <View style={[styles.row, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
                <View style={[styles.imageWrap, { backgroundColor: isDark ? '#1E293B' : '#F1F5F9' }]}>
                    <Image source={image ? { uri: image } : PROFILE_PLACEHOLDER_IMAGE} style={StyleSheet.absoluteFill} contentFit="cover" />
                    {item.privacy === 'private' && (
                        <View style={styles.lockBadge}>
                            <Lock size={scale(12)} color="#FFFFFF" />
                        </View>
                    )}
                </View>

                <View style={{ flex: 1, minWidth: 0 }}>
                    <View style={[styles.nameRow, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
                        <Text variant="h3" numberOfLines={1} style={{ flex: 1, fontSize: scale(20), textAlign: isRTL ? 'right' : 'left' }}>
                            {name}{item.age ? `, ${item.age}` : ''}
                        </Text>
                        {verified && <ShieldCheck size={scale(18)} color="#059669" />}
                    </View>

                    {location ? (
                        <View style={[styles.metaRow, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
                            <MapPin size={scale(14)} color={isDark ? '#94A3B8' : '#64748B'} />
                            <Text variant="caption" numberOfLines={1} style={{ color: isDark ? '#94A3B8' : '#64748B', flex: 1, textAlign: isRTL ? 'right' : 'left' }}>
                                {location}
                            </Text>
                        </View>
                    ) : null}

                    <Text variant="body-sm" numberOfLines={2} style={{ color: isDark ? '#CBD5E1' : '#475569', marginTop: scale(5), textAlign: isRTL ? 'right' : 'left' }}>
                        {listText([
                            displayText(item.designation?.label || item.designation),
                            displayText(item.education?.label || item.education),
                            ...(item.languages_spoken || []).map(displayText),
                        ]) || t('tap_photo_edit', 'Tap to view profile')}
                    </Text>
                </View>
            </View>

            {(onFavorite || onSkip) && (
                <View style={[styles.actions, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
                    {onSkip && (
                        <Pressable onPress={onSkip} style={[styles.actionButton, { borderColor: isDark ? '#334155' : '#E2E8F0' }]}>
                            <X size={scale(16)} color={isDark ? '#CBD5E1' : '#475569'} />
                            <Text variant="caption">{t('skip', 'Skip')}</Text>
                        </Pressable>
                    )}
                    {onFavorite && (
                        <Pressable onPress={onFavorite} style={[styles.actionButton, styles.primaryAction]}>
                            <Heart size={scale(16)} color="#FFFFFF" />
                            <Text variant="caption" style={{ color: '#FFFFFF' }}>{favoriteLabel || t('favourited', 'Favourited')}</Text>
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
        borderRadius: scale(16),
        padding: scale(12),
        marginBottom: scale(12),
    },
    row: {
        gap: scale(12),
    },
    imageWrap: {
        width: scale(92),
        height: scale(122),
        borderRadius: scale(13),
        overflow: 'hidden',
        alignItems: 'center',
        justifyContent: 'center',
    },
    lockBadge: {
        position: 'absolute',
        right: scale(7),
        bottom: scale(7),
        width: scale(24),
        height: scale(24),
        borderRadius: scale(12),
        backgroundColor: 'rgba(15,23,42,0.76)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    nameRow: {
        alignItems: 'center',
        gap: scale(6),
    },
    metaRow: {
        alignItems: 'center',
        gap: scale(4),
        marginTop: scale(3),
    },
    actions: {
        gap: scale(8),
        marginTop: scale(12),
    },
    actionButton: {
        flex: 1,
        minHeight: scale(40),
        borderWidth: 1,
        borderRadius: scale(999),
        alignItems: 'center',
        justifyContent: 'center',
        flexDirection: 'row',
        gap: scale(6),
    },
    primaryAction: {
        borderColor: '#F34B6F',
        backgroundColor: '#F34B6F',
    },
});
