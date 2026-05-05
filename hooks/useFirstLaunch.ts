import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import AsyncStorage from "@react-native-async-storage/async-storage";

interface FirstLaunchState {
  hasSeenOnboarding: boolean;
  setHasSeenOnboarding: (value: boolean) => void;
}

export const useFirstLaunchStore = create<FirstLaunchState>()(
  persist(
    (set) => ({
      hasSeenOnboarding: false,
      setHasSeenOnboarding: (value) => set({ hasSeenOnboarding: value }),
    }),
    {
      name: "tonikah-onboarding-status",
      storage: createJSONStorage(() => AsyncStorage),
    },
  ),
);

export const useFirstLaunch = () => {
  const { hasSeenOnboarding, setHasSeenOnboarding } = useFirstLaunchStore();
  return {
    isFirstLaunch: !hasSeenOnboarding,
    completeOnboarding: () => setHasSeenOnboarding(true),
  };
};
