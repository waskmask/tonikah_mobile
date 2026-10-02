import type { ChatMessage } from '@/lib/chatService';

export function mergeChatMessageMedia(previous: ChatMessage, incoming: ChatMessage): ChatMessage {
    if (previous.unsent) return previous;
    if (incoming.unsent) return { ...incoming, media: null };
    if (previous.type !== incoming.type || !previous.media || !incoming.media) return incoming;

    const sameKey = previous.media.key && incoming.media.key
        ? previous.media.key === incoming.media.key
        : !previous.media.key && !incoming.media.key && previous.media.url === incoming.media.url;
    if (!sameKey) return incoming;

    return {
        ...incoming,
        media: {
            ...incoming.media,
            localUri: incoming.media.localUri || previous.media.localUri,
            waveform: incoming.media.waveform?.length
                ? incoming.media.waveform
                : previous.media.waveform,
        },
    };
}
