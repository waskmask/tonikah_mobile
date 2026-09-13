import React, { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Linking, Platform, Pressable, StyleSheet, View } from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Location from 'expo-location';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Text } from '@/components/ui/Text';
import { GradientButton } from '@/components/ui/GradientButton';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { ProfileSetupHeader } from '@/components/ui/ProfileSetupHeader';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorText } from '@/components/ui/FormField';
import { useTheme } from '@/hooks/useTheme';
import { scale } from '@/hooks/useResponsive';
import { ProfileSetupTokens } from '@/constants/uiTokens';
import { profileService } from '@/lib/profileService';
import { useProfileSetupStore } from '@/store/profileSetupStore';
import { useAuthStore } from '@/store/authStore';
import { toast } from '@/hooks/useToast';
import { LocateFixed, MapPinOff } from 'lucide-react-native';

type LocationRecovery =
    | 'permission_denied'
    | 'services_disabled'
    | 'location_unavailable'
    | 'network_error'
    | 'service_unavailable'
    | 'resolve_failed';

type PlaceDetails = {
    place_id?: string;
    city?: string;
    state?: string;
    country?: string;
    countryCode?: string;
    lat?: number;
    lng?: number;
};

function normalizeLanguage(language: string) {
    return language.split('-')[0]?.trim() || 'en';
}

function formatCountryForLocale(
    countryCode: string,
    fallback: string,
    locale: string,
    t: (key: string, options?: Record<string, unknown>) => string,
) {
    const normalizedCode = countryCode.trim().toUpperCase();
    const countryKey = /^[A-Z]{2}$/.test(normalizedCode) ? `countries:c_${normalizedCode.toLowerCase()}` : '';

    if (countryKey) {
        const translated = t(countryKey, { defaultValue: '' });
        if (translated && translated !== countryKey) return translated;
    }

    if (/^[A-Z]{2}$/.test(normalizedCode)) {
        try {
            const displayNames = new (Intl as any).DisplayNames([locale], { type: 'region' });
            return displayNames.of(normalizedCode) || fallback || normalizedCode;
        } catch {
            return fallback || normalizedCode;
        }
    }

    return fallback || countryCode;
}

