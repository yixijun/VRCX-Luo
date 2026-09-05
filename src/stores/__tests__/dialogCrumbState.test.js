import { describe, expect, it } from 'vitest';

import {
    clearDialogCrumbs,
    jumpDialogCrumb,
    pushDialogCrumb,
    setDialogCrumbLabel
} from '../ui/dialogCrumbState';

describe('dialog crumb state', () => {
    it('adds a valid crumb and supplies its default label', () => {
        const crumbs = [];
        const data = { type: 'user', id: 'u1' };

        pushDialogCrumb(crumbs, data);

        expect(crumbs).toEqual([{ type: 'user', id: 'u1', label: 'u1' }]);
        expect(data.label).toBe('u1');
    });

    it('updates the current crumb instead of appending a duplicate', () => {
        const crumbs = [{ type: 'user', id: 'u1', label: 'Old name' }];

        pushDialogCrumb(crumbs, {
            type: 'user',
            id: 'u1',
            label: 'New name'
        });

        expect(crumbs).toEqual([
            { type: 'user', id: 'u1', label: 'New name' }
        ]);
    });

    it('updates the label of a matching crumb', () => {
        const crumbs = [{ type: 'user', id: 'u1', label: 'Old name' }];

        setDialogCrumbLabel(crumbs, 'user', 'u1', 'New name');

        expect(crumbs).toEqual([
            { type: 'user', id: 'u1', label: 'New name' }
        ]);
    });

    it('ignores incomplete or unknown label updates', () => {
        const crumbs = [{ type: 'user', id: 'u1', label: 'User' }];

        setDialogCrumbLabel(crumbs, 'user', 'u1', '');
        setDialogCrumbLabel(crumbs, 'missing-type', 'u1', 'New name');

        expect(crumbs).toEqual([{ type: 'user', id: 'u1', label: 'User' }]);
    });

    it('truncates descendants when an earlier crumb is reopened', () => {
        const crumbs = [
            { type: 'user', id: 'u1', label: 'User' },
            { type: 'world', id: 'w1', label: 'World' },
            { type: 'avatar', id: 'a1', label: 'Avatar' }
        ];

        pushDialogCrumb(crumbs, {
            type: 'user',
            id: 'u1',
            label: 'Updated user'
        });

        expect(crumbs).toEqual([
            { type: 'user', id: 'u1', label: 'Updated user' }
        ]);
    });

    it('ignores crumbs without a type or id', () => {
        const crumbs = [{ type: 'user', id: 'u1', label: 'User' }];

        pushDialogCrumb(crumbs, { type: 'user' });
        pushDialogCrumb(crumbs, { id: 'missing-type' });

        expect(crumbs).toEqual([
            { type: 'user', id: 'u1', label: 'User' }
        ]);
    });

    it('removes crumbs after a valid jump target', () => {
        const crumbs = [
            { type: 'user', id: 'u1' },
            { type: 'world', id: 'w1' },
            { type: 'avatar', id: 'a1' }
        ];

        jumpDialogCrumb(crumbs, 0);

        expect(crumbs).toEqual([{ type: 'user', id: 'u1' }]);
    });

    it('leaves crumbs unchanged for an out-of-range jump', () => {
        const crumbs = [
            { type: 'user', id: 'u1' },
            { type: 'world', id: 'w1' }
        ];

        jumpDialogCrumb(crumbs, -1);
        jumpDialogCrumb(crumbs, crumbs.length);

        expect(crumbs).toEqual([
            { type: 'user', id: 'u1' },
            { type: 'world', id: 'w1' }
        ]);
    });

    it('creates an empty crumb list when cleared', () => {
        const cleared = clearDialogCrumbs();

        expect(cleared).toEqual([]);
    });
});
