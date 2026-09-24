import type { ReportEntityType } from '@/lib/reportsService';

export const PROFILE_REPORT_DETAILS = {
    fake_or_impersonation: ['using_another_identity', 'misleading_identity', 'stolen_profile_photos', 'other_fake_profile'],
    scam_or_money_request: ['asked_for_money', 'investment_or_crypto', 'suspicious_link', 'romance_scam'],
    underage: ['says_under_18', 'appears_under_18', 'admitted_false_age'],
    harassment_or_abuse: ['threats_or_intimidation', 'sexual_harassment', 'hate_or_discrimination', 'repeated_unwanted_contact'],
    inappropriate_content: ['sexual_content', 'violent_content', 'offensive_language', 'contact_details_or_social_media'],
    spam_or_promotion: ['advertising_or_sales', 'repeated_messages', 'redirecting_off_app'],
} as const;

export const IMAGE_REPORT_DETAILS = {
    nudity_or_sexual_content: ['nudity', 'sexually_suggestive', 'explicit_sexual_act'],
    fake_or_stolen_photo: ['celebrity_or_public_figure', 'stock_or_ai_generated', 'belongs_to_someone_else', 'heavily_misleading_photo'],
    hate_or_offensive_content: ['hate_symbol', 'discriminatory_content', 'obscene_gesture'],
    violence_or_disturbing_content: ['graphic_violence', 'weapon_or_threat', 'self_harm', 'other_disturbing_content'],
    personal_information: ['phone_or_email_visible', 'social_media_handle_visible', 'address_or_document_visible'],
} as const;

export type ReportReason = keyof typeof PROFILE_REPORT_DETAILS | keyof typeof IMAGE_REPORT_DETAILS | 'other';
export type ReportReasonDetail =
    | (typeof PROFILE_REPORT_DETAILS)[keyof typeof PROFILE_REPORT_DETAILS][number]
    | (typeof IMAGE_REPORT_DETAILS)[keyof typeof IMAGE_REPORT_DETAILS][number];

export function reportReasons(entityType: ReportEntityType): ReportReason[] {
    return [
        ...Object.keys(entityType === 'Image' ? IMAGE_REPORT_DETAILS : PROFILE_REPORT_DETAILS),
        'other',
    ] as ReportReason[];
}

export function reportDetails(entityType: ReportEntityType, reason: ReportReason | null): ReportReasonDetail[] {
    if (!reason || reason === 'other') return [];
    const taxonomy = entityType === 'Image' ? IMAGE_REPORT_DETAILS : PROFILE_REPORT_DETAILS;
    return [...((taxonomy as Record<string, readonly ReportReasonDetail[]>)[reason] || [])];
}

export const REPORT_REASON_FALLBACKS: Record<ReportReason, string> = {
    fake_or_impersonation: 'Fake profile or impersonation',
    scam_or_money_request: 'Scam or money request',
    underage: 'Underage user',
    harassment_or_abuse: 'Harassment or abuse',
    inappropriate_content: 'Inappropriate content',
    spam_or_promotion: 'Spam or promotion',
    nudity_or_sexual_content: 'Nudity or sexual content',
    fake_or_stolen_photo: 'Fake or stolen photo',
    hate_or_offensive_content: 'Hateful or offensive content',
    violence_or_disturbing_content: 'Violence or disturbing content',
    personal_information: 'Personal information',
    other: 'Something else',
};

export const REPORT_REASON_DESCRIPTION_FALLBACKS: Record<ReportReason, string> = {
    fake_or_impersonation: 'Another identity, misleading details, or stolen profile photos.',
    scam_or_money_request: 'Money requests, suspicious links, investments, or romance scams.',
    underage: 'The person says or appears to be under 18.',
    harassment_or_abuse: 'Threats, sexual harassment, discrimination, or unwanted contact.',
    inappropriate_content: 'Sexual, violent, offensive, or promotional profile content.',
    spam_or_promotion: 'Advertising, repeated messages, or redirection outside the app.',
    nudity_or_sexual_content: 'Nudity, sexually suggestive content, or explicit sexual activity.',
    fake_or_stolen_photo: 'A celebrity, AI-generated image, stolen photo, or misleading alteration.',
    hate_or_offensive_content: 'Hate symbols, discriminatory content, or obscene gestures.',
    violence_or_disturbing_content: 'Violence, weapons, threats, self-harm, or disturbing imagery.',
    personal_information: 'Phone, email, social media, address, or identity documents.',
    other: 'A different issue not listed above.',
};

