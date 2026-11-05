import { describe, expect, test } from 'vitest';
import { findSuspiciousBioClearBurst } from '../bioClearBurst';

const record = (id, minutes) => ({
    id,
    userId: `usr_${id}`,
    createdAt: new Date(Date.UTC(2026, 0, 1, 0, minutes)).toISOString()
});
describe('Bio-clear burst review', () => {
    test('requires three valid records within five minutes', () => {
        expect(
            findSuspiciousBioClearBurst([
                record(1, 0),
                record(2, 6),
                record(3, 12)
            ])
        ).toBeNull();
        expect(
            findSuspiciousBioClearBurst([
                record(1, 0),
                record(2, 2),
                { id: 3, createdAt: 'bad' }
            ])
        ).toBeNull();
    });
    test('finds the newest burst and includes connected records without changing input', () => {
        const records = [
            record(1, 0),
            record(2, 1),
            record(3, 2),
            record(4, 30),
            record(5, 31),
            record(6, 32),
            record(7, 37)
        ];
        const result = findSuspiciousBioClearBurst(records.toReversed());
        expect(result.rows.map(({ id }) => id)).toEqual([4, 5, 6, 7]);
        expect(result.start.id).toBe(4);
        expect(result.end.id).toBe(7);
        expect(records[0]).not.toHaveProperty('time');
    });
});
