import React, { useCallback, useMemo, useState } from 'react';
import { View, ScrollView, KeyboardAvoidingView, Platform, Alert, StyleSheet, Pressable, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Location from 'expo-location';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Text } from '@/components/ui/Text';
import { GradientButton } from '@/components/ui/GradientButton';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { ProfileSetupHeader } from '@/components/ui/ProfileSetupHeader';
import { FieldLabel } from '@/components/ui/FormField';
import { useTheme } from '@/hooks/useTheme';
import { scale } from '@/hooks/useResponsive';
import { profileService } from '@/lib/profileService';
import { useProfileSetupStore } from '@/store/profileSetupStore';
import { LocateFixed } from 'lucide-react-native';

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
        try {
            const permission = await Location.requestForegroundPermissionsAsync();
            if (permission.status !== Location.PermissionStatus.GRANTED) {
                Alert.alert(
                    t('common:error', { defaultValue: 'Error' }),
                    t('common:location_permission_required', { defaultValue: 'Location permission is required to fill your current city.' }),
                );
                return;
            }

            const servicesEnabled = await Location.hasServicesEnabledAsync();
            if (!servicesEnabled) {
                Alert.alert(
                    t('common:error', { defaultValue: 'Error' }),
                    t('common:device_location_services_disabled', { defaultValue: 'Please turn on device location services and try again.' }),
                );
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
                Alert.alert(
                    t('common:error', { defaultValue: 'Error' }),
                    t('common:device_location_unavailable', { defaultValue: 'Could not get your device location. Please enable location services and try again.' }),
                );
                return;
            }

            const lat = position.coords.latitude;
            const lng = position.coords.longitude;
            const res = await profileService.fetchPlaceReverse(lat, lng, 'en');

            if (res.success && hasResolvedLocation(res.data)) {
                applyLocationDetails(res.data);
                return;
            }

            const messageKey =
                res.message === 'network_error'
                    ? 'common:location_backend_network_error'
                    : res.status === 404 || res.message === 'invalid_json'
                        ? 'common:location_backend_unavailable'
                        : 'common:location_resolve_failed';

            Alert.alert(
                t('common:error', { defaultValue: 'Error' }),
                t(messageKey, { defaultValue: 'Could not resolve your city from this location. Please try again.' }),
            );
        } catch {
            Alert.alert(
                t('common:error', { defaultValue: 'Error' }),
                t('common:device_location_unavailable', { defaultValue: 'Could not get your device location. Please enable location services and try again.' }),
            );
        } finally {
            setDetectingLocation(false);
        }
    };

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
                router.push('/(profile-setup)/step9');
            } else {
                Alert.alert(t('common:error', { defaultValue: 'Error' }), res.message || t('common:server_error_default', { defaultValue: 'Failed to update' }));
            }
        } catch {
            Alert.alert(t('common:error', { defaultValue: 'Error' }), t('common:network_error', { defaultValue: 'Network error' }));
        } finally {
            setLoading(false);
        }
    };

    return (
        <SafeAreaView className="flex-1 bg-white dark:bg-slate-900">
            <ProgressBar currentStep={8} />
            <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
                <ScrollView contentContainerStyle={{ padding: scale(20), paddingBottom: scale(100) }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
                    <ProfileSetupHeader
                        title={t('location_title', { defaultValue: 'Current location' })}
                        subtitle={t('location_desc', { defaultValue: 'Enter your present residing city and country.' })}
                    />

                    <FieldLabel text={t('current_location', { defaultValue: 'Current location' })} required />
                    <Pressable
                        onPress={detectCurrentLocation}
                        disabled={detectingLocation}
                        style={[
                            styles.locationButton,
                            {
                                backgroundColor: isDark ? '#1E293B' : '#FFFFFF',
                                borderColor: errors.city ? '#EF4444' : isDark ? '#334155' : '#E2E8F0',
                                opacity: detectingLocation ? 0.65 : 1,
                            },
                        ]}
                    >
                        <Text
                            variant="body-sm"
                            numberOfLines={2}
                            style={{
                                color: city ? (isDark ? '#E2E8F0' : '#0A0D14') : (isDark ? '#64748B' : '#9CA3AF'),
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
                    {errors.city ? (
                        <Text variant="caption" style={{ color: '#EF4444', marginTop: scale(-8), marginLeft: scale(4) }}>
                            {errors.city}
                        </Text>
                    ) : null}
                </ScrollView>
            </KeyboardAvoidingView>

            <View style={styles.footer}><GradientButton title={t('continue', { defaultValue: 'Continue' })} onPress={handleSubmit} loading={loading} disabled={loading} /></View>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    footer: { padding: scale(20), paddingBottom: scale(10) },
    locationButton: {
        minHeight: scale(54),
        borderWidth: 1,
        borderRadius: scale(12),
        paddingHorizontal: scale(16),
        marginBottom: scale(16),
        flexDirection: 'row',
        alignItems: 'center',
        gap: scale(10),
    },
});
