/* global module, Buffer */
/** Local encryption handlers; callers register them behind the renderer guard. */
function createLocalSecretHandlers({
    safeStorage,
    platform = process.platform
}) {
    function requireEncryption() {
        if (
            !safeStorage.isEncryptionAvailable() ||
            (platform === 'linux' &&
                safeStorage.getSelectedStorageBackend() === 'basic_text')
        ) {
            throw new Error('Secure local storage unavailable');
        }
    }
    return {
        protectLocalSecret(_event, plaintext) {
            if (
                typeof plaintext !== 'string' ||
                !plaintext ||
                plaintext.length > 4096
            ) {
                throw new TypeError('Invalid local secret');
            }
            requireEncryption();
            return safeStorage.encryptString(plaintext).toString('base64');
        },
        unprotectLocalSecret(_event, ciphertext) {
            if (
                typeof ciphertext !== 'string' ||
                !ciphertext ||
                ciphertext.length > 16384 ||
                !/^[a-z0-9+/]+={0,2}$/i.test(ciphertext)
            ) {
                throw new TypeError('Invalid protected secret');
            }
            requireEncryption();
            return safeStorage.decryptString(Buffer.from(ciphertext, 'base64'));
        }
    };
}

module.exports = { createLocalSecretHandlers };
