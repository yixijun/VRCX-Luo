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
    groups?: {
        count: number;
        list: Array<{
            iconUrl?: string;
            id: string;
            name: string;
        }>;
    };
    publicWorlds?: Array<{
        id: string;
        authorId: string;
        name: string;
        created_at?: string;
        updated_at?: string;
        favorites?: number;
        popularity?: number;
        tags?: string[];
        thumbnailImageUrl?: string;
        occupants?: number;
        [key: string]: unknown;
    }>;
    totalPublicWorldsCount?: number;
    worldFavoriteLists?: Array<{
        count: number;
        id: string;
        name: string;
        thumbnails: string[];
    }>;
}

export type GetPublicProfile = (params: {
    userId: string;
    withGroupsAndWorlds?: boolean;
}) => Promise<{
    json: PublicProfile;
    params: { userId: string; withGroupsAndWorlds?: boolean };
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
