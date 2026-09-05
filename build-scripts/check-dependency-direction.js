const { checkDependencyDirection } = require('./dependencyDirection.cjs');

try {
    const result = checkDependencyDirection();
    console.log(
        `Dependency direction OK: ${result.filesScanned} files scanned, ${result.edgesScanned} restricted edges, ${result.legacy.length} documented legacy exceptions.`
    );
} catch (error) {
    console.error(error.message);
    process.exitCode = 1;
}
