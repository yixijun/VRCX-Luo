const fs = require('node:fs');
const path = require('node:path');

const defaultRootDir = path.join(__dirname, '..');
const DEFAULT_CANONICAL_LOCALE = 'en.json';
const TRANSLATION_METADATA_KEYS = new Set(['language', 'translator']);

function normalizeFileName(fileName) {
    return path.posix.basename(String(fileName).replaceAll('\\', '/'));
}

function isPlainObject(value) {
    return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function flattenTranslationLeaves(value, prefix = '', entries = []) {
    if (!isPlainObject(value)) {
        entries.push({ path: prefix, value });
        return entries;
    }

    for (const [key, child] of Object.entries(value)) {
        const childPath = prefix ? `${prefix}.${key}` : key;
        flattenTranslationLeaves(child, childPath, entries);
    }

    return entries;
}

function getTranslationEntries(localeObject) {
    const entries = [];
    if (!isPlainObject(localeObject)) return entries;

    for (const [key, value] of Object.entries(localeObject)) {
        if (TRANSLATION_METADATA_KEYS.has(key)) continue;
        flattenTranslationLeaves(value, key, entries);
    }

    return entries;
}

function getKeySet(entries) {
    return new Set(entries.map((entry) => entry.path));
}

function inspectLocalizationResources({
    resources,
    canonicalLocale = DEFAULT_CANONICAL_LOCALE,
    supportedCodes
}) {
    const errors = [];
    const keyDrift = [];
    const normalizedCanonicalLocale = normalizeFileName(canonicalLocale);
    const normalizedResources = resources.map((resource) => ({
        ...resource,
        fileName: normalizeFileName(resource.fileName)
    }));

    const resourceNames = new Set();
    for (const resource of normalizedResources) {
        if (resourceNames.has(resource.fileName)) {
            errors.push(`Duplicate localization file: ${resource.fileName}`);
        }
        resourceNames.add(resource.fileName);
    }

    const canonicalResource = normalizedResources.find(
        (resource) => resource.fileName === normalizedCanonicalLocale
    );
    if (!canonicalResource) {
        errors.push(`Canonical localization file not found: ${normalizedCanonicalLocale}`);
    }

    if (supportedCodes) {
        const expectedFiles = new Set(
            supportedCodes.map((code) => `${String(code)}.json`)
        );
        for (const fileName of resourceNames) {
            if (!expectedFiles.has(fileName)) {
                errors.push(`Unsupported localization file: ${fileName}`);
            }
        }
        for (const expectedFile of expectedFiles) {
            if (!resourceNames.has(expectedFile)) {
                errors.push(`Missing localization file: ${expectedFile}`);
            }
        }
    }

    const validateResource = (resource) => {
        if (resource.parseError) {
            errors.push(`${resource.fileName}: invalid JSON (${resource.parseError})`);
            return null;
        }
        if (!isPlainObject(resource.value)) {
            errors.push(`${resource.fileName}: root must be a JSON object`);
            return null;
        }
        if (typeof resource.value.language !== 'string' || !resource.value.language.trim()) {
            errors.push(`${resource.fileName}: language must be a non-empty string`);
        }
        if (
            typeof resource.value.translator !== 'string' ||
            !resource.value.translator.trim()
        ) {
            errors.push(`${resource.fileName}: translator must be a non-empty string`);
        }

        const entries = getTranslationEntries(resource.value);
        for (const entry of entries) {
            if (typeof entry.value !== 'string') {
                errors.push(
                    `${resource.fileName}: translation leaf ${entry.path} must be a string (got ${Array.isArray(entry.value) ? 'array' : typeof entry.value})`
                );
            }
        }
        return entries;
    };

    const canonicalEntries = canonicalResource
        ? validateResource(canonicalResource)
        : null;
    const canonicalKeys = canonicalEntries ? getKeySet(canonicalEntries) : new Set();

    for (const resource of normalizedResources) {
        if (resource === canonicalResource) continue;
        const entries = validateResource(resource);
        if (!entries || !canonicalEntries) continue;

        const keys = getKeySet(entries);
        const missing = [...canonicalKeys].filter((key) => !keys.has(key));
        const extra = [...keys].filter((key) => !canonicalKeys.has(key));
        if (missing.length || extra.length) {
            keyDrift.push({
                fileName: resource.fileName,
                missing,
                extra
            });
        }
    }

    return {
        canonicalKeyCount: canonicalKeys.size,
        canonicalLocale: normalizedCanonicalLocale,
        errors,
        keyDrift,
        localeCount: normalizedResources.length,
        resources: normalizedResources
    };
}

function assertLocalizationContract(result, { failOnKeyDrift = false } = {}) {
    const issues = [...result.errors];
    if (failOnKeyDrift) {
        for (const drift of result.keyDrift) {
            if (drift.missing.length) {
                issues.push(
                    `${drift.fileName}: missing ${drift.missing.length} canonical translation keys`
                );
            }
            if (drift.extra.length) {
                issues.push(
                    `${drift.fileName}: has ${drift.extra.length} keys absent from ${result.canonicalLocale}`
                );
            }
        }
    }

    if (issues.length > 0) {
        throw new Error(`Localization contract check failed:\n${issues.join('\n')}`);
    }
    return result;
}

function collectLocalizationResources(rootDir, fsModule = fs) {
    const localeDir = path.join(rootDir, 'src', 'localization');
    if (!fsModule.existsSync(localeDir)) {
        return [
            {
                fileName: 'src/localization',
                parseError: 'directory not found'
            }
        ];
    }

    return fsModule
        .readdirSync(localeDir, { withFileTypes: true })
        .filter(
            (entry) => entry.isFile() && path.extname(entry.name).toLowerCase() === '.json'
        )
        .sort((left, right) => left.name.localeCompare(right.name))
        .map((entry) => {
            const filePath = path.join(localeDir, entry.name);
            try {
                return {
                    fileName: entry.name,
                    value: JSON.parse(fsModule.readFileSync(filePath, 'utf8'))
                };
            } catch (error) {
                return {
                    fileName: entry.name,
                    parseError: error.message
                };
            }
        });
}

function readSupportedCodes(rootDir, fsModule = fs) {
    const localesPath = path.join(rootDir, 'src', 'localization', 'locales.js');
    if (!fsModule.existsSync(localesPath)) return undefined;

    const source = fsModule.readFileSync(localesPath, 'utf8');
    const match = source.match(/languageCodes\s*=\s*\[([\s\S]*?)\]/u);
    if (!match) return undefined;

    return [...match[1].matchAll(/['"]([^'"]+)['"]/g)].map((entry) => entry[1]);
}

function checkLocalizationContract({
    rootDir = defaultRootDir,
    fsModule = fs,
    canonicalLocale = DEFAULT_CANONICAL_LOCALE,
    supportedCodes,
    failOnKeyDrift = false
} = {}) {
    const resources = collectLocalizationResources(rootDir, fsModule);
    const codes = supportedCodes ?? readSupportedCodes(rootDir, fsModule);
    return assertLocalizationContract(
        inspectLocalizationResources({
            resources,
            canonicalLocale,
            supportedCodes: codes
        }),
        { failOnKeyDrift }
    );
}

module.exports = {
    DEFAULT_CANONICAL_LOCALE,
    TRANSLATION_METADATA_KEYS,
    assertLocalizationContract,
    checkLocalizationContract,
    collectLocalizationResources,
    flattenTranslationLeaves,
    getTranslationEntries,
    inspectLocalizationResources,
    readSupportedCodes
};
