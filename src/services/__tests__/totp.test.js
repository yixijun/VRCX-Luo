import { describe, expect, test } from 'vitest';
import { generateTotp, parseTotpSecret } from '../totp';

// Public RFC 6238 Appendix B test key and vectors, never a user's credential.
const key = 'GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ';
describe('TOTP', () => {
    test.each([
        [59, '94287082'],
        [1111111109, '07081804'],
        [1111111111, '14050471'],
        [1234567890, '89005924'],
        [2000000000, '69279037'],
        [20000000000, '65353130']
    ])('matches RFC 6238 at %s seconds', async (seconds, expected) => {
        expect(
            await generateTotp(key, { now: seconds * 1000, digits: 8 })
        ).toBe(expected);
    });
    test('generates six-digit codes and changes at the exact step boundary', async () => {
        expect(await generateTotp(key, { now: 59000 })).toBe('287082');
        expect(await generateTotp(key, { now: 59999 })).toBe('287082');
        expect(await generateTotp(key, { now: 60000 })).not.toBe('287082');
    });
    test('accepts Base32 formatting and an authenticator export URI', () => {
        expect(parseTotpSecret(' gezd-gnbv gy3tqojq gezdgnbvgy3tqojq ')).toBe(
            key
        );
        expect(
            parseTotpSecret(
                `otpauth://totp/VRChat:example?secret=${key}&issuer=VRChat&algorithm=SHA1&digits=6&period=30`
            )
        ).toBe(key);
    });
    test.each([
        '',
        '123456',
        'JBSWY3DP!',
        `otpauth://hotp/example?secret=${key}`,
        `otpauth://totp/example?secret=${key}&digits=8`,
        `otpauth://totp/example?secret=${key}&period=60`,
        `otpauth://totp/example?secret=${key}&algorithm=SHA256`,
        `otpauth://totp/example?secret=${key}&secret=${key}`
    ])('rejects invalid/unsupported keys without exposing input', (input) => {
        expect(() => parseTotpSecret(input)).toThrow(
            /Invalid TOTP|Unsupported TOTP/
        );
        try {
            parseTotpSecret(input);
        } catch (error) {
            if (input) expect(error.message).not.toContain(input);
        }
    });
});
