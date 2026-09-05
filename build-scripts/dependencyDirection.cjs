const fs = require('node:fs');
const path = require('node:path');

const defaultRootDir = path.join(__dirname, '..');

const DEFAULT_RULES = [
    {
        root: 'src/shared',
        forbiddenRoots: [
            'src/api',
            'src/components',
            'src/coordinators',
            'src-electron',
            'src/localization',
            'src/plugins',
            'src/queries',
            'src/services',
            'src/stores',
            'src/views'
        ]
    },
    {
        root: 'src/localization',
        forbiddenRoots: [
            'src/api',
            'src/components',
            'src/coordinators',
            'src-electron',
            'src/plugins',
            'src/queries',
            'src/services',
            'src/shared',
            'src/stores',
            'src/views'
        ]
    }
];

// Existing shared helpers predate this guard and still carry UI, store, API,
// or service responsibilities. Keep their edges visible while preventing new
// reverse dependencies from entering the shared/localization seams.
const LEGACY_EXCEPTIONS = [
    { source: 'src/shared/utils/appActions.js', targetRoot: 'src/plugins' },
    { source: 'src/shared/utils/appActions.js', targetRoot: 'src/stores' },
    { source: 'src/shared/utils/base/devtool.js', targetRoot: 'src/stores' },
    {
        source: 'src/shared/utils/base/format.js',
        targetRoot: 'src/plugins'
    },
    { source: 'src/shared/utils/base/ui.js', targetRoot: 'src/plugins' },
    { source: 'src/shared/utils/base/ui.js', targetRoot: 'src/services' },
    {
        source: 'src/shared/utils/common.js',
        targetRoot: 'src/coordinators'
    },
    { source: 'src/shared/utils/common.js', targetRoot: 'src/services' },
    { source: 'src/shared/utils/group.js', targetRoot: 'src/api' },
    {
        source: 'src/shared/utils/index.js',
        targetRoot: 'src/coordinators'
    },
    {
        source: 'src/shared/utils/notificationMessage.js',
        targetRoot: 'src/plugins'
    },
    {
        source: 'src/shared/utils/quickSearchUtils.js',
        targetRoot: 'src/services'
    },
    { source: 'src/shared/utils/world.js', targetRoot: 'src/api' }
];

const SOURCE_EXTENSIONS = new Set(['.cjs', '.js', '.jsx', '.mjs', '.vue']);

