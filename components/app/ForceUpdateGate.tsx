import React, { useCallback, useEffect, useState } from 'react';
import { AppState, Linking, Modal, Platform, StatusBar, StyleSheet, View } from 'react-native';
import * as Application from 'expo-application';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowCircleUp } from 'phosphor-react-native';

import { Text } from '@/components/ui/Text';
import { GradientButton } from '@/components/ui/GradientButton';
import { useColors } from '@/hooks/useColors';
import { useLanguage } from '@/hooks/useLanguage';
import { scale } from '@/hooks/useResponsive';
import { useTheme } from '@/hooks/useTheme';
import {
    fetchMobileAppConfig,
    MobilePlatformConfig,
    requiredUpdateForBuild,
} from '@/lib/mobileAppConfig';

export function ForceUpdateGate() {
    const colors = useColors();
    const { isDark } = useTheme();
    const { t } = useLanguage();
    const [requiredUpdate, setRequiredUpdate] = useState<MobilePlatformConfig | null>(null);
    const [openingStore, setOpeningStore] = useState(false);
    const [storeError, setStoreError] = useState(false);

    const checkForUpdate = useCallback(async () => {
        if (Platform.OS !== 'ios' && Platform.OS !== 'android') return;

        const config = await fetchMobileAppConfig();
        // Fail open on transient API errors. If an update was already required,
        // retain the gate until a successful response explicitly clears it.
        if (!config) return;

        setRequiredUpdate(requiredUpdateForBuild(config, Application.nativeBuildVersion));
    }, []);

    useEffect(() => {
        void checkForUpdate();
        const subscription = AppState.addEventListener('change', (state) => {
            if (state === 'active') void checkForUpdate();
        });
        return () => subscription.remove();
    }, [checkForUpdate]);

    const openStore = async () => {
        if (!requiredUpdate?.storeUrl || openingStore) return;

        setOpeningStore(true);
        setStoreError(false);
        try {
            await Linking.openURL(requiredUpdate.storeUrl);
        } catch {
            setStoreError(true);
        } finally {
            setOpeningStore(false);
        }
    };

    return (
        <Modal
            visible={Boolean(requiredUpdate)}
            animationType="fade"
            presentationStyle="fullScreen"
            statusBarTranslucent={false}
            onRequestClose={() => undefined}
        >
            <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.brand.bg.primary }]}>
                <StatusBar
                    barStyle={isDark ? 'light-content' : 'dark-content'}
                    backgroundColor={colors.brand.bg.primary}
                />
                <View style={styles.content}>
                    <View style={[styles.iconSurface, { backgroundColor: colors.chrome.common.primaryTint }]}>
                        <ArrowCircleUp size={scale(42)} color={colors.chrome.primary} weight="duotone" />
                    </View>
                    <Text variant="h2" align="center" style={{ color: colors.brand.text.heading }}>
                        {t('update_required_title', 'Update required')}
                    </Text>
                    <Text variant="body" align="center" style={[styles.message, { color: colors.brand.text.muted }]}>
                        {t('update_required_message', 'Install the latest version of toNikah to continue.')}
                    </Text>
                    {storeError ? (
                        <Text variant="caption" align="center" style={{ color: colors.brand.accent.error }}>
                            {t('update_store_open_failed', 'Could not open the store. Please try again.')}
                        </Text>
                    ) : null}
                    <GradientButton
                        title={t('update_now', 'Update now')}
                        onPress={() => void openStore()}
                        loading={openingStore}
                        widthMode="full"
                        containerStyle={styles.button}
                    />
                </View>
            </SafeAreaView>
        </Modal>
    );
}

const styles = StyleSheet.create({
    safeArea: {
        flex: 1,
    },
    content: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: scale(28),
        gap: scale(14),
    },
    iconSurface: {
        width: scale(72),
        height: scale(72),
        borderRadius: scale(36),
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: scale(8),
    },
    message: {
        maxWidth: scale(320),
        marginBottom: scale(12),
    },
    button: {
        maxWidth: scale(360),
        marginTop: scale(8),
    },
});
