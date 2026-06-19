import { t } from './profileDisplay';

const CHAT_KEY_FALLBACKS: Record<string, string> = {
    account_deleted: 'Account deleted',
    already_viewed: 'Already viewed',
    chat_hidden: 'Chat hidden',
    conversation_ended: 'Conversation ended',
    conversation_muted: 'Conversation muted',
    conversation_unmuted: 'Conversation unmuted',
    copied: 'Copied',
    copy: 'Copy',
    delete_chat: 'Delete chat',
    delete_chat_confirm: 'Delete this chat for me?',
    end_conversation: 'End conversation',
    end_conversation_confirm: 'End this conversation?',
    media_download_failed: 'Could not download media. Please try again.',
    message_failed: 'Message failed to send. Tap to retry.',
    message_unsent: 'Message unsent',
    more_options: 'More options',
    mute_conversation: 'Mute notifications',
    photo: 'Photo',
    reply: 'Reply',
    request_accepted: 'Request accepted',
    sent_you_a_message: 'sent you a message',
    unsend: 'Unsend',
    unmute_conversation: 'Unmute notifications',
    view_once_photo: 'View once photo',
    voice_note: 'Voice note',
};

function titleFromKey(value: string) {
    return value
        .replace(/[_-]+/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .replace(/\b\w/g, (char) => char.toUpperCase());
}

export function translateChatText(value?: string | null, fallback?: string) {
    const raw = String(value || '').trim();
    if (!raw) return fallback || '';
    const normalized = raw.toLowerCase().replace(/\s+/g, '_');
    const knownFallback = CHAT_KEY_FALLBACKS[raw] || CHAT_KEY_FALLBACKS[normalized];
    if (knownFallback) return t(`chat:${normalized}`, fallback || knownFallback);
    if (raw.includes('_')) return t(`chat:${raw}`, fallback || titleFromKey(raw));
    return raw;
}
