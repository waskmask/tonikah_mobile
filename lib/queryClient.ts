import { QueryClient } from '@tanstack/react-query';

export const queryClient = new QueryClient({
    defaultOptions: {
        queries: {
            staleTime: 30_000,
            gcTime: 10 * 60_000,
            retry: 1,
            refetchOnMount: false,
            refetchOnReconnect: true,
        },
        mutations: {
            retry: false,
        },
    },
});
