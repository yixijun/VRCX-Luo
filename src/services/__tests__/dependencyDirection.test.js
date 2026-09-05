import { describe, expect, it } from 'vitest';

import {
    assertDependencyDirection,
    inspectDependencyDirection,
    parseDependencySpecifiers,
    resolveProjectImport
} from '../../../build-scripts/dependencyDirection.cjs';

describe('dependency direction guard', () => {
    it('resolves relative and aliased project imports while ignoring packages', () => {
        expect(resolveProjectImport('src/shared/utils/example.js', '../../stores')).toBe(
            'src/stores'
        );
        expect(resolveProjectImport('src/shared/utils/example.js', '@/services/foo')).toBe(
            'src/services/foo'
        );
        expect(resolveProjectImport('src/shared/utils/example.js', 'vue')).toBeNull();
    });

    it('parses multiline static imports, exports, and dynamic imports', () => {
        expect(
            parseDependencySpecifiers(`
                import {\n                    value\n                } from '../../stores';
                export * from '../constants';
                const lazy = import('../services/config');
            `)
        ).toEqual(['../../stores', '../constants', '../services/config']);
    });

    it('keeps documented legacy edges visible and rejects a new reverse edge', () => {
        const result = inspectDependencyDirection({
            files: [
                {
                    path: 'src/shared/utils/legacy.js',
                    content: "import { useStore } from '../../stores';"
                },
                {
                    path: 'src/shared/utils/new.js',
                    content: "import { run } from '../../coordinators/new';"
                },
                {
                    path: 'src/shared/utils/safe.js',
                    content: "import { constant } from '../constants';"
                }
            ],
            legacyExceptions: [
                { source: 'src/shared/utils/legacy.js', targetRoot: 'src/stores' }
            ]
        });

        expect(result.filesScanned).toBe(3);
        expect(result.legacy).toHaveLength(1);
        expect(result.violations).toHaveLength(1);
        expect(result.violations[0].targetRoot).toBe('src/coordinators');
        expect(() => assertDependencyDirection(result)).toThrow(
            /src\/shared\/utils\/new\.js imports .*src\/coordinators/iu
        );
    });

    it('does not scan tests unless explicitly requested', () => {
        const files = [
            {
                path: 'src/shared/__tests__/example.test.js',
                content: "import { useStore } from '../../stores';"
            }
        ];

        expect(inspectDependencyDirection({ files }).filesScanned).toBe(0);
        expect(
            inspectDependencyDirection({ files, includeTests: true }).violations
        ).toHaveLength(1);
    });
});
