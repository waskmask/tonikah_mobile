import React, { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import { useWindowDimensions } from 'react-native';
import ReanimatedDrawerLayout, {
    DrawerLockMode,
    DrawerPosition,
    DrawerType,
    type DrawerLayoutMethods,
} from 'react-native-gesture-handler/ReanimatedDrawerLayout';

import { AppMenuDrawerContent } from '@/components/app/AppMenuDrawer';
import { useLanguage } from '@/hooks/useLanguage';
import { useTheme } from '@/hooks/useTheme';

type RootAppMenuContextValue = {
    openMenu: () => void;
};

const RootAppMenuContext = createContext<RootAppMenuContextValue | null>(null);

export function useRootAppMenu() {
    return useContext(RootAppMenuContext);
}

export function RootAppMenuDrawer({ children }: { children: React.ReactNode }) {
    const drawerRef = useRef<DrawerLayoutMethods>(null);
    const [isOpen, setIsOpen] = useState(false);
    const { width } = useWindowDimensions();
    const { isRTL } = useLanguage();
    const { isDark } = useTheme();
    const drawerWidth = Math.min(width * 0.86, 360);

    const openMenu = useCallback(() => {
        drawerRef.current?.openDrawer();
    }, []);
    const closeMenu = useCallback(() => {
        drawerRef.current?.closeDrawer();
    }, []);
    const contextValue = useMemo(() => ({ openMenu }), [openMenu]);

    return (
        <RootAppMenuContext.Provider value={contextValue}>
            <ReanimatedDrawerLayout
                ref={drawerRef}
                drawerWidth={drawerWidth}
                drawerPosition={isRTL ? DrawerPosition.LEFT : DrawerPosition.RIGHT}
                drawerType={DrawerType.FRONT}
                drawerLockMode={DrawerLockMode.LOCKED_CLOSED}
                drawerBackgroundColor="transparent"
                overlayColor={isDark ? 'rgba(0,0,0,0.58)' : 'rgba(16,16,17,0.45)'}
                onDrawerOpen={() => setIsOpen(true)}
                onDrawerClose={() => setIsOpen(false)}
                renderNavigationView={() => (
                    <AppMenuDrawerContent onClose={closeMenu} isOpen={isOpen} />
                )}
            >
                {children}
            </ReanimatedDrawerLayout>
        </RootAppMenuContext.Provider>
    );
}
