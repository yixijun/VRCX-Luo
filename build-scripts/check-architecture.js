const { checkDependencyDirection } = require('./dependencyDirection.cjs');
const { checkLocalizationContract } = require('./localizationContract.cjs');

try {
    const dependencyResult = checkDependencyDirection();
    const localizationResult = checkLocalizationContract();
    const missing = localizationResult.keyDrift.reduce(
        (total, drift) => total + drift.missing.length,
        0
    );
    const extra = localizationResult.keyDrift.reduce(
        (total, drift) => total + drift.extra.length,
        0
    );

    console.log(
        `Architecture checks OK: ${dependencyResult.filesScanned} shared/localization files scanned; ${localizationResult.localeCount} locales, ${localizationResult.canonicalKeyCount} canonical keys, ${missing} fallback omissions, ${extra} extra keys.`
    );
} catch (error) {
    console.error(error.message);
    process.exitCode = 1;
}
