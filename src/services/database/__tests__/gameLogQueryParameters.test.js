import { describe, expect, test } from 'vitest';

import {
    buildEscapedVipFilter,
    buildParameterizedVipFilter,
    resolveGameLogFilterFlags
} from '../gameLogQueryParameters.js';

describe('game log query parameters', () => {
    test('builds parameterized VIP filters in input order', () => {
        expect(buildParameterizedVipFilter(['usr_a', 'usr_b'])).toEqual({
            query: 'AND user_id IN (@vip_0, @vip_1)',
            args: {
                '@vip_0': 'usr_a',
                '@vip_1': 'usr_b'
            }
        });
    });

    test('enables all mapped filters when no filter is selected', () => {
        expect(
            resolveGameLogFilterFlags([], {
                Location: 'location',
                Event: 'event'
            })
        ).toEqual({ location: true, event: true });
    });

    test('enables only recognized filters when a selection is provided', () => {
        expect(
            resolveGameLogFilterFlags(['Event', 'Unknown'], {
                Location: 'location',
                Event: 'event'
            })
        ).toEqual({ location: false, event: true });
    });

    test('escapes lookup VIP literals while preserving an empty predicate', () => {
        expect(buildEscapedVipFilter(["usr_a", "x'y"])).toBe(
            "AND user_id IN ('usr_a', 'x''y')"
        );
        expect(buildEscapedVipFilter([])).toBe('');
    });
});
