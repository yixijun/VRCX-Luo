const identityCache = new Map();
const MAX_IDENTITY_CACHE_SIZE = 2000;

function trimCache() {
    if (identityCache.size <= MAX_IDENTITY_CACHE_SIZE) {
        return;
    }
    const firstKey = identityCache.keys().next().value;
    if (firstKey) {
        identityCache.delete(firstKey);
    }
}

function getUserId(user, userId) {
    return userId || user?.id || user?.userId || '';
}

function getDisplayName(user, displayName, userId) {
    return displayName || user?.displayName || user?.name || userId || '';
}

export function getUserIdentitySignature(identity) {
    return [
        identity?.id || '',
        identity?.displayName || '',
        identity?.imageUrl || ''
    ].join('\u0000');
}

export function hasUserIdentityChanged(previous, next) {
    return getUserIdentitySignature(previous) !== getUserIdentitySignature(next);
}

export function getUserIdentity({
    user = null,
    userId = '',
    displayName = '',
    imageUrl = '',
    imageResolver = null,
    isIcon = true,
    resolution = '64'
} = {}) {
    const id = getUserId(user, userId);
    const name = getDisplayName(user, displayName, id);
    const resolvedImage =
        imageUrl || imageResolver?.(user, isIcon, resolution) || '';
    const signature = [id, name, resolvedImage].join('\u0000');
    const cacheKey = id || name || signature;
    const cached = identityCache.get(cacheKey);

    if (cached?.signature === signature) {
        return cached.identity;
    }

    const identity = {
        id,
        displayName: name,
        imageUrl: resolvedImage,
        signature
    };

    identityCache.set(cacheKey, {
        signature,
        identity
    });
    trimCache();

    return identity;
}

export function clearUserIdentityCache() {
    identityCache.clear();
}
