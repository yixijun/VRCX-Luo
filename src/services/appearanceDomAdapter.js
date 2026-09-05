/**
 * Creates the DOM class implementation used by appearance settings.
 *
 * @param {{documentElement: {classList: {
 *     add: (...names: string[]) => void,
 *     remove: (...names: string[]) => void
 * }}}} [documentRef]
 * @returns {{
 *     applyAccessibleStatusIndicators: (enabled: boolean) => void,
 *     applyOfficialStatusColors: (useOfficial: boolean) => void,
 *     applyTableDensity: (density: string) => void
 * }}
 */
export function createAppearanceDomAdapter(documentRef = document) {
    const getClassList = () => documentRef.documentElement.classList;

    function applyAccessibleStatusIndicators(enabled) {
        const classList = getClassList();
        classList.remove('accessible-status-indicators');
        if (enabled) {
            classList.add('accessible-status-indicators');
        }
    }

    function applyOfficialStatusColors(useOfficial) {
        const classList = getClassList();
        classList.remove('vrcx-status-colors');
        if (!useOfficial) {
            classList.add('vrcx-status-colors');
        }
    }

    function applyTableDensity(density) {
        const classList = getClassList();
        classList.remove('is-compact-table', 'is-comfortable-table');
        if (density === 'compact') {
            classList.add('is-compact-table');
        }
        if (density === 'comfortable') {
            classList.add('is-comfortable-table');
        }
    }

    return {
        applyAccessibleStatusIndicators,
        applyOfficialStatusColors,
        applyTableDensity
    };
}
