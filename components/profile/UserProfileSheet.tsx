import React, { useEffect, useState } from 'react';
import { Modal } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { UserProfileView, UserProfileViewProps } from '@/components/profile/UserProfileView';
import { ToastProvider } from '@/hooks/useToast';
import { useColors } from '@/hooks/useColors';
import { PUBLIC_PROFILE_DETAIL_STALE_TIME_MS, queryClient } from '@/lib/queryClient';
import { queryKeys } from '@/lib/queryKeys';

type UserProfileSheetProps = Omit<UserProfileViewProps, 'mode' | 'showClose'> & {
    visible: boolean;
};

export function UserProfileSheet({
    visible,
    userId,
    initialProfile,
    onClose,
    ...profileProps
}: UserProfileSheetProps) {
    const resolvedUserId = userId || initialProfile?.id || initialProfile?._id || '';
    const [contentReady, setContentReady] = useState(false);
    const backgroundColor = useColors().brand.bg.surface;

    useEffect(() => {
        if (!visible || !resolvedUserId) {
            setContentReady(false);
            return;
        }

        const cached = queryClient.getQueryState<any>(queryKeys.profile.detail(String(resolvedUserId)));
        if (!cached?.data || cached.data.privacy === 'private' || cached.isInvalidated
            || Date.now() - cached.dataUpdatedAt >= PUBLIC_PROFILE_DETAIL_STALE_TIME_MS) return;

        const frame = requestAnimationFrame(() => setContentReady(true));
        return () => cancelAnimationFrame(frame);
    }, [resolvedUserId, visible]);

    return (
        <Modal
            visible={visible && Boolean(resolvedUserId)}
            animationType="slide"
            presentationStyle="fullScreen"
            statusBarTranslucent
            navigationBarTranslucent
            onRequestClose={onClose}
            onShow={() => setContentReady(true)}
        >
            {visible && resolvedUserId ? (
                <GestureHandlerRootView style={{ flex: 1, backgroundColor }}>
                    <UserProfileView
                        {...profileProps}
                        userId={String(resolvedUserId)}
                        initialProfile={initialProfile}
                        mode="modal"
                        showClose
                        previewOnly={!contentReady}
                        onClose={onClose}
                    />
                    {contentReady ? <ToastProvider /> : null}
                </GestureHandlerRootView>
            ) : null}
        </Modal>
    );
}
