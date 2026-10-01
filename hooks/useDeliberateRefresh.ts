import { useCallback, useEffect, useRef } from 'react';
import type { NativeScrollEvent, NativeSyntheticEvent, NativeTouchEvent } from 'react-native';
import { scale } from '@/hooks/useResponsive';

const PULL_THRESHOLD = scale(90);
const TOP_TOLERANCE = scale(2);

export function useDeliberateRefresh(onRefresh?: () => void, enabled = true) {
    const scrollYRef = useRef(0);
    const touchStartYRef = useRef<number | null>(null);
    const startedAtTopRef = useRef(false);
    const maxPullRef = useRef(0);
    const resetTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const clearGesture = useCallback(() => {
        touchStartYRef.current = null;
        startedAtTopRef.current = false;
        maxPullRef.current = 0;
    }, []);

    useEffect(() => () => {
        if (resetTimerRef.current) clearTimeout(resetTimerRef.current);
    }, []);

    const onScroll = useCallback((event: NativeSyntheticEvent<NativeScrollEvent>) => {
        scrollYRef.current = Math.max(0, event.nativeEvent.contentOffset.y);
    }, []);

    const onTouchStart = useCallback((event: NativeSyntheticEvent<NativeTouchEvent>) => {
        if (resetTimerRef.current) clearTimeout(resetTimerRef.current);
        touchStartYRef.current = event.nativeEvent.pageY;
        startedAtTopRef.current = scrollYRef.current <= TOP_TOLERANCE;
        maxPullRef.current = 0;
    }, []);

    const onTouchMove = useCallback((event: NativeSyntheticEvent<NativeTouchEvent>) => {
        if (!startedAtTopRef.current || touchStartYRef.current === null) return;
        maxPullRef.current = Math.max(
            maxPullRef.current,
            event.nativeEvent.pageY - touchStartYRef.current,
        );
    }, []);

    const finishTouch = useCallback(() => {
        // Native RefreshControl invokes onRefresh around touch release. Keep the
        // gesture data briefly so the callback can verify the completed pull.
        resetTimerRef.current = setTimeout(clearGesture, 400);
    }, [clearGesture]);

    const guardedRefresh = useCallback(() => {
        if (!enabled || !startedAtTopRef.current || maxPullRef.current < PULL_THRESHOLD) return;
        onRefresh?.();
    }, [enabled, onRefresh]);

    return {
        onScroll,
        onTouchStart,
        onTouchMove,
        onTouchEnd: finishTouch,
        onTouchCancel: finishTouch,
        guardedRefresh,
    };
}
