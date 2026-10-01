export type ChatRelationship = 'none' | 'active' | 'pending' | 'other';

type StatusPayload = {
    status?: unknown;
    relationshipStatus?: unknown;
    conversationId?: string | null;
    requestRole?: string | null;
};

export function chatRelationship(payload: StatusPayload, metadataState?: string | null): ChatRelationship | null {
    const direct = payload.relationshipStatus || (typeof payload.status === 'string' ? payload.status : null);
    if (direct === 'none' || direct === 'active' || direct === 'pending' || direct === 'other') return direct;
    if (!payload.conversationId) return 'none';
    if (payload.requestRole === 'incoming' || payload.requestRole === 'sent') return 'pending';
    if (metadataState === 'active') return 'active';
    if (metadataState === 'request_pending') return 'pending';
    if (metadataState === 'ended') return 'other';
    return null;
}
