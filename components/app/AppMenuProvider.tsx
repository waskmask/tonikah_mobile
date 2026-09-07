import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { AppMenuDrawer } from '@/components/app/AppMenuDrawer';
import { markInteraction } from '@/lib/performanceDiagnostics';

type AppMenuContextValue = {
    openMenu: () => void;
    closeMenu: () => void;
};

const AppMenuContext = createContext<AppMenuContextValue | null>(null);

export function AppMenuProvider({ children }: { children: React.ReactNode }) {
    const [visible, setVisible] = useState(false);
    const openMenu = useCallback(() => {
        markInteraction('drawer');
        setVisible(true);
    }, []);
    const closeMenu = useCallback(() => setVisible(false), []);
    const value = useMemo(() => ({ openMenu, closeMenu }), [closeMenu, openMenu]);

    return (
        <AppMenuContext.Provider value={value}>
            {children}
            <AppMenuDrawer visible={visible} onClose={closeMenu} />
        </AppMenuContext.Provider>
    );
}

export function useAppMenu() {
    const context = useContext(AppMenuContext);
    if (!context) throw new Error('useAppMenu must be used inside AppMenuProvider');
    return context;
}
