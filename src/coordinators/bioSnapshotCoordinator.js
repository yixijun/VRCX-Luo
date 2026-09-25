const bioSnapshotQueues = new Map();

/**
 * Serialize bio snapshot checks per user so concurrent profile fetches cannot
 * insert the same profile revision more than once.
 *
 * @param {object} options
 * @param {object} options.database
 * @param {string} options.userId
 * @param {string} options.currentUserId
 * @param {string} options.currentBio
 * @param {string|undefined} [options.previousBio]
 * @param {boolean} [options.isFriend]
 * @param {string} options.displayName
 * @param {string} [options.createdAt]
 * @param {(snapshot: {bio: string, previousBio: string, createdAt: string}) => void} [options.onRecorded]
 * @returns {Promise<boolean>} whether a new snapshot was inserted
 */
export function recordBioSnapshotForUser(options) {
    const { userId } = options || {};
    if (!userId) {
        return Promise.resolve(false);
    }

    const previousWrite = bioSnapshotQueues.get(userId) || Promise.resolve();
    const currentWrite = previousWrite
        .catch(() => {})
        .then(() => persistBioSnapshotForUser(options));
    bioSnapshotQueues.set(userId, currentWrite);

    return currentWrite.finally(() => {
        if (bioSnapshotQueues.get(userId) === currentWrite) {
            bioSnapshotQueues.delete(userId);
        }
    });
}

async function persistBioSnapshotForUser({
    database,
    userId,
    currentUserId,
    currentBio,
    previousBio,
    isFriend,
    displayName,
    createdAt = new Date().toJSON(),
    onRecorded
}) {
    if (
        !database ||
        !userId ||
        userId === currentUserId ||
        typeof currentBio !== 'string'
    ) {
        return false;
    }

    const eventFlowWillRecord =
        isFriend &&
        previousBio !== undefined &&
        Boolean(previousBio) &&
        Boolean(currentBio) &&
        previousBio !== currentBio;
    if (eventFlowWillRecord) {
        return false;
    }

    const last = await database.getLastBioChangeForUser(userId);
    if (last && last.bio === currentBio) {
        return false;
    }

    await database.addBioToDatabase({
        created_at: createdAt,
        userId,
        displayName,
        bio: currentBio,
        previousBio: last ? last.bio : ''
    });
    if (typeof onRecorded === 'function') {
        onRecorded({
            bio: currentBio,
            previousBio: last ? last.bio : '',
            createdAt
        });
    }
    return true;
}
