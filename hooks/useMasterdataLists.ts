import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
    fetchMasterdataVersion,
    getMemoryMasterdata,
    isMasterdataFresh,
    MasterdataItem,
    readMasterdataCache,
    refreshMasterdata,
} from '@/lib/masterdataCache';
import { queryClient } from '@/lib/queryClient';
import { queryKeys } from '@/lib/queryKeys';

export type MasterdataLoadStatus = 'loading' | 'ready' | 'error';

function initialState(types: readonly string[], language: string) {
    const data: Record<string, MasterdataItem[]> = {};
    const status: Record<string, MasterdataLoadStatus> = {};
    for (const type of types) {
        const cached = getMemoryMasterdata(type, language);
        data[type] = cached?.items || [];
        status[type] = cached ? 'ready' : 'loading';
    }
    return { data, status };
}

export function useMasterdataLists(types: readonly string[], language: string) {
    const typesKey = types.join('|');
    const generationRef = useRef(0);
    const initial = useMemo(() => initialState(types, language), [language, typesKey]);
    const [data, setData] = useState<Record<string, MasterdataItem[]>>(initial.data);
    const [statusByType, setStatusByType] = useState<Record<string, MasterdataLoadStatus>>(initial.status);

    const publish = useCallback((type: string, items: MasterdataItem[]) => {
        setData((current) => ({ ...current, [type]: items }));
        queryClient.setQueryData<Record<string, MasterdataItem[]>>(
            queryKeys.masterdata.editProfile(language),
            (current = {}) => ({ ...current, [type]: items }),
        );
    }, [language]);

    const loadType = useCallback(async (type: string, generation: number, force = false) => {
        const cached = await readMasterdataCache(type, language);
        if (generation !== generationRef.current) return;

        if (cached) {
            publish(type, cached.items);
            setStatusByType((current) => ({ ...current, [type]: 'ready' }));
        } else {
            setStatusByType((current) => ({ ...current, [type]: 'loading' }));
        }

        const serverVersion = await fetchMasterdataVersion();
        if (generation !== generationRef.current) return;
        const versionChanged = Boolean(serverVersion && cached?.version !== serverVersion);
        if (!force && cached && isMasterdataFresh(cached) && !versionChanged) return;

        try {
            const fresh = await refreshMasterdata(type, language, serverVersion);
            if (generation !== generationRef.current) return;
            publish(type, fresh.items);
            setStatusByType((current) => ({ ...current, [type]: 'ready' }));
        } catch {
            if (generation !== generationRef.current) return;
            setStatusByType((current) => ({ ...current, [type]: cached ? 'ready' : 'error' }));
        }
    }, [language, publish]);

    useEffect(() => {
        const generation = generationRef.current + 1;
        generationRef.current = generation;
        const next = initialState(types, language);
        setData(next.data);
        setStatusByType(next.status);
        types.forEach((type) => void loadType(type, generation));
        return () => {
            if (generationRef.current === generation) generationRef.current += 1;
        };
    }, [language, loadType, typesKey]);

    const retry = useCallback((type: string) => {
        const generation = generationRef.current;
        setStatusByType((current) => ({ ...current, [type]: 'loading' }));
        void loadType(type, generation, true);
    }, [loadType]);

    const revalidate = useCallback(() => {
        const generation = generationRef.current;
        types.forEach((type) => void loadType(type, generation));
    }, [loadType, typesKey]);

    return { data, statusByType, retry, revalidate };
}
