import { describe, expect, it } from 'vitest';

import {
    isSettingsSearchEntryAvailable,
    searchSettingsCatalog,
    settingsSearchCatalog
} from '../settingsSearchCatalog';

const translate = (key) =>
    ({
        font: 'Font',
        close: 'Close Window',
        group: 'Window Behavior',
        proxy: 'Proxy Settings'
    })[key] || key;

describe('settingsSearchCatalog', () => {
    it('matches translated labels and aliases without mutating settings', () => {
        const catalog = [
            {
                id: 'font',
                tab: 'interface',
                labelKey: 'font',
                groupKey: 'group',
                aliases: ['字体']
            },
            {
                id: 'close',
                tab: 'interface',
                labelKey: 'close',
                groupKey: 'group',
                aliases: ['tray']
            }
        ];

        expect(
            searchSettingsCatalog(catalog, 'font', translate).map(
                (entry) => entry.id
            )
        ).toEqual(['font']);
        expect(
            searchSettingsCatalog(catalog, 'tray', translate).map(
                (entry) => entry.id
            )
        ).toEqual(['close']);
        expect(searchSettingsCatalog(catalog, '  ', translate)).toEqual([]);
        expect(catalog[0].label).toBeUndefined();
    });

    it('filters platform-specific entries', () => {
        const close = settingsSearchCatalog.find(
            (entry) => entry.id === 'close-window-action'
        );

        expect(isSettingsSearchEntryAvailable(close, { isMacOS: true })).toBe(
            false
        );
        expect(isSettingsSearchEntryAvailable(close, { isMacOS: false })).toBe(
            true
        );
    });
});
