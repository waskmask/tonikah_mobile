import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import AsyncStorage from "@react-native-async-storage/async-storage";

interface FirstLaunchState {
  hasSeenOnboarding: boolean;
  isHydrated: boolean;
  setHasSeenOnboarding: (value: boolean) => void;
  setHydrated: (value: boolean) => void;
}

export const useFirstLaunchStore = create<FirstLaunchState>()(
  persist(
    (set) => ({
      hasSeenOnboarding: false,
      isHydrated: false,
      setHasSeenOnboarding: (value) => set({ hasSeenOnboarding: value }),
      setHydrated: (value) => set({ isHydrated: value }),
    }),
    {
      name: "tonikah-onboarding-status",
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({ hasSeenOnboarding: state.hasSeenOnboarding }),
      onRehydrateStorage: () => () => {
        useFirstLaunchStore.setState({ isHydrated: true });
      },
    },
  ),
);

export const useFirstLaunch = () => {
  const { hasSeenOnboarding, isHydrated, setHasSeenOnboarding } = useFirstLaunchStore();
  return {
    isFirstLaunch: !hasSeenOnboarding,
    isHydrated,
    completeOnboarding: () => setHasSeenOnboarding(true),
  };
};
