import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, AppState, Pressable, StyleSheet, View } from 'react-native';
import { Bookmark, Compass, History, Send, User } from 'lucide-react-native';
import type { LucideIcon } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Text } from '@/components/ui/Text';
import { useLanguage } from '@/hooks/useLanguage';
import { useColors } from '@/hooks/useColors';
import { scale } from '@/hooks/useResponsive';
import { chatService } from '@/lib/chatService';
import { Typography } from '@/constants/typography';
import { useHaptics } from '@/hooks/useHaptics';
import { useChatSocket } from '@/hooks/useChatSocket';

const ACTIVE_STROKE = 2;
const INACTIVE_STROKE = 1.8;

type TabRoute = {
    name: string;
    labelKey: string;
    fallback: string;
    Icon: LucideIcon;
};

const TAB_ROUTES: TabRoute[] = [
    { name: 'search', labelKey: 'explore', fallback: 'Explore', Icon: Compass },
    { name: 'messages', labelKey: 'messages', fallback: 'Messages', Icon: Send },
    { name: 'favourited', labelKey: 'favourited', fallback: 'Saved', Icon: Bookmark },
    { name: 'activities', labelKey: 'activities', fallback: 'Activity', Icon: History },
    { name: 'profile', labelKey: 'profile', fallback: 'Me', Icon: User },
];

const VISIBLE_ROUTE_NAMES = new Set(TAB_ROUTES.map((item) => item.name));

function safeLabel(value: unknown, fallback: string) {
    return typeof value === 'string' && value.trim() ? value.trim() : fallback;
}

function unreadFromResponse(value: any) {
    return Number(value?.unreadCount ?? value?.count ?? value?.data?.unreadCount ?? value?.data?.count ?? 0) || 0;
}

