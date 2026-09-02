import React, { useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Menu, User } from 'lucide-react-native';
import { AppMenuDrawer } from '@/components/app/AppMenuDrawer';
import { Text } from '@/components/ui/Text';
import { useAuthStore } from '@/store/authStore';
import { useLanguage } from '@/hooks/useLanguage';
import { useColors } from '@/hooks/useColors';
import { HeaderTokens } from '@/constants/uiTokens';
import { scale } from '@/hooks/useResponsive';

function textValue(value: unknown, fallback: string) {
    return typeof value === 'string' && value.trim() ? value.trim() : fallback;
}

export function AppTopBar() {
    const { t, isRTL } = useLanguage();
    const colors = useColors();
    const chrome = colors.chrome.header;
    const user = useAuthStore((state) => state.user);
    const [menuOpen, setMenuOpen] = useState(false);

    const displayName = useMemo(() => {
        const profileName = user?.profile?.profileName;
        return textValue(profileName, textValue(user?.username, user?.email || 'toNikah'));
    }, [user?.email, user?.profile?.profileName, user?.username]);

    return (
        <>
            <SafeAreaView
                edges={['top']}
                style={[
                    styles.safeArea,
                    {
                        backgroundColor: chrome.background,
                        borderBottomColor: chrome.border,
                    },
                ]}
            >
                <View style={[styles.topBar, { flexDirection: 'row' }]}>
                    <Pressable
                        onPress={() => router.push('/(tabs)/search')}
                        style={[styles.brandBlock, { alignItems: 'flex-start' }]}
                    >
                        <Text variant="h3" style={[styles.brand, { color: chrome.title }]}>
                            toNikah
                        </Text>
                        <Text
                            variant="caption"
                            numberOfLines={1}
                            style={{ color: chrome.subtitle, maxWidth: scale(220) }}
                        >
                            {displayName}
                        </Text>
                    </Pressable>

                    <View style={[styles.actions, { flexDirection: 'row' }]}>
                        <Pressable
                            accessibilityRole="button"
                            accessibilityLabel={textValue(t('my_profile'), 'My Profile')}
                            onPress={() => router.push('/(tabs)/profile')}
                            style={[styles.iconButton, { borderColor: chrome.border, backgroundColor: chrome.iconBackground }]}
                        >
                            <User size={19} color={chrome.icon} />
                        </Pressable>
                        <Pressable
                            accessibilityRole="button"
                            accessibilityLabel={textValue(t('menu'), 'Menu')}
                            onPress={() => setMenuOpen(true)}
                            style={[styles.iconButton, { borderColor: chrome.border, backgroundColor: chrome.iconBackground }]}
                        >
                            <Menu size={20} color={chrome.icon} />
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
        minHeight: HeaderTokens.minHeight,
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: HeaderTokens.paddingHorizontal,
        paddingBottom: 0,
    },
    brandBlock: {
        flex: 1,
        minWidth: 0,
    },
    brand: {
        fontSize: HeaderTokens.brandFontSize,
        lineHeight: HeaderTokens.brandLineHeight,
    },
    actions: {
        alignItems: 'center',
        gap: HeaderTokens.actionGap,
    },
    iconButton: {
        width: HeaderTokens.iconButtonSize,
        height: HeaderTokens.iconButtonSize,
        borderWidth: 1,
        borderRadius: HeaderTokens.iconButtonRadius,
        alignItems: 'center',
        justifyContent: 'center',
    },
});
