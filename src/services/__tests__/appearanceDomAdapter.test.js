import { describe, expect, it } from 'vitest';

import { createAppearanceDomAdapter } from '../appearanceDomAdapter';

function createDocumentStub(initialClasses = []) {
    const classes = new Set(initialClasses);
    const calls = [];
    const classList = {
        add(...names) {
            calls.push(['add', ...names]);
            names.forEach((name) => classes.add(name));
        },
        remove(...names) {
            calls.push(['remove', ...names]);
            names.forEach((name) => classes.delete(name));
        },
        contains(name) {
            return classes.has(name);
        }
    };

    return {
        document: { documentElement: { classList } },
        classes,
        calls
    };
}

describe('appearance DOM adapter', () => {
    it('applies and removes accessible status indicator class', () => {
        const stub = createDocumentStub(['accessible-status-indicators']);
        const adapter = createAppearanceDomAdapter(stub.document);

        adapter.applyAccessibleStatusIndicators(false);
        expect(stub.classes.has('accessible-status-indicators')).toBe(false);

        adapter.applyAccessibleStatusIndicators(true);
        expect(stub.classes.has('accessible-status-indicators')).toBe(true);
        expect(stub.calls).toEqual([
            ['remove', 'accessible-status-indicators'],
            ['remove', 'accessible-status-indicators'],
            ['add', 'accessible-status-indicators']
        ]);
    });

    it('uses the inverse class for official status color preference', () => {
        const stub = createDocumentStub(['vrcx-status-colors']);
        const adapter = createAppearanceDomAdapter(stub.document);

        adapter.applyOfficialStatusColors(true);
        expect(stub.classes.has('vrcx-status-colors')).toBe(false);

        adapter.applyOfficialStatusColors(false);
        expect(stub.classes.has('vrcx-status-colors')).toBe(true);
    });

    it('keeps only the class matching the selected table density', () => {
        const stub = createDocumentStub([
            'is-comfortable-table',
            'unrelated-class'
        ]);
        const adapter = createAppearanceDomAdapter(stub.document);

        adapter.applyTableDensity('compact');
        expect(stub.classes.has('is-compact-table')).toBe(true);
        expect(stub.classes.has('is-comfortable-table')).toBe(false);

        adapter.applyTableDensity('standard');
        expect(stub.classes.has('is-compact-table')).toBe(false);
        expect(stub.classes.has('is-comfortable-table')).toBe(false);
        expect(stub.classes.has('unrelated-class')).toBe(true);
    });
});
