import { useEffect, useState } from 'react';
import { AccessibilityInfo } from 'react-native';

export function useReducedMotion() {
    const [reduceMotion, setReduceMotion] = useState(false);

    useEffect(() => {
        let mounted = true;
        AccessibilityInfo.isReduceMotionEnabled()
            .then((enabled) => {
                if (mounted) setReduceMotion(enabled);
            })
            .catch(() => undefined);

        const subscription = AccessibilityInfo.addEventListener?.('reduceMotionChanged', (enabled) => {
            setReduceMotion(enabled);
        });

        return () => {
            mounted = false;
            subscription?.remove?.();
        };
    }, []);

    return reduceMotion;
}
