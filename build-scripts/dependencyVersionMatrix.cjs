const fs = require('node:fs');
const path = require('node:path');

const defaultRootDir = path.join(__dirname, '..');

const CRITICAL_NPM_PACKAGES = [
    'electron',
    'electron-builder',
    'node-api-dotnet',
    'pinia',
    'typescript',
    'vite',
    'vitest',
    'vue',
    'vue-i18n'
];

const COUPLED_DOTNET_PACKAGES = [
    ['CefSharp.OffScreen.NETCore', 'CefSharp.WinForms.NETCore'],
    ['Microsoft.JavaScript.NodeApi', 'Microsoft.JavaScript.NodeApi.Generator']
];

const SHARED_DOTNET_PACKAGES = [
    'DiscordRichPresence',
    'NLog',
    'Newtonsoft.Json',
    'SixLabors.ImageSharp',
    'SixLabors.ImageSharp.Drawing',
    'SourceGear.sqlite3',
    'System.Data.SQLite',
    'System.Management',
    'Websocket.Client'
];

function parsePackageManifest(packageJson, packageLock = {}) {
    if (!packageJson || typeof packageJson !== 'object') {
        throw new Error('package.json must be a JSON object');
    }
    if (!packageLock || typeof packageLock !== 'object') {
        throw new Error('package-lock.json must be a JSON object');
    }

    const lockRootVersion = packageLock.packages?.['']?.version;
    const critical = CRITICAL_NPM_PACKAGES.map((name) => ({
        name,
        declared:
            packageJson.dependencies?.[name] ??
            packageJson.devDependencies?.[name] ??
            null,
        resolved: packageLock.packages?.[`node_modules/${name}`]?.version ?? null
    }));

    return {
        name: packageJson.name ?? null,
        version: packageJson.version ?? null,
        lockVersion: packageLock.version ?? null,
        lockRootVersion: lockRootVersion ?? null,
        critical
    };
}

function parseCsprojManifest(fileName, csprojText) {
    const targetFramework = csprojText.match(
        /<TargetFramework>\s*([^<]+?)\s*<\/TargetFramework>/u
    )?.[1];
    const packageReferences = [];
    const pattern =
        /<PackageReference\s+Include="([^"]+)"\s+Version="([^"]+)"\s*\/?>(?:<\/PackageReference>)?/gu;

    for (const match of csprojText.matchAll(pattern)) {
        packageReferences.push({ name: match[1], version: match[2] });
    }

    return {
        fileName: path.posix.basename(String(fileName).replaceAll('\\', '/')),
        targetFramework: targetFramework ?? null,
        packageReferences
    };
}

function groupDotnetVersions(projects) {
    const grouped = new Map();
    for (const project of projects) {
        for (const reference of project.packageReferences) {
            if (!SHARED_DOTNET_PACKAGES.includes(reference.name)) continue;
            const entries = grouped.get(reference.name) ?? [];
            entries.push({
                project: project.fileName,
                version: reference.version
            });
            grouped.set(reference.name, entries);
        }
    }
    return [...grouped.entries()].map(([name, entries]) => ({ name, entries }));
}

function inspectVersionMatrix(matrix) {
    const errors = [];
    const drifts = [];

    if (!matrix.package?.name) errors.push('package.json name is missing');
    if (!matrix.package?.version) errors.push('package.json version is missing');
    if (
        matrix.package?.version &&
        matrix.package.lockRootVersion &&
        matrix.package.version !== matrix.package.lockRootVersion
    ) {
        errors.push(
            `package-lock root version is ${matrix.package.lockRootVersion}; expected ${matrix.package.version}`
        );
    }

    for (const dependency of matrix.package?.critical ?? []) {
        if (!dependency.declared) {
            errors.push(`critical npm package is not declared: ${dependency.name}`);
        } else if (!dependency.resolved) {
            errors.push(`critical npm package is not locked: ${dependency.name}`);
        }
    }

    for (const project of matrix.dotnet?.projects ?? []) {
        if (!project.targetFramework) {
            errors.push(`${project.fileName}: TargetFramework is missing`);
        }

        const seen = new Set();
        for (const reference of project.packageReferences) {
            if (seen.has(reference.name)) {
                errors.push(
                    `${project.fileName}: duplicate PackageReference ${reference.name}`
                );
            }
            seen.add(reference.name);
        }

        for (const coupledPackages of COUPLED_DOTNET_PACKAGES) {
            const versions = coupledPackages
                .map((name) =>
                    project.packageReferences.find((reference) => reference.name === name)
                )
                .filter(Boolean)
                .map((reference) => reference.version);
            if (versions.length === coupledPackages.length && new Set(versions).size > 1) {
                errors.push(
                    `${project.fileName}: coupled packages ${coupledPackages.join(' / ')} must share a version`
                );
            }
        }
    }

    for (const group of matrix.dotnet?.sharedPackages ?? []) {
        const versions = new Set(group.entries.map((entry) => entry.version));
        if (versions.size > 1) {
            drifts.push({
                dependency: group.name,
                entries: group.entries
            });
        }
    }

    return { errors, drifts };
}

function createVersionMatrix({ packageJson, packageLock, csprojFiles }) {
    const projects = csprojFiles.map(({ fileName, content }) =>
        parseCsprojManifest(fileName, content)
    );
    const matrix = {
        package: parsePackageManifest(packageJson, packageLock),
        dotnet: {
            projects,
            sharedPackages: groupDotnetVersions(projects)
        }
    };
    return { matrix, ...inspectVersionMatrix(matrix) };
}

function collectVersionMatrix({ rootDir = defaultRootDir, fsModule = fs } = {}) {
    const packageJson = JSON.parse(
        fsModule.readFileSync(path.join(rootDir, 'package.json'), 'utf8')
    );
    const packageLock = JSON.parse(
        fsModule.readFileSync(path.join(rootDir, 'package-lock.json'), 'utf8')
    );
    const dotnetDir = path.join(rootDir, 'Dotnet');
    const csprojFiles = fsModule
        .readdirSync(dotnetDir, { withFileTypes: true })
        .filter(
            (entry) => entry.isFile() && path.extname(entry.name).toLowerCase() === '.csproj'
        )
        .sort((left, right) => left.name.localeCompare(right.name))
        .map((entry) => ({
            fileName: entry.name,
            content: fsModule.readFileSync(path.join(dotnetDir, entry.name), 'utf8')
        }));

    return createVersionMatrix({ packageJson, packageLock, csprojFiles });
}

function checkVersionMatrix(options) {
    const result = collectVersionMatrix(options);
    if (result.errors.length > 0) {
        throw new Error(`Dependency version matrix check failed:\n${result.errors.join('\n')}`);
    }
    return result;
}

module.exports = {
    COUPLED_DOTNET_PACKAGES,
    CRITICAL_NPM_PACKAGES,
    SHARED_DOTNET_PACKAGES,
    checkVersionMatrix,
    collectVersionMatrix,
    createVersionMatrix,
    inspectVersionMatrix,
    parseCsprojManifest,
    parsePackageManifest
};
