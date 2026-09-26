/**
 * Build the initial values for the current user's profile editor.
 *
 * Public profile data is loaded separately from the user resource. Keeping
 * this fallback local means the editor can render the cached profile while a
 * full self-profile request is still in flight.
 */
export function getProfileEditorSeed(currentUser = {}, userDialog = {}) {
    const profileSeed = {
        ...(userDialog.ref || {}),
        ...(userDialog.publicProfileRef || {})
    };
    const themes = Array.isArray(profileSeed.themes) ? profileSeed.themes.slice() : [];
    const selectedTheme = themes.find((theme) => theme.id === profileSeed.themeId);

    return {
        selfProfileRef: profileSeed,
        status: currentUser.status ?? profileSeed.status ?? '',
        statusDescription: currentUser.statusDescription ?? profileSeed.statusDescription ?? '',
        pronouns: profileSeed.pronouns ?? currentUser.pronouns ?? '',
        bio: profileSeed.bio ?? currentUser.bio ?? '',
        bioLinks: Array.isArray(profileSeed.bioLinks) ? profileSeed.bioLinks.slice() : [],
        bannerColor: profileSeed.bannerColor ?? currentUser.bannerColor ?? '',
        bannerUrl: profileSeed.bannerUrl ?? currentUser.bannerUrl ?? '',
        bannerType: profileSeed.bannerType ?? currentUser.bannerType ?? 'color',
        iconUrl: profileSeed.iconUrl ?? currentUser.iconUrl ?? '',
        themes,
        themeId: profileSeed.themeId ?? '',
        themeName: selectedTheme?.name ?? '',
        themeButtonColor: profileSeed.themeButtonColor ?? selectedTheme?.buttonColor ?? '',
        themeIconColor: profileSeed.themeIconColor ?? selectedTheme?.iconColor ?? '',
        themeSubtextColor: profileSeed.themeSubtextColor ?? selectedTheme?.subtextColor ?? '',
        backgroundType: profileSeed.backgroundType ?? 'default',
        backgroundTextureId: profileSeed.backgroundTextureId ?? '',
        backgroundGradientBottom: profileSeed.backgroundGradientBottom ?? '',
        backgroundGradientTop: profileSeed.backgroundGradientTop ?? '',
        nameplateEffect: profileSeed.nameplateEffect ?? '',
        profileEffect: profileSeed.profileEffect ?? '',
        iconFrame: profileSeed.iconFrame ?? ''
    };
}

/**
 * Build the values for the compact bio editor used from the info tab.
 */
export function getBioEditorSeed(currentUser = {}, userDialog = {}) {
    const publicProfile = userDialog.publicProfileRef || {};
    const userProfile = userDialog.ref || {};
    const bioLinks = Array.isArray(publicProfile.bioLinks)
        ? publicProfile.bioLinks
        : Array.isArray(userProfile.bioLinks)
          ? userProfile.bioLinks
          : Array.isArray(currentUser.bioLinks)
            ? currentUser.bioLinks
            : [];

    return {
        bio: publicProfile.bio ?? userProfile.bio ?? currentUser.bio ?? '',
        bioLinks: bioLinks.slice()
    };
}
