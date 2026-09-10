export type VerificationGuardAction =
    | 'profileActions'
    | 'save'
    | 'chat'
    | 'report'
    | 'checkout'
    | 'browse';

type VerificationGateCopy = {
    title: string;
    titleFallback: string;
    message: string;
    messageFallback: string;
};

export const VERIFICATION_GATE_COPY: Record<VerificationGuardAction, VerificationGateCopy> = {
    profileActions: {
        title: 'verify_email_profile_actions_title',
        titleFallback: 'Verify your email to save profiles',
        message: 'verify_email_profile_actions_message',
        messageFallback: 'Please verify your email before saving or skipping profiles.',
    },
    save: {
        title: 'verify_email_profile_actions_title',
        titleFallback: 'Verify your email to save changes',
        message: 'verify_email_profile_actions_message',
        messageFallback: 'Please verify your email before saving changes.',
    },
    chat: {
        title: 'verify_email_full_chat_title',
        titleFallback: 'Verify your email to use full chat',
        message: 'verify_email_full_chat_message',
        messageFallback: 'Please verify your email before opening conversations or sending messages.',
    },
    report: {
        title: 'verify_email_report_title',
        titleFallback: 'Verify your email to report',
        message: 'verify_email_report_message',
        messageFallback: 'Please verify your email before submitting reports.',
    },
    checkout: {
        title: 'email_not_verified',
        titleFallback: 'Email Not Verified',
        message: 'verify_email_checkout_message',
        messageFallback: 'Please verify your email before starting checkout.',
    },
    browse: {
        title: 'verify_email_browse_limit_title',
        titleFallback: 'Verify your email to keep browsing',
        message: 'verify_email_browse_limit_message',
        messageFallback: 'Verify your email to continue exploring more matches.',
    },
};
