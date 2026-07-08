import { useEffect } from "react";
import { Redirect } from "expo-router";
import { useAuthStore } from "@/store/authStore";
import { useFirstLaunch } from "@/hooks/useFirstLaunch";
import { useProfileSetupStore } from "@/store/profileSetupStore";
import { AppLoadingScreen } from "@/components/app/AppLoadingScreen";

export default function Index() {
    const { isAuthenticated, isRestoringSession, user } = useAuthStore();
    const { isFirstLaunch } = useFirstLaunch();
    const { getIncompleteStep, setGender } = useProfileSetupStore();

    // restoreSession already fetched (or cached) the user with the same /me
    // endpoint — no second network round-trip here.
    const profile = isAuthenticated ? user?.profile : undefined;

    useEffect(() => {
        if (profile?.gender) setGender(profile.gender);
    }, [profile?.gender, setGender]);

    // Wait until session is restored
    if (isRestoringSession) {
        return <AppLoadingScreen />;
    }

    if (isFirstLaunch) {
        return <Redirect href="/(onboarding)" />;
    }

    if (isAuthenticated) {
        const incompleteStep = profile ? getIncompleteStep(profile) : 1;
        if (incompleteStep > 0) {
            return <Redirect href={`/(profile-setup)/step${incompleteStep}` as any} />;
        }
        return <Redirect href="/(tabs)/search" />;
    }

    return <Redirect href="/(auth)/login" />;
}
