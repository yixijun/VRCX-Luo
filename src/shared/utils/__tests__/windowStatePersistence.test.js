import { vi } from 'vitest';

import { createWindowStateSaver } from '../windowStatePersistence';

describe('window state persistence', () => {
    it('coalesces repeated move updates into one save of the latest state', () => {
        vi.useFakeTimers();
        const save = vi.fn();
        const saveLatestState = createWindowStateSaver(save, 300);

        saveLatestState({ x: 10, y: 20 });
        saveLatestState({ x: 30, y: 40 });
        saveLatestState({ x: 50, y: 60 });

        expect(save).not.toHaveBeenCalled();

        vi.advanceTimersByTime(299);
        expect(save).not.toHaveBeenCalled();

        vi.advanceTimersByTime(1);
        expect(save).toHaveBeenCalledTimes(1);
        expect(save).toHaveBeenCalledWith({ x: 50, y: 60 });

        vi.useRealTimers();
    });
});
