/**
 * Public profile payload returned by GET /api/1/profile/:userId.
 *
 * VRChat keeps presence/relationship data in the user resource, while these
 * fields describe the profile shown to other users. Most fields are optional
 * because older accounts and compatibility responses may omit them.
 */
export interface PublicProfile {
    ageVerificationStatus?: string;
    ageVerified?: boolean;
    backgroundGradientBottom?: string;
    backgroundGradientTop?: string;
    backgroundTextureId?: string;
    backgroundType?: string;
    badges?: unknown[];
    bannerColor?: string;
    bannerType?: string;
    bannerUrl?: string;
    bio?: string;
    bioLinks?: string[];
    displayName?: string;
    hasVrcPlus?: boolean;
    iconFrame?: string;
    iconUrl?: string;
    id?: string;
    isEconomyCreator?: boolean;
    languages?: string[];
    nameplateEffect?: string;
    profileEffect?: string;
    pronouns?: string;
    representedGroup?: unknown;
    themeButtonColor?: string;
    themeIconColor?: string;
    themeId?: string;
    themeSubtextColor?: string;
    trustTags?: string[];
}

export type GetPublicProfile = (params: { userId: string }) => Promise<{
    json: PublicProfile;
    params: { userId: string };
}>;

export interface SelfProfile extends PublicProfile {
    bioLinks?: string[];
    themes?: Array<{
        id: string;
        name: string;
        buttonColor?: string;
        iconColor?: string;
        subtextColor?: string;
    }>;
    userIcon?: string;
}
