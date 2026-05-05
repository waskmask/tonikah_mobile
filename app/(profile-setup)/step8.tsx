import React, { useState, useCallback } from 'react';
import { View, ScrollView, KeyboardAvoidingView, Platform, Alert, StyleSheet, FlatList, Pressable, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Text } from '@/components/ui/Text';
import { Input } from '@/components/ui/Input';
import { GradientButton } from '@/components/ui/GradientButton';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { FieldLabel, ErrorText, SelectField } from '@/components/ui/FormField';
import { useTheme } from '@/hooks/useTheme';
import { scale } from '@/hooks/useResponsive';
import { profileService } from '@/lib/profileService';
import { useProfileSetupStore } from '@/store/profileSetupStore';
import { Config } from '@/constants/config';
import { MapPin, Search, Globe } from 'lucide-react-native';

let searchTimeout: ReturnType<typeof setTimeout>;

export default function Step8() {
    const { t } = useTranslation('common');
    const { isDark } = useTheme();
    const { setProfileData } = useProfileSetupStore();
    const iconColor = isDark ? '#94A3B8' : '#6B7280';

    const [city, setCity] = useState('');
    const [country, setCountry] = useState('');
    const [placeId, setPlaceId] = useState('');
    const [geo, setGeo] = useState<{ lat: number; lng: number } | null>(null);

    const [searchQuery, setSearchQuery] = useState('');
    const [predictions, setPredictions] = useState<any[]>([]);
    const [searchLoading, setSearchLoading] = useState(false);
    const [loading, setLoading] = useState(false);
    const [errors, setErrors] = useState<Record<string, string>>({});

    const searchCities = useCallback((query: string) => {
        setSearchQuery(query);
        clearTimeout(searchTimeout);

        if (query.length < 3) {
            setPredictions([]);
            return;
        }

        searchTimeout = setTimeout(async () => {
            setSearchLoading(true);
            try {
                const url = `https://maps.googleapis.com/maps/api/place/autocomplete/json?input=${encodeURIComponent(query)}&types=(cities)&key=${Config.GOOGLE_MAPS_API_KEY}`;
                const res = await fetch(url);
                const data = await res.json();
                setPredictions(data.predictions || []);
            } catch {
                setPredictions([]);
            } finally {
                setSearchLoading(false);
            }
        }, 400);
    }, []);

    const selectPlace = async (prediction: any) => {
        setPredictions([]);
        setSearchQuery(prediction.description);
        setPlaceId(prediction.place_id);
        setSearchLoading(true);

        try {
            const url = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${prediction.place_id}&fields=address_components,geometry&key=${Config.GOOGLE_MAPS_API_KEY}`;
            const res = await fetch(url);
            const data = await res.json();

            if (data.result) {
                const components = data.result.address_components || [];
                const cityComp = components.find((c: any) => c.types.includes('locality'));
                const countryComp = components.find((c: any) => c.types.includes('country'));
                const stateComp = components.find((c: any) => c.types.includes('administrative_area_level_1'));

                setCity(cityComp?.long_name || prediction.structured_formatting?.main_text || '');
                setCountry(countryComp?.short_name || '');
                if (data.result.geometry?.location) {
                    setGeo({ lat: data.result.geometry.location.lat, lng: data.result.geometry.location.lng });
                }
                if (errors.city) setErrors((e) => ({ ...e, city: '' }));
            }
        } catch { } finally {
            setSearchLoading(false);
        }
    };

    const validate = (): boolean => {
        const e: Record<string, string> = {};
        if (!city) e.city = 'Please search and select your city';
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
                    city,
                    country,
                    geo: geo ? { type: 'Point', coordinates: [geo.lng, geo.lat] } : undefined,
                },
            };
            const res = await profileService.updateProfile(payload);
            if (res.success) {
                setProfileData(payload);
                router.push('/(profile-setup)/step9');
            } else {
                Alert.alert('Error', res.message || 'Failed to update');
            }
        } catch {
            Alert.alert('Error', 'Something went wrong');
        } finally {
            setLoading(false);
        }
    };

    return (
        <SafeAreaView className="flex-1 bg-white dark:bg-slate-900">
            <ProgressBar currentStep={8} />
            <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
                <ScrollView contentContainerStyle={{ padding: scale(20), paddingBottom: scale(100) }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
                    <Text variant="heading" className="font-heading mb-1" align="center">{t('step_8.title')}</Text>
                    <Text variant="body-sm" className="mb-4" align="center" style={{ color: isDark ? '#94A3B8' : '#6B7280' }}>{t('step_8.subtitle')}</Text>

                    <FieldLabel text={t('step_8.city')} required />
                    <Input
                        placeholder={t('step_8.search_city')}
                        value={searchQuery}
                        onChangeText={searchCities}
                        leftIcon={<Search size={scale(18)} color={iconColor} />}
                        error={errors.city}
                    />

                    {/* Predictions list */}
                    {searchLoading && <ActivityIndicator style={{ marginVertical: scale(8) }} color="#FE8A7B" />}
                    {predictions.length > 0 && (
                        <View style={[styles.predictionsContainer, { backgroundColor: isDark ? '#1E293B' : '#FFFFFF', borderColor: isDark ? '#334155' : '#E2E8F0' }]}>
                            {predictions.map((item) => (
                                <Pressable key={item.place_id} onPress={() => selectPlace(item)} style={[styles.predictionItem, { borderBottomColor: isDark ? '#334155' : '#F1F5F9' }]}>
                                    <MapPin size={scale(16)} color={iconColor} />
                                    <Text variant="body-sm" style={{ flex: 1, marginLeft: scale(8) }} numberOfLines={1}>{item.description}</Text>
                                </Pressable>
                            ))}
                        </View>
                    )}

                    {/* Selected city & country display */}
                    {city ? (
                        <View style={{ marginTop: scale(12) }}>
                            <FieldLabel text={t('step_8.city')} />
                            <SelectField value={city} placeholder="" onPress={() => { }} icon={<MapPin size={scale(18)} color={iconColor} />} />

                            <FieldLabel text={t('step_8.country')} />
                            <SelectField value={country} placeholder="" onPress={() => { }} icon={<Globe size={scale(18)} color={iconColor} />} />
                        </View>
                    ) : null}
                </ScrollView>
            </KeyboardAvoidingView>

            <View style={styles.footer}><GradientButton title={t('common.continue')} onPress={handleSubmit} loading={loading} disabled={loading} /></View>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    footer: { padding: scale(20), paddingBottom: scale(10) },
    predictionsContainer: { borderWidth: 1, borderRadius: scale(12), overflow: 'hidden', marginTop: scale(4) },
    predictionItem: { flexDirection: 'row', alignItems: 'center', padding: scale(14), borderBottomWidth: 1 },
});