export function BottomTabBar({ state, descriptors, navigation }: any) {
    const colors = useColors();
    const tabChrome = colors.chrome.tabBar;
    const { currentLanguage, t, isRTL } = useLanguage();
    const insets = useSafeAreaInsets();
    const { lightImpact } = useHaptics();
    const [pendingRoute, setPendingRoute] = useState<string | null>(null);
    const [unreadCount, setUnreadCount] = useState(0);
    const activeRouteName = state.routes[state.index]?.name;

    useEffect(() => {
        setPendingRoute(null);
    }, [activeRouteName]);

    const refreshUnreadCount = useCallback(async () => {
        try {
            const res = await chatService.unreadCount();
            setUnreadCount(unreadFromResponse(res));
        } catch {
            // Keep the existing badge value if the refresh fails.
        }
    }, []);

    useEffect(() => {
        let active = true;
        chatService.unreadCount()
            .then((res) => {
                if (active) setUnreadCount(unreadFromResponse(res));
            })
            .catch(() => undefined);
        return () => {
            active = false;
        };
    }, []);

    useEffect(() => {
        const subscription = AppState.addEventListener('change', (stateValue) => {
            if (stateValue === 'active') {
                refreshUnreadCount();
            }
        });
        return () => subscription.remove();
    }, [refreshUnreadCount]);

    // Re-sync whenever the active tab changes (e.g. returning from a conversation
    // after reading it) so the badge reflects the latest server state.
    useEffect(() => {
        refreshUnreadCount();
    }, [activeRouteName, refreshUnreadCount]);

    // Stable handlers: useChatSocket lists its callbacks as effect deps, so inline
    // arrows would tear down and reconnect the socket every render and miss the
    // `chat:unread` events that drive this badge.
    const handleUnread = useCallback((payload: any) => {
        setUnreadCount(unreadFromResponse(payload));
    }, []);
    const handleUnreadRefresh = useCallback(() => {
        refreshUnreadCount();
    }, [refreshUnreadCount]);

    useChatSocket({
        enabled: true,
        onUnread: handleUnread,
        onMessage: handleUnreadRefresh,
        onConversationChanged: handleUnreadRefresh,
    });

    const visibleRoutes = useMemo(
        () => TAB_ROUTES.map((item) => {
            const route = state.routes.find((candidate: any) => candidate.name === item.name);
            return route ? { ...item, route } : null;
        }).filter(Boolean) as Array<TabRoute & { route: any }>,
        [state.routes],
    );

    if (!VISIBLE_ROUTE_NAMES.has(activeRouteName)) return null;

    return (
        <View
            style={[
                styles.container,
                {
                    paddingBottom: Math.max(insets.bottom, scale(8)),
                    backgroundColor: tabChrome.background,
                    borderTopColor: tabChrome.border,
                    shadowColor: colors.chrome.common.shadow,
                },
            ]}
        >
            <View style={[styles.inner, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
                {visibleRoutes.map((item) => {
                    const options = descriptors[item.route.key]?.options || {};
                    const isFocused = activeRouteName === item.name;
                    const pending = pendingRoute === item.name;
                    const isActive = isFocused || pending;
                    const label = safeLabel(t(item.labelKey), item.fallback);
                    const color = isActive ? tabChrome.active : tabChrome.inactive;
                    const badge = item.name === 'messages' ? unreadCount : 0;
                    const labelFontFamily = currentLanguage === 'ar'
                        ? (isActive ? Typography.font.arabic.bold : Typography.font.arabic.semi)
                        : (isActive ? Typography.font.body.semi : Typography.font.body.medium);
                    const fill = isFocused && item.name === 'favourited' ? color : 'transparent';

                    function onPress() {
                        const event = navigation.emit({
                            type: 'tabPress',
                            target: item.route.key,
                            canPreventDefault: true,
                        });

                        if (isFocused || event.defaultPrevented) return;
                        lightImpact();
                        setPendingRoute(item.name);
                        navigation.navigate(item.route.name, item.route.params);
                    }

                    return (
                        <Pressable
                            key={item.name}
                            accessibilityRole="button"
                            accessibilityState={isFocused ? { selected: true } : undefined}
                            accessibilityLabel={options.tabBarAccessibilityLabel || label}
                            onPress={onPress}
                            style={({ pressed }) => [
                                styles.item,
                                pressed && styles.itemPressed,
                            ]}
                        >
                            <View style={styles.iconSlot}>
                                <View style={styles.iconWrap}>
                                    {pending ? (
                                        <ActivityIndicator size="small" color={color} />
                                    ) : (
                                        <item.Icon
                                            size={scale(20)}
                                            color={color}
                                            strokeWidth={isActive ? ACTIVE_STROKE : INACTIVE_STROKE}
                                            fill={fill}
                                        />
                                    )}
                                    {badge > 0 ? (
                                        <View
                                            style={[
                                                styles.tabDot,
                                                {
                                                    backgroundColor: colors.chrome.badge.background,
                                                    borderColor: tabChrome.background,
                                                },
                                            ]}
                                        />
                                    ) : null}
                                </View>
                            </View>
                            <View style={styles.labelWrap}>
                                <Text
                                    variant="caption"
                                    numberOfLines={1}
                                    ellipsizeMode="tail"
                                    style={[
                                        styles.label,
                                        {
                                            color,
                                            fontSize: scale(8),
                                            lineHeight: scale(12),
                                            fontFamily: labelFontFamily,
                                        },
                                    ]}
                                >
                                    {label}
                                </Text>
                            </View>
                        </Pressable>
                    );
                })}
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        borderTopWidth: StyleSheet.hairlineWidth,
        paddingTop: 5,
        paddingHorizontal: scale(16),
        shadowOpacity: 0.06,
        shadowRadius: scale(16),
        shadowOffset: { width: 0, height: -3 },
        elevation: 10,
    },
    inner: {
        width: '100%',
        maxWidth: 640,
        alignSelf: 'center',
        flexDirection: 'row',
        alignItems: 'flex-end',
        justifyContent: 'space-between',
    },
    item: {
        flex: 1,
        flexBasis: 0,
        minWidth: 0,
        minHeight: scale(52),
        alignItems: 'center',
        justifyContent: 'center',
        gap: scale(5) + 2,
        paddingHorizontal: 0,
    },
    itemPressed: {
        opacity: 0.82,
        transform: [{ scale: 0.96 }],
    },
    iconSlot: {
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: scale(28),
        width: '100%',
        maxWidth: scale(62),
    },
    iconWrap: {
        alignItems: 'center',
        justifyContent: 'center',
        minWidth: scale(28),
        minHeight: scale(28),
        maxWidth: scale(62),
    },
    tabDot: {
        position: 'absolute',
        top: -scale(2),
        right: -scale(4),
        width: scale(9),
        height: scale(9),
        borderRadius: scale(5),
        borderWidth: scale(1.5),
    },
    labelWrap: {
        width: '100%',
        minWidth: 0,
        maxWidth: scale(62),
        paddingHorizontal: 0,
    },
    label: {
        width: '100%',
        textAlign: 'center',
        includeFontPadding: false,
    },
});
