import React, { useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Menu, User } from 'lucide-react-native';
import { AppMenuDrawer } from '@/components/app/AppMenuDrawer';
import { Text } from '@/components/ui/Text';
import { useAuthStore } from '@/store/authStore';
import { useLanguage } from '@/hooks/useLanguage';
import { useTheme } from '@/hooks/useTheme';
import { scale } from '@/hooks/useResponsive';

function textValue(value: unknown, fallback: string) {
    return typeof value === 'string' && value.trim() ? value.trim() : fallback;
}

export function AppTopBar() {
    const { t, isRTL } = useLanguage();
    const { isDark } = useTheme();
    const user = useAuthStore((state) => state.user);
    const [menuOpen, setMenuOpen] = useState(false);

    const displayName = useMemo(() => {
        const profileName = user?.profile?.profileName;
        return textValue(profileName, textValue(user?.username, user?.email || 'toNikah'));
    }, [user?.email, user?.profile?.profileName, user?.username]);

    const iconColor = isDark ? '#CBD5E1' : '#475569';
    const borderColor = isDark ? '#334155' : '#E2E8F0';
    const surfaceColor = isDark ? '#111827' : '#FFFFFF';

    return (
        <>
            <SafeAreaView
                edges={['top']}
                style={[
                    styles.safeArea,
                    {
                        backgroundColor: surfaceColor,
                        borderBottomColor: borderColor,
                    },
                ]}
            >
                <View style={[styles.topBar, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
                    <Pressable
                        onPress={() => router.push('/(tabs)/search')}
                        style={[styles.brandBlock, { alignItems: isRTL ? 'flex-end' : 'flex-start' }]}
                    >
                        <Text variant="h3" style={styles.brand}>
                            toNikah
                        </Text>
                        <Text
                            variant="caption"
                            numberOfLines={1}
                            style={{ color: isDark ? '#94A3B8' : '#64748B', maxWidth: scale(220) }}
                        >
                            {displayName}
                        </Text>
                    </Pressable>

                    <View style={[styles.actions, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
                        <Pressable
                            accessibilityRole="button"
                            accessibilityLabel={textValue(t('my_profile'), 'My Profile')}
                            onPress={() => router.push('/(tabs)/profile')}
                            style={[styles.iconButton, { borderColor, backgroundColor: isDark ? '#1E293B' : '#F8FAFC' }]}
                        >
                            <User size={scale(19)} color={iconColor} />
                        </Pressable>
                        <Pressable
                            accessibilityRole="button"
                            accessibilityLabel={textValue(t('menu'), 'Menu')}
                            onPress={() => setMenuOpen(true)}
                            style={[styles.iconButton, { borderColor, backgroundColor: isDark ? '#1E293B' : '#F8FAFC' }]}
                        >
                            <Menu size={scale(20)} color={iconColor} />
                        </Pressable>
                    </View>
                </View>
            </SafeAreaView>

            <AppMenuDrawer visible={menuOpen} onClose={() => setMenuOpen(false)} />
        </>
    );
}

const styles = StyleSheet.create({
    safeArea: {
        borderBottomWidth: StyleSheet.hairlineWidth,
    },
    topBar: {
        minHeight: scale(48),
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: scale(14),
        paddingBottom: 0,
    },
    brandBlock: {
        flex: 1,
        minWidth: 0,
    },
    brand: {
        fontSize: scale(21),
        lineHeight: scale(24),
    },
    actions: {
        alignItems: 'center',
        gap: scale(10),
    },
    iconButton: {
        width: scale(38),
        height: scale(38),
        borderWidth: 1,
        borderRadius: scale(13),
        alignItems: 'center',
        justifyContent: 'center',
    },
});