function buildLocationLabel(city: string, state: string, country: string) {
    return [city, state, country].filter(Boolean).join(', ');
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

async function withLocationTimeout<T>(promise: Promise<T>, timeoutMs = 12000): Promise<T> {
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

export default function Step8() {
    const { t, i18n } = useTranslation(['common', 'countries']);
    const { isDark } = useTheme();
    const { setProfileData } = useProfileSetupStore();
    const placesSearchLanguage = useMemo(() => normalizeLanguage(i18n.language), [i18n.language]);
    const displayLocale = placesSearchLanguage;

    const [city, setCity] = useState('');
    const [countryCode, setCountryCode] = useState('');
    const [countryDisplay, setCountryDisplay] = useState('');
    const [stateName, setStateName] = useState('');
    const [placeId, setPlaceId] = useState('');
    const [geo, setGeo] = useState<{ lat: number; lng: number } | null>(null);

    const [detectingLocation, setDetectingLocation] = useState(false);
    const [locationRecovery, setLocationRecovery] = useState<LocationRecovery | null>(null);
    const [loading, setLoading] = useState(false);
    const [errors, setErrors] = useState<Record<string, string>>({});

    const selectedCountryDisplay = countryDisplay || formatCountryForLocale(countryCode, countryCode, displayLocale, t);
    const currentLocationValue = city
        ? buildLocationLabel(city, '', selectedCountryDisplay)
        : t('current_location', { defaultValue: 'Current location' });

    const applyLocationDetails = useCallback((details: PlaceDetails) => {
        const nextCountryCode = (details.countryCode || '').trim().toUpperCase();
        const nextCity = (details.city || '').trim();
        const nextState = (details.state || '').trim();
        const nextCountryDisplay = formatCountryForLocale(nextCountryCode, details.country || '', displayLocale, t);
        const nextLat = Number(details.lat);
        const nextLng = Number(details.lng);

        setCity(nextCity);
        setStateName(nextState);
        setCountryCode(nextCountryCode);
        setCountryDisplay(nextCountryDisplay);
        setPlaceId(details.place_id || '');
        setGeo(Number.isFinite(nextLat) && Number.isFinite(nextLng) ? { lat: nextLat, lng: nextLng } : null);
        setErrors((current) => ({ ...current, city: '' }));
    }, [displayLocale, t]);

    const detectCurrentLocation = async () => {
        setDetectingLocation(true);
        setLocationRecovery(null);
        setErrors((current) => ({ ...current, city: '' }));
        try {
            let permission = await Location.getForegroundPermissionsAsync();
            if (permission.status !== Location.PermissionStatus.GRANTED && permission.canAskAgain) {
                permission = await Location.requestForegroundPermissionsAsync();
            }

            if (permission.status !== Location.PermissionStatus.GRANTED) {
                setLocationRecovery('permission_denied');
                return;
            }

            const servicesEnabled = await Location.hasServicesEnabledAsync();
            if (!servicesEnabled) {
                setLocationRecovery('services_disabled');
                return;
            }

            let position: Location.LocationObject | null = null;
            try {
                position = await withLocationTimeout(
                    Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }),
                );
            } catch {
                position = await Location.getLastKnownPositionAsync({
                    maxAge: 5 * 60 * 1000,
                    requiredAccuracy: 5000,
                });
            }

            if (!position) {
                setLocationRecovery('location_unavailable');
                return;
            }

            const lat = position.coords.latitude;
            const lng = position.coords.longitude;
            const res = await profileService.fetchPlaceReverse(lat, lng, 'en');

            if (res.success && hasResolvedLocation(res.data)) {
                applyLocationDetails(res.data);
                setLocationRecovery(null);
                return;
            }

            const recovery =
                res.message === 'network_error'
                    ? 'network_error'
                    : res.status === 404 || res.message === 'invalid_json'
                        ? 'service_unavailable'
                        : 'resolve_failed';

            setLocationRecovery(recovery);
        } catch {
            setLocationRecovery('location_unavailable');
        } finally {
            setDetectingLocation(false);
        }
    };

    const requestDeviceLocationServices = async () => {
        if (Platform.OS !== 'android') {
            await Linking.openSettings();
            return;
        }

        try {
            await Location.enableNetworkProviderAsync();
            await detectCurrentLocation();
        } catch {
            // Declining the native prompt should leave the recovery state visible.
        }
    };

    const openLocationSettings = async () => {
        if (locationRecovery === 'services_disabled') {
            await requestDeviceLocationServices();
            return;
        }

        if (locationRecovery === 'permission_denied') {
            try {
                const permission = await Location.getForegroundPermissionsAsync();
                if (permission.status !== Location.PermissionStatus.GRANTED && permission.canAskAgain) {
                    const requested = await Location.requestForegroundPermissionsAsync();
                    if (requested.status === Location.PermissionStatus.GRANTED) {
                        await detectCurrentLocation();
                    }
                    return;
                }

                if (permission.status === Location.PermissionStatus.GRANTED) {
                    await detectCurrentLocation();
                    return;
                }
            } catch {
                // App settings is the remaining route when Android blocks another prompt.
            }
        }

        try {
            await Linking.openSettings();
        } catch {
            toast.show(
                t('common:location_permission_required', { defaultValue: 'Location permission is required to continue.' }),
                'error',
            );
        }
    };

    const retryLocationAccess = async () => {
        if (locationRecovery === 'services_disabled') {
            await requestDeviceLocationServices();
            return;
        }

        if (locationRecovery === 'permission_denied') {
            try {
                const permission = await Location.getForegroundPermissionsAsync();
                if (permission.status !== Location.PermissionStatus.GRANTED && permission.canAskAgain) {
                    const requested = await Location.requestForegroundPermissionsAsync();
                    if (requested.status === Location.PermissionStatus.GRANTED) {
                        await detectCurrentLocation();
                    }
                    return;
                }
            } catch {
                // The standard retry below preserves the current recovery state.
            }
        }

        await detectCurrentLocation();
    };

    const recoveryMessage = locationRecovery
        ? t(
            locationRecovery === 'permission_denied'
                ? 'common:location_permission_required'
                : locationRecovery === 'services_disabled'
                    ? 'common:device_location_services_disabled'
                    : locationRecovery === 'network_error'
                        ? 'common:location_backend_network_error'
                        : locationRecovery === 'service_unavailable'
                            ? 'common:location_backend_unavailable'
                            : locationRecovery === 'resolve_failed'
                                ? 'common:location_resolve_failed'
                                : 'common:device_location_unavailable',
            { defaultValue: 'Could not verify your current location. Please try again.' },
        )
        : '';

    const validate = (): boolean => {
        const e: Record<string, string> = {};
        const hasValidGeo = Boolean(
            geo &&
            Number.isFinite(geo.lng) &&
            Number.isFinite(geo.lat),
        );

        if (!placeId || !city || !/^[A-Z]{2}$/.test(countryCode) || !hasValidGeo) {
            e.city = t('current_location_required', { defaultValue: 'Please use current location to fill your city, state, and country.' });
        }

        setErrors(e);
        return Object.keys(e).length === 0;
    };

    const handleSubmit = async () => {
        if (!validate()) return;
        setLoading(true);
        try {
            const payload = {
                current_location: {
                    place_id: placeId,
                    country: countryCode.toUpperCase(),
                    ...(stateName ? { state: stateName } : {}),
                    city,
                    geo: {
                        type: 'Point',
                        coordinates: [
                            Number.isFinite(geo?.lng) ? geo?.lng : 0,
                            Number.isFinite(geo?.lat) ? geo?.lat : 0,
                        ],
                    },
                },
            };
            const res = await profileService.updateProfile(payload);
            if (res.success) {
                setProfileData(payload);
                // Keep the cached /me user in sync so reload resumes correctly
                useAuthStore.getState().refreshUser().catch(() => { });
                router.push('/(profile-setup)/step9');
            } else {
                toast.show(res.message || t('server_error_default', { defaultValue: 'Failed to update' }), 'error');
            }
        } catch {
            toast.show(t('network_error', { defaultValue: 'Network error' }), 'error');
        } finally {
            setLoading(false);
        }
    };

    return (
        <SafeAreaView className="flex-1 bg-brand-bg-primary">
            <ProgressBar currentStep={8} />
            <KeyboardAwareScrollView
                style={{ flex: 1 }}
                contentContainerStyle={ProfileSetupTokens.scrollContent}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
                bottomOffset={scale(100)}
            >
                    <ProfileSetupHeader
                        step={8}
                        title={t('location_title', { defaultValue: 'Current location' })}
                        subtitle={t('current_location_required', { defaultValue: 'Please use current location to fill your city, state, and country.' })}
                    />

                    {locationRecovery ? (
                        <EmptyState
                            style={styles.recovery}
                            icon={<MapPinOff size={scale(30)} color="#F34B6F" />}
                            title={t('location_title', { defaultValue: 'Current location' })}
                            description={recoveryMessage}
                            actions={[
                                ...(
                                    locationRecovery === 'permission_denied' || locationRecovery === 'services_disabled'
                                        ? [{
                                            label: t('open_settings', { defaultValue: 'Open Settings' }),
                                            onPress: openLocationSettings,
                                        }]
                                        : []
                                ),
                                {
                                    label: t('btn_try_again', { defaultValue: 'Try Again' }),
                                    onPress: retryLocationAccess,
                                    variant: 'secondary' as const,
                                    disabled: detectingLocation,
                                    loading: detectingLocation,
                                },
                            ]}
                        />
                    ) : (
                        <Pressable
                            onPress={detectCurrentLocation}
                            disabled={detectingLocation}
                            style={[
                                styles.locationButton,
                                {
                                    borderBottomColor: errors.city ? '#EF4444' : isDark ? '#3A332B' : '#E8E1D6',
                                    opacity: detectingLocation ? 0.65 : 1,
                                },
                            ]}
                        >
                            <Text
                                variant="body-sm"
                                numberOfLines={2}
                                style={{
                                    color: city ? (isDark ? '#E8E1D6' : '#201B15') : (isDark ? '#A99C8D' : '#5C5348'),
                                    flex: 1,
                                }}
                            >
                                {currentLocationValue}
                            </Text>
                            {detectingLocation ? (
                                <ActivityIndicator color="#F34B6F" />
                            ) : (
                                <LocateFixed size={scale(18)} color="#F34B6F" />
                            )}
                        </Pressable>
                    )}
                    {errors.city ? <ErrorText text={errors.city} /> : null}
            </KeyboardAwareScrollView>

            <View style={styles.footer}><GradientButton title={t('continue', { defaultValue: 'Continue' })} onPress={handleSubmit} loading={loading} disabled={loading || detectingLocation} widthMode="full" height={40} textSize={15} /></View>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    footer: { padding: scale(20), paddingBottom: scale(10) },
    recovery: {
        paddingTop: scale(12),
        paddingBottom: scale(24),
    },
    // Underline style, matching the app's inputs
    locationButton: {
        minHeight: scale(48),
        borderBottomWidth: 1,
        backgroundColor: 'transparent',
        paddingHorizontal: scale(6),
        marginBottom: scale(16),
        flexDirection: 'row',
        alignItems: 'center',
        gap: scale(10),
    },
});
