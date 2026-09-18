import { patchAndRefetchActiveQuery, queryKeys } from '../queries';
import { request } from '../services/request';
import { useUserStore } from '../stores';
import { applyUser, applyCurrentUser } from '../coordinators/userCoordinator';

/**
 * @returns {string}
 */
function getCurrentUserId() {
    return useUserStore().currentUser.id;
}

const userReq = {
    /**
     * Fetch user from API.
     * identifier of registered user
     * @type {import('../types/api/user').GetUser}
     */
    getUser(params) {
        return request(`users/${params.userId}`, {
            method: 'GET'
        }).then((json) => {
            if (!json) {
                throw new Error(
                    `getUser missing user data for: ${params.userId}`
                );
            }
            json.$lastFetch = Date.now(); // todo: make this not suck
            const args = {
                json,
                params,
                ref: applyUser(json)
            };
            return args;
        });
    },

    /**
     * Fetch the public profile for a user.
     *
     * VRChat moved public-facing profile data such as the bio and profile
     * icon out of the user resource. Keep this request separate from
     * getUser so callers can use the new endpoint without losing the old
     * user/presence payload used throughout VRCX.
     * @param {{ userId: string }} params
     * @type {import('../types/api/profile').GetPublicProfile}
     */
    getPublicProfile(params) {
        return request(`profile/${params.userId}`, {
            method: 'GET'
        }).then((json) => ({
            json,
            params
        }));
    },

    /**
     * Fetch the private profile used by the profile editor.
     * @param {{ userId: string }} params
     */
    getPrivateProfile(params) {
        return request(`profile/${params.userId}/private`, {
            method: 'GET'
        }).then((json) => ({ json, params }));
    },

    /**
     * Fetch the current user's complete profile editor payload.
     */
    getSelfProfile() {
        return request(`profile/${getCurrentUserId()}`, {
            method: 'GET',
            params: { asSelf: true }
        }).then((json) => ({ json, params: {} }));
    },

    /**
     * Save the current user's profile fields.
     * @param {object} params
     */
    saveProfile(params) {
        return request(`profile/${getCurrentUserId()}`, {
            method: 'PUT',
            params
        }).then((json) => ({ json, params }));
    },

    /**
     * Update one of the current user's profile themes.
     * @param {object} params
     */
    saveProfileTheme(params) {
        return request(`profile/theme/${params.themeId}`, {
            method: 'PUT',
            params
        }).then((json) => ({ json, params }));
    },

    /**
     * Create a profile theme for the current user.
     * @param {object} params
     */
    createProfileTheme(params) {
        return request('profile/theme', {
            method: 'POST',
            params
        }).then((json) => ({ json, params }));
    },

    /**
     * Delete a profile theme.
     * @param {{ id: string }} params
     */
    deleteProfileTheme(params) {
        return request(`profile/theme/${params.id}`, {
            method: 'DELETE'
        }).then((json) => ({ json, params }));
    },

    /**
     * @type {import('../types/api/user').GetUsers}
     */
    getUsers(params) {
        return request('users', {
            method: 'GET',
            params
        }).then((json) => {
            const args = {
                json,
                params
            };
            return args;
        });
    },

    /**
     * @param {{tags: string[]}} params User tags to add
     * @returns {Promise<{json: any, params: {tags: string[]}}>}
     */
    addUserTags(params) {
        return request(`users/${getCurrentUserId()}/addTags`, {
            method: 'POST',
            params
        }).then((json) => {
            const args = {
                json,
                params
            };
            applyCurrentUser(json);
            return args;
        });
    },

    /**
     * @param {{tags: string[]}} params User tags to remove
     * @returns {Promise<{json: any, params: {tags: string[]}}>}
     */
    removeUserTags(params) {
        return request(`users/${getCurrentUserId()}/removeTags`, {
            method: 'POST',
            params
        }).then((json) => {
            const args = {
                json,
                params
            };
            applyCurrentUser(json);
            return args;
        });
    },

    /**
     * @param {{ userId: string }} params
     * @returns {Promise<{json: any, params: { userId: string }}>}
     */
    getUserFeedback(params) {
        return request(`users/${params.userId}/feedback`, {
            method: 'GET',
            params: {
                n: 100
            }
        }).then((json) => {
            const args = {
                json,
                params
            };
            return args;
        });
    },

    /**
     * Updates current user's status.
     * @type {import('../types/api/user').GetCurrentUser}
     */
    saveCurrentUser(params) {
        return request(`users/${getCurrentUserId()}`, {
            method: 'PUT',
            params
        }).then((json) => {
            const args = {
                json,
                params,
                ref: applyCurrentUser(json)
            };
            patchAndRefetchActiveQuery({
                queryKey: queryKeys.user(args.ref.id),
                nextData: args
            }).catch((err) => {
                console.error(
                    'Failed to refresh user query after mutation:',
                    err
                );
            });
            return args;
        });
    },

    /**
     * @param {{ offset: number, n: number }} params
     * @returns {Promise<{json: any, params: { offset: number, n: number }}>}
     */
    getUserNotes(params) {
        return request(`userNotes`, {
            method: 'GET',
            params
        }).then((json) => {
            const args = {
                json,
                params
            };
            return args;
        });
    },

    getMutualCounts(params) {
        return request(`users/${params.userId}/mutuals`, {
            method: 'GET'
        }).then((json) => {
            const args = {
                json,
                params
            };
            return args;
        });
    },

    getMutualFriends(params) {
        return request(`users/${params.userId}/mutuals/friends`, {
            method: 'GET',
            params
        }).then((json) => {
            const args = {
                json,
                params
            };
            return args;
        });
    },

    getMutualGroups(params) {
        return request(`users/${params.userId}/mutuals/groups`, {
            method: 'GET',
            params
        }).then((json) => {
            const args = {
                json,
                params
            };
            return args;
        });
    }
};

export default userReq;
