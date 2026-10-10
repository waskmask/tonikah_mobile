import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, AppState, BackHandler, Image, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { X } from '@/components/ui/icons/PhosphorCompat';
import { Text } from '@/components/ui/Text';
import { scale } from '@/hooks/useResponsive';
import { t } from '@/lib/profileDisplay';

// Serialize native changes so rapid close/reopen cannot race the iOS layer restoration.
let protectionQueue: Promise<unknown> = Promise.resolve();
let nextProtectionId = 0;

export function ViewOncePhotoViewer({ url, seconds, onClose, onLoaded, onError }: {
    url: string;
    seconds: number;
    onClose: () => void;
    onLoaded: () => void;
    onError: () => void;
}) {
    const insets = useSafeAreaInsets();
    const [ready, setReady] = useState(false);
    const [remaining, setRemaining] = useState(seconds);
    const callbacks = useRef({ onClose, onError });
    callbacks.current = { onClose, onError };

    useEffect(() => {
        let active = true;
        let capture: typeof import('expo-screen-capture') | undefined;
        const key = `view-once-${++nextProtectionId}`;
        protectionQueue = protectionQueue.then(async () => {
            if (!active) return;
            try {
                capture = await import('expo-screen-capture');
                await capture.preventScreenCaptureAsync(key);
                if (active) setReady(true);
            } catch {
                // Never reveal the image when the installed binary cannot protect it.
                if (active) callbacks.current.onError();
            }
        });
        const appState = AppState.addEventListener('change', (state) => {
            if (state !== 'active') {
                active = false;
                setReady(false);
                callbacks.current.onClose();
            }
        });
        const back = BackHandler.addEventListener('hardwareBackPress', () => {
            callbacks.current.onClose();
            return true;
        });
        return () => {
            active = false;
            appState.remove();
            back.remove();
            protectionQueue = protectionQueue.then(async () => {
                await capture?.allowScreenCaptureAsync(key);
            }).catch((error) => {
                console.warn('[view-once] Could not release capture protection', error);
            });
        };
    }, []);

    useEffect(() => {
        if (!ready) return;
        if (remaining <= 0) {
            callbacks.current.onClose();
            return;
        }
        const timer = setTimeout(() => setRemaining((value) => value - 1), 1000);
        return () => clearTimeout(timer);
    }, [ready, remaining]);

    return (
        <View style={styles.overlay} accessibilityViewIsModal>
            <Pressable
                accessibilityRole="button"
                accessibilityLabel={t('close', 'Close')}
                style={[styles.close, { top: insets.top + scale(14) }]}
                onPress={onClose}
            >
                <X size={scale(22)} color="#FFFFFF" />
            </Pressable>
            {ready && remaining > 0 ? (
                <>
                    <View style={[styles.countdown, { top: insets.top + scale(18) }]}>
                        <Text variant="caption" className="font-body-bold" style={{ color: '#FFFFFF' }}>{remaining}s</Text>
                    </View>
                    <Image source={{ uri: url }} style={styles.image} resizeMode="contain" onLoad={onLoaded} onError={onError} />
                </>
            ) : <ActivityIndicator color="#FFFFFF" />}
        </View>
    );
}

const styles = StyleSheet.create({
    overlay: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, backgroundColor: '#000000', alignItems: 'center', justifyContent: 'center', zIndex: 1000, elevation: 1000 },
    image: { width: '92%', height: '82%' },
    close: { position: 'absolute', right: scale(16), zIndex: 1, width: scale(44), height: scale(44), borderRadius: scale(22), backgroundColor: '#282828', alignItems: 'center', justifyContent: 'center' },
    countdown: { position: 'absolute', left: scale(16), zIndex: 1, paddingHorizontal: scale(12), paddingVertical: scale(5), borderRadius: scale(14), backgroundColor: '#282828' },
});
