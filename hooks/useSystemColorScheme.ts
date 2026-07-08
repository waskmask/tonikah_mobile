import { useEffect, useState } from 'react';
import { Appearance, AppState, ColorSchemeName, useColorScheme } from 'react-native';

/**
 * Like RN's useColorScheme, but reliable across backgrounding: the OS theme
 * usually changes while the app is paused (user is in device settings), and
 * Android doesn't always deliver the Appearance event to a paused app. This
 * re-reads the scheme every time the app returns to the foreground.
 */
export function useSystemColorScheme(): ColorSchemeName | null {
    const live = useColorScheme();
    const [scheme, setScheme] = useState<ColorSchemeName | null>(live ?? null);

    useEffect(() => {
        setScheme(live ?? null);
    }, [live]);

    useEffect(() => {
        const subscription = AppState.addEventListener('change', (state) => {
            if (state === 'active') {
                setScheme(Appearance.getColorScheme() ?? null);
            }
        });
        return () => subscription.remove();
    }, []);

    return scheme;
}
