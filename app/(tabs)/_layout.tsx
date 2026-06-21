import { Tabs } from "expo-router";
import { BottomTabBar } from "@/components/app/BottomTabBar";
import { usePeriodicLocationRefresh } from "@/hooks/usePeriodicLocationRefresh";

export default function TabsLayout() {
    usePeriodicLocationRefresh();

    return (
        <Tabs
            screenOptions={{
                headerShown: false,
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
