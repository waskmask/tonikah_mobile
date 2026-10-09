import React from 'react';
import { ActivityIndicator, Platform, Pressable, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Reanimated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';
import { Copy, Info, Reply, Trash2, X } from '@/components/ui/icons/PhosphorCompat';
import { scale } from '@/hooks/useResponsive';
import { messageBubbleHolePath, messageContextLayout, type MessageAnchor } from '@/lib/messageContextLayout';

export type MessageContextAction = {
    id: 'reply' | 'copy' | 'report' | 'delete';
    label: string;
    onPress: () => void;
    danger?: boolean;
};

const ICONS = { reply: Reply, copy: Copy, report: Info, delete: Trash2 };
const REACTIONS = ['\u{1F44D}', '\u2764\uFE0F', '\u{1F602}', '\u{1F62E}', '\u{1F622}', '\u{1F64F}'];

export function MessageContextOverlay({
    anchor,
    mine,
    hasTail,
    imageOnlyTail,
    viewport,
    headerHeight,
    colors,
    actions,
    busy,
    busyActionId,
    onReact,
    onActionFeedback,
    onClose,
}: {
    anchor: MessageAnchor;
    mine: boolean;
    hasTail: boolean;
    imageOnlyTail: boolean;
    viewport: { width: number; height: number };
    headerHeight: number;
    colors: { card: string; text: string; muted: string; danger: string; border: string };
    actions: MessageContextAction[];
    busy: boolean;
    busyActionId?: MessageContextAction['id'];
    onReact: (emoji: string) => void;
    onActionFeedback: () => void;
    onClose: () => void;
}) {
    const android = Platform.OS === 'android';
    const menuHeight = actions.length * scale(44) + scale(8);
    const headerActions = [...actions.filter((action) => action.id !== 'report'), ...actions.filter((action) => action.id === 'report')];
    const layout = messageContextLayout(anchor, viewport, menuHeight, headerHeight, scale(48), mine);
    const { bubble } = layout;
    const dim = 'rgba(0,0,0,0.55)';
    const holeInset = 1;
    const hole = messageBubbleHolePath({
        x: bubble.x + holeInset,
        y: bubble.y + holeInset,
        width: Math.max(0, bubble.width - holeInset * 2),
        height: Math.max(0, bubble.height - holeInset * 2),
    }, mine, scale(14) - holeInset, { tail: hasTail, imageOnly: imageOnlyTail, tailWidth: scale(6) });

    return (
        <View style={StyleSheet.absoluteFill}>
            <Pressable style={StyleSheet.absoluteFill} onPress={busy ? undefined : onClose} accessibilityLabel="Close message actions" />
            <Reanimated.View entering={FadeIn.duration(120)} pointerEvents="none" style={StyleSheet.absoluteFill}>
                <Svg width={viewport.width} height={viewport.height}>
                    <Path d={`M 0 0 H ${viewport.width} V ${viewport.height} H 0 Z ${hole}`} fill={dim} fillRule="evenodd" />
                </Svg>
            </Reanimated.View>

            {android && (
                <Reanimated.View entering={FadeIn.duration(140)} style={[styles.actionBar, { height: headerHeight, backgroundColor: colors.card, borderBottomColor: colors.border }]}>
                    <Pressable onPress={onClose} disabled={busy} style={styles.barButton} accessibilityRole="button" accessibilityLabel="Close selection">
                        <X size={scale(22)} color={colors.text} />
                    </Pressable>
                    <Text style={[styles.selectionCount, { color: colors.text }]}>1</Text>
                    <View style={styles.barSpacer} />
                    {headerActions.map((action) => {
                        const Icon = ICONS[action.id];
                        return (
                            <Pressable key={action.id} onPress={() => { onActionFeedback(); action.onPress(); }} disabled={busy} style={styles.barButton} accessibilityRole="button" accessibilityLabel={action.label}>
                                {busy && busyActionId === action.id
                                    ? <ActivityIndicator size="small" color={colors.text} />
                                    : <Icon size={scale(21)} color={colors.text} strokeWidth={2} />}
                            </Pressable>
                        );
                    })}
                </Reanimated.View>
            )}

            <Reanimated.View
                entering={FadeInDown.duration(170)}
                style={[
                    styles.reactionRow,
                    {
                        left: layout.reaction.x,
                        top: android ? layout.reaction.yAndroid : layout.reaction.yIos,
                        width: layout.reaction.width,
                        height: scale(48),
                        backgroundColor: colors.card,
                        borderColor: colors.border,
                    },
                ]}
            >
                {REACTIONS.map((emoji) => (
                    <Pressable key={emoji} onPress={() => { onActionFeedback(); onReact(emoji); }} disabled={busy} style={styles.reactionButton} accessibilityRole="button" accessibilityLabel={`React ${emoji}`}>
                        <Text style={styles.reactionEmoji}>{emoji}</Text>
                    </Pressable>
                ))}
            </Reanimated.View>

            {!android && (
                <Reanimated.View entering={FadeInDown.duration(180)} style={[styles.menu, { left: layout.menu.x, top: layout.menu.y, width: layout.menu.width, backgroundColor: colors.card, borderColor: colors.border }]}>
                    {actions.map((action) => {
                        const Icon = ICONS[action.id];
                        const tint = action.danger ? colors.danger : colors.text;
                        return (
                            <TouchableOpacity
                                key={action.id}
                                onPress={() => { onActionFeedback(); action.onPress(); }}
                                disabled={busy}
                                activeOpacity={0.65}
                                style={styles.menuAction}
                                accessibilityRole="button"
                                accessibilityLabel={action.label}
                            >
                                <Text numberOfLines={1} style={[styles.menuLabel, { color: tint }]}>{action.label}</Text>
                                {busy && busyActionId === action.id
                                    ? <ActivityIndicator size="small" color={tint} />
                                    : <Icon size={scale(20)} color={tint} strokeWidth={2} />}
                            </TouchableOpacity>
                        );
                    })}
                </Reanimated.View>
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    actionBar: { position: 'absolute', left: 0, right: 0, top: 0, flexDirection: 'row', alignItems: 'center', paddingHorizontal: scale(6), borderBottomWidth: StyleSheet.hairlineWidth },
    barButton: { width: scale(42), height: scale(44), alignItems: 'center', justifyContent: 'center' },
    selectionCount: { fontSize: scale(18), fontWeight: '600' },
    barSpacer: { flex: 1 },
    reactionRow: { position: 'absolute', flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center', borderRadius: scale(24), borderWidth: StyleSheet.hairlineWidth, paddingHorizontal: scale(4), shadowColor: '#000', shadowOpacity: 0.14, shadowRadius: 8, shadowOffset: { width: 0, height: 3 }, elevation: 7 },
    reactionButton: { flex: 1, height: '100%', alignItems: 'center', justifyContent: 'center' },
    reactionEmoji: { fontSize: scale(24), lineHeight: scale(30) },
    menu: { position: 'absolute', borderRadius: scale(12), overflow: 'hidden', shadowColor: '#000', shadowOpacity: 0.18, shadowRadius: 12, shadowOffset: { width: 0, height: 5 }, elevation: 8, paddingVertical: scale(4) },
    menuAction: { height: scale(44), flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: scale(14), gap: scale(12) },
    menuLabel: { flex: 1, minWidth: 0, fontSize: scale(15), lineHeight: scale(20), fontWeight: '400' },
});
