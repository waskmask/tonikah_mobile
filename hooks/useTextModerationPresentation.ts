import { useCallback, useEffect, useRef, useState } from 'react';
import { Platform } from 'react-native';
import type { TextModerationWarning } from '@/lib/textModeration';

type Phase = 'editor' | 'closing-editor' | 'warning' | 'closing-warning';
type Presentation = { phase: Phase; warning: TextModerationWarning | null };

/** Serialize native modal presentations without discarding the editor's draft. */
export function useTextModerationPresentation(editorOpen: boolean) {
    const editorOpenRef = useRef(editorOpen);
    editorOpenRef.current = editorOpen;
    const [presentation, setPresentation] = useState<Presentation>({ phase: 'editor', warning: null });

    const setModerationWarning = useCallback((warning: TextModerationWarning | null) => {
        setPresentation((current) => {
            if (warning) {
                return {
                    warning,
                    phase: current.phase === 'closing-editor' || current.phase === 'closing-warning'
                        ? current.phase
                        : current.phase === 'editor' && editorOpenRef.current ? 'closing-editor' : 'warning',
                };
            }
            return { warning: null, phase: current.phase === 'warning' ? 'closing-warning' : current.phase };
        });
    }, []);

    const onEditorDismiss = useCallback(() => {
        setPresentation((current) => current.phase === 'closing-editor'
            ? { ...current, phase: current.warning ? 'warning' : 'editor' }
            : current);
    }, []);

    const onWarningDismiss = useCallback(() => {
        setPresentation((current) => current.phase === 'closing-warning'
            ? { ...current, phase: current.warning ? 'warning' : 'editor' }
            : current);
    }, []);

    useEffect(() => {
        // RN's native onDismiss is iOS-only. Android finishes hiding on commit.
        if (Platform.OS === 'ios') return;
        const finish = presentation.phase === 'closing-editor' ? onEditorDismiss
            : presentation.phase === 'closing-warning' ? onWarningDismiss : null;
        if (!finish) return;
        const frame = requestAnimationFrame(finish);
        return () => cancelAnimationFrame(frame);
    }, [presentation.phase, onEditorDismiss, onWarningDismiss]);

    return {
        moderationWarning: presentation.phase === 'warning' ? presentation.warning : null,
        setModerationWarning,
        editorSuspended: presentation.phase !== 'editor',
        onEditorDismiss,
        onWarningDismiss,
    };
}
