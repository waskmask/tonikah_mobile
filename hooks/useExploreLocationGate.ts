import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import * as Location from 'expo-location';
import { profileService } from '@/lib/profileService';
import { useAuthStore } from '@/store/authStore';

export type ExploreLocationState =
    | 'checking'
    | 'ready'
    | 'permission_denied'
    | 'services_disabled'
    | 'location_unavailable'
    | 'network_error';

const LOCATION_TIMEOUT_MS = 12000;

async function withTimeout<T>(promise: Promise<T>): Promise<T> {
    let timeoutId: ReturnType<typeof setTimeout> | undefined;
    const timeout = new Promise<never>((_, reject) => {
        timeoutId = setTimeout(() => reject(new Error('location_timeout')), LOCATION_TIMEOUT_MS);
    });

    try {
        return await Promise.race([promise, timeout]);
    } finally {
        if (timeoutId) clearTimeout(timeoutId);
    }
}

async function getFreshPosition(): Promise<Location.LocationObject | null> {
    const requestedAt = Date.now();
    let subscription: Location.LocationSubscription | undefined;
    let timeoutId: ReturnType<typeof setTimeout> | undefined;
    let pollId: ReturnType<typeof setInterval> | undefined;
    let pollInFlight = false;
    let settled = false;

    return new Promise((resolve) => {
        const finish = (position: Location.LocationObject | null) => {
            if (settled) return;
            settled = true;
            if (timeoutId) clearTimeout(timeoutId);
            if (pollId) clearInterval(pollId);
            subscription?.remove();
            resolve(position);
        };

        const acceptIfFresh = (position: Location.LocationObject | null) => {
            if (!position || position.timestamp + 1000 < requestedAt) return;
            finish(position);
        };

        const pollFreshLastKnown = async () => {
            if (settled || pollInFlight) return;
            pollInFlight = true;
            try {
                const position = await Location.getLastKnownPositionAsync({
                    maxAge: 15 * 1000,
                    requiredAccuracy: 5000,
                });
                acceptIfFresh(position);
            } catch {
                // The active watcher can still deliver a fresh position.
            } finally {
                pollInFlight = false;
            }
        };

        timeoutId = setTimeout(() => finish(null), LOCATION_TIMEOUT_MS);
        pollId = setInterval(() => void pollFreshLastKnown(), 500);
        void pollFreshLastKnown();

        void Location.watchPositionAsync(
            {
                accuracy: Location.Accuracy.High,
                timeInterval: 1000,
                distanceInterval: 0,
            },
            acceptIfFresh,
            () => finish(null),
        )
            .then((nextSubscription) => {
                subscription = nextSubscription;
                if (settled) nextSubscription.remove();
            })
            .catch(() => finish(null));
    });
}

async function resolvePosition({ forceFresh }: { forceFresh: boolean }) {
    if (forceFresh) return getFreshPosition();

    const lastKnown = await Location.getLastKnownPositionAsync({
        maxAge: 15 * 60 * 1000,
        requiredAccuracy: 5000,
    });
    if (lastKnown) return lastKnown;

    try {
        return await withTimeout(
            Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }),
        );
    } catch {
        return null;
    }
}

/**
 * Explore is location-dependent, but the rest of the app is not. This keeps
 * the requirement scoped to Explore and never asks for background permission.
 */
export function useExploreLocationGate() {
    const refreshUser = useAuthStore((state) => state.refreshUser);
    const [state, setState] = useState<ExploreLocationState>('checking');
    const [retrying, setRetrying] = useState(false);
    const stateRef = useRef<ExploreLocationState>('checking');
    const inFlightRef = useRef(false);
    const mountedRef = useRef(true);

    const updateState = useCallback((nextState: ExploreLocationState) => {
        stateRef.current = nextState;
        if (mountedRef.current) setState(nextState);
    }, []);

    const checkLocation = useCallback(async ({ forceFresh = false }: { forceFresh?: boolean } = {}) => {
        if (inFlightRef.current) return;
        inFlightRef.current = true;
        if (stateRef.current === 'checking') {
            updateState('checking');
        } else if (mountedRef.current) {
            setRetrying(true);
        }

        let position: Awaited<ReturnType<typeof resolvePosition>>;
        try {
            const servicesEnabled = await Location.hasServicesEnabledAsync();
            if (!servicesEnabled) {
                updateState('services_disabled');
                inFlightRef.current = false;
                if (mountedRef.current) setRetrying(false);
                return;
            }

            let permission = await Location.getForegroundPermissionsAsync();
            if (permission.status !== Location.PermissionStatus.GRANTED && permission.canAskAgain) {
                permission = await Location.requestForegroundPermissionsAsync();
            }
            if (permission.status !== Location.PermissionStatus.GRANTED) {
                updateState('permission_denied');
                inFlightRef.current = false;
                if (mountedRef.current) setRetrying(false);
                return;
            }

            position = await resolvePosition({ forceFresh });
            if (!position) {
                updateState('location_unavailable');
                inFlightRef.current = false;
                if (mountedRef.current) setRetrying(false);
                return;
            }
        } catch {
            updateState('location_unavailable');
            inFlightRef.current = false;
            if (mountedRef.current) setRetrying(false);
            return;
        }

        try {
            const reverse = await profileService.fetchPlaceReverse(
                position.coords.latitude,
                position.coords.longitude,
                'en',
            );
            const place = reverse.data as Record<string, any> | undefined;
            const lat = Number(place?.lat);
            const lng = Number(place?.lng);
            if (
                !reverse.success ||
                !place?.place_id ||
                !place?.city ||
                !String(place?.countryCode || '').match(/^[A-Z]{2}$/i) ||
                !Number.isFinite(lat) ||
                !Number.isFinite(lng)
            ) {
                updateState('network_error');
                return;
            }

            const currentLocation = useAuthStore.getState().user?.profile?.current_location;
            if (currentLocation?.place_id !== place.place_id) {
                const update = await profileService.updateProfile({
                    current_location: {
                        place_id: place.place_id,
                        city: place.city,
                        ...(place.state ? { state: place.state } : {}),
                        country: String(place.countryCode).toUpperCase(),
                        geo: { type: 'Point', coordinates: [lng, lat] },
                    },
                });
                if (!update.success) {
                    updateState('network_error');
                    return;
                }

                await refreshUser();
            }

            updateState('ready');
        } catch {
            updateState('network_error');
        } finally {
            inFlightRef.current = false;
            if (mountedRef.current) setRetrying(false);
        }
    }, [refreshUser, updateState]);

    const retry = useCallback(
        () => checkLocation({ forceFresh: true }),
        [checkLocation],
    );

    useEffect(() => {
        mountedRef.current = true;
        void checkLocation();

        const subscription = AppState.addEventListener('change', (nextState: AppStateStatus) => {
            if (nextState === 'active' && stateRef.current !== 'ready') {
                void checkLocation({ forceFresh: true });
            }
        });

        return () => {
            mountedRef.current = false;
            subscription.remove();
        };
    }, [checkLocation]);

    return { state, retry, retrying };
}