function normalizeProjectPath(filePath) {
    return path.posix
        .normalize(String(filePath).replaceAll('\\', '/'))
        .replace(/^\.\//u, '');
}

function isTestPath(filePath) {
    const normalized = normalizeProjectPath(filePath);
    return (
        normalized.includes('/__tests__/') ||
        normalized.endsWith('.test.js') ||
        normalized.endsWith('.test.jsx') ||
        normalized.endsWith('.spec.js') ||
        normalized.endsWith('.spec.jsx')
    );
}

function getProjectRoot(filePath, roots) {
    const normalized = normalizeProjectPath(filePath);
    return roots.find(
        (root) => normalized === root || normalized.startsWith(`${root}/`)
    );
}

function parseDependencySpecifiers(source) {
    const specifiers = new Set();
    const staticPattern =
        /\b(?:import|export)\s+(?:(?:[\s\S]*?)\sfrom\s+)?(['"])([^'"]+)\1/g;
    const dynamicPattern = /\bimport\s*\(\s*(['"])([^'"]+)\1\s*\)/g;

    for (const pattern of [staticPattern, dynamicPattern]) {
        for (const match of source.matchAll(pattern)) {
            specifiers.add(match[2]);
        }
    }

    return [...specifiers];
}

function resolveProjectImport(sourceFile, specifier) {
    if (specifier.startsWith('@/')) {
        return normalizeProjectPath(`src/${specifier.slice(2)}`);
    }

    if (specifier.startsWith('.')) {
        return normalizeProjectPath(
            path.posix.join(path.posix.dirname(sourceFile), specifier)
        );
    }

    if (specifier.startsWith('src/')) {
        return normalizeProjectPath(specifier);
    }

    return null;
}

function exceptionKey(source, targetRoot) {
    return `${normalizeProjectPath(source)} -> ${targetRoot}`;
}

function inspectDependencyDirection({
    files,
    rules = DEFAULT_RULES,
    legacyExceptions = LEGACY_EXCEPTIONS,
    includeTests = false
}) {
    const normalizedRules = rules.map((rule) => ({
        ...rule,
        root: normalizeProjectPath(rule.root),
        forbiddenRoots: rule.forbiddenRoots.map(normalizeProjectPath)
    }));
    const ruleRoots = normalizedRules.map((rule) => rule.root);
    const exceptionSet = new Set(
        legacyExceptions.map(({ source, targetRoot }) =>
            exceptionKey(source, normalizeProjectPath(targetRoot))
        )
    );
    const violations = [];
    const legacy = [];
    let filesScanned = 0;
    let edgesScanned = 0;

    for (const file of files) {
        const source = normalizeProjectPath(file.path);
        if ((!includeTests && isTestPath(source)) || !getProjectRoot(source, ruleRoots)) {
            continue;
        }

        const rule = normalizedRules.find(
            (candidate) =>
                source === candidate.root || source.startsWith(`${candidate.root}/`)
        );
        if (!rule) continue;

        filesScanned += 1;
        for (const specifier of parseDependencySpecifiers(file.content)) {
            const target = resolveProjectImport(source, specifier);
            if (!target) continue;

            const targetRoot = rule.forbiddenRoots.find(
                (root) => target === root || target.startsWith(`${root}/`)
            );
            if (!targetRoot) continue;

            edgesScanned += 1;
            const edge = {
                source,
                specifier,
                target,
                targetRoot,
                message: `${source} imports ${specifier} (${targetRoot})`
            };
            if (exceptionSet.has(exceptionKey(source, targetRoot))) {
                legacy.push(edge);
            } else {
                violations.push(edge);
            }
        }
    }

    return { filesScanned, edgesScanned, legacy, violations };
}

function assertDependencyDirection(result) {
    if (result.violations.length === 0) return result;

    const details = result.violations.map((edge) => edge.message).join('\n');
    throw new Error(`Dependency direction check failed:\n${details}`);
}

function collectSourceFiles(rootDir, fsModule = fs) {
    const files = [];
    const sourceRoots = ['src/shared', 'src/localization'];

    const walk = (directory) => {
        for (const entry of fsModule.readdirSync(directory, { withFileTypes: true })) {
            const absolutePath = path.join(directory, entry.name);
            if (entry.isDirectory()) {
                walk(absolutePath);
                continue;
            }

            if (!SOURCE_EXTENSIONS.has(path.extname(entry.name).toLowerCase())) {
                continue;
            }

            files.push({
                path: normalizeProjectPath(path.relative(rootDir, absolutePath)),
                content: fsModule.readFileSync(absolutePath, 'utf8')
            });
        }
    };

    for (const sourceRoot of sourceRoots) {
        const absoluteRoot = path.join(rootDir, ...sourceRoot.split('/'));
        if (fsModule.existsSync(absoluteRoot)) walk(absoluteRoot);
    }

    return files;
}

function checkDependencyDirection({ rootDir = defaultRootDir, fsModule = fs } = {}) {
    const files = collectSourceFiles(rootDir, fsModule);
    return assertDependencyDirection(inspectDependencyDirection({ files }));
}

module.exports = {
    DEFAULT_RULES,
    LEGACY_EXCEPTIONS,
    assertDependencyDirection,
    checkDependencyDirection,
    collectSourceFiles,
    inspectDependencyDirection,
    parseDependencySpecifiers,
    resolveProjectImport
};
