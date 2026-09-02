import { api, ApiResponse } from './api';

// Profile API service
export const profileService = {
    // Fetch current user profile (mobile lane)
    fetchMe: (): Promise<ApiResponse> => api.get('/app-user/mobile/me'),

    fetchProfileCompletion: (): Promise<ApiResponse> => api.get('/app-user/profile-completion'),

    // Lightweight owner summary (avatar URLs + completion) for chrome like the tab bar
    fetchMySummary: (): Promise<ApiResponse> => api.get('/users/me/summary'),

    // Create profile (Step 1 only)
    createProfile: (data: object): Promise<ApiResponse> => api.post('/profile/new', data),

    // Update profile (Steps 2-10)
    updateProfile: (data: object): Promise<ApiResponse> => api.patch('/profile/update', data),

    saveHobbies: (valueIds: string[]): Promise<ApiResponse> =>
        api.post('/profile/hobbies', { value_ids: valueIds }),

    saveFaithInDailyLife: (valueIds: string[]): Promise<ApiResponse> =>
        api.post('/profile/faith_in_daily_life', { value_ids: valueIds }),

    fetchPartnerPreference: (): Promise<ApiResponse> =>
        api.get('/profile/partner-preference'),

    savePartnerPreference: (data: object): Promise<ApiResponse> =>
        api.patch('/profile/partner-preference', data),

    // Masterdata endpoints
    fetchMasterdata: (type: string): Promise<ApiResponse> => api.get(`/masterdata/${type}`),

    // Google Places endpoints through the backend proxy.
    fetchPlaceAutocomplete: (input: string, language = 'en'): Promise<ApiResponse> =>
        api.get(`/profile/places/autocomplete?input=${encodeURIComponent(input)}&language=${encodeURIComponent(language)}`),

    fetchPlaceDetails: (placeId: string, language = 'en'): Promise<ApiResponse> =>
        api.get(`/profile/places/details?place_id=${encodeURIComponent(placeId)}&language=${encodeURIComponent(language)}`),

    fetchPlaceReverse: (lat: number, lng: number, language = 'en'): Promise<ApiResponse> =>
        api.get(`/profile/places/reverse?lat=${encodeURIComponent(String(lat))}&lng=${encodeURIComponent(String(lng))}&language=${encodeURIComponent(language)}`),
};
