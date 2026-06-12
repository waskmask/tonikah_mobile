import { create } from 'zustand';

interface ProfileData {
    [key: string]: any;
}

interface MasterdataItem {
    _id: string;
    name: string;
    description?: string;
    [key: string]: any;
}

interface ProfileSetupState {
    // Profile data accumulated across steps
    gender: string;
    profileData: ProfileData;

    // Masterdata cache
    masterdata: Record<string, MasterdataItem[]>;

    // Actions
    setGender: (gender: string) => void;
    setProfileData: (data: ProfileData) => void;
    setMasterdata: (data: Record<string, MasterdataItem[]>) => void;
    reset: () => void;

    // Step detection: returns 1-10 for incomplete step, or 0 if all complete
    getIncompleteStep: (profile: ProfileData) => number;
}

export const useProfileSetupStore = create<ProfileSetupState>((set, get) => ({
    gender: '',
    profileData: {},
    masterdata: {},

    setGender: (gender) => set({ gender }),

    setProfileData: (data) =>
        set((state) => ({
            profileData: { ...state.profileData, ...data },
        })),

    setMasterdata: (data) =>
        set((state) => ({
            masterdata: { ...state.masterdata, ...data },
        })),

    reset: () => set({ gender: '', profileData: {}, masterdata: {} }),

    getIncompleteStep: (profile: ProfileData) => {
        if (!profile) return 1;

        // Walk the fields in order to find the first empty required field
        // Field names match the API response (snake_case)
        if (!profile.profileName) return 1;
        if (!profile.mother_tongue) return 2;
        if (!profile.marital_status) return 3;
        if (!profile.height) return 4;
        if (!profile.education) return 5;
        if (!profile.sect) return 6;
        if (!profile.smoking) return 7;
        if (!profile.current_location?.city) return 8;
        if (!profile.profile_manager) return 9;
        if (profile.newProfile === true) return 10;

        return 0; // All complete
    },
}));
