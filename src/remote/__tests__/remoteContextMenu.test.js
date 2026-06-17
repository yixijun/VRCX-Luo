import { describe, expect, it } from 'vitest';

import {
    getSubmenuDirection,
    shouldCloseContextMenu
} from '../remoteContextMenu';

describe('remote context menu', () => {
    it('opens submenus away from the viewport edge', () => {
        expect(getSubmenuDirection(1700, 236, 188, 2048)).toBe('left');
        expect(getSubmenuDirection(1200, 236, 188, 2048)).toBe('right');
    });

    it('keeps the single context menu open while interacting inside it', () => {
        expect(
            shouldCloseContextMenu({
                closest: (selector) =>
                    selector === '.context-menu' ? {} : null
            })
        ).toBe(false);
        expect(
            shouldCloseContextMenu({
                closest: () => null
            })
        ).toBe(true);
    });
});
