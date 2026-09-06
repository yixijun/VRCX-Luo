import { describe, expect, it, vi } from 'vitest';

import {
    createWristPointerDesktopTestApi,
    installWristPointerDesktopTest,
    isWristPointerDesktopTestEnabled
} from '../wristPointerDesktopTest';

function createTestElement() {
    const listeners = new Map();
    return {
        getBoundingClientRect: () => ({
            left: 10,
            top: 20,
            width: 100,
            height: 200
        }),
        addEventListener: vi.fn((type, listener) => {
            listeners.set(type, listener);
        }),
        removeEventListener: vi.fn((type, listener) => {
            if (listeners.get(type) === listener) {
                listeners.delete(type);
            }
        }),
        emit(type, event) {
            listeners.get(type)?.(event);
        }
    };
}

describe('wristPointerDesktopTest', () => {
    it('enables the desktop simulator only for the explicit query flag', () => {
        expect(isWristPointerDesktopTestEnabled('?wrist-pointer-test=1')).toBe(
            true
        );
        expect(isWristPointerDesktopTestEnabled('?wrist-pointer-test=0')).toBe(
            false
        );
        expect(isWristPointerDesktopTestEnabled('')).toBe(false);
    });

    it('provides safe native API defaults for the desktop simulator', async () => {
        const api = createWristPointerDesktopTestApi();

        expect(await api.CurrentCulture()).toBe('en-gb');
        expect(await api.CustomVrScript()).toBe('');
        expect(await api.GetVRDevices()).toEqual([]);
        expect(await api.GetExecuteVrOverlayFunctionQueue()).toEqual([]);
        expect(await api.GetWristPointerQueue()).toEqual([]);
        expect(await api.CpuUsage()).toBe(0);
        expect(await api.GetUptime()).toBe(0);
        await expect(api.VrInit()).resolves.toBeUndefined();
        await expect(api.ToggleSystemMonitor(true)).resolves.toBeUndefined();
    });

    it('maps desktop pointer movement to normalized wrist coordinates', () => {
        const element = createTestElement();
        const onMove = vi.fn();

        const cleanup = installWristPointerDesktopTest({
            element,
            onMove
        });
        element.emit('pointermove', { clientX: 60, clientY: 120 });

        expect(onMove).toHaveBeenCalledWith({
            x: 0.5,
            y: 0.5,
            visible: true,
            pressed: false,
            hand: 'right'
        });

        cleanup();
    });

    it('hides the pointer at its last position when the cursor leaves the wrist', () => {
        const element = createTestElement();
        const onMove = vi.fn();
        const cleanup = installWristPointerDesktopTest({ element, onMove });

        element.emit('pointermove', { clientX: 35, clientY: 70 });
        element.emit('pointerleave', {});

        expect(onMove).toHaveBeenLastCalledWith({
            x: 0.25,
            y: 0.25,
            visible: false,
            pressed: false,
            hand: 'right'
        });

        cleanup();
    });

    it('emits a trigger payload when the desktop cursor is clicked', () => {
        const element = createTestElement();
        const onMove = vi.fn();
        const onClick = vi.fn();
        const cleanup = installWristPointerDesktopTest({
            element,
            onMove,
            onClick
        });

        element.emit('click', {
            clientX: 90,
            clientY: 180,
            detail: 1,
            target: element
        });

        expect(onClick).toHaveBeenCalledWith({
            x: 0.8,
            y: 0.8,
            visible: true,
            pressed: true,
            hand: 'right'
        });

        cleanup();
    });

    it('prevents duplicate native clicks for explicit wrist actions', () => {
        const element = createTestElement();
        const action = {
            dataset: { vrAction: 'wrist-page-devices' },
            closest: () => action,
            click: vi.fn()
        };
        element.contains = () => true;
        const preventDefault = vi.fn();
        const stopPropagation = vi.fn();
        const onMove = vi.fn();
        const onClick = vi.fn(() => action.click());
        const cleanup = installWristPointerDesktopTest({
            element,
            onMove,
            onClick
        });

        element.emit('click', {
            clientX: 40,
            clientY: 60,
            detail: 1,
            target: action,
            preventDefault,
            stopPropagation
        });

        expect(preventDefault).toHaveBeenCalledOnce();
        expect(stopPropagation).toHaveBeenCalledOnce();
        expect(onClick).toHaveBeenCalledOnce();
        expect(action.click).toHaveBeenCalledOnce();

        cleanup();
    });

    it('captures explicit action clicks before the native action handler runs', () => {
        const element = document.createElement('div');
        const action = document.createElement('button');
        action.dataset.vrAction = 'wrist-page-devices';
        element.className = 'wrist';
        element.append(action);
        document.body.append(element);
        vi.spyOn(element, 'getBoundingClientRect').mockReturnValue({
            left: 10,
            top: 20,
            width: 100,
            height: 200,
            right: 110,
            bottom: 220,
            x: 10,
            y: 20,
            toJSON: () => {}
        });
        const nativeClick = vi.fn();
        action.addEventListener('click', nativeClick);
        const onMove = vi.fn();
        const onClick = vi.fn();
        const cleanup = installWristPointerDesktopTest({
            element,
            onMove,
            onClick
        });

        action.dispatchEvent(
            new MouseEvent('click', {
                bubbles: true,
                detail: 1,
                clientX: 40,
                clientY: 60
            })
        );

        expect(nativeClick).not.toHaveBeenCalled();
        expect(onClick).toHaveBeenCalledOnce();

        cleanup();
        element.remove();
    });

    it('removes desktop listeners when the simulator is cleaned up', () => {
        const element = createTestElement();
        const onMove = vi.fn();
        const onClick = vi.fn();
        const cleanup = installWristPointerDesktopTest({
            element,
            onMove,
            onClick
        });

        cleanup();
        element.emit('pointermove', { clientX: 60, clientY: 120 });
        element.emit('pointerleave', {});
        element.emit('click', {
            clientX: 60,
            clientY: 120,
            detail: 1,
            target: element
        });

        expect(onMove).not.toHaveBeenCalled();
        expect(onClick).not.toHaveBeenCalled();
        expect(element.removeEventListener).toHaveBeenCalledTimes(5);
    });

    it('marks the pointer as pressed while the desktop trigger is held', () => {
        const element = createTestElement();
        const onMove = vi.fn();
        const cleanup = installWristPointerDesktopTest({ element, onMove });

        element.emit('pointerdown', { clientX: 30, clientY: 40 });
        element.emit('pointerup', { clientX: 30, clientY: 40 });

        expect(onMove).toHaveBeenNthCalledWith(1, {
            x: 0.2,
            y: 0.1,
            visible: true,
            pressed: true,
            hand: 'right'
        });
        expect(onMove).toHaveBeenNthCalledWith(2, {
            x: 0.2,
            y: 0.1,
            visible: true,
            pressed: false,
            hand: 'right'
        });

        cleanup();
    });
});
