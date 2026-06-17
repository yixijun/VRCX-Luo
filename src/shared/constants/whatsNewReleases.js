const whatsNewReleases = Object.freeze({
    '2026.06.17': {
        items: [
            {
                key: 'remote_access',
                icon: 'monitor-smartphone'
            },
            {
                key: 'remote_actions',
                icon: 'mouse-pointer-click'
            },
            {
                key: 'remote_notifications',
                icon: 'bell'
            }
        ]
    },
    '2026.04.05': {
        items: [
            {
                key: 'quick_search',
                icon: 'search'
            },
            {
                key: 'local_favorite_groups',
                icon: 'folder-heart'
            },
            {
                key: 'auto_status',
                icon: 'refresh-cw'
            },
            {
                key: 'right_click_menus',
                icon: 'mouse-pointer-click'
            }
        ]
    }
});

/**
 * @param {string} version
 * @returns {string}
 */
function normalizeReleaseVersion(version) {
    const versionMatch = String(version || '')
        .replace(/^VRCX(?:-Luo)?(?:\s+Nightly)?\s+/, '')
        .match(/(\d{4})\.(\d{1,2})\.(\d{1,2})/);
    if (!versionMatch) {
        return '';
    }
    const [, year, month, day] = versionMatch;
    return `${year}.${month.padStart(2, '0')}.${day.padStart(2, '0')}`;
}

/**
 * @param {string} version
 * @returns {{titleKey: string, subtitleKey: string, items: Array<{key: string, icon: string, titleKey: string, descriptionKey: string}>} | null}
 */
function getWhatsNewRelease(version) {
    const normalizedVersion = normalizeReleaseVersion(version);
    if (!normalizedVersion) {
        return null;
    }
    const release = whatsNewReleases[normalizedVersion];
    if (!release) {
        return null;
    }

    const i18nKey = normalizedVersion.replaceAll('.', '_');
    const baseKey = `onboarding.whatsnew.releases.${i18nKey}`;
    return {
        titleKey: `${baseKey}.title`,
        subtitleKey: `${baseKey}.subtitle`,
        items: release.items.map((item) => ({
            ...item,
            titleKey: `${baseKey}.items.${item.key}.title`,
            descriptionKey: `${baseKey}.items.${item.key}.description`
        }))
    };
}

/**
 * @returns {{titleKey: string, subtitleKey: string, items: Array<{key: string, icon: string, titleKey: string, descriptionKey: string}>} | null}
 */
function getLatestWhatsNewRelease() {
    const versions = Object.keys(whatsNewReleases);
    if (versions.length === 0) {
        return null;
    }
    const latestVersion = versions.sort().at(-1);
    return getWhatsNewRelease(latestVersion);
}

export {
    getLatestWhatsNewRelease,
    getWhatsNewRelease,
    normalizeReleaseVersion,
    whatsNewReleases
};
