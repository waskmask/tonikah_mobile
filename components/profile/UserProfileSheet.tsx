import React from 'react';
import { Modal } from 'react-native';
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
                <>
                    <UserProfileView
                        {...profileProps}
                        userId={String(resolvedUserId)}
                        initialProfile={initialProfile}
                        mode="modal"
                        showClose
                        onClose={onClose}
                    />
                    <ToastProvider />
                </>
            ) : null}
        </Modal>
    );
}
