const fs = require('fs');
const path = require('path');

const NIGHTLY_HASH_LENGTH = 7;
const DEFAULT_VERSION_FILE_PATH = path.join(__dirname, '..', 'Version');

function getUtcDateVersion(now = new Date()) {
    return now.toISOString().split('T')[0].replaceAll('-', '.');
}

function normalizeVersionText(versionText) {
    return typeof versionText === 'string' ? versionText.trim() : '';
}

function isNightlyVersion(versionText) {
    const normalizedVersion = normalizeVersionText(versionText);
    const versionParts = normalizedVersion.split('-');
    return versionParts.at(-1)?.length === NIGHTLY_HASH_LENGTH;
}

function toPackageVersion(versionText, fallbackPackageVersion = '') {
    const normalizedVersion = normalizeVersionText(versionText);

    if (!normalizedVersion || normalizedVersion === 'Nightly Build') {
        return fallbackPackageVersion;
    }

    const timestampIndex = normalizedVersion.indexOf('T');
    if (timestampIndex > 0) {
        return normalizedVersion
            .substring(0, timestampIndex)
            .replaceAll('-', '.');
    }

    return normalizedVersion;
}

function createVersionMetadata(
    versionText,
    { fallbackPackageVersion = '' } = {}
) {
    const sourceVersion = normalizeVersionText(versionText);

    return {
        sourceVersion,
        packageVersion: toPackageVersion(sourceVersion, fallbackPackageVersion),
        isNightly: isNightlyVersion(sourceVersion)
    };
}

function readVersionMetadata({
    versionFilePath = DEFAULT_VERSION_FILE_PATH,
    fallbackPackageVersion = '',
    readFile = fs.readFileSync
} = {}) {
    return createVersionMetadata(readFile(versionFilePath, 'utf8'), {
        fallbackPackageVersion
    });
}

module.exports = {
    createVersionMetadata,
    getUtcDateVersion,
    isNightlyVersion,
    normalizeVersionText,
    readVersionMetadata,
    toPackageVersion
};
