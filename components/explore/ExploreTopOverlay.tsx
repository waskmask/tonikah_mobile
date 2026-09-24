import React from 'react';
import { Platform, Pressable, StyleSheet, Text as RNText, View } from 'react-native';
import { GlassView, isGlassEffectAPIAvailable, isLiquidGlassAvailable } from 'expo-glass-effect';
import { requireOptionalNativeModule } from 'expo-modules-core';
import { Info, Settings2 } from 'lucide-react-native';
import { AppMenuButton } from '@/components/app/AppMenuButton';
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
    const hasNativeGlass = Platform.OS === 'ios'
        && !!requireOptionalNativeModule('ExpoGlassEffect')
        && isGlassEffectAPIAvailable()
        && isLiquidGlassAvailable();
    // Light: dark icon on neutral grey chip; dark: light icon on dark chip.
    const iconColor = isDark ? '#E5E5E7' : '#201B15';

    return (
        // Warm screen color (not the white header token) so status bar, top bar
        // and deck background read as one continuous surface on Explore
        <View style={[styles.root, { backgroundColor: colors.chrome.explore.screen }]}>
            <Pressable
                onPress={onOpenFilters}
                accessibilityRole="button"
                accessibilityLabel={t('filters', 'Filters')}
                accessibilityValue={filterCount > 0 ? { text: String(filterCount) } : undefined}
                hitSlop={4}
                style={styles.filterWrap}
            >
                <View
                    pointerEvents="none"
                    style={[styles.filterShadow, {
                        backgroundColor: Platform.OS === 'android' && !isDark
                            ? '#F7F7F7'
                            : colors.chrome.explore.actionCircle,
                    }]}
                />
                {hasNativeGlass ? (
                    <GlassView
                        pointerEvents="none"
                        glassEffectStyle="regular"
                        colorScheme={isDark ? 'dark' : 'light'}
                        style={styles.filterGlass}
                    />
                ) : null}
                <View pointerEvents="none" style={styles.filterIconCenter}>
                    <Settings2
                        size={scale(Platform.OS === 'android' ? 22 : 18)}
                        width={scale(Platform.OS === 'android' ? 24 : 18)}
                        height={scale(Platform.OS === 'android' ? 22 : 18)}
                        color={iconColor}
                        strokeWidth={Platform.OS === 'android' ? 2.5 : 2.2}
                    />
                </View>
                {filterCount > 0 ? (
                    <View pointerEvents="none" style={[styles.countBadge, { backgroundColor: colors.chrome.badge.background, borderColor: colors.chrome.explore.screen }]}>
                        <RNText style={[styles.countText, { color: colors.chrome.common.inverseText }]}>{filterCount}</RNText>
                    </View>
                ) : null}
            </Pressable>
            <View style={styles.actions}>
                <IconButton onPress={onOpenTour}>
                    <Info size={scale(Platform.OS === 'android' ? 20 : 18)} color={iconColor} strokeWidth={2.35} />
                </IconButton>
                <AppMenuButton onPress={onOpenMenu} />
            </View>
        </View>
    );
}

function IconButton({ children, onPress }: { children: React.ReactNode; onPress: () => void }) {
    return (
        <View style={styles.buttonShell}>
            <Pressable
                onPress={onPress}
                hitSlop={6}
                style={({ pressed }) => [
                    styles.button,
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
        overflow: 'visible',
        zIndex: 2,
    },
    actions: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: scale(14),
    },
    filterWrap: {
        width: scale(Platform.OS === 'android' ? 38 : 46),
        height: scale(Platform.OS === 'android' ? 38 : 46),
        position: 'relative',
        overflow: 'visible',
    },
    filterShadow: {
        position: 'absolute',
        top: 0,
        right: 0,
        bottom: 0,
        left: 0,
        borderRadius: scale(Platform.OS === 'android' ? 18 : 22),
    },
    filterGlass: {
        position: 'absolute',
        top: 0,
        right: 0,
        bottom: 0,
        left: 0,
        borderRadius: scale(22),
        borderCurve: 'continuous',
    },
    filterIconCenter: {
        position: 'absolute',
        top: 0,
        right: 0,
        bottom: 0,
        left: 0,
        alignItems: 'center',
        justifyContent: 'center',
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
        position: 'absolute',
        top: scale(-5),
        right: scale(-6),
        minWidth: scale(17),
        height: scale(17),
        borderRadius: scale(9),
        borderWidth: 1.5,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: scale(3),
    },
    countText: {
        color: '#FFFFFF',
        fontSize: scale(10),
        lineHeight: scale(12),
    },
});
