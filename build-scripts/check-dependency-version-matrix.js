const { checkVersionMatrix } = require('./dependencyVersionMatrix.cjs');

try {
    const result = checkVersionMatrix();
    const npmVersion = result.matrix.package.version;
    const frameworks = result.matrix.dotnet.projects
        .map((project) => `${project.fileName}:${project.targetFramework}`)
        .join(', ');

    console.log(
        `Dependency version matrix OK: package ${npmVersion}; ${result.matrix.dotnet.projects.length} .NET projects (${frameworks}).`
    );

    if (result.drifts.length > 0) {
        console.warn('Known cross-project version drift:');
        for (const drift of result.drifts) {
            const entries = drift.entries
                .map((entry) => `${entry.project}=${entry.version}`)
                .join(', ');
            console.warn(`- ${drift.dependency}: ${entries}`);
        }
    }
} catch (error) {
    console.error(error.message);
    process.exitCode = 1;
}
