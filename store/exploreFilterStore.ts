import { create } from 'zustand';
import { ExploreFilterState, resetExploreFilters } from '@/lib/exploreFilters';

type ExploreFilterStore = {
    filtersByAccount: Record<string, ExploreFilterState>;
    setFilters: (accountId: string, filters: ExploreFilterState) => void;
    clearFilters: (accountId: string) => void;
};

/** Keeps Explore filters while the app process is alive without surprising users across launches. */
export const useExploreFilterStore = create<ExploreFilterStore>((set) => ({
    filtersByAccount: {},
    setFilters: (accountId, filters) => set((state) => ({
        filtersByAccount: { ...state.filtersByAccount, [accountId]: filters },
    })),
    clearFilters: (accountId) => set((state) => ({
        filtersByAccount: { ...state.filtersByAccount, [accountId]: resetExploreFilters() },
    })),
}));
