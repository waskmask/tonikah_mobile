import { useCallback, useRef } from 'react';
import type { FlatList } from 'react-native';
import { scale } from '@/hooks/useResponsive';

export const CHAT_NEAR_BOTTOM_THRESHOLD = scale(48);

type ScrollMetrics = {
    offset: number;
    layoutHeight: number;
    contentHeight: number;
};

export function isNearBottomScroll(
    scrollOffset: number,
    layoutHeight: number,
    contentHeight: number,
    threshold = CHAT_NEAR_BOTTOM_THRESHOLD,
) {
    if (contentHeight <= layoutHeight) return true;
    return scrollOffset + layoutHeight >= contentHeight - threshold;
}

export function useChatScrollAnchor<T>() {
    const isNearBottomRef = useRef(true);
    const scrollMetricsRef = useRef<ScrollMetrics>({
        offset: 0,
        layoutHeight: 0,
        contentHeight: 0,
    });

    const updateScrollMetrics = useCallback((
        offset: number,
        layoutHeight: number,
        contentHeight: number,
    ) => {
        scrollMetricsRef.current = { offset, layoutHeight, contentHeight };
        isNearBottomRef.current = isNearBottomScroll(offset, layoutHeight, contentHeight);
    }, []);

    const snapToLatest = useCallback((
        listRef: React.RefObject<FlatList<T> | null>,
        itemCount: number,
        animated = false,
    ) => {
        if (itemCount <= 0) return;

        const lastIndex = itemCount - 1;

        requestAnimationFrame(() => {
            try {
                listRef.current?.scrollToIndex({
                    index: lastIndex,
                    viewPosition: 1,
                    animated,
                });
            } catch {
                listRef.current?.scrollToEnd({ animated });
                listRef.current?.scrollToOffset({
                    offset: Number.MAX_SAFE_INTEGER,
                    animated: false,
                });
            }
        });
    }, []);

    const snapToLatestWithRetry = useCallback((
        listRef: React.RefObject<FlatList<T> | null>,
        itemCount: number,
        retries = 2,
        onComplete?: () => void,
    ) => {
        if (itemCount <= 0) {
            onComplete?.();
            return;
        }

        let attemptsLeft = retries;

        const run = () => {
            snapToLatest(listRef, itemCount, false);
            requestAnimationFrame(() => {
                if (attemptsLeft > 0) {
                    attemptsLeft -= 1;
                    run();
                    return;
                }
                isNearBottomRef.current = true;
                onComplete?.();
            });
        };

        run();
    }, [snapToLatest]);

    return {
        isNearBottomRef,
        scrollMetricsRef,
        updateScrollMetrics,
        snapToLatest,
        snapToLatestWithRetry,
    };
}