export const REPORT_DETAIL_FALLBACKS: Record<ReportReasonDetail, string> = {
    using_another_identity: "Using another person's identity",
    misleading_identity: 'Misleading identity information',
    stolen_profile_photos: 'Stolen profile photos',
    other_fake_profile: 'Another fake-profile issue',
    asked_for_money: 'Asked me for money',
    investment_or_crypto: 'Investment or cryptocurrency scheme',
    suspicious_link: 'Sent a suspicious link',
    romance_scam: 'Romance scam',
    says_under_18: 'Says they are under 18',
    appears_under_18: 'Appears to be under 18',
    admitted_false_age: 'Admitted using a false age',
    threats_or_intimidation: 'Threats or intimidation',
    sexual_harassment: 'Sexual harassment',
    hate_or_discrimination: 'Hate or discrimination',
    repeated_unwanted_contact: 'Repeated unwanted contact',
    sexual_content: 'Sexual content',
    violent_content: 'Violent content',
    offensive_language: 'Offensive language',
    contact_details_or_social_media: 'Contact details or social media promotion',
    advertising_or_sales: 'Advertising or selling',
    repeated_messages: 'Repeated unwanted messages',
    redirecting_off_app: 'Redirecting people outside the app',
    nudity: 'Nudity',
    sexually_suggestive: 'Sexually suggestive content',
    explicit_sexual_act: 'Explicit sexual activity',
    celebrity_or_public_figure: 'Celebrity or public figure',
    stock_or_ai_generated: 'Stock or AI-generated image',
    belongs_to_someone_else: 'Belongs to someone else',
    heavily_misleading_photo: 'Heavily altered or misleading',
    hate_symbol: 'Hate symbol',
    discriminatory_content: 'Discriminatory content',
    obscene_gesture: 'Obscene gesture',
    graphic_violence: 'Graphic violence',
    weapon_or_threat: 'Weapon or threat',
    self_harm: 'Self-harm',
    other_disturbing_content: 'Other disturbing content',
    phone_or_email_visible: 'Phone number or email',
    social_media_handle_visible: 'Social media username',
    address_or_document_visible: 'Address or identity document',
};

export const REPORT_DETAIL_DESCRIPTION_FALLBACKS: Record<ReportReasonDetail, string> = {
    using_another_identity: 'They appear to be pretending to be a real person.',
    misleading_identity: 'Their name, age, location, or other identity details seem false.',
    stolen_profile_photos: 'Their profile photos appear to have been taken from someone else.',
    other_fake_profile: 'Another sign suggests this profile is not genuine.',
    asked_for_money: 'They requested money, gifts, transfers, or financial help.',
    investment_or_crypto: 'They promoted an investment, trading, or cryptocurrency opportunity.',
    suspicious_link: 'They sent a link that may steal information or install harmful software.',
    romance_scam: 'They built romantic trust to ask for money or personal information.',
    says_under_18: 'They stated that they are younger than 18.',
    appears_under_18: 'Their photos or behavior suggest they may be younger than 18.',
    admitted_false_age: 'They said the age shown on their profile is not their real age.',
    threats_or_intimidation: 'They threatened, intimidated, or tried to frighten someone.',
    sexual_harassment: 'They sent unwanted sexual comments, requests, or behavior.',
    hate_or_discrimination: 'They targeted someone because of identity, religion, ethnicity, or another protected trait.',
    repeated_unwanted_contact: 'They continued contacting someone after being asked to stop.',
    sexual_content: 'Their profile contains sexual language, images, or requests.',
    violent_content: 'Their profile promotes or displays violence or harm.',
    offensive_language: 'Their profile contains abusive, degrading, or obscene language.',
    contact_details_or_social_media: 'Their profile promotes contact details or social media accounts.',
    advertising_or_sales: 'They are promoting products, services, or commercial offers.',
    repeated_messages: 'They repeatedly send the same or unwanted promotional messages.',
    redirecting_off_app: 'They are trying to move people to another app, website, or service.',
    nudity: 'The photo shows exposed intimate body parts.',
    sexually_suggestive: 'The photo uses sexual poses, clothing, or framing.',
    explicit_sexual_act: 'The photo depicts explicit sexual activity.',
    celebrity_or_public_figure: 'The photo appears to show a celebrity or public figure.',
    stock_or_ai_generated: 'The photo appears to be stock imagery or generated by AI.',
    belongs_to_someone_else: 'The photo appears to belong to a different person.',
    heavily_misleading_photo: 'The photo is edited or framed in a way that misrepresents the person.',
    hate_symbol: 'The photo displays a symbol associated with hate or extremism.',
    discriminatory_content: 'The photo attacks or degrades people based on a protected trait.',
    obscene_gesture: 'The photo shows an offensive or obscene hand gesture.',
    graphic_violence: 'The photo shows severe injury, blood, or graphic violence.',
    weapon_or_threat: 'The photo shows a weapon being used to threaten or intimidate.',
    self_harm: 'The photo depicts or encourages self-harm.',
    other_disturbing_content: 'The photo contains other shocking or disturbing imagery.',
    phone_or_email_visible: 'A phone number or email address is visible in the photo.',
    social_media_handle_visible: 'A social media username or account is visible in the photo.',
    address_or_document_visible: 'A home address, identity document, or other sensitive record is visible.',
};
