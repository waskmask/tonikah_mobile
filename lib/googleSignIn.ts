import { Config } from '@/constants/config';
import { Platform, TurboModuleRegistry } from 'react-native';

// Check whether the native Google Sign-In binary is linked.
// Use the non-throwing `.get()` so we never crash at import time.
const isNativeModuleAvailable = Platform.OS !== 'web'
    && Boolean(TurboModuleRegistry?.get?.('RNGoogleSignin'));

if (!isNativeModuleAvailable) {
    console.warn(
        '[GoogleSignIn] Native module "RNGoogleSignin" not found. ' +
        'Google Sign-In is disabled. Build a Dev Client to enable it.'
    );
}

// Only require the JS wrapper when the native module actually exists.
function getGoogleSignin() {
    if (!isNativeModuleAvailable) {
        throw new Error('Google Sign-In native module is not available');
    }
    const { GoogleSignin } = require('@react-native-google-signin/google-signin');
    return GoogleSignin;
}

function getStatusCodes() {
    const { statusCodes } = require('@react-native-google-signin/google-signin');
    return statusCodes;
}

// Configure ONCE on app startup (call in root _layout.tsx)
export function configureGoogleSignIn() {
    if (!isNativeModuleAvailable) return;

    try {
        const GoogleSignin = getGoogleSignin();
        GoogleSignin.configure({
            webClientId: Config.GOOGLE_WEB_CLIENT_ID,     // REQUIRED for both platforms
            iosClientId: Config.GOOGLE_IOS_CLIENT_ID,      // Required for iOS
            offlineAccess: false,                           // we only need idToken
            scopes: ['email', 'profile'],
        });
    } catch (error) {
        console.warn('[GoogleSignIn] Configuration failed:', error);
    }
}

export interface GoogleSignInResult {
    success: boolean;
    idToken?: string;
    error?: string;
    cancelled?: boolean;
}

export async function signInWithGoogle(): Promise<GoogleSignInResult> {
    if (!isNativeModuleAvailable) {
        return { success: false, error: 'google_signin_not_available' };
    }

    try {
        const GoogleSignin = getGoogleSignin();
        const statusCodes = getStatusCodes();

        await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });

        // Sign out first to always show account picker
        try { await GoogleSignin.signOut(); } catch { }

        const response = await GoogleSignin.signIn();

        // Extract idToken — the shape depends on library version
        const idToken = (response as any).data?.idToken || (response as any).idToken;

        if (!idToken) {
            return { success: false, error: 'no_id_token' };
        }

        return { success: true, idToken };
    } catch (error: any) {
        const statusCodes = getStatusCodes();

        if (error.code === statusCodes.SIGN_IN_CANCELLED) {
            return { success: false, cancelled: true };
        }
        if (error.code === statusCodes.IN_PROGRESS) {
            return { success: false, error: 'sign_in_in_progress' };
        }
        if (error.code === statusCodes.PLAY_SERVICES_NOT_AVAILABLE) {
            return { success: false, error: 'play_services_unavailable' };
        }
        return { success: false, error: error.message || 'google_signin_failed' };
    }
}
