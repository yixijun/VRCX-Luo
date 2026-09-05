const fs = require('fs');
const path = require('path');

const {
    getUtcDateVersion,
    readVersionMetadata
} = require('./versionMetadata.cjs');

const defaultRootDir = path.join(__dirname, '..');

function updatePackageVersions({
    rootDir = defaultRootDir,
    fsModule = fs,
    now = new Date()
} = {}) {
    const versionFilePath = path.join(rootDir, 'Version');
    const packageJsonPath = path.join(rootDir, 'package.json');
    const packageLockPath = path.join(rootDir, 'package-lock.json');

    let metadata;
    try {
        metadata = readVersionMetadata({
            versionFilePath,
            fallbackPackageVersion: getUtcDateVersion(now),
            readFile: (filePath, encoding) =>
                fsModule.readFileSync(filePath, encoding)
        });
    } catch (err) {
        console.error('Error reading Version file:', err);
        throw err;
    }

    let packageJson;
    try {
        packageJson = JSON.parse(
            fsModule.readFileSync(packageJsonPath, 'utf8')
        );
    } catch (err) {
        console.error('Error reading package.json:', err);
        throw err;
    }

    let packageLock;
    try {
        packageLock = JSON.parse(
            fsModule.readFileSync(packageLockPath, 'utf8')
        );
        if (!packageLock.packages?.['']) {
            throw new Error('package-lock.json is missing its root package');
        }
    } catch (err) {
        console.error('Error reading package-lock.json:', err);
        throw err;
    }

    packageJson.version = metadata.packageVersion;
    packageLock.version = metadata.packageVersion;
    packageLock.packages[''].version = metadata.packageVersion;

    try {
        fsModule.writeFileSync(
            packageJsonPath,
            `${JSON.stringify(packageJson, null, 4)}\n`,
            'utf8'
        );
        fsModule.writeFileSync(
            packageLockPath,
            `${JSON.stringify(packageLock, null, 4)}\n`,
            'utf8'
        );
        console.log(
            `Updated version in package.json to: ${metadata.packageVersion}`
        );
    } catch (err) {
        console.error('Error writing package versions:', err);
        throw err;
    }

    return metadata;
}

if (require.main === module) {
    try {
        updatePackageVersions();
    } catch {
        process.exit(1);
    }
}

module.exports = { updatePackageVersions };
