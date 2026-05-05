import AsyncStorage from "@react-native-async-storage/async-storage";

export const storage = {
    getItem: async (key: string) => {
        try {
            const value = await AsyncStorage.getItem(key);
            return value ? JSON.parse(value) : null;
        } catch (e) {
            console.error("Error reading from storage", e);
            return null;
        }
    },
    setItem: async (key: string, value: any) => {
        try {
            await AsyncStorage.setItem(key, JSON.stringify(value));
        } catch (e) {
            console.error("Error writing to storage", e);
        }
    },
    removeItem: async (key: string) => {
        try {
            await AsyncStorage.removeItem(key);
        } catch (e) {
            console.error("Error removing from storage", e);
        }
    },
};
