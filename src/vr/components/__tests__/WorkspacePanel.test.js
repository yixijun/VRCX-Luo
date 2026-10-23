import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { flushPromises, mount } from '@vue/test-utils';
import WorkspacePanel from '../WorkspacePanel.vue';

describe('VR workspace controller input', () => {
    let wrapper, submit;
    const commands = () => submit.mock.calls.map(([json]) => JSON.parse(json));
    beforeEach(async () => {
        vi.useFakeTimers();
        submit = vi.fn(async () => true);
        vi.stubGlobal('AppApiVr', { SubmitDashboardAction: submit });
        wrapper = mount(WorkspacePanel, { attachTo: document.body });
        await flushPromises();
        vi.spyOn(wrapper.element, 'getBoundingClientRect').mockReturnValue({
            left: 0,
            top: 512,
            width: 1024,
            height: 1024
        });
        vi.spyOn(
            wrapper.find('.workspace-image').element,
            'getBoundingClientRect'
        ).mockReturnValue({ left: 0, top: 612, width: 1024, height: 924 });
        wrapper.vm.frame(
            JSON.stringify({
                image: 'data:image/jpeg;base64,AA==',
                width: 1280,
                height: 1024
            })
        );
        await wrapper.vm.$nextTick();
    });
    afterEach(() => {
        wrapper.unmount();
        vi.useRealTimers();
        vi.unstubAllGlobals();
        vi.restoreAllMocks();
    });
    const input = (event) =>
        JSON.stringify({ x: 0.5, y: 0.55, button: 'left', ...event });
    it('starts the workspace and sends real down/move/up events for dragging', async () => {
        expect(commands()[0]).toMatchObject({
            action: 'workspace',
            type: 'open'
        });
        wrapper.vm.input(input({ phase: 'down' }));
        wrapper.vm.input(input({ phase: 'move', x: 0.6 }));
        wrapper.vm.input(input({ phase: 'up', x: 0.6 }));
        await flushPromises();
        expect(
            commands()
                .slice(1)
                .map((command) => command.input.type)
        ).toEqual(['down', 'move', 'up']);
        expect(commands()[2].input.pressed).toBe(true);
    });
    it('retains the right button during movement and release outside the viewport', () => {
        wrapper.vm.input(input({ phase: 'down', button: 'right' }));
        wrapper.vm.input(input({ phase: 'move' }));
        wrapper.vm.input(input({ phase: 'up', y: 0 }));
        expect(commands().at(-1).input).toMatchObject({
            type: 'up',
            button: 'right'
        });
        expect(commands()[2].input).toMatchObject({
            type: 'move',
            button: 'right',
            pressed: true
        });
    });
    it('forwards horizontal and vertical scrolling and clamps deltas', () => {
        wrapper.vm.input(JSON.stringify({ scroll: 5000, scrollX: -5000 }));
        expect(commands().at(-1).input).toMatchObject({
            type: 'scroll',
            deltaX: -1200,
            deltaY: 1200
        });
    });
    it('does not click an errored or disconnected workspace', () => {
        wrapper.vm.status(JSON.stringify({ error: 'disconnected' }));
        wrapper.vm.input(input({ phase: 'down' }));
        expect(commands()).toHaveLength(1);
    });
    it('stops the session and heartbeat when closed', async () => {
        wrapper.unmount();
        const count = commands().length;
        await vi.advanceTimersByTimeAsync(6000);
        expect(commands()).toHaveLength(count);
        expect(commands().at(-1).type).toBe('close');
    });
    it('releases a held right button before closing the session', () => {
        wrapper.vm.input(input({ phase: 'down', button: 'right' }));
        wrapper.unmount();
        expect(commands().at(-2).input).toMatchObject({
            type: 'up',
            button: 'right'
        });
        expect(commands().at(-1).type).toBe('close');
    });
});
