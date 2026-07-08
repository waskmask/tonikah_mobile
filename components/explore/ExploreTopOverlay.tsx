import React from 'react';
import { Pressable, StyleSheet, Text as RNText, TouchableOpacity, View } from 'react-native';
import { CircleHelp, Menu, SlidersHorizontal } from 'lucide-react-native';
import { scale } from '@/hooks/useResponsive';
import { useColors } from '@/hooks/useColors';
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
    const iconColor = colors.chrome.header.icon;

    return (
        <View style={[styles.root, { backgroundColor: colors.chrome.header.background, borderBottomColor: colors.chrome.common.hairline }]}>
            <TouchableOpacity activeOpacity={0.82} onPress={onOpenFilters} hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }} style={[styles.filterButton, { backgroundColor: colors.chrome.primary, borderColor: colors.chrome.primary, shadowColor: colors.chrome.primary }]}>
                <SlidersHorizontal size={scale(17)} color={colors.chrome.common.inverseText} strokeWidth={2.5} />
                <RNText style={[styles.filterText, { color: colors.chrome.common.inverseText }]}>{t('filters', 'Filters')}</RNText>
                {filterCount > 0 ? (
                    <View style={styles.countBadge}>
                        <RNText style={[styles.countText, { color: colors.chrome.common.inverseText }]}>{filterCount}</RNText>
                    </View>
                ) : null}
            </TouchableOpacity>
            <View style={styles.actions}>
                <IconButton onPress={onOpenTour}>
                    <CircleHelp size={scale(20)} color={iconColor} strokeWidth={2.35} />
                </IconButton>
                <IconButton onPress={onOpenMenu}>
                    <Menu size={scale(22)} color={iconColor} strokeWidth={2.55} />
                </IconButton>
            </View>
        </View>
    );
}

function IconButton({ children, onPress }: { children: React.ReactNode; onPress: () => void }) {
    const colors = useColors();
    return (
        <Pressable
            onPress={onPress}
            // Visual size stays 34pt; hitSlop brings the touch target to ~44pt
            hitSlop={6}
            style={({ pressed }) => [
                styles.button,
                { backgroundColor: colors.chrome.header.iconBackground, borderColor: colors.brand.bg.border },
                pressed && styles.pressed,
            ]}
        >
            {children}
        </Pressable>
    );
}

const styles = StyleSheet.create({
    root: {
        height: scale(50),
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: scale(14),
        borderBottomWidth: 1,
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
        borderWidth: 1,
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
    button: {
        width: scale(34),
        height: scale(34),
        borderRadius: scale(17),
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        shadowColor: '#000000',
        shadowOpacity: 0.08,
        shadowRadius: scale(8),
        shadowOffset: { width: 0, height: 3 },
        elevation: 2,
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
