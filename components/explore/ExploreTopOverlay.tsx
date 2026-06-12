import React from 'react';
import { Pressable, StyleSheet, Text as RNText, TouchableOpacity, View } from 'react-native';
import { CircleHelp, Menu, SlidersHorizontal } from 'lucide-react-native';
import { scale } from '@/hooks/useResponsive';
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
    const { isDark } = useTheme();
    const iconColor = isDark ? '#F8FAFC' : '#1F2D27';

    return (
        <View style={[styles.root, { backgroundColor: isDark ? '#111827' : '#FFFFFF' }]}>
            <TouchableOpacity activeOpacity={0.82} onPress={onOpenFilters} style={styles.filterButton}>
                <SlidersHorizontal size={scale(17)} color="#FFFFFF" strokeWidth={2.5} />
                <RNText style={styles.filterText}>{t('filters', 'Filters')}</RNText>
                {filterCount > 0 ? (
                    <View style={styles.countBadge}>
                        <RNText style={styles.countText}>{filterCount}</RNText>
                    </View>
                ) : null}
            </TouchableOpacity>
            <View style={styles.actions}>
                <IconButton isDark={isDark} onPress={onOpenTour}>
                    <CircleHelp size={scale(20)} color={iconColor} strokeWidth={2.35} />
                </IconButton>
                <IconButton isDark={isDark} onPress={onOpenMenu}>
                    <Menu size={scale(22)} color={iconColor} strokeWidth={2.55} />
                </IconButton>
            </View>
        </View>
    );
}

function IconButton({ children, isDark, onPress }: { children: React.ReactNode; isDark: boolean; onPress: () => void }) {
    return (
        <Pressable
            onPress={onPress}
            style={({ pressed }) => [
                styles.button,
                { backgroundColor: isDark ? '#1F2937' : '#F6F7F8', borderColor: isDark ? '#374151' : '#E5EAF0' },
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
        borderBottomColor: 'rgba(148,163,184,0.18)',
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
        backgroundColor: '#F34B6F',
        borderWidth: 1,
        borderColor: '#F34B6F',
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        gap: scale(7),
        paddingHorizontal: scale(10),
        paddingVertical: scale(6),
        shadowColor: '#F34B6F',
        shadowOpacity: 0.24,
        shadowRadius: scale(12),
        shadowOffset: { width: 0, height: 5 },
        elevation: 4,
        zIndex: 10,
    },
    filterText: {
        color: '#FFFFFF',
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
