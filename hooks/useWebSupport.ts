import { useCallback } from 'react';
import { useLanguage } from '@/hooks/useLanguage';
import { useToast } from '@/hooks/useToast';
import { openWebSupport } from '@/lib/webSupport';

export function useWebSupport() {
    const { currentLanguage, t } = useLanguage();
    const toast = useToast();

    return useCallback(async () => {
        try {
            await openWebSupport(currentLanguage);
        } catch {
            toast.show(
                String(t('support_open_failed', { defaultValue: 'Could not open support. Please try again.' })),
                'error',
            );
        }
    }, [currentLanguage, t, toast]);
}
