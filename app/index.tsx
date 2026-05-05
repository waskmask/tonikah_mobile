import { useEffect, useState } from "react";
import { Redirect } from "expo-router";
import { ActivityIndicator, View } from "react-native";
import { useAuthStore } from "@/store/authStore";
import { useFirstLaunch } from "@/hooks/useFirstLaunch";
import { useProfileSetupStore } from "@/store/profileSetupStore";
import { profileService } from "@/lib/profileService";

export default function Index() {
    const { isAuthenticated, user, isRestoringSession } = useAuthStore();
    const { isFirstLaunch } = useFirstLaunch();
    const { getIncompleteStep, setGender } = useProfileSetupStore();

    const [profileChecked, setProfileChecked] = useState(false);
    const [incompleteStep, setIncompleteStep] = useState(0);
    const [needsVerification, setNeedsVerification] = useState(false);

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
                    // Check email verification first
                    if (res.user.email_verified === false) {
                        setNeedsVerification(true);
                        setProfileChecked(true);
                        return;
                    }

                    const profile = res.user.profile;
                    if (!profile || profile.newProfile === true) {
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
            <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#0F172A' }}>
                <ActivityIndicator size="large" color="#FE8A7B" />
            </View>
        );
    }

    if (isFirstLaunch) {
        return <Redirect href="/(onboarding)" />;
    }

    if (isAuthenticated) {
        // Email not verified → send to verify-email (NOT back to login)
        if (needsVerification) {
            return <Redirect href={{ pathname: "/(auth)/verify-email", params: { email: user?.email || '' } }} />;
        }

        if (incompleteStep > 0) {
            return <Redirect href={`/(profile-setup)/step${incompleteStep}` as any} />;
        }
        return <Redirect href="/(tabs)/home" />;
    }

    return <Redirect href="/(auth)/login" />;
}
