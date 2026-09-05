const {
    createVersionMetadata,
    normalizeVersionText
} = require('./versionMetadata.cjs');

function inspectVersionConsistency({
    versionText = '',
    packageVersion,
    packageLockVersion,
    packageLockRootVersion
} = {}) {
    const metadata = createVersionMetadata(versionText, {
        fallbackPackageVersion: packageVersion ?? ''
    });
    const issues = [];

    if (!normalizeVersionText(versionText)) {
        issues.push('Version is empty');
    }

    if (packageVersion !== metadata.packageVersion) {
        issues.push(
            `package.json version is ${packageVersion}; expected ${metadata.packageVersion}`
        );
    }

    if (packageLockVersion !== metadata.packageVersion) {
        issues.push(
            `package-lock.json version is ${packageLockVersion}; expected ${metadata.packageVersion}`
        );
    }

    if (packageLockRootVersion !== metadata.packageVersion) {
        issues.push(
            `package-lock.json root package version is ${packageLockRootVersion}; expected ${metadata.packageVersion}`
        );
    }

    return {
        sourceVersion: metadata.sourceVersion,
        expectedPackageVersion: metadata.packageVersion,
        issues
    };
}

function assertVersionConsistency(input) {
    const result = inspectVersionConsistency(input);
    if (result.issues.length > 0) {
        throw new Error(
            ['Version consistency check failed:', ...result.issues].join('\n')
        );
    }
    return result;
}

module.exports = {
    assertVersionConsistency,
    inspectVersionConsistency
};
