import React from 'react';
import { Modal } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { UserProfileView, UserProfileViewProps } from '@/components/profile/UserProfileView';
import { ToastProvider } from '@/hooks/useToast';

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

    return (
        <Modal
            visible={visible && Boolean(resolvedUserId)}
            animationType="slide"
            presentationStyle="fullScreen"
            statusBarTranslucent
            navigationBarTranslucent
            onRequestClose={onClose}
        >
            {visible && resolvedUserId ? (
                <GestureHandlerRootView style={{ flex: 1 }}>
                    <UserProfileView
                        {...profileProps}
                        userId={String(resolvedUserId)}
                        initialProfile={initialProfile}
                        mode="modal"
                        showClose
                        onClose={onClose}
                    />
                    <ToastProvider />
                </GestureHandlerRootView>
            ) : null}
        </Modal>
    );
}
