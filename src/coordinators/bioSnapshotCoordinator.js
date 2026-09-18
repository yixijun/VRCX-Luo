/**
 * Persist a bio snapshot obtained from either the legacy user response or the
 * dedicated public-profile response.
 *
 * The public-profile endpoint can race the friend-update event flow, so the
 * caller supplies the cached value that was available before opening the
 * dialog. That lets this seam keep the existing duplicate-avoidance rule
 * without making the UI depend on which endpoint resolved first.
 *
 * @param {object} options
 * @param {object} options.database
 * @param {string} options.userId
 * @param {string} options.currentUserId
 * @param {string} options.currentBio
 * @param {string|undefined} options.previousBio
 * @param {boolean} options.isFriend
 * @param {string} options.displayName
 * @param {string} [options.createdAt]
 * @returns {Promise<boolean>} whether a new snapshot was inserted
 */
export async function recordBioSnapshotForUser({
    database,
    userId,
    currentUserId,
    currentBio,
    previousBio,
    isFriend,
    displayName,
    createdAt = new Date().toJSON()
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
    return true;
}
