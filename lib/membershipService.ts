import { api, ApiResponse } from './api';

export const membershipService = {
    me: (): Promise<ApiResponse> => api.get('/membership/me'),
    plans: (): Promise<ApiResponse> => api.get('/membership/plans'),
    startTrial: (planSlugOrId?: string): Promise<ApiResponse> =>
        api.post('/membership/trial/start', { planSlugOrId }),
};
