import { Tabs } from "expo-router";
import { AppTopBar } from "@/components/app/AppTopBar";
import { BottomTabBar } from "@/components/app/BottomTabBar";
import { usePeriodicLocationRefresh } from "@/hooks/usePeriodicLocationRefresh";

export default function TabsLayout() {
    usePeriodicLocationRefresh();

    return (
        <Tabs
            screenOptions={{
                headerShown: true,
                header: () => <AppTopBar />,
            }}
            tabBar={(props) => <BottomTabBar {...props} />}
        >
            <Tabs.Screen
                name="home"
                options={{
                    href: null,
                }}
            />
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
                }}
            />
            <Tabs.Screen
                name="favourited"
                options={{
                    title: "Saved",
                }}
            />
            <Tabs.Screen
                name="activities"
                options={{
                    title: "Activities",
                }}
            />
            <Tabs.Screen
                name="profile"
                options={{
                    title: "Profile",
                }}
            />
            <Tabs.Screen name="edit-profile" options={{ href: null }} />
            <Tabs.Screen name="memberships" options={{ href: null }} />
            <Tabs.Screen name="blocked-users" options={{ href: null }} />
            <Tabs.Screen name="settings" options={{ href: null }} />
            <Tabs.Screen name="language" options={{ href: null, headerShown: false }} />
            <Tabs.Screen name="my-hobbies" options={{ href: null }} />
            <Tabs.Screen name="faith" options={{ href: null }} />
            <Tabs.Screen name="partner-preference" options={{ href: null }} />
        </Tabs>
    );
}
