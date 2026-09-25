import { ref } from 'vue';
import { storeToRefs } from 'pinia';

import { replaceBioSymbols } from '../../../shared/utils';
import { useAuthStore, useSearchStore, useWorldStore } from '../../../stores';
import { worldRequest } from '../../../api';

/**
 * World search composable for Search view.
 * Manages world search state, category selection, and pagination.
 */
export function useSearchWorld() {
    const { cachedWorlds } = useWorldStore();
    const { searchText } = storeToRefs(useSearchStore());
    const { cachedConfig } = storeToRefs(useAuthStore());

    const searchWorldOption = ref('');
    const searchWorldLabs = ref(false);
    const searchWorldParams = ref({});
    const searchWorldCategoryIndex = ref(null);
    const searchWorldResults = ref([]);
    const isSearchWorldLoading = ref(false);
    const hasMoreWorldResults = ref(false);
    const searchWorldError = ref(false);
    let searchGeneration = 0;
    let activeRequestGeneration = null;

    /**
     *
     * @param ref
     */
    function searchWorld(ref) {
        searchGeneration += 1;
        searchWorldOption.value = '';
        searchWorldCategoryIndex.value = ref?.index ?? null;
        searchWorldResults.value = [];
        hasMoreWorldResults.value = true;
        searchWorldError.value = false;
        const params = {
            n: 10,
            offset: 0
        };
        switch (ref.sortHeading) {
            case 'featured':
                params.sort = 'order';
                params.featured = 'true';
                break;
            case 'trending':
                params.sort = 'popularity';
                params.featured = 'false';
                break;
            case 'updated':
                params.sort = 'updated';
                break;
            case 'created':
                params.sort = 'created';
                break;
            case 'publication':
                params.sort = 'publicationDate';
                break;
            case 'shuffle':
                params.sort = 'shuffle';
                break;
            case 'active':
                searchWorldOption.value = 'active';
                break;
            case 'recent':
                searchWorldOption.value = 'recent';
                break;
            case 'favorite':
                searchWorldOption.value = 'favorites';
                break;
            case 'labs':
                params.sort = 'labsPublicationDate';
                break;
            case 'heat':
                params.sort = 'heat';
                params.featured = 'false';
                break;
            default:
                params.sort = 'relevance';
                params.search = replaceBioSymbols(searchText.value);
                break;
        }
        params.order = ref.sortOrder || 'descending';
        if (ref.sortOwnership === 'mine') {
            params.user = 'me';
            params.releaseStatus = 'all';
        }
        if (ref.tag) {
            params.tag = ref.tag;
        }
        if (!searchWorldLabs.value) {
            if (params.tag) {
                params.tag += ',system_approved';
            } else {
                params.tag = 'system_approved';
            }
        }
        // TODO: option.platform
        searchWorldParams.value = params;
        return moreSearchWorld(0, false);
    }

    /**
     *
     * @param index
     */
    function handleSearchWorldCategorySelect(index) {
        searchWorldCategoryIndex.value = index;
        const config = /** @type {{ dynamicWorldRows?: Array<{ index?: number, sortHeading?: string, sortOrder?: string, tag?: string }> }} */ (
            cachedConfig.value
        );
        const row = config.dynamicWorldRows?.find(
            (r) => r.index === index
        );
        searchWorld(row || {});
    }

    /**
     *
     * @param {number} [go=0]
     * @param {boolean} [appendResults=go > 0]
     */
    async function moreSearchWorld(go = 0, appendResults = go > 0) {
        const currentGeneration = searchGeneration;
        if (!searchWorldParams.value.n || activeRequestGeneration === currentGeneration) {
            return;
        }
        if (go > 0 && !hasMoreWorldResults.value) {
            return;
        }

        const params = /** @type {{ n: number, offset: number, [key: string]: any }} */ (
            { ...searchWorldParams.value }
        );
        if (go) {
            params.offset += params.n * go;
            if (params.offset < 0) {
                params.offset = 0;
            }
        }
        searchWorldParams.value = params;
        activeRequestGeneration = currentGeneration;
        searchWorldError.value = false;
        isSearchWorldLoading.value = true;

        try {
            const args = await worldRequest.getWorlds(params, searchWorldOption.value);
            if (currentGeneration !== searchGeneration) {
                return;
            }

            const map = new Map(
                appendResults ? searchWorldResults.value.map((world) => [world.id, world]) : []
            );
            for (const json of args.json) {
                const world = cachedWorlds.get(json.id);
                if (typeof world !== 'undefined') {
                    map.set(world.id, world);
                }
            }
            searchWorldResults.value = Array.from(map.values());
            hasMoreWorldResults.value = args.json.length >= params.n;
        } catch (error) {
            if (currentGeneration === searchGeneration) {
                searchWorldError.value = true;
                console.error('Failed to load world search results:', error);
            }
        } finally {
            if (activeRequestGeneration === currentGeneration) {
                activeRequestGeneration = null;
                isSearchWorldLoading.value = false;
            }
        }
    }

    function retryWorldSearch() {
        if (!searchWorldParams.value.n || isSearchWorldLoading.value) {
            return;
        }
        hasMoreWorldResults.value = true;
        searchWorldError.value = false;
        return moreSearchWorld(0, searchWorldResults.value.length > 0);
    }

    /**
     *
     */
    function clearWorldSearch() {
        searchGeneration += 1;
        activeRequestGeneration = null;
        searchWorldParams.value = {};
        searchWorldResults.value = [];
        hasMoreWorldResults.value = false;
        searchWorldError.value = false;
        isSearchWorldLoading.value = false;
    }

    return {
        searchWorldOption,
        searchWorldLabs,
        searchWorldParams,
        searchWorldCategoryIndex,
        searchWorldResults,
        isSearchWorldLoading,
        hasMoreWorldResults,
        searchWorldError,
        searchWorld,
        moreSearchWorld,
        retryWorldSearch,
        handleSearchWorldCategorySelect,
        clearWorldSearch
    };
}
