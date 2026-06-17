const ITERATIONS = 120000;
const KEY_LENGTH = 32;

function bytesToBase64(bytes) {
    return btoa(String.fromCharCode(...bytes));
}

function base64ToBytes(value) {
    return Uint8Array.from(atob(value), (char) => char.charCodeAt(0));
}

async function derivePasswordHash(password, saltBase64) {
    const keyMaterial = await crypto.subtle.importKey(
        'raw',
        new TextEncoder().encode(password),
        'PBKDF2',
        false,
        ['deriveBits']
    );
    const bits = await crypto.subtle.deriveBits(
        {
            name: 'PBKDF2',
            salt: base64ToBytes(saltBase64),
            iterations: ITERATIONS,
            hash: 'SHA-256'
        },
        keyMaterial,
        KEY_LENGTH * 8
    );
    return bytesToBase64(new Uint8Array(bits));
}

export async function createPasswordHash(password) {
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const saltBase64 = bytesToBase64(salt);
    const hash = await derivePasswordHash(password, saltBase64);
    return `pbkdf2-sha256:${ITERATIONS}:${saltBase64}:${hash}`;
}

export async function verifyPassword(password, encodedHash) {
    const parts = String(encodedHash || '').split(':');
    if (parts.length !== 4 || parts[0] !== 'pbkdf2-sha256') {
        return false;
    }
    const [, iterations, salt, hash] = parts;
    if (Number(iterations) !== ITERATIONS) {
        return false;
    }
    const actual = await derivePasswordHash(password, salt);
    return actual === hash;
}

export function clampRemotePort(value) {
    const port = Number.parseInt(value, 10);
    if (!Number.isFinite(port)) {
        return 23580;
    }
    return Math.min(65535, Math.max(1024, port));
}

export function createRemoteToken() {
    const bytes = crypto.getRandomValues(new Uint8Array(32));
    return bytesToBase64(bytes)
        .replaceAll('+', '-')
        .replaceAll('/', '_')
        .replaceAll('=', '');
}

export { ITERATIONS };
