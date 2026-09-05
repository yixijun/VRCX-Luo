import { describe, expect, it, vi } from 'vitest';

import { installBodyDropGuard } from '../dropGuard';

function createBodyStub() {
    let dropListener;
    const body = {
        addEventListener: vi.fn((eventName, listener) => {
            if (eventName === 'drop') {
                dropListener = listener;
            }
        }),
        removeEventListener: vi.fn()
    };

    return {
        body,
        dispatchDrop() {
            const event = { preventDefault: vi.fn() };
            dropListener(event);
            return event;
        }
    };
}

describe('body drop guard', () => {
    it('prevents default drops and returns a cleanup function', () => {
        const stub = createBodyStub();
        const cleanup = installBodyDropGuard({ body: stub.body });

        expect(stub.body.addEventListener).toHaveBeenCalledWith(
            'drop',
            expect.any(Function)
        );

        const event = stub.dispatchDrop();
        expect(event.preventDefault).toHaveBeenCalledOnce();

        cleanup();
        expect(stub.body.removeEventListener).toHaveBeenCalledWith(
            'drop',
            expect.any(Function)
        );
    });
});
