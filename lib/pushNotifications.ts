import { router } from 'expo-router';
import Constants from 'expo-constants';
import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Linking, Platform } from 'react-native';
import { api } from '@/lib/api';

type NotificationsModule = typeof import('expo-notifications');

declare const require: (moduleName: string) => NotificationsModule;

const PUSH_TOKEN_KEY = 'tn_push_token';
const PUSH_ENABLED_KEY = 'tn_push_enabled';
const PUSH_BANNER_DATE_KEY = 'tn_push_banner_last_shown';

let notificationsModule: NotificationsModule | null | undefined;
let notificationHandlerConfigured = false;

function getNotifications() {
    if (Platform.OS === 'web') return null;
    if (Platform.OS === 'android' && Constants.appOwnership === 'expo') return null;
    if (notificationsModule !== undefined) return notificationsModule;

    try {
        notificationsModule = require('expo-notifications');
        if (!notificationsModule?.setNotificationHandler) {
            notificationsModule = null;
        }
    } catch (error) {
        console.warn('[push] expo-notifications unavailable:', error);
        notificationsModule = null;
    }

    if (notificationsModule && !notificationHandlerConfigured) {
        NotificationsSafe.setNotificationHandler({
            handleNotification: async () => ({
                shouldPlaySound: false,
                shouldSetBadge: false,
                shouldShowAlert: false,
                shouldShowBanner: false,
                shouldShowList: false,
            }),
        });
        notificationHandlerConfigured = true;
    }

    return notificationsModule;
}

const NotificationsSafe = {
    setNotificationHandler(handler: Parameters<NotificationsModule['setNotificationHandler']>[0]) {
        notificationsModule?.setNotificationHandler(handler);
    },
};

function getProjectId() {
    return (
        Constants.expoConfig?.extra?.eas?.projectId ||
        Constants.easConfig?.projectId ||
        null
    );
}

async function getPushToken(Notifications: NotificationsModule, projectId: string) {
    if (Platform.OS === 'android') {
        try {
            const nativeToken = await Notifications.getDevicePushTokenAsync();
            const token = nativeToken?.data ? String(nativeToken.data) : '';
            if (token) return token;
        } catch (error) {
            console.warn('[push] native Android token unavailable, falling back to Expo token', error);
        }
    }

    return (await Notifications.getExpoPushTokenAsync({ projectId })).data;
}

function notificationTarget(data: Record<string, unknown> | undefined) {
    const conversationId = data?.conversationId ? String(data.conversationId) : '';
    const kind = data?.kind ? String(data.kind) : '';

    if (conversationId && (kind.includes('chat') || kind.includes('request'))) {
        return `/conversation/${conversationId}` as const;
    }

    return '/(tabs)/messages' as const;
}

export async function registerForPushNotifications() {
    if (Platform.OS === 'web') return { success: false, message: 'push_not_supported' };
    const Notifications = getNotifications();
    if (!Notifications) return { success: false, message: 'push_not_available' };

    const appEnabled = await getPushPreference();
    if (!appEnabled) return { success: false, message: 'push_disabled' };

    if (Platform.OS === 'android') {
        await Notifications.setNotificationChannelAsync('messages', {
            name: 'Messages',
            importance: Notifications.AndroidImportance.HIGH,
            vibrationPattern: [0, 250, 250, 250],
            lightColor: '#F34B6F',
        });
        await Notifications.setNotificationChannelAsync('default', {
            name: 'Default',
            importance: Notifications.AndroidImportance.HIGH,
            vibrationPattern: [0, 250, 250, 250],
            lightColor: '#F34B6F',
        });
    }

    const projectId = getProjectId();
    if (!projectId) return { success: false, message: 'push_not_configured' };

    const existing = await Notifications.getPermissionsAsync();
    let finalStatus = existing.status;

    if (existing.status !== 'granted') {
        const requested = await Notifications.requestPermissionsAsync();
        finalStatus = requested.status;
    }

    if (finalStatus !== 'granted') {
        return { success: false, message: 'push_permission_denied' };
    }

    const token = await getPushToken(Notifications, projectId);
    const platform = Platform.OS === 'ios' ? 'ios' : 'android';
    const result = await api.post('/device-tokens', { token, platform });

    if (result.success) {
        await SecureStore.setItemAsync(PUSH_TOKEN_KEY, token);
    }

    return result;
}

export async function removeRegisteredPushToken() {
    const token = await SecureStore.getItemAsync(PUSH_TOKEN_KEY);
    if (!token) return;

    try {
        await api.deleteWithBody('/device-tokens', { token });
    } finally {
        await SecureStore.deleteItemAsync(PUSH_TOKEN_KEY);
    }
}

export async function getPushPreference() {
    const value = await AsyncStorage.getItem(PUSH_ENABLED_KEY);
    return value !== 'false';
}

export async function setPushPreference(enabled: boolean) {
    await AsyncStorage.setItem(PUSH_ENABLED_KEY, enabled ? 'true' : 'false');
}

export async function enablePushNotifications() {
    await setPushPreference(true);
    return registerForPushNotifications();
}

export async function disablePushNotifications() {
    await setPushPreference(false);
    await removeRegisteredPushToken();
    return { success: true, message: 'push_disabled' };
}

export async function getPushNotificationStatus() {
    const Notifications = getNotifications();
    if (Platform.OS === 'web' || !Notifications) {
        return {
            appEnabled: false,
            deviceGranted: false,
            canAskAgain: false,
            enabled: false,
            status: 'unsupported',
        };
    }

    const [appEnabled, permissions] = await Promise.all([
        getPushPreference(),
        Notifications.getPermissionsAsync(),
    ]);
    const deviceGranted = permissions.status === 'granted';

    return {
        appEnabled,
        deviceGranted,
        canAskAgain: permissions.canAskAgain,
        enabled: appEnabled && deviceGranted,
        status: permissions.status,
    };
}

export async function shouldShowPushBannerToday() {
    const status = await getPushNotificationStatus();
    if (status.enabled) return false;

    const today = new Date().toISOString().slice(0, 10);
    const lastShown = await AsyncStorage.getItem(PUSH_BANNER_DATE_KEY);
    return lastShown !== today;
}

export async function markPushBannerShownToday() {
    await AsyncStorage.setItem(PUSH_BANNER_DATE_KEY, new Date().toISOString().slice(0, 10));
}

export async function openPushNotificationSettings() {
    await Linking.openSettings();
}

export function addPushNotificationListeners(onForegroundMessage?: (message: string) => void) {
    const Notifications = getNotifications();
    if (!Notifications) return () => { };

    const receivedSubscription = Notifications.addNotificationReceivedListener((notification) => {
        const title = notification.request.content.title || '';
        const body = notification.request.content.body || '';
        const message = [title, body].filter(Boolean).join(': ');
        if (message) onForegroundMessage?.(message);
    });

    const responseSubscription = Notifications.addNotificationResponseReceivedListener((response) => {
        const data = response.notification.request.content.data as Record<string, unknown> | undefined;
        router.push(notificationTarget(data) as any);
    });

    Notifications.getLastNotificationResponseAsync().then((response) => {
        if (!response) return;
        const data = response.notification.request.content.data as Record<string, unknown> | undefined;
        router.push(notificationTarget(data) as any);
    }).catch(() => { });

    return () => {
        receivedSubscription.remove();
        responseSubscription.remove();
    };
}
