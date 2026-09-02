import React from 'react';
import { ActivityIndicator, Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Bookmark, Lock, MapPin, ShieldCheck, X } from 'lucide-react-native';
import { Text } from '@/components/ui/Text';
import { PressableScale } from '@/components/ui/PressableScale';
import { useHaptics } from '@/hooks/useHaptics';
import { useLanguage } from '@/hooks/useLanguage';
import { useColors } from '@/hooks/useColors';
import { scale } from '@/hooks/useResponsive';
import { displayText, profileImage, t, translateCountry, translateNamespace } from '@/lib/profileDisplay';
import { PROFILE_PLACEHOLDER_IMAGE } from '@/lib/profileAssets';

type ProfileListCardProps = {
    item: any;
    onPress: () => void;
    onFavorite?: () => void;
    onSkip?: () => void;
    favoriteLabel?: string;
    badgeLabel?: string;
    actionTone?: 'primary' | 'danger' | 'neutral';
    actionPlacement?: 'footer' | 'overlayIcon' | 'overlayPill';
    actionLoading?: boolean;
};

function firstValue(value: any) {
    return Array.isArray(value) ? value[0] : value;
}

function pushUnique(pills: string[], value?: string) {
    const label = String(value || '').trim();
    if (!label) return;
    if (!pills.some((pill) => pill.toLowerCase() === label.toLowerCase())) {
        pills.push(label);
    }
}

function collectPills(item: any) {
    const pills: string[] = [];
    const nationalities = Array.isArray(item.nationality) ? item.nationality : firstValue(item.nationality) ? [firstValue(item.nationality)] : [];
    const ethnicItems = Array.isArray(item.ethnic_group) ? item.ethnic_group : firstValue(item.ethnic_group) ? [firstValue(item.ethnic_group)] : [];

    nationalities.forEach((entry: any) => {
        const label = displayText(entry);
        pushUnique(pills, translateNamespace('nationalities', label));
    });

    const designation = displayText(item.designation);
    pushUnique(pills, translateNamespace('designations', designation));

    ethnicItems.forEach((entry: any) => {
        const label = displayText(entry);
        pushUnique(pills, translateNamespace('ethnic_group', label));
    });

    if (pills.length < 3) {
        const education = displayText(item.education);
        pushUnique(pills, translateNamespace('common', education));
    }

    return pills.filter(Boolean).slice(0, 3);
}

