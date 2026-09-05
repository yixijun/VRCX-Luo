const fs = require('fs');
const path = require('path');

const { readVersionMetadata } = require('../src-electron/versionMetadata.cjs');
const {
    assertVersionConsistency
} = require('../src-electron/versionConsistency.cjs');

const defaultRootDir = path.join(__dirname, '..');

function checkVersionConsistency({
    rootDir = defaultRootDir,
    fsModule = fs
} = {}) {
    const versionFilePath = path.join(rootDir, 'Version');
    const packageJsonPath = path.join(rootDir, 'package.json');
    const packageLockPath = path.join(rootDir, 'package-lock.json');
    const metadata = readVersionMetadata({
        versionFilePath,
        readFile: (filePath, encoding) =>
            fsModule.readFileSync(filePath, encoding)
    });
    const packageJson = JSON.parse(
        fsModule.readFileSync(packageJsonPath, 'utf8')
    );
    const packageLock = JSON.parse(
        fsModule.readFileSync(packageLockPath, 'utf8')
    );

    const result = assertVersionConsistency({
        versionText: metadata.sourceVersion,
        packageVersion: packageJson.version,
        packageLockVersion: packageLock.version,
        packageLockRootVersion: packageLock.packages?.['']?.version
    });

    console.log(
        `Version consistency OK: ${result.sourceVersion} -> ${result.expectedPackageVersion}`
    );
    return result;
}

if (require.main === module) {
    try {
        checkVersionConsistency();
    } catch (err) {
        console.error(err.message);
        process.exit(1);
    }
}

module.exports = { checkVersionConsistency };
