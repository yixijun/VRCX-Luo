import { describe, expect, it, vi } from 'vitest';

import { createDesktopNotificationController } from '../../../src-electron/desktopNotificationController.cjs';

function createNotificationClass() {
    const instances = [];
    const Notification = vi.fn(function Notification(options) {
        const handlers = new Map();
        this.options = options;
        this.on = vi.fn((eventName, handler) => {
            handlers.set(eventName, handler);
        });
        this.close = vi.fn();
        this.removeAllListeners = vi.fn(() => handlers.clear());
        this.show = vi.fn();
        this.emit = (eventName) => handlers.get(eventName)?.();
        instances.push(this);
    });
    return { Notification, instances };
}

describe('desktop notification controller', () => {
    it('does not create a notification when disabled', () => {
        const { Notification, instances } = createNotificationClass();
        const controller = createDesktopNotificationController({
            Notification,
            isEnabled: () => false,
            getActiveNotification: () => null,
            setActiveNotification: vi.fn()
        });

        controller.show('Title', 'Body', 'icon.png', true);

        expect(instances).toHaveLength(0);
    });

    it('preserves creation options and replaces the active notification', () => {
        const { Notification, instances } = createNotificationClass();
        let activeNotification = null;
        const setActiveNotification = vi.fn((value) => {
            activeNotification = value;
        });
        const controller = createDesktopNotificationController({
            Notification,
            isEnabled: () => true,
            getActiveNotification: () => activeNotification,
            setActiveNotification
        });

        controller.show('Title', 'Body', 'icon.png', 1);
        controller.show('Next', 'Other', '', 0);

        expect(Notification).toHaveBeenNthCalledWith(1, {
            title: 'Title',
            body: 'Body',
            icon: 'icon.png',
            silent: true
        });
        expect(Notification).toHaveBeenNthCalledWith(2, {
            title: 'Next',
            body: 'Other',
            icon: '',
            silent: false
        });
        expect(instances[0].close).toHaveBeenCalledOnce();
        expect(instances[0].removeAllListeners).not.toHaveBeenCalled();
        expect(instances[0].show).toHaveBeenCalledOnce();
        expect(instances[1].show).toHaveBeenCalledOnce();
        expect(activeNotification).toBe(instances[1]);
    });

    it('clears only the current notification after close', () => {
        const { Notification, instances } = createNotificationClass();
        let activeNotification = null;
        const setActiveNotification = vi.fn((value) => {
            activeNotification = value;
        });
        const controller = createDesktopNotificationController({
            Notification,
            isEnabled: () => true,
            getActiveNotification: () => activeNotification,
            setActiveNotification
        });

        controller.show('First', '', '', false);
        const first = instances[0];
        controller.show('Second', '', '', false);
        const second = instances[1];

        first.emit('close');
        expect(activeNotification).toBe(second);
        second.emit('close');
        expect(second.removeAllListeners).toHaveBeenCalledOnce();
        expect(activeNotification).toBeNull();
    });
});