export function ProfileListCard({
    item,
    onPress,
    onFavorite,
    onSkip,
    favoriteLabel,
    badgeLabel,
    actionTone = 'primary',
    actionPlacement = 'footer',
    actionLoading = false,
}: ProfileListCardProps) {
    const { isRTL } = useLanguage();
    const colors = useColors();
    const { lightImpact } = useHaptics();
    const common = colors.chrome.common;
    const { width } = useWindowDimensions();
    const image = profileImage(item);
    const cardWidth = Math.floor((width - scale(28) - scale(10)) / 2);
    const location = item.location
        ? [item.location.city, translateCountry(item.location.country)].filter(Boolean).join(' - ')
        : [item.city, translateCountry(item.country)].filter(Boolean).join(' - ');
    const name = item.profileName || item.username || t('not_set', 'Not set');
    const age = item.age || item.profile?.age;
    const verified = Boolean(item.verified?.selfie || item.verified_profile);
    const pills = collectPills(item);
    const actionColor = actionTone === 'danger' ? colors.brand.accent.error : actionTone === 'neutral' ? colors.chrome.header.icon : colors.chrome.primary;
    const showOverlayAction = onFavorite && actionPlacement !== 'footer';

    return (
        <PressableScale
            onPress={onPress}
            activeScale={0.97}
            style={[
                styles.card,
                {
                    width: cardWidth,
                    backgroundColor: common.card,
                    borderColor: colors.brand.bg.border,
                },
            ]}
        >
            <View style={[styles.imageWrap, { backgroundColor: common.cardAlt }]}>
                <Image source={image ? { uri: image } : PROFILE_PLACEHOLDER_IMAGE} style={StyleSheet.absoluteFill} contentFit="cover" />
                <LinearGradient
                    colors={['rgba(24, 19, 14,0.04)', 'rgba(24, 19, 14,0.18)', 'rgba(24, 19, 14,0.82)']}
                    locations={[0, 0.48, 1]}
                    style={StyleSheet.absoluteFill}
                />
                {badgeLabel ? (
                    <View style={[styles.badge, { left: isRTL ? undefined : 0, right: isRTL ? 0 : undefined, backgroundColor: colors.chrome.primary }]}>
                        <Text numberOfLines={1} style={[styles.badgeText, { color: common.inverseText }]}>{badgeLabel}</Text>
                    </View>
                ) : null}
                {item.privacy === 'private' && (
                    <View style={[styles.lockBadge, { left: isRTL ? scale(8) : undefined, right: isRTL ? undefined : scale(8) }]}>
                        <Lock size={scale(12)} color={common.inverseText} />
                    </View>
                )}
                {verified && (
                    <View style={[styles.verifiedBadge, { left: isRTL ? scale(8) : undefined, right: isRTL ? undefined : scale(8) }]}>
                        <ShieldCheck size={scale(13)} color={common.inverseText} />
                    </View>
                )}
                {showOverlayAction ? (
                    <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={favoriteLabel || t('remove', 'Remove')}
                        disabled={actionLoading}
                        onPress={(event) => {
                            event.stopPropagation();
                            lightImpact();
                            onFavorite();
                        }}
                        style={[
                            actionPlacement === 'overlayPill' ? styles.overlayPillAction : styles.overlayIconAction,
                            {
                                right: isRTL ? undefined : actionPlacement === 'overlayIcon' ? scale(4) : scale(10),
                                left: isRTL ? (actionPlacement === 'overlayIcon' ? scale(4) : scale(10)) : undefined,
                            },
                            actionLoading && styles.actionLoading,
                        ]}
                    >
                        {actionLoading ? (
                            <ActivityIndicator size="small" color={common.inverseText} />
                        ) : actionPlacement === 'overlayPill' ? (
                            <Text numberOfLines={1} style={styles.overlayPillText}>{favoriteLabel}</Text>
                        ) : (
                            <X size={scale(21)} color={common.inverseText} strokeWidth={2.4} />
                        )}
                    </Pressable>
                ) : null}
                <View style={styles.overlayContent}>
                    {/* Content-sized text in a row: the row mirrors under native RTL,
                        no textAlign needed. ‏ (RLM) sets RTL bidi base so the
                        age renders on the visual left of the name. */}
                    <View style={styles.nameRow}>
                        <Text numberOfLines={1} style={styles.name}>
                            {isRTL ? '‏' : ''}{name}{age ? `, ${age}` : ''}
                        </Text>
                    </View>
                    {location ? (
                        <View style={[styles.metaRow, { flexDirection: 'row' }]}>
                            <MapPin size={scale(11)} color={colors.brand.bg.border} />
                            <Text numberOfLines={1} style={styles.location}>
                                {isRTL ? '‏' : ''}{location}
                            </Text>
                        </View>
                    ) : null}
                    {pills.length ? (
                        <View style={[styles.pillRow, { flexDirection: 'row' }]}>
                            {pills.map((pill, index) => (
                                <View key={`${String(item.id || item._id || name)}-${pill}-${index}`} style={styles.pill}>
                                    <Text numberOfLines={1} style={styles.pillText}>{pill}</Text>
                                </View>
                            ))}
                        </View>
                    ) : null}
                </View>
            </View>

            {((onFavorite && !showOverlayAction) || onSkip) && (
                <View style={[styles.actions, { flexDirection: 'row' }]}>
                    {onSkip && (
                        <Pressable onPress={onSkip} style={[styles.actionButton, { borderColor: colors.brand.bg.border }]}>
                            <X size={scale(16)} color={colors.chrome.header.icon} />
                            <Text variant="caption" numberOfLines={1}>{t('skip', 'Skip')}</Text>
                        </Pressable>
                    )}
                    {onFavorite && (
                        <Pressable
                            disabled={actionLoading}
                            onPress={() => { lightImpact(); onFavorite(); }}
                            style={[
                                styles.actionButton,
                                {
                                    borderColor: actionColor,
                                    backgroundColor: actionTone === 'primary' ? colors.chrome.primary : 'transparent',
                                },
                                actionLoading && styles.actionLoading,
                            ]}
                        >
                            {actionLoading ? (
                                <ActivityIndicator size="small" color={actionTone === 'primary' ? common.inverseText : actionColor} />
                            ) : (
                                <Bookmark size={scale(15)} color={actionTone === 'primary' ? common.inverseText : actionColor} />
                            )}
                            <Text variant="caption" numberOfLines={1} style={{ color: actionTone === 'primary' ? common.inverseText : actionColor }}>
                                {favoriteLabel || t('favourited', 'Favourited')}
                            </Text>
                        </Pressable>
                    )}
                </View>
            )}
        </PressableScale>
    );
}

const styles = StyleSheet.create({
    card: {
        borderWidth: 0,
        borderRadius: scale(8),
        overflow: 'hidden',
        marginBottom: scale(10),
    },
    imageWrap: {
        aspectRatio: 0.75,
        overflow: 'hidden',
        alignItems: 'center',
        justifyContent: 'center',
    },
    badge: {
        position: 'absolute',
        top: 0,
        maxWidth: '82%',
        minHeight: scale(28),
        borderBottomRightRadius: scale(6),
        paddingHorizontal: scale(10),
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 2,
    },
    badgeText: {
        fontSize: scale(10),
        lineHeight: scale(13),
        fontWeight: '800',
    },
    lockBadge: {
        position: 'absolute',
        top: scale(8),
        width: scale(24),
        height: scale(24),
        borderRadius: scale(12),
        backgroundColor: 'rgba(24, 19, 14,0.76)',
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
    overlayIconAction: {
        position: 'absolute',
        top: scale(4),
        width: scale(36),
        height: scale(36),
        borderRadius: scale(18),
        backgroundColor: 'transparent',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 3,
    },
    overlayPillAction: {
        position: 'absolute',
        top: scale(10),
        minHeight: scale(32),
        borderRadius: scale(999),
        backgroundColor: 'rgba(24, 19, 14,0.54)',
        paddingHorizontal: scale(12),
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 3,
    },
    overlayPillText: {
        color: '#FFFFFF',
        fontSize: scale(12),
        lineHeight: scale(15),
        fontWeight: '800',
    },
    overlayContent: {
        position: 'absolute',
        left: scale(10),
        right: scale(10),
        bottom: scale(10),
    },
    nameRow: {
        flexDirection: 'row',
    },
    name: {
        flexShrink: 1,
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
        flexShrink: 1,
        color: '#E8E1D6',
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
        backgroundColor: 'rgba(24, 19, 14,0.34)',
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
    actionLoading: { opacity: 0.72 },
});
