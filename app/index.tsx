import { useEffect, useState } from "react";
import { Redirect } from "expo-router";
import { ActivityIndicator, View } from "react-native";
import { useAuthStore } from "@/store/authStore";
import { useFirstLaunch } from "@/hooks/useFirstLaunch";
import { useProfileSetupStore } from "@/store/profileSetupStore";
import { profileService } from "@/lib/profileService";
import { useColors } from "@/hooks/useColors";

export default function Index() {
    const colors = useColors();
    const { isAuthenticated, isRestoringSession, setUser } = useAuthStore();
    const { isFirstLaunch } = useFirstLaunch();
    const { getIncompleteStep, setGender } = useProfileSetupStore();

    const [profileChecked, setProfileChecked] = useState(false);
    const [incompleteStep, setIncompleteStep] = useState(0);

    useEffect(() => {
        if (!isAuthenticated) {
            setProfileChecked(true);
            return;
        }

        // Fetch fresh profile data from API
        (async () => {
            try {
                const res = await profileService.fetchMe();
                if (res.success && res.user) {
                    setUser(res.user);

                    const profile = res.user.profile;
                    if (!profile) {
                        setIncompleteStep(1);
                    } else {
                        const step = getIncompleteStep(profile);
                        setIncompleteStep(step);
                        if (profile.gender) setGender(profile.gender);
                    }
                } else {
                    // No user data → step 1
                    setIncompleteStep(1);
                }
            } catch {
                setIncompleteStep(1);
            } finally {
                setProfileChecked(true);
            }
        })();
    }, [isAuthenticated]);

    // Wait until session is restored
    if (isRestoringSession || !profileChecked) {
        return (
            <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.chrome.loader.background }}>
                <ActivityIndicator size="large" color={colors.chrome.loader.spinner} />
            </View>
        );
    }

    if (isFirstLaunch) {
        return <Redirect href="/(onboarding)" />;
    }

    if (isAuthenticated) {
        if (incompleteStep > 0) {
            return <Redirect href={`/(profile-setup)/step${incompleteStep}` as any} />;
        }
        return <Redirect href="/(tabs)/search" />;
    }

    return <Redirect href="/(auth)/login" />;
}
