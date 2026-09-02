import React from 'react';
import { Pressable, StyleSheet, Text as RNText, TouchableOpacity, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { CircleHelp, Menu, SlidersHorizontal } from 'lucide-react-native';
import { scale } from '@/hooks/useResponsive';
import { useColors } from '@/hooks/useColors';
import { useTheme } from '@/hooks/useTheme';
import { t } from '@/lib/profileDisplay';

export function ExploreTopOverlay({
    filterCount,
    onOpenFilters,
    onOpenTour,
    onOpenMenu,
}: {
    filterCount: number;
    onOpenFilters: () => void;
    onOpenTour: () => void;
    onOpenMenu: () => void;
}) {
    const colors = useColors();
    const { isDark } = useTheme();
    // Light: dark icon on warm grey chip; dark: light icon on dark chip.
    const iconColor = isDark ? '#E8E1D6' : '#201B15';

    return (
        // Warm screen color (not the white header token) so status bar, top bar
        // and deck background read as one continuous surface on Explore
        <View style={[styles.root, { backgroundColor: colors.chrome.explore.screen }]}>
            <TouchableOpacity
                activeOpacity={0.82}
                onPress={onOpenFilters}
                hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                style={[styles.filterButton, { shadowColor: colors.chrome.primary }]}
            >
                <LinearGradient
                    colors={[colors.brand.gradient.start, colors.brand.gradient.end]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={StyleSheet.absoluteFill}
                />
                <SlidersHorizontal size={scale(13)} color={colors.chrome.common.inverseText} strokeWidth={2.5} />
                <RNText style={[styles.filterText, { color: colors.chrome.common.inverseText }]}>{t('filters', 'Filters')}</RNText>
                {filterCount > 0 ? (
                    <View style={styles.countBadge}>
                        <RNText style={[styles.countText, { color: colors.chrome.common.inverseText }]}>{filterCount}</RNText>
                    </View>
                ) : null}
            </TouchableOpacity>
            <View style={styles.actions}>
                <IconButton onPress={onOpenTour}>
                    <CircleHelp size={scale(15)} color={iconColor} strokeWidth={2.35} />
                </IconButton>
                <IconButton onPress={onOpenMenu}>
                    <Menu size={scale(15)} color={iconColor} strokeWidth={2.55} />
                </IconButton>
            </View>
        </View>
    );
}

function IconButton({ children, onPress }: { children: React.ReactNode; onPress: () => void }) {
    const { isDark } = useTheme();
    const backgroundColor = isDark ? '#2C2925' : '#ECE6DE';

    return (
        <View
            style={[
                styles.buttonShell,
                { backgroundColor },
            ]}
        >
            <Pressable
                onPress={onPress}
                hitSlop={6}
                style={({ pressed }) => [
                    styles.button,
                    { backgroundColor },
                    pressed && styles.pressed,
                ]}
            >
                {children}
            </Pressable>
        </View>
    );
}

const styles = StyleSheet.create({
    // Status bar and this bar share one background now, so keep the row tight —
    // a taller row reads as dead space under the status bar
    root: {
        height: scale(42),
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: scale(14),
    },
    actions: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: scale(16),
    },
    filterButton: {
        minWidth: scale(80),
        minHeight: scale(34),
        borderRadius: scale(18),
        overflow: 'hidden',
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        gap: scale(7),
        paddingHorizontal: scale(10),
        paddingVertical: scale(6),
        shadowOpacity: 0.24,
        shadowRadius: scale(12),
        shadowOffset: { width: 0, height: 5 },
        elevation: 4,
        zIndex: 10,
    },
    filterText: {
        fontWeight: '700',
        fontSize: scale(13),
        lineHeight: scale(16),
    },
    buttonShell: {
        width: scale(34),
        height: scale(34),
        borderRadius: scale(17),
        alignItems: 'center',
        justifyContent: 'center',
    },
    button: {
        position: 'absolute',
        top: 0,
        right: 0,
        bottom: 0,
        left: 0,
        borderRadius: scale(17),
        alignItems: 'center',
        justifyContent: 'center',
    },
    pressed: {
        opacity: 0.78,
        transform: [{ scale: 0.97 }],
    },
    countBadge: {
        minWidth: scale(18),
        height: scale(18),
        borderRadius: scale(9),
        backgroundColor: 'rgba(255,255,255,0.24)',
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: scale(4),
    },
    countText: {
        color: '#FFFFFF',
        fontSize: scale(10),
        lineHeight: scale(12),
    },
});
