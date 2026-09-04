/* global __dirname, module, process, require */

const fs = require('fs');
const path = require('path');

const schemaPath = path.join(
    __dirname,
    '..',
    'docs',
    'schemas',
    'screenshotMetadata-schema.json'
);

/**
 * Parses and checks the stable shape of the screenshot metadata schema.
 *
 * @param {string} filePath
 * @returns {Record<string, unknown>}
 */
function validateSchema(filePath) {
    if (!fs.existsSync(filePath)) {
        throw new Error(`Schema file not found: ${filePath}`);
    }

    let schema;
    try {
        schema = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    } catch (error) {
        throw new Error(`Schema is not valid JSON: ${error.message}`);
    }

    if (!schema || typeof schema !== 'object' || Array.isArray(schema)) {
        throw new Error('Schema root must be a JSON object.');
    }

    if (typeof schema.$schema !== 'string' || schema.type !== 'object') {
        throw new Error(
            'Schema must declare a JSON Schema URI and object type.'
        );
    }

    if (!schema.properties || typeof schema.properties !== 'object') {
        throw new Error('Schema must declare an object properties map.');
    }

    return schema;
}

if (require.main === module) {
    try {
        const schema = validateSchema(schemaPath);
        console.log(
            `Screenshot metadata schema is valid (${Object.keys(schema.properties).length} properties).`
        );
    } catch (error) {
        console.error(error.message);
        process.exitCode = 1;
    }
}

module.exports = { validateSchema };
