import { Tabs } from "expo-router";
import { Home, Search, MessageSquare, User } from "lucide-react-native";
import { useTheme } from "@/hooks/useTheme";
import { scale } from "@/hooks/useResponsive";

export default function TabsLayout() {
    const { isDark } = useTheme();

    return (
        <Tabs
            screenOptions={{
                headerShown: false,
                tabBarStyle: {
                    backgroundColor: isDark ? "#1E293B" : "#FFFFFF",
                    borderTopColor: isDark ? "#334155" : "#E2E8F0",
                    height: scale(80),
                    paddingBottom: scale(20),
                },
                tabBarActiveTintColor: "#FE8A7B",
                tabBarInactiveTintColor: isDark ? "#94A3B8" : "#6B7280",
            }}
        >
            <Tabs.Screen
                name="home"
                options={{
                    tabBarIcon: ({ color }) => <Home color={color} size={scale(24)} />,
                }}
            />
            <Tabs.Screen
                name="search"
                options={{
                    tabBarIcon: ({ color }) => <Search color={color} size={scale(24)} />,
                }}
            />
            <Tabs.Screen
                name="messages"
                options={{
                    tabBarIcon: ({ color }) => <MessageSquare color={color} size={scale(24)} />,
                }}
            />
            <Tabs.Screen
                name="profile"
                options={{
                    tabBarIcon: ({ color }) => <User color={color} size={scale(24)} />,
                }}
            />
        </Tabs>
    );
}
