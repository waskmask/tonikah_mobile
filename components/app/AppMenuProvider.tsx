import React, { createContext, useContext } from 'react';
import { useRootAppMenu } from '@/components/app/RootAppMenuDrawer';

type AppMenuContextValue = {
    openMenu: () => void;
    closeMenu: () => void;
};

const AppMenuContext = createContext<AppMenuContextValue | null>(null);

export function AppMenuProvider({ children }: { children: React.ReactNode }) {
    const value = useRootAppMenu();
    if (!value) throw new Error('AppMenuProvider must be used inside RootAppMenuDrawer');

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
