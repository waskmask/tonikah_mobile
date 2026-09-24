import { api, ApiResponse } from './api';

export type ReportEntityType = 'User' | 'Image';

export type CreateReportInput = {
    entityType: ReportEntityType;
    /** Image uuid for image reports (falls back to the user id), user id otherwise. */
    entityId: string;
    /** Owner account id required to resolve an image embedded in a profile gallery. */
    reportedUserId?: string;
    reason: string;
    reasonDetail?: string;
    reportVersion?: 1 | 2;
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
        if (input.entityType === 'Image' && input.reportedUserId) {
            formData.append('reportedUserId', input.reportedUserId);
        }
        formData.append('reason', input.reason);
        if (input.reasonDetail) formData.append('reasonDetail', input.reasonDetail);
        formData.append('reportVersion', String(input.reportVersion || 2));
        if (input.description?.trim()) formData.append('description', input.description.trim());
        if (input.entityType === 'Image' && input.imageUrl) formData.append('imageUrl', input.imageUrl);
        return api.postFormData('/reports', formData);
    },
};
