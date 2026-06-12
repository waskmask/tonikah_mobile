import React, { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import { Bookmark, ChevronUp, RotateCcw, X } from 'lucide-react-native';
import { scale } from '@/hooks/useResponsive';

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
    const [activeKey, setActiveKey] = useState<ButtonKey | null>(null);

    const run = (key: ButtonKey, action: () => void) => {
        setActiveKey(key);
        setTimeout(() => setActiveKey(null), 260);
        action();
    };

    return (
        <View style={styles.root}>
            <Circle buttonKey="undo" activeKey={activeKey} disabled={!canUndo || busy} size="sm" onPress={() => run('undo', onUndo)}>
                <RotateCcw size={scale(24)} color="#7A8480" strokeWidth={2.5} />
            </Circle>
            <Circle buttonKey="skip" activeKey={activeKey} disabled={busy} size="md" tone="skip" onPress={() => run('skip', onSkip)}>
                <X size={scale(26)} color="#F34B6F" strokeWidth={2.7} />
            </Circle>
            <Circle buttonKey="favorite" activeKey={activeKey} disabled={busy} size="md" tone="primary" onPress={() => run('favorite', onFavorite)}>
                {busy ? <ActivityIndicator color="#FFFFFF" /> : <Bookmark size={scale(26)} color="#FFFFFF" fill="#FFFFFF" strokeWidth={2.4} />}
            </Circle>
            <Circle buttonKey="view" activeKey={activeKey} disabled={busy} size="sm" tone="view" onPress={() => run('view', onView)}>
                <ChevronUp size={scale(28)} color="#38A8E8" strokeWidth={2.8} />
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
}: {
    children: React.ReactNode;
    buttonKey: ButtonKey;
    activeKey: ButtonKey | null;
    onPress: () => void;
    disabled?: boolean;
    tone?: 'neutral' | 'skip' | 'primary' | 'view';
    size: 'sm' | 'md';
}) {
    const active = activeKey === buttonKey;
    const dimmed = activeKey !== null && !active;
    const ringStyle =
        tone === 'primary'
            ? styles.primaryRing
            : tone === 'skip'
                ? styles.skipRing
                : tone === 'view'
                    ? styles.viewRing
                    : styles.neutralRing;

    return (
        <View style={[styles.wrap, size === 'md' ? styles.md : styles.sm, tone === 'primary' && styles.primaryWrap]}>
            <View
                pointerEvents="none"
                style={[
                    styles.shadowLayer,
                    size === 'md' ? styles.md : styles.sm,
                    tone === 'primary' && styles.primaryShadowLayer,
                    tone === 'skip' && styles.skipShadowLayer,
                    tone === 'view' && styles.viewShadowLayer,
                    dimmed && styles.dimmedShadow,
                ]}
            />
            <View
                pointerEvents="none"
                style={[
                    styles.glow,
                    size === 'md' ? styles.glowMd : styles.glowSm,
                    tone === 'primary' && styles.primaryGlow,
                    tone === 'skip' && styles.skipGlow,
                    tone === 'view' && styles.viewGlow,
                    active && styles.activeGlow,
                ]}
            />
            {active ? <View pointerEvents="none" style={[styles.activeRing, ringStyle]} /> : null}
            <Pressable
                onPress={onPress}
                disabled={disabled}
                style={({ pressed }) => [
                    styles.circle,
                    size === 'md' ? styles.md : styles.sm,
                    tone === 'primary' && styles.primary,
                    tone === 'skip' && styles.skip,
                    tone === 'view' && styles.view,
                    disabled && styles.disabled,
                    dimmed && styles.dimmed,
                    (pressed || active) && !disabled && styles.pressed,
                ]}
            >
                {children}
            </Pressable>
        </View>
    );
}

const styles = StyleSheet.create({
    root: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: scale(15),
        minHeight: scale(84),
        paddingTop: scale(8),
        paddingBottom: scale(14),
        backgroundColor: '#FAFAF8',
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
        backgroundColor: '#FFFFFF',
        shadowColor: '#0D1B12',
        shadowOpacity: 0.2,
        shadowRadius: scale(24),
        shadowOffset: { width: 0, height: 12 },
        elevation: 12,
    },
    circle: {
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: scale(999),
        backgroundColor: '#FFFFFF',
        borderWidth: 1,
        borderColor: 'rgba(13,27,18,0.04)',
        shadowColor: '#0D1B12',
        shadowOpacity: 0.18,
        shadowRadius: scale(18),
        shadowOffset: { width: 0, height: 9 },
        elevation: 10,
        zIndex: 2,
    },
    sm: { width: scale(48), height: scale(48) },
    md: { width: scale(56), height: scale(56) },
    primary: {
        backgroundColor: '#F34B6F',
        borderColor: '#F34B6F',
        shadowColor: '#F34B6F',
        shadowOpacity: 0.48,
        shadowRadius: scale(28),
        shadowOffset: { width: 0, height: 14 },
        elevation: 16,
    },
    skip: {
        shadowOpacity: 0.16,
    },
    view: {
        shadowOpacity: 0.14,
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
        backgroundColor: '#F34B6F',
        shadowColor: '#F34B6F',
        shadowOpacity: 0.38,
        shadowRadius: scale(30),
        shadowOffset: { width: 0, height: 15 },
        elevation: 16,
    },
    skipShadowLayer: {
        shadowColor: '#0D1B12',
        shadowOpacity: 0.16,
        elevation: 11,
    },
    viewShadowLayer: {
        shadowColor: '#0D1B12',
        shadowOpacity: 0.16,
        elevation: 11,
    },
    glow: {
        position: 'absolute',
        borderRadius: scale(999),
        opacity: 0.5,
        zIndex: 0,
    },
    glowSm: {
        width: scale(46),
        height: scale(46),
    },
    glowMd: {
        width: scale(54),
        height: scale(54),
    },
    primaryGlow: {
        backgroundColor: 'rgba(243,75,111,0.24)',
        transform: [{ translateY: scale(11) }],
    },
    skipGlow: {
        backgroundColor: 'rgba(244,63,94,0.10)',
        transform: [{ translateY: scale(9) }],
    },
    viewGlow: {
        backgroundColor: 'rgba(56,168,232,0.12)',
        transform: [{ translateY: scale(9) }],
    },
    activeGlow: {
        opacity: 1,
        transform: [{ translateY: scale(11) }, { scale: 1.35 }],
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
    primaryRing: {
        borderColor: 'rgba(243,75,111,0.45)',
    },
    skipRing: {
        borderColor: 'rgba(244,63,94,0.5)',
    },
    viewRing: {
        borderColor: 'rgba(56,168,232,0.5)',
    },
    neutralRing: {
        borderColor: 'rgba(122,132,128,0.35)',
    },
});
