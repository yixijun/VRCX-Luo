const { checkLocalizationContract } = require('./localizationContract.cjs');

try {
    const result = checkLocalizationContract({
        // Missing/extra keys are reported for the existing fallback model;
        // `--strict` is available for a future all-locales parity migration.
        failOnKeyDrift: process.argv.includes('--strict')
    });
    const missing = result.keyDrift.reduce(
        (total, drift) => total + drift.missing.length,
        0
    );
    const extra = result.keyDrift.reduce(
        (total, drift) => total + drift.extra.length,
        0
    );
    console.log(
        `Localization contract OK: ${result.localeCount} locales, ${result.canonicalKeyCount} canonical keys, ${missing} fallback omissions, ${extra} extra keys.`
    );
    for (const drift of result.keyDrift.filter((entry) => entry.extra.length > 0)) {
        console.log(
            `  ${drift.fileName}: ${drift.missing.length} missing, ${drift.extra.length} extra`
        );
    }
} catch (error) {
    console.error(error.message);
    process.exitCode = 1;
}
