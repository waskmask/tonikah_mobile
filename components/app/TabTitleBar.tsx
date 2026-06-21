import React, { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Menu } from 'lucide-react-native';
import { AppMenuDrawer } from '@/components/app/AppMenuDrawer';
import { Text } from '@/components/ui/Text';
import { useLanguage } from '@/hooks/useLanguage';
import { useColors } from '@/hooks/useColors';
import { HeaderTokens } from '@/constants/uiTokens';
import { scale } from '@/hooks/useResponsive';

type TabTitleBarProps = {
    title: string;
    subtitle?: string;
    showMenu?: boolean;
};

/** Title bar for root tab screens (no back button). */
export function TabTitleBar({ title, subtitle, showMenu = false }: TabTitleBarProps) {
    const { isRTL, t } = useLanguage();
    const chrome = useColors().chrome.header;
    const [menuOpen, setMenuOpen] = useState(false);

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
                <View style={[styles.topBar, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
                    <View style={[styles.titleBlock, { alignItems: isRTL ? 'flex-end' : 'flex-start' }]}>
                        <Text
                            variant="body-sm"
                            numberOfLines={1}
                            className="font-body-bold"
                            style={[styles.title, { color: chrome.title, textAlign: isRTL ? 'right' : 'left' }]}
                        >
                            {title}
                        </Text>
                        {subtitle ? (
                            <Text
                                variant="caption"
                                numberOfLines={1}
                                style={{ color: chrome.subtitle, marginTop: scale(2), textAlign: isRTL ? 'right' : 'left' }}
                            >
                                {subtitle}
                            </Text>
                        ) : null}
                    </View>
                    {showMenu ? (
                        <Pressable
                            accessibilityRole="button"
                            accessibilityLabel={String(t('menu') || 'Menu')}
                            onPress={() => setMenuOpen(true)}
                            style={({ pressed }) => [
                                styles.iconButton,
                                { borderColor: chrome.border, backgroundColor: chrome.iconBackground },
                                pressed && styles.iconButtonPressed,
                            ]}
                        >
                            <Menu size={scale(20)} color={chrome.icon} strokeWidth={2.55} />
                        </Pressable>
                    ) : (
                        <View style={styles.iconSpacer} />
                    )}
                </View>
            </SafeAreaView>
            {showMenu ? (
                <AppMenuDrawer visible={menuOpen} onClose={() => setMenuOpen(false)} />
            ) : null}
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
    },
    titleBlock: {
        flex: 1,
        minWidth: 0,
        justifyContent: 'center',
        paddingRight: scale(10),
    },
    title: {
        width: '100%',
        fontSize: scale(17),
        lineHeight: scale(22),
    },
    iconButton: {
        width: scale(34),
        height: scale(34),
        borderRadius: scale(17),
        borderWidth: 1,
        alignItems: 'center',
        justifyContent: 'center',
    },
    iconButtonPressed: {
        opacity: 0.78,
        transform: [{ scale: 0.97 }],
    },
    iconSpacer: {
        width: scale(34),
        height: scale(34),
    },
});
