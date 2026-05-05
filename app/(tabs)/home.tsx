import React from "react";
import { View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Text } from "@/components/ui/Text";
import { GradientButton } from "@/components/ui/GradientButton";
import { useLanguage } from "@/hooks/useLanguage";
import { useTheme } from "@/hooks/useTheme";

export default function HomeScreen() {
    const { languageName, changeLanguage } = useLanguage();
    const { toggleTheme, isDark } = useTheme();

    return (
        <SafeAreaView className="flex-1 bg-brand-bg-primary">
            <View className="flex-1 px-8 pt-10">
                <Text variant="h1" className="mb-2">Home</Text>
                <Text variant="body" className="mb-10">Welcome to toNikah</Text>

                <View className="bg-brand-bg-surface p-6 rounded-3xl mb-6">
                    <Text variant="h3" className="mb-4">Quick Settings</Text>

                    <GradientButton
                        title={`Switch Theme (${isDark ? "Light" : "Dark"})`}
                        onPress={toggleTheme}
                    />

                    <View className="h-4" />

                    <GradientButton
                        title={`Switch Language (${languageName})`}
                        onPress={() => changeLanguage(languageName === "English" ? "ar" : "en")}
                    />
                </View>
            </View>
        </SafeAreaView>
    );
}
