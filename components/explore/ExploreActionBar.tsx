import React, { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View, useWindowDimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Bookmark, ChevronUp, RotateCcw, X } from 'lucide-react-native';
import { scale } from '@/hooks/useResponsive';
import { useColors } from '@/hooks/useColors';
import { useHaptics } from '@/hooks/useHaptics';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { useTheme } from '@/hooks/useTheme';

type ButtonKey = 'undo' | 'skip' | 'favorite' | 'view';

type Props = {
    canUndo: boolean;
    busy?: boolean;
    onUndo: () => void;
    onSkip: () => void;
    onFavorite: () => void;
    onView: () => void;
};

export function ExploreActionBar({ canUndo, busy, onUndo, onSkip, onFavorite, onView }: Props) {
    const colors = useColors();
    const { isDark } = useTheme();
    const explore = colors.chrome.explore;
    const { lightImpact } = useHaptics();
    const reduceMotion = useReducedMotion();
    const [activeKey, setActiveKey] = useState<ButtonKey | null>(null);
    // Extra breathing room above the buttons on tall screens only — short
    // devices keep the tighter gap so the deck doesn't lose card height
    const { height: windowHeight } = useWindowDimensions();
    const tallDevice = windowHeight >= 820;

    const run = (key: ButtonKey, action: () => void) => {
        lightImpact();
        if (!reduceMotion) {
            setActiveKey(key);
            setTimeout(() => setActiveKey(null), 260);
        }
        action();
    };

    return (
        <View style={[styles.root, { backgroundColor: explore.actionBar, paddingTop: scale(12) + (tallDevice ? scale(8) : 0) }]}>
            <Circle buttonKey="undo" activeKey={activeKey} disabled={!canUndo || busy} size="sm" reduceMotion={reduceMotion} onPress={() => run('undo', onUndo)}>
                <RotateCcw size={scale(24)} color={isDark ? '#F1CA71' : '#D2A33B'} strokeWidth={2.5} />
            </Circle>
            <Circle buttonKey="skip" activeKey={activeKey} disabled={busy} size="md" tone="skip" reduceMotion={reduceMotion} onPress={() => run('skip', onSkip)}>
                <X size={scale(26)} color={isDark ? '#FFFFFF' : '#141210'} strokeWidth={2.7} />
            </Circle>
            <Circle buttonKey="view" activeKey={activeKey} disabled={busy} size="md" tone="view" reduceMotion={reduceMotion} onPress={() => run('view', onView)}>
                <ChevronUp size={scale(28)} color="#FFFFFF" strokeWidth={2.8} />
            </Circle>
            <Circle buttonKey="favorite" activeKey={activeKey} disabled={busy} size="sm" tone="primary" reduceMotion={reduceMotion} onPress={() => run('favorite', onFavorite)}>
                {busy ? <ActivityIndicator color="#3E9DFF" /> : <Bookmark size={scale(22)} color="#3E9DFF" fill="#3E9DFF" strokeWidth={2.4} />}
            </Circle>
        </View>
    );
}

