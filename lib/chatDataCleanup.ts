import AsyncStorage from '@react-native-async-storage/async-storage';
import { clearAllCachedMessages, clearEveryCachedMessage } from '@/lib/chatCache';
import { clearCachedInbox } from '@/lib/chatInboxCache';
import { clearChatMediaCache, clearChatMediaCacheForUser } from '@/lib/chatMediaCache';
import { queryClient } from '@/lib/queryClient';
import { clearOfflineMessageQueue } from '@/lib/offlineMessageQueue';
import { stopAllChatAudioPlayback } from '@/lib/chatAudioPlayback';

async function clearEveryCachedInbox(): Promise<void> {
    const keys = await AsyncStorage.getAllKeys();
    const matching = keys.filter((key) => key.startsWith('chat:inbox:'));
    if (matching.length) await AsyncStorage.multiRemove(matching);
}

export async function clearPrivateChatData(userId?: string | null): Promise<void> {
    stopAllChatAudioPlayback();
    await queryClient.cancelQueries({ queryKey: ['chat'] }).catch(() => undefined);
    queryClient.removeQueries({ queryKey: ['chat'] });

    if (userId) {
        await Promise.allSettled([
            clearAllCachedMessages(userId),
            clearCachedInbox(userId),
            clearChatMediaCacheForUser(userId),
            clearOfflineMessageQueue(userId),
        ]);
        return;
    }

    // A confirmed unauthorized response can arrive before the cached user is
    // restored. In that case remove every account's private chat cache.
    await Promise.allSettled([
        clearEveryCachedMessage(),
        clearEveryCachedInbox(),
        clearChatMediaCache(),
        clearOfflineMessageQueue(),
    ]);
}
