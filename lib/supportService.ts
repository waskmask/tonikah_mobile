import { api, ApiResponse } from './api';

export const supportService = {
    createTicket: (body: {
        name?: string;
        email?: string;
        city?: string;
        language?: string;
        type: string;
        subject: string;
        message: string;
        page?: string;
        timezone?: string;
    }): Promise<ApiResponse> => api.post('/support/tickets', body),
};
