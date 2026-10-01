import { useEffect, useState } from "react";
import { router, useLocalSearchParams, type Href } from "expo-router";
import { useAuthStore } from "@/store/authStore";
import { useFirstLaunch } from "@/hooks/useFirstLaunch";
import { useProfileSetupStore } from "@/store/profileSetupStore";
import { AppLoadingScreen } from "@/components/app/AppLoadingScreen";
import { firstSearchParam, sanitizeAuthReturnPath } from "@/lib/authReturn";
import { markStartup } from "@/lib/performanceDiagnostics";

function LoadingRedirect({ href }: { href: Href }) {
    useEffect(() => {
        router.replace(href);
    }, [href]);

    return <AppLoadingScreen />;
}

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

    useEffect(() => {
        if (isRestoringSession || !isFirstLaunchHydrated) return;
        const destination = isFirstLaunch
            ? 'onboarding'
            : isAuthenticated
                ? incompleteStep > 0
                    ? 'profile-setup'
                    : 'tabs'
                : 'login';
        markStartup('initial-route-decided', { destination });
    }, [incompleteStep, isAuthenticated, isFirstLaunch, isFirstLaunchHydrated, isRestoringSession]);

    // Do not route from either store's temporary default state.
    if (isRestoringSession || !isFirstLaunchHydrated) {
        return <AppLoadingScreen />;
    }

    if (isFirstLaunch) {
        return <LoadingRedirect href="/(onboarding)" />;
    }

    if (isAuthenticated) {
        if (incompleteStep > 0) {
            if (!freshUserChecked) {
                return <AppLoadingScreen />;
            }
            return <LoadingRedirect href={`/(profile-setup)/step${incompleteStep}` as Href} />;
        }
        return <LoadingRedirect href={(returnTo || '/(tabs)/search') as Href} />;
    }

    return <LoadingRedirect href="/(auth)/login" />;
}
