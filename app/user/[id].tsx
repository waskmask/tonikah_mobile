import React, { useMemo, useState } from 'react';
import { View } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { UserProfileView } from '@/components/profile/UserProfileView';
import { BottomTabBar } from '@/components/app/BottomTabBar';

const TAB_ROUTES = ['search', 'messages', 'favourited', 'activities', 'profile'].map((name) => ({
    key: `profile-page-${name}`,
    name,
}));

const PROFILE_ROUTE = { key: 'profile-page-user', name: 'user' };

export default function UserProfileDetailScreen() {
    const { id } = useLocalSearchParams<{ id: string }>();
    const [bottomBarHidden, setBottomBarHidden] = useState(false);
    const tabState = useMemo(() => ({
        index: TAB_ROUTES.length,
        routes: [...TAB_ROUTES, PROFILE_ROUTE],
    }), []);
    const tabNavigation = useMemo(() => ({
        emit: () => ({ defaultPrevented: false }),
        navigate: (name: string) => router.navigate(`/(tabs)/${name}` as any),
        preload: (name: string) => router.prefetch(`/(tabs)/${name}` as any),
    }), []);

    return (
        <View style={{ flex: 1 }}>
            <UserProfileView
                userId={String(id || '')}
                mode="screen"
                showClose
                onClose={() => router.back()}
                onBottomBarVisibilityChange={setBottomBarHidden}
            />
            <BottomTabBar
                state={tabState}
                descriptors={{}}
                navigation={tabNavigation}
                activeTabName="search"
                hidden={bottomBarHidden}
                overlay
                liveUpdates={false}
            />
        </View>
    );
}
