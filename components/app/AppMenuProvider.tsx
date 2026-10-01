import React, { createContext, useCallback, useContext, useMemo } from 'react';
import { useNavigation } from 'expo-router';
import { markInteraction } from '@/lib/performanceDiagnostics';

type AppMenuContextValue = {
    openMenu: () => void;
    closeMenu: () => void;
};

const AppMenuContext = createContext<AppMenuContextValue | null>(null);

export function AppMenuProvider({ children }: { children: React.ReactNode }) {
    const drawerNavigation = useNavigation('/(tabs)') as unknown as {
        openDrawer: () => void;
        closeDrawer: () => void;
    };
    const openMenu = useCallback(() => {
        markInteraction('drawer');
        drawerNavigation.openDrawer();
    }, [drawerNavigation]);
    const closeMenu = useCallback(() => drawerNavigation.closeDrawer(), [drawerNavigation]);
    const value = useMemo(() => ({ openMenu, closeMenu }), [closeMenu, openMenu]);

    return (
        <AppMenuContext.Provider value={value}>
            {children}
        </AppMenuContext.Provider>
    );
}

export function useAppMenu() {
    const context = useContext(AppMenuContext);
    if (!context) throw new Error('useAppMenu must be used inside AppMenuProvider');
    return context;
}
