import { describe, expect, test } from 'vitest';

import {
    clampRemotePort,
    createPasswordHash,
    verifyPassword
} from '../remoteAccessSecurity';

describe('remoteAccessSecurity', () => {
    test('hashes and verifies passwords without storing plaintext', async () => {
        const hash = await createPasswordHash('secret-password');

        expect(hash).toMatch(/^pbkdf2-sha256:/);
        expect(hash).not.toContain('secret-password');
        await expect(verifyPassword('secret-password', hash)).resolves.toBe(
            true
        );
        await expect(verifyPassword('wrong-password', hash)).resolves.toBe(
            false
        );
    });

    test('clamps invalid remote ports', () => {
        expect(clampRemotePort('abc')).toBe(23580);
        expect(clampRemotePort(80)).toBe(1024);
        expect(clampRemotePort(70000)).toBe(65535);
        expect(clampRemotePort(23580)).toBe(23580);
    });
});
