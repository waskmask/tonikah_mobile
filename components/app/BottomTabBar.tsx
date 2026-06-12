import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import { Bookmark, Compass, History, Send, User } from 'lucide-react-native';
import type { LucideIcon } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Text } from '@/components/ui/Text';
import { useLanguage } from '@/hooks/useLanguage';
import { useTheme } from '@/hooks/useTheme';
import { scale } from '@/hooks/useResponsive';
import { chatService } from '@/lib/chatService';
import { Typography } from '@/constants/typography';

const BRAND_PINK = '#F34B6F';

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
    { name: 'activities', labelKey: 'activities', fallback: 'Activities', Icon: History },
    { name: 'profile', labelKey: 'my_profile', fallback: 'Profile', Icon: User },
];

const VISIBLE_ROUTE_NAMES = new Set(TAB_ROUTES.map((item) => item.name));

export function BottomTabBar({ state, descriptors, navigation }: any) {
    const { isDark } = useTheme();
    const { currentLanguage, t, isRTL } = useLanguage();
    const insets = useSafeAreaInsets();
    const [pendingRoute, setPendingRoute] = useState<string | null>(null);
    const [unreadCount, setUnreadCount] = useState(0);
    const activeRouteName = state.routes[state.index]?.name;

    useEffect(() => {
        setPendingRoute(null);
    }, [activeRouteName]);

    useEffect(() => {
        let mounted = true;
        chatService.unreadCount()
            .then((res) => {
                if (!mounted) return;
                setUnreadCount(Number(res.unreadCount ?? res.count ?? 0) || 0);
            })
            .catch(() => undefined);
        return () => {
            mounted = false;
        };
    }, []);

    const visibleRoutes = useMemo(
        () => TAB_ROUTES.map((item) => {
            const route = state.routes.find((candidate: any) => candidate.name === item.name);
            return route ? { ...item, route } : null;
        }).filter(Boolean) as Array<TabRoute & { route: any }>,
        [state.routes],
    );

    if (!VISIBLE_ROUTE_NAMES.has(activeRouteName)) return null;

    const borderColor = isDark ? '#334155' : '#E2E8F0';
    const backgroundColor = isDark ? 'rgba(17, 24, 39, 0.98)' : 'rgba(255, 255, 255, 0.98)';

    return (
        <View
            style={[
                styles.container,
                {
                    paddingBottom: Math.max(insets.bottom, scale(6)),
                    backgroundColor,
                    borderTopColor: borderColor,
                },
            ]}
        >
            <View style={[styles.inner, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
                {visibleRoutes.map((item) => {
                    const options = descriptors[item.route.key]?.options || {};
                    const isFocused = activeRouteName === item.name;
                    const pending = pendingRoute === item.name;
                    const label = safeLabel(t(item.labelKey), item.fallback);
                    const color = isFocused || pending ? BRAND_PINK : isDark ? '#94A3B8' : '#25322B';
                    const fontSize = label.length > 13 ? 9 : 10.5;
                    const badge = item.name === 'messages' ? unreadCount : 0;
                    const labelFontFamily = currentLanguage === 'ar' ? Typography.font.arabic.bold : Typography.font.body.semi;
                    const fill = isFocused && item.name === 'favourited' ? color : 'transparent';

                    function onPress() {
                        const event = navigation.emit({
                            type: 'tabPress',
                            target: item.route.key,
                            canPreventDefault: true,
                        });

                        if (isFocused || event.defaultPrevented) return;
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
                            <View style={styles.iconWrap}>
                                {pending ? (
                                    <ActivityIndicator size="small" color={color} />
                                ) : (
                                    <item.Icon
                                        size={scale(22)}
                                        color={color}
                                        strokeWidth={isFocused ? 2.7 : 2.1}
                                        fill={fill}
                                    />
                                )}
                                {badge > 0 ? <View style={[styles.badge, { borderColor: backgroundColor }]} /> : null}
                            </View>
                            <Text
                                variant="caption"
                                numberOfLines={1}
                                ellipsizeMode="tail"
                                style={[
                                    styles.label,
                                    {
                                        color,
                                        fontSize,
                                        fontFamily: labelFontFamily,
                                        lineHeight: 13,
                                    },
                                ]}
                            >
                                {label}
                            </Text>
                        </Pressable>
                    );
                })}
            </View>
        </View>
    );
}

function safeLabel(value: unknown, fallback: string) {
    return typeof value === 'string' && value.trim() ? value.trim() : fallback;
}

const styles = StyleSheet.create({
    container: {
        borderTopWidth: 1,
        paddingTop: scale(7),
        paddingHorizontal: scale(14),
        shadowColor: '#0F172A',
        shadowOpacity: 0.08,
        shadowRadius: scale(18),
        shadowOffset: { width: 0, height: -4 },
        elevation: 12,
    },
    inner: {
        width: '100%',
        maxWidth: 640,
        alignSelf: 'center',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    item: {
        width: scale(58),
        minHeight: scale(54),
        alignItems: 'center',
        justifyContent: 'center',
        gap: scale(3),
        paddingHorizontal: 0,
    },
    itemPressed: {
        opacity: 0.72,
    },
    iconWrap: {
        width: scale(58),
        height: scale(25),
        alignItems: 'center',
        justifyContent: 'center',
    },
    badge: {
        position: 'absolute',
        top: scale(1),
        right: scale(1),
        width: scale(9),
        height: scale(9),
        borderRadius: scale(5),
        backgroundColor: BRAND_PINK,
        borderWidth: 2,
    },
    label: {
        width: scale(58),
        maxWidth: scale(58),
        textAlign: 'center',
        includeFontPadding: false,
    },
});
