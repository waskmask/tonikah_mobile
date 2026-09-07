export const queryKeys = {
    chat: {
        unreadCount: ['chat', 'unread-count'] as const,
        inbox: ['chat', 'inbox'] as const,
    },
    profile: {
        mySummary: ['profile', 'my-summary'] as const,
    },
    gallery: {
        me: ['gallery', 'me'] as const,
    },
    favourites: {
        list: ['favourites', 'list'] as const,
    },
    activities: {
        list: (mode: string) => ['activities', mode] as const,
    },
    masterdata: {
        editProfile: (language: string) => ['masterdata', 'edit-profile', language] as const,
    },
};
