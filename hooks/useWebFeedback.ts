import { useCallback } from 'react';
import { useLanguage } from '@/hooks/useLanguage';
import { useToast } from '@/hooks/useToast';
import { openWebFeedback } from '@/lib/webFeedback';

export function useWebFeedback() {
    const { currentLanguage, t } = useLanguage();
    const toast = useToast();

    return useCallback(async () => {
        try {
            await openWebFeedback(currentLanguage);
        } catch {
            toast.show(
                String(t('feedback_open_failed', { defaultValue: 'Could not open feedback. Please try again.' })),
                'error',
            );
        }
    }, [currentLanguage, t, toast]);
}
