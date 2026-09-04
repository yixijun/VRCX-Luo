import { describe, expect, it, vi } from 'vitest';

import { createToastAdapter } from '../toastAdapter';

describe('createToastAdapter', () => {
    it('keeps the callable toast entrypoint used by coordinators', () => {
        const implementation = Object.assign(
            vi.fn(() => 'toast-id'),
            {
                dismiss: vi.fn(),
                error: vi.fn(),
                info: vi.fn(),
                loading: vi.fn(),
                success: vi.fn(),
                warning: vi.fn()
            }
        );
        const adapter = createToastAdapter(implementation);

        expect(adapter('message', { duration: 1000 })).toBe('toast-id');
        expect(implementation).toHaveBeenCalledWith('message', {
            duration: 1000
        });
    });

    it('forwards the coordinator toast interface to the supplied implementation', () => {
        const implementation = {
            dismiss: vi.fn(),
            error: vi.fn(() => 'error-id'),
            info: vi.fn(),
            loading: vi.fn(),
            success: vi.fn(),
            warning: vi.fn()
        };
        const adapter = createToastAdapter(implementation);

        expect(adapter.error('message', { duration: 1000 })).toBe('error-id');
        adapter.dismiss('error-id');
        adapter.info('info');
        adapter.loading('loading');
        adapter.success('success');
        adapter.warning('warning');

        expect(implementation.error).toHaveBeenCalledWith('message', {
            duration: 1000
        });
        expect(implementation.dismiss).toHaveBeenCalledWith('error-id');
        expect(implementation.info).toHaveBeenCalledWith('info');
        expect(implementation.loading).toHaveBeenCalledWith('loading');
        expect(implementation.success).toHaveBeenCalledWith('success');
        expect(implementation.warning).toHaveBeenCalledWith('warning');
    });
});
