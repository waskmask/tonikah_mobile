import { api, ApiResponse } from './api';

export type ReportEntityType = 'User' | 'Image';

export type CreateReportInput = {
    entityType: ReportEntityType;
    /** Image uuid for image reports (falls back to the user id), user id otherwise. */
    entityId: string;
    reason: 'spam' | 'inappropriate' | 'scam' | 'harassment' | 'other';
    description?: string;
    /** Direct URL of the reported image (Image reports only). */
    imageUrl?: string;
};

/** POST /api/reports — same multipart shape the Next.js ReportModal sends. */
export const reportsService = {
    create: (input: CreateReportInput): Promise<ApiResponse> => {
        const formData = new FormData();
        formData.append('reportedEntityType', input.entityType);
        formData.append('reportedEntityId', input.entityId);
        formData.append('reason', input.reason);
        if (input.description?.trim()) formData.append('description', input.description.trim());
        if (input.entityType === 'Image' && input.imageUrl) formData.append('imageUrl', input.imageUrl);
        return api.post('/reports', formData);
    },
};
