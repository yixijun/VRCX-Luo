const BASE32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

/** Decode a Base32 authenticator secret without accepting ignored characters. */
function decodeBase32(value) {
    const secret = value.replace(/[\s-]/g, '').toUpperCase();
    if (!/^[A-Z2-7]+=*$/.test(secret) || secret.length > 256) {
        throw new Error('Invalid TOTP secret');
    }
    const raw = secret.replace(/=+$/, '');
    if (![0, 2, 4, 5, 7].includes(raw.length % 8))
        throw new Error('Invalid TOTP secret');
    if (
        secret.includes('=') &&
        secret.length - raw.length !== (8 - (raw.length % 8)) % 8
    ) {
        throw new Error('Invalid TOTP secret');
    }
    let buffer = 0;
    let bits = 0;
    const bytes = [];
    for (const letter of raw) {
        buffer = (buffer << 5) | BASE32.indexOf(letter);
        bits += 5;
        if (bits >= 8) {
            bits -= 8;
            bytes.push((buffer >>> bits) & 255);
            buffer &= (1 << bits) - 1;
        }
    }
    if (buffer !== 0 || bytes.length < 10)
        throw new Error('Invalid TOTP secret');
    return { secret: raw, bytes: new Uint8Array(bytes) };
}

/** Accept a Base32 key or a standard VRChat-compatible otpauth TOTP URI. */
export function parseTotpSecret(input) {
    if (typeof input !== 'string' || input.length > 2048)
        throw new Error('Invalid TOTP secret');
    let value = input.trim();
    if (/^otpauth:/i.test(value)) {
        let uri;
        try {
            uri = new URL(value);
        } catch {
            throw new Error('Invalid TOTP secret');
        }
        const params = uri.searchParams;
        if (
            uri.hostname !== 'totp' ||
            uri.username ||
            uri.password ||
            params.getAll('secret').length !== 1 ||
            ['algorithm', 'digits', 'period'].some(
                (key) => params.getAll(key).length > 1
            ) ||
            (params.get('algorithm') || 'SHA1').toUpperCase() !== 'SHA1' ||
            (params.get('digits') || '6') !== '6' ||
            (params.get('period') || '30') !== '30'
        ) {
            throw new Error('Unsupported TOTP settings');
        }
        value = params.get('secret');
    }
    return decodeBase32(value).secret;
}

/**
 * RFC 6238 TOTP using Web Crypto; defaults match VRChat authenticators.
 * @param {string} secret
 * @param {{now?: number, period?: number, digits?: number, algorithm?: string}} [options]
 * @returns {Promise<string>}
 */
export async function generateTotp(
    secret,
    { now = Date.now(), period = 30, digits = 6, algorithm = 'SHA-1' } = {}
) {
    if (
        !Number.isFinite(now) ||
        now < 0 ||
        !Number.isInteger(period) ||
        period <= 0 ||
        ![6, 8].includes(digits) ||
        !['SHA-1', 'SHA-256', 'SHA-512'].includes(algorithm)
    ) {
        throw new Error('Invalid TOTP settings');
    }
    const { bytes } = decodeBase32(secret);
    const counter = BigInt(Math.floor(now / 1000 / period));
    const message = new Uint8Array(8);
    new DataView(message.buffer).setBigUint64(0, counter, false);
    try {
        const key = await crypto.subtle.importKey(
            'raw',
            bytes,
            { name: 'HMAC', hash: algorithm },
            false,
            ['sign']
        );
        const hmac = new Uint8Array(
            await crypto.subtle.sign('HMAC', key, message)
        );
        const offset = hmac[hmac.length - 1] & 15;
        const binary =
            new DataView(hmac.buffer).getUint32(offset, false) & 0x7fffffff;
        return String(binary % 10 ** digits).padStart(digits, '0');
    } finally {
        bytes.fill(0);
    }
}
