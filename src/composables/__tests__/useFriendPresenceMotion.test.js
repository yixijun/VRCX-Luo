import { afterEach, describe, expect, it, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import { defineComponent, nextTick, ref } from 'vue';
import { useFriendPresenceMotion } from '../useFriendPresenceMotion';

let wrapper;
afterEach(() => {
    wrapper?.unmount();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
});

function setup() {
    const friends = ref([{ id: 'a', state: 'offline' }]);
    const enabled = ref(true);
    const reduced = ref(false);
    vi.stubGlobal('matchMedia', () => ({ matches: reduced.value }));
    let hooks;
    wrapper = mount(
        defineComponent({
            setup() {
                hooks = useFriendPresenceMotion(
                    () => friends.value,
                    () => enabled.value
                );
                return () => null;
            }
        })
    );
    const animation = { cancel: vi.fn() };
    const element = {
        dataset: { friendId: 'a' },
        animate: vi.fn(() => animation)
    };
    return { friends, enabled, reduced, hooks, element, animation };
}

describe('friend presence motion', () => {
    it('skips initial display, new friends and ordinary virtual-scroll mounts', async () => {
        const { friends, hooks, element } = setup();
        const done = vi.fn();
        hooks.presenceEnter(element, done);
        friends.value.push({ id: 'b', state: 'online' });
        await nextTick();
        hooks.presenceEnter({ ...element, dataset: { friendId: 'b' } }, done);
        hooks.presenceLeave(element, done);
        expect(element.animate).not.toHaveBeenCalled();
        expect(done).toHaveBeenCalledTimes(3);
    });

    it('animates entry and removal after online and offline changes without changing position', async () => {
        const { friends, hooks, element, animation } = setup();
        friends.value[0].state = 'online';
        await nextTick();
        const entered = vi.fn();
        hooks.presenceEnter(element, entered);
        expect(element.animate).toHaveBeenLastCalledWith(
            [{ opacity: 0 }, { opacity: 1 }],
            expect.objectContaining({ duration: 180 })
        );
        expect(entered).not.toHaveBeenCalled();
        animation.onfinish();
        expect(entered).toHaveBeenCalledOnce();
        friends.value[0].state = 'offline';
        await nextTick();
        const removed = vi.fn();
        hooks.presenceLeave(element, removed);
        expect(element.inert).toBe(true);
        expect(element.animate).toHaveBeenLastCalledWith(
            [{ opacity: 1 }, { opacity: 0 }],
            expect.objectContaining({ duration: 120 })
        );
        animation.onfinish();
        expect(removed).toHaveBeenCalledOnce();
    });

    it('respects both animation preferences and expires changes before later scrolling', async () => {
        const { friends, enabled, reduced, hooks, element } = setup();
        const now = vi.spyOn(Date, 'now').mockReturnValue(1000);
        friends.value[0].state = 'online';
        await nextTick();
        const done = vi.fn();
        enabled.value = false;
        hooks.presenceEnter(element, done);
        enabled.value = true;
        reduced.value = true;
        hooks.presenceLeave(element, done);
        reduced.value = false;
        now.mockReturnValue(1600);
        hooks.presenceEnter(element, done);
        expect(element.animate).not.toHaveBeenCalled();
        expect(done).toHaveBeenCalledTimes(3);
    });

    it('cancels in-flight animations when the sidebar unmounts', async () => {
        const { friends, hooks, element, animation } = setup();
        friends.value[0].state = 'online';
        await nextTick();
        hooks.presenceEnter(element, vi.fn());
        wrapper.unmount();
        expect(animation.cancel).toHaveBeenCalledOnce();
    });
});
