/** Protect small secrets with the desktop host's OS-backed encryption. */
export async function protectLocalSecret(value) {
    if (window.electron?.protectLocalSecret) {
        const encrypted = await window.electron.protectLocalSecret(value);
        if (typeof encrypted !== 'string' || !encrypted)
            throw new Error('Secure local storage unavailable');
        return `electron:${encrypted}`;
    }
    const encrypted = await AppApi.ProtectLocalSecret(value);
    if (!encrypted) throw new Error('Secure local storage unavailable');
    return `cef:${encrypted}`;
}

export async function unprotectLocalSecret(value) {
    if (
        value.startsWith('electron:') &&
        window.electron?.unprotectLocalSecret
    ) {
        return window.electron.unprotectLocalSecret(value.slice(9));
    }
    if (value.startsWith('cef:'))
        return AppApi.UnprotectLocalSecret(value.slice(4));
    throw new Error('Unsupported protected secret');
}
