import { useEffect, useRef } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';
import { profileService } from '@/lib/profileService';
import { useAuthStore } from '@/store/authStore';

type PlaceDetails = {
    place_id?: string;
    city?: string;
    state?: string;
    countryCode?: string;
    lat?: number;
    lng?: number;
};

const REFRESH_INTERVAL_MS = 12 * 60 * 60 * 1000;
const LOCATION_TIMEOUT_MS = 12000;

function lastRefreshKey(userId: string) {
    return `tn_location_refresh_at:${userId}`;
}

function hasCompletedProfileLocation(profile: Record<string, any> | undefined) {
    return Boolean(
        profile &&
        profile.newProfile !== true &&
        profile.current_location?.city &&
        profile.current_location?.country &&
        profile.current_location?.place_id,
    );
}

function hasResolvedLocation(details: PlaceDetails | undefined) {
    if (!details) return false;
    const lat = Number(details.lat);
    const lng = Number(details.lng);

    return Boolean(
        details.place_id &&
        details.city?.trim() &&
        details.countryCode?.trim().match(/^[A-Z]{2}$/i) &&
        Number.isFinite(lat) &&
        Number.isFinite(lng),
    );
}

async function withLocationTimeout<T>(promise: Promise<T>, timeoutMs = LOCATION_TIMEOUT_MS): Promise<T> {
    let timeoutId: ReturnType<typeof setTimeout> | undefined;
    const timeout = new Promise<never>((_, reject) => {
        timeoutId = setTimeout(() => reject(new Error('location_timeout')), timeoutMs);
    });

    try {
        return await Promise.race([promise, timeout]);
    } finally {
        if (timeoutId) clearTimeout(timeoutId);
    }
}

async function getDeviceLocation() {
    try {
        return await withLocationTimeout(
            Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }),
        );
    } catch {
        return Location.getLastKnownPositionAsync({
            maxAge: 5 * 60 * 1000,
            requiredAccuracy: 5000,
        });
    }
}

export function usePeriodicLocationRefresh() {
    const user = useAuthStore((state) => state.user);
    const refreshUser = useAuthStore((state) => state.refreshUser);
    const inFlightRef = useRef(false);

    useEffect(() => {
        let mounted = true;

        const refreshLocation = async () => {
            if (!mounted || inFlightRef.current || !user?._id) return;
            if (!hasCompletedProfileLocation(user.profile)) return;

            inFlightRef.current = true;
            try {
                const key = lastRefreshKey(user._id);
                const lastRefresh = Number(await AsyncStorage.getItem(key));
                if (Number.isFinite(lastRefresh) && Date.now() - lastRefresh < REFRESH_INTERVAL_MS) {
                    return;
                }

                const permission = await Location.getForegroundPermissionsAsync();
                if (permission.status !== Location.PermissionStatus.GRANTED) return;

                const position = await getDeviceLocation();
                if (!position) return;

                const lat = position.coords.latitude;
                const lng = position.coords.longitude;
                const reverse = await profileService.fetchPlaceReverse(lat, lng, 'en');
                if (!reverse.success || !hasResolvedLocation(reverse.data)) return;

                const details = reverse.data as PlaceDetails;
                const payload = {
                    current_location: {
                        place_id: details.place_id,
                        city: details.city,
                        ...(details.state ? { state: details.state } : {}),
                        country: details.countryCode?.toUpperCase(),
                        geo: {
                            type: 'Point',
                            coordinates: [Number(details.lng), Number(details.lat)],
                        },
                    },
                };

                const update = await profileService.updateProfile(payload);
                if (update.success) {
                    await AsyncStorage.setItem(key, String(Date.now()));
                    await refreshUser();
                }
            } catch {
                // Silent background refresh: never block the app for location maintenance.
            } finally {
                inFlightRef.current = false;
            }
        };

        const handleAppStateChange = (nextState: AppStateStatus) => {
            if (nextState === 'active') {
                void refreshLocation();
            }
        };

        void refreshLocation();
        const subscription = AppState.addEventListener('change', handleAppStateChange);

        return () => {
            mounted = false;
            subscription.remove();
        };
    }, [refreshUser, user?._id, user?.profile]);
}
