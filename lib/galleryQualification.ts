export type GalleryQualificationItem = {
    uuid?: string;
    safe?: boolean;
    moderationMeta?: { status?: string };
};

export function isQualifiedGalleryImage(item: GalleryQualificationItem) {
    const status = item.moderationMeta?.status;
    const isLegacyImage = typeof item.safe !== 'boolean' && !status;
    return isLegacyImage || (item.safe === true && status === 'approved');
}

export function hasQualifiedGalleryImage(items: GalleryQualificationItem[] = []) {
    return items.some(isQualifiedGalleryImage);
}
