const path = require('node:path');
const { fileURLToPath } = require('node:url');

const PACKAGED_RENDERER_DOCUMENTS = Object.freeze([
    'build/html/index.html',
    'build/html/vr.html'
]);
const DEV_RENDERER_DOCUMENTS = Object.freeze(['/index.html', '/vr.html']);

function getRendererSourceUrl(event) {
    if (typeof event?.senderFrame?.url === 'string') {
        return event.senderFrame.url;
    }
    if (typeof event?.sender?.getURL === 'function') {
        try {
            return event.sender.getURL();
        } catch {
            return '';
        }
    }
    return '';
}

function normalizePath(filePath) {
    const resolved = path.resolve(filePath);
    return process.platform === 'win32' ? resolved.toLowerCase() : resolved;
}

function isPackagedRendererDocument(url, appRoot) {
    if (!appRoot || (url.hostname && url.hostname !== 'localhost')) {
        return false;
    }

    let filePath;
    try {
        filePath = fileURLToPath(url);
    } catch {
        return false;
    }

    const normalizedFilePath = normalizePath(filePath);
    return PACKAGED_RENDERER_DOCUMENTS.some((relativePath) => {
        return (
            normalizedFilePath ===
            normalizePath(path.join(appRoot, relativePath))
        );
    });
}

function isDevRendererDocument(url, allowDevServer) {
    return (
        allowDevServer === true &&
        url.protocol === 'http:' &&
        url.hostname === 'localhost' &&
        url.port === '9000' &&
        DEV_RENDERER_DOCUMENTS.includes(url.pathname)
    );
}

function isTrustedRendererSource(event, options = {}) {
    const sourceUrl = getRendererSourceUrl(event);
    if (!sourceUrl) {
        return false;
    }

    let url;
    try {
        url = new URL(sourceUrl);
    } catch {
        return false;
    }

    if (url.protocol === 'file:') {
        return isPackagedRendererDocument(url, options.appRoot);
    }

    return isDevRendererDocument(url, options.allowDevServer);
}

function assertTrustedRendererSource(event, options = {}) {
    if (!isTrustedRendererSource(event, options)) {
        const sourceUrl = getRendererSourceUrl(event) || '<unknown>';
        throw new Error(`Renderer source is not trusted: ${sourceUrl}`);
    }
}

function createTrustedRendererGuard(options = {}) {
    return (handler) => {
        if (typeof handler !== 'function') {
            throw new TypeError('IPC handler must be a function');
        }
        return (event, ...args) => {
            assertTrustedRendererSource(event, options);
            return handler(event, ...args);
        };
    };
}

module.exports = {
    DEV_RENDERER_DOCUMENTS,
    PACKAGED_RENDERER_DOCUMENTS,
    assertTrustedRendererSource,
    createTrustedRendererGuard,
    getRendererSourceUrl,
    isTrustedRendererSource
};
