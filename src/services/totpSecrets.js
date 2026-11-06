import configRepository from './config';
import { protectLocalSecret, unprotectLocalSecret } from './localSecrets';
import { generateTotp, parseTotpSecret } from './totp';

/** @typedef {{ username: string, endpoint: string }} TotpIdentity */

function scopeFor(identity) {
    if (!identity?.username?.trim()) throw new Error('Missing TOTP account');
    const endpoint = new URL(identity.endpoint);
    if (
        endpoint.protocol !== 'https:' ||
        endpoint.username ||
        endpoint.password ||
        endpoint.search ||
        endpoint.hash
    ) {
        throw new Error('Invalid TOTP endpoint');
    }
    return JSON.stringify([
        endpoint.href.replace(/\/+$/, ''),
        identity.username.trim().toLowerCase()
    ]);
}

async function storageKey(scope) {
    const digest = new Uint8Array(
        await crypto.subtle.digest('SHA-256', new TextEncoder().encode(scope))
    );
    return `VRCX_totp_${Array.from(digest, (byte) => byte.toString(16).padStart(2, '0')).join('')}`;
}

export async function hasTotpSecret(identity) {
    return Boolean(
        await configRepository.getString(
            await storageKey(scopeFor(identity)),
            ''
        )
    );
}

export async function saveTotpSecret(identity, input) {
    const scope = scopeFor(identity);
    const secret = parseTotpSecret(input);
    const encrypted = await protectLocalSecret(
        JSON.stringify({ scope, secret })
    );
    if (!encrypted) throw new Error('Secure local storage unavailable');
    const key = await storageKey(scope);
    await configRepository.setString(key, encrypted);
    if ((await configRepository.getString(key, '')) !== encrypted)
        throw new Error('Failed to save protected secret');
}

export async function removeTotpSecret(identity) {
    const key = await storageKey(scopeFor(identity));
    await configRepository.remove(key);
    if (await configRepository.getString(key, ''))
        throw new Error('Failed to remove protected secret');
}

export async function getTotpSecret(identity) {
    const scope = scopeFor(identity);
    const encrypted = await configRepository.getString(
        await storageKey(scope),
        ''
    );
    if (!encrypted) return null;
    const payload = JSON.parse(await unprotectLocalSecret(encrypted));
    if (payload.scope !== scope) throw new Error('TOTP account mismatch');
    return parseTotpSecret(payload.secret);
}
