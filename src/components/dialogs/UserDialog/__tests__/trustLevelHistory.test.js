import { describe, expect, test } from 'vitest';

import { buildTrustLevelTimeline, getTrustLevelMeta } from '../trustLevelHistory';

describe('buildTrustLevelTimeline', () => {
    test('keeps only trust level rows and sorts newest first', () => {
        const timeline = buildTrustLevelTimeline([
            {
                rowId: 1,
                type: 'TrustLevel',
                created_at: '2026-01-01T00:00:00.000Z',
                previousTrustLevel: 'Known User',
                trustLevel: 'Trusted User'
            },
            {
                rowId: 2,
                type: 'DisplayName',
                created_at: '2026-02-01T00:00:00.000Z'
            },
            {
                rowId: 3,
                type: 'TrustLevel',
                created_at: '2026-03-01T00:00:00.000Z',
                previousTrustLevel: 'User',
                trustLevel: 'Known User'
            }
        ]);

        expect(timeline).toEqual([
            {
                id: 3,
                createdAt: '2026-03-01T00:00:00.000Z',
                from: 'User',
                to: 'Known User',
                fromMeta: {
                    shortLabel: 'User',
                    className: 'x-tag-known'
                },
                toMeta: {
                    shortLabel: 'Known',
                    className: 'x-tag-trusted'
                }
            },
            {
                id: 1,
                createdAt: '2026-01-01T00:00:00.000Z',
                from: 'Known User',
                to: 'Trusted User',
                fromMeta: {
                    shortLabel: 'Known',
                    className: 'x-tag-trusted'
                },
                toMeta: {
                    shortLabel: 'Trusted',
                    className: 'x-tag-veteran'
                }
            }
        ]);
    });

    test('falls back for unknown trust levels', () => {
        expect(getTrustLevelMeta('Mystery')).toEqual({
            shortLabel: 'Mystery',
            className: 'text-muted-foreground border-muted-foreground/40'
        });
    });
});
