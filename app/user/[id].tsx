import React from 'react';
import { View } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { UserProfileView } from '@/components/profile/UserProfileView';

export default function UserProfileDetailScreen() {
    const { id } = useLocalSearchParams<{ id: string }>();
    return (
        <View style={{ flex: 1 }}>
            <UserProfileView
                userId={String(id || '')}
                mode="screen"
                showClose
                onClose={() => router.back()}
            />
        </View>
    );
}
