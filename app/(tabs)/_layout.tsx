import { useEffect } from "react";
import { router, Tabs } from "expo-router";
import { BottomTabBar } from "@/components/app/BottomTabBar";
import { usePeriodicLocationRefresh } from "@/hooks/usePeriodicLocationRefresh";
import { AppMenuProvider } from "@/components/app/AppMenuProvider";
import { MembershipAccessListener } from "@/components/app/MembershipAccessListener";
import { scheduleIdleWork } from "@/lib/idleWork";

export default function TabsLayout() {
    usePeriodicLocationRefresh();

    useEffect(() => {
        return scheduleIdleWork(() => {
            router.prefetch('/(tabs)/hobbies-faith');
        });
    }, []);

    return (
        <AppMenuProvider>
        <MembershipAccessListener />
        <Tabs
            screenOptions={{
                headerShown: false,
                sceneStyle: { flex: 1 },
                // Navigation chrome should react immediately. Screen-level
                // transitions made tab presses feel delayed on Android.
                animation: "none",
            }}
            tabBar={(props) => <BottomTabBar {...props} />}
        >
            <Tabs.Screen
                name="search"
                options={{
                    title: "Explore",
                    headerShown: false,
                }}
            />
            <Tabs.Screen
                name="messages"
                options={{
                    title: "Messages",
                    headerShown: false,
                }}
            />
            <Tabs.Screen
                name="favourited"
                options={{
                    title: "Saved",
                    headerShown: false,
                }}
            />
            <Tabs.Screen
                name="activities"
                options={{
                    title: "Activities",
                    headerShown: false,
                }}
            />
            <Tabs.Screen
                name="profile"
                options={{
                    title: "Profile",
                    headerShown: false,
                    freezeOnBlur: true,
                }}
            />
            <Tabs.Screen name="edit-profile" options={{ href: null }} />
            <Tabs.Screen name="memberships" options={{ href: null }} />
            <Tabs.Screen name="blocked-users" options={{ href: null }} />
            <Tabs.Screen name="settings" options={{ href: null }} />
            <Tabs.Screen name="language" options={{ href: null, headerShown: false }} />
            <Tabs.Screen name="hobbies-faith" options={{ href: null }} />
            <Tabs.Screen name="partner-preference" options={{ href: null }} />
        </Tabs>
        </AppMenuProvider>
    );
}
