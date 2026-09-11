// Keep the Electron package entrypoint separate from the application composition
// root. This lets Electron load the CJS main module consistently in dev and
// packaged builds while preserving the existing main-process implementation.
require('./main.js');
