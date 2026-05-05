import { api, ApiResponse } from './api';

// Profile API service
export const profileService = {
    // Fetch current user profile (mobile lane)
    fetchMe: (): Promise<ApiResponse> => api.get('/app-user/mobile/me'),

    // Create profile (Step 1 only)
    createProfile: (data: object): Promise<ApiResponse> => api.post('/profile/new', data),

    // Update profile (Steps 2–9)
    updateProfile: (data: object): Promise<ApiResponse> => api.patch('/profile/update', data),

    // Masterdata endpoints
    fetchMasterdata: (type: string): Promise<ApiResponse> => api.get(`/masterdata/${type}`),

    // Google Places autocomplete (via backend proxy or direct)
    fetchPlaceDetails: (placeId: string): Promise<ApiResponse> =>
        api.get(`/profile/places/details?place_id=${placeId}&language=en`),
};
