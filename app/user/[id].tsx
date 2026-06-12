import React from 'react';
import { useLocalSearchParams, router } from 'expo-router';
import { UserProfileView } from '@/components/profile/UserProfileView';

export default function UserProfileDetailScreen() {
    const { id } = useLocalSearchParams<{ id: string }>();
    return (
        <UserProfileView
            userId={String(id || '')}
            mode="screen"
            showClose
            onClose={() => router.back()}
        />
    );
}
