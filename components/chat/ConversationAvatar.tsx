import React, { useRef, useState } from 'react';
import { StyleSheet } from 'react-native';
import { Image } from 'expo-image';
import { PROFILE_PLACEHOLDER_IMAGE } from '@/lib/profileAssets';

/** Keep missing or failed chat photos consistent in lists and conversation headers. */
export function ConversationAvatar({ identity, uri }: { identity: string; uri?: string | null }) {
    const [failedSource, setFailedSource] = useState('');
    const sourceKey = `${identity}:${uri || ''}`;
    const currentSource = useRef(sourceKey);
    currentSource.current = sourceKey;
    return (
        <>
            <Image source={PROFILE_PLACEHOLDER_IMAGE} style={StyleSheet.absoluteFill} contentFit="cover" />
            {!!uri && failedSource !== sourceKey && (
                <Image
                    key={sourceKey}
                    source={{ uri }}
                    recyclingKey={sourceKey}
                    style={StyleSheet.absoluteFill}
                    contentFit="cover"
                    onError={() => {
                        if (currentSource.current === sourceKey) setFailedSource(sourceKey);
                    }}
                />
            )}
        </>
    );
}