function Circle({
    children,
    buttonKey,
    activeKey,
    onPress,
    disabled,
    tone = 'neutral',
    size,
    reduceMotion = false,
}: {
    children: React.ReactNode;
    buttonKey: ButtonKey;
    activeKey: ButtonKey | null;
    onPress: () => void;
    disabled?: boolean;
    tone?: 'neutral' | 'skip' | 'primary' | 'view';
    size: 'sm' | 'md';
    reduceMotion?: boolean;
}) {
    const colors = useColors();
    const { isDark } = useTheme();
    const common = colors.chrome.common;
    const active = activeKey === buttonKey;
    const dimmed = activeKey !== null && !active;
    const hasDarkShine = isDark && tone !== 'view';
    const lightBorderColor =
        tone === 'primary'
            ? '#C8DFFF'
            : tone === 'skip'
                ? '#DEDEDE'
                : '#F8E6BD';
    const buttonBackground =
        tone === 'view'
            ? colors.brand.gradient.start
            : isDark
                ? '#2C2925'
                : '#FFFFFF';
    const buttonShadow =
        tone === 'view'
            ? colors.chrome.primary
            : isDark
                ? '#000000'
                : common.shadow;
    const ringColor =
        tone === 'primary'
            ? common.blueRing
            : tone === 'skip'
                ? common.dangerRing
                : tone === 'view'
                    ? common.primaryRing
                    : 'rgba(241,202,113,0.5)';

    return (
        <View style={[styles.wrap, size === 'md' ? styles.md : styles.sm, tone === 'view' && styles.primaryWrap]}>
            <View
                pointerEvents="none"
                style={[
                    styles.shadowLayer,
                    {
                        backgroundColor: buttonBackground,
                        shadowColor: buttonShadow,
                    },
                    size === 'md' ? styles.md : styles.sm,
                    tone === 'view' && [styles.primaryShadowLayer, { shadowColor: colors.chrome.primary }],
                    tone === 'primary' && [styles.viewShadowLayer, { shadowColor: buttonShadow }],
                    tone === 'skip' && [styles.skipShadowLayer, { shadowColor: common.shadow }],
                    dimmed && styles.dimmedShadow,
                ]}
            />
            {active ? <View pointerEvents="none" style={[styles.activeRing, { borderColor: ringColor }]} /> : null}
            {tone === 'view' ? (
                <LinearGradient
                    colors={[
                        colors.brand.gradient.start,
                        colors.brand.gradient.center,
                        colors.brand.gradient.end,
                    ]}
                    locations={[0, 0.5, 1]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={[
                        styles.circle,
                        styles.primary,
                        { shadowColor: buttonShadow, borderWidth: 0 },
                        size === 'md' ? styles.md : styles.sm,
                        disabled && styles.disabled,
                        dimmed && styles.dimmed,
                        active && !disabled && !reduceMotion && styles.pressed,
                    ]}
                >
                    <Pressable
                        onPress={onPress}
                        disabled={disabled}
                        style={({ pressed }) => [
                            styles.buttonContent,
                            pressed && !disabled && styles.contentPressed,
                        ]}
                    >
                        {children}
                    </Pressable>
                </LinearGradient>
            ) : hasDarkShine ? (
                <LinearGradient
                    colors={[
                        'rgba(255,255,255,0.62)',
                        'rgba(255,255,255,0.22)',
                        'rgba(255,255,255,0.06)',
                        'rgba(255,255,255,0.24)',
                    ]}
                    locations={[0, 0.3, 0.7, 1]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={[
                        styles.circle,
                        { shadowColor: buttonShadow, borderWidth: 0 },
                        size === 'md' ? styles.md : styles.sm,
                        tone === 'skip' && styles.skip,
                        tone === 'primary' && styles.view,
                        disabled && styles.disabled,
                        dimmed && styles.dimmed,
                        active && !disabled && !reduceMotion && styles.pressed,
                    ]}
                >
                    <View style={styles.darkShineContent}>
                        <Pressable
                            onPress={onPress}
                            disabled={disabled}
                            style={({ pressed }) => [
                                styles.buttonContent,
                                pressed && !disabled && styles.contentPressed,
                            ]}
                        >
                            {children}
                        </Pressable>
                    </View>
                </LinearGradient>
            ) : (
                <Pressable
                    onPress={onPress}
                    disabled={disabled}
                    style={({ pressed }) => [
                        styles.circle,
                        {
                            backgroundColor: buttonBackground,
                            borderColor: lightBorderColor,
                            borderWidth: 0.5,
                            shadowColor: buttonShadow,
                        },
                        size === 'md' ? styles.md : styles.sm,
                        tone === 'skip' && styles.skip,
                        tone === 'primary' && styles.view,
                        disabled && styles.disabled,
                        dimmed && styles.dimmed,
                        (pressed || active) && !disabled && !reduceMotion && styles.pressed,
                    ]}
                >
                    {children}
                </Pressable>
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    root: {
        flexDirection: 'row',
        // Action buttons keep the same order in RTL (universal gesture layout,
        // like Tinder) — pin this row to LTR so native RTL doesn't mirror it
        direction: 'ltr',
        alignItems: 'center',
        justifyContent: 'center',
        gap: scale(15),
        minHeight: scale(84),
        paddingTop: scale(12),
        paddingBottom: scale(14),
    },
    wrap: {
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'visible',
        position: 'relative',
    },
    primaryWrap: {
        zIndex: 2,
    },
    shadowLayer: {
        position: 'absolute',
        borderRadius: scale(999),
        shadowOpacity: 0.12,
        shadowRadius: scale(11),
        shadowOffset: { width: 0, height: 5 },
        elevation: 5,
    },
    circle: {
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
        borderRadius: scale(999),
        borderWidth: 1,
        borderColor: 'rgba(13,27,18,0.04)',
        shadowOpacity: 0,
        shadowRadius: 0,
        shadowOffset: { width: 0, height: 0 },
        elevation: 0,
        zIndex: 2,
    },
    buttonContent: {
        flex: 1,
        width: '100%',
        borderRadius: scale(999),
        alignItems: 'center',
        justifyContent: 'center',
    },
    contentPressed: {
        opacity: 0.82,
    },
    darkShineContent: {
        flex: 1,
        alignSelf: 'stretch',
        margin: 1,
        borderRadius: scale(999),
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#2C2925',
        borderTopWidth: 1,
        borderTopColor: 'rgba(255,255,255,0.08)',
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(0,0,0,0.32)',
    },
    sm: { width: scale(48), height: scale(48) },
    md: { width: scale(56), height: scale(56) },
    primary: {
        shadowOpacity: 0,
        elevation: 0,
    },
    skip: {
        shadowOpacity: 0,
    },
    view: {
        shadowOpacity: 0,
    },
    disabled: { opacity: 0.42 },
    dimmed: {
        opacity: 0.58,
        transform: [{ scale: 0.94 }],
    },
    dimmedShadow: {
        opacity: 0.38,
    },
    pressed: { transform: [{ scale: 1.1 }] },
    primaryShadowLayer: {
        shadowOpacity: 0.1,
        shadowRadius: scale(12),
        shadowOffset: { width: 0, height: 6 },
        elevation: 5,
    },
    skipShadowLayer: {
        shadowOpacity: 0.1,
        elevation: 5,
    },
    viewShadowLayer: {
        shadowOpacity: 0.1,
        elevation: 5,
    },
    activeRing: {
        position: 'absolute',
        top: -scale(5),
        right: -scale(5),
        bottom: -scale(5),
        left: -scale(5),
        borderRadius: scale(999),
        borderWidth: scale(3),
        opacity: 0.86,
        zIndex: 1,
    },
});
