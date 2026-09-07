import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Menu } from 'lucide-react-native';
import { useAppMenu } from '@/components/app/AppMenuProvider';
import { Text } from '@/components/ui/Text';
import { useLanguage } from '@/hooks/useLanguage';
import { useColors } from '@/hooks/useColors';
import { HeaderTokens, NavigationTypeTokens } from '@/constants/uiTokens';
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
    const { openMenu } = useAppMenu();

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
                    {/* Text is content-sized inside rows: the row's main axis mirrors
                        under native RTL, so no textAlign is needed (Android flips
                        literal textAlign values in RTL, iOS doesn't) */}
                    <View style={styles.titleBlock}>
                        <View style={styles.titleRow}>
                            <Text
                                variant="body-sm"
                                numberOfLines={1}
                                className="font-body-bold"
                                style={[styles.title, { color: chrome.title }]}
                            >
                                {title}
                            </Text>
                        </View>
                        {subtitle ? (
                            <View style={styles.titleRow}>
                                <Text
                                    variant="caption"
                                    numberOfLines={1}
                                    style={{ color: chrome.subtitle, marginTop: scale(2), flexShrink: 1 }}
                                >
                                    {subtitle}
                                </Text>
                            </View>
                        ) : null}
                    </View>
                    {showMenu ? (
                        <Pressable
                            accessibilityRole="button"
                            accessibilityLabel={String(t('menu') || 'Menu')}
                            onPress={openMenu}
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
        paddingEnd: scale(10),
    },
    titleRow: {
        flexDirection: 'row',
    },
    title: {
        flexShrink: 1,
        ...NavigationTypeTokens.topBarTitle,
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
