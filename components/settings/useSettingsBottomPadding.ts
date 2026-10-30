import { Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { scale } from '@/hooks/useResponsive';

export function useSettingsBottomPadding() {
    const insets = useSafeAreaInsets();
    // Match the Settings hub's navigation clearance. Android's native tab
    // container already applies its bottom safe area; the iOS profile tab does not.
    return scale(120) + (Platform.OS === 'ios' ? insets.bottom : 0);
}
