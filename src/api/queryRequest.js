import {
    entityQueryPolicies,
    fetchWithEntityPolicy,
    queryKeys
} from '../queries';
import { createQueryResourceRegistry } from '../queries/queryResourceRegistry';

import avatarRequest from './avatar';
import favoriteRequest from './favorite';
import friendRequest from './friend';
import groupRequest from './group';
import inventoryRequest from './inventory';
import miscRequest from './misc';
import userRequest from './user';
import vrcPlusIconRequest from './vrcPlusIcon';
import vrcPlusImageRequest from './vrcPlusImage';
import worldRequest from './world';

const registry = createQueryResourceRegistry({
    requests: {
        avatarRequest,
        favoriteRequest,
        friendRequest,
        groupRequest,
        inventoryRequest,
        miscRequest,
        userRequest,
        vrcPlusIconRequest,
        vrcPlusImageRequest,
        worldRequest
    },
    queryKeys,
    policies: entityQueryPolicies
});

const queryRequest = {
    /**
     * @template T
     * @param {keyof typeof registry} resource
     * @param {any} [params]
     * @returns {Promise<T & {cache: boolean}>}
     */
    async fetch(resource, params = {}) {
        const entry = registry[resource];
        if (!entry) {
            throw new Error(`Unknown query resource: ${String(resource)}`);
        }

        const { data, cache } = await fetchWithEntityPolicy({
            queryKey: entry.key(params),
            policy: entry.policy,
            queryFn: () => entry.queryFn(params),
            label: resource
        });

        return {
            ...data,
            cache
        };
    }
};

export default queryRequest;
