export type ProfileVerificationFlags = {
    phone: boolean;
    age: boolean;
    selfie: boolean;
};

export type ProfileVerificationSource = {
    phone?: { verified?: boolean };
    verified?: Partial<ProfileVerificationFlags> | boolean;
    verified_account?: Partial<ProfileVerificationFlags>;
} | null | undefined;

export function getProfileVerificationFlags(profile: ProfileVerificationSource): ProfileVerificationFlags {
    const sources = [profile?.verified, profile?.verified_account].filter(
        (value): value is Partial<ProfileVerificationFlags> => typeof value === 'object' && value !== null,
    );

    return {
        phone: profile?.phone?.verified === true || sources.some((value) => value.phone === true),
        age: sources.some((value) => value.age === true),
        selfie: sources.some((value) => value.selfie === true),
    };
}

export function hasProfileVerification(flags: ProfileVerificationFlags): boolean {
    return flags.phone || flags.age || flags.selfie;
}

export function isVerifiedProfile(profile: ProfileVerificationSource): boolean {
    return hasProfileVerification(getProfileVerificationFlags(profile));
}
