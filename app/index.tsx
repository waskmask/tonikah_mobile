import { useEffect, useState } from "react";
import { Redirect, useLocalSearchParams } from "expo-router";
import { useAuthStore } from "@/store/authStore";
import { useFirstLaunch } from "@/hooks/useFirstLaunch";
import { useProfileSetupStore } from "@/store/profileSetupStore";
import { AppLoadingScreen } from "@/components/app/AppLoadingScreen";
import { firstSearchParam, sanitizeAuthReturnPath } from "@/lib/authReturn";

export default function Index() {
    const { isAuthenticated, isRestoringSession, user, refreshUser } = useAuthStore();
    const { isFirstLaunch, isHydrated: isFirstLaunchHydrated } = useFirstLaunch();
    const { getIncompleteStep, setGender } = useProfileSetupStore();
    const params = useLocalSearchParams<{ returnTo?: string | string[] }>();
    const returnTo = sanitizeAuthReturnPath(firstSearchParam(params.returnTo));

    // restoreSession unblocks with the CACHED user; the background /me can
    // land after we've already redirected. A stale cache must not decide the
    // profile-setup resume step, so when it says "incomplete" we hold the
    // splash until one fresh /me confirms it. Complete profiles skip this.
    const [freshUserChecked, setFreshUserChecked] = useState(false);

    const profile = isAuthenticated ? user?.profile : undefined;
    const incompleteStep = isAuthenticated ? (profile ? getIncompleteStep(profile) : 1) : 0;
    const needsFreshCheck = isAuthenticated && !isRestoringSession && incompleteStep > 0 && !freshUserChecked;

    useEffect(() => {
        if (profile?.gender) setGender(profile.gender);
    }, [profile?.gender, setGender]);

    useEffect(() => {
        if (!needsFreshCheck) return;
        // On failure (offline) fall back to the cached decision.
        refreshUser()
            .catch(() => undefined)
            .finally(() => setFreshUserChecked(true));
    }, [needsFreshCheck, refreshUser]);

    // Do not route from either store's temporary default state.
    if (isRestoringSession || !isFirstLaunchHydrated) {
        return <AppLoadingScreen />;
    }

    if (isFirstLaunch) {
        return <Redirect href="/(onboarding)" />;
    }

    if (isAuthenticated) {
        if (incompleteStep > 0) {
            if (!freshUserChecked) {
                return <AppLoadingScreen />;
            }
            return <Redirect href={`/(profile-setup)/step${incompleteStep}` as any} />;
        }
        return <Redirect href={(returnTo || '/(tabs)/search') as any} />;
    }

    return <Redirect href="/(auth)/login" />;
}
