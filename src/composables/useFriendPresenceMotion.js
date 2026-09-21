import { onBeforeUnmount, watch } from 'vue';

/** Animate actual presence changes without animating virtual scroll mounts. */
export function useFriendPresenceMotion(getFriends, isEnabled) {
    let previous = new Map();
    const changed = new Map();
    const animations = new Set();
    watch(
        () =>
            getFriends().map((friend) => [
                friend.id,
                friend.state === 'online'
            ]),
        (entries) => {
            const now = Date.now();
            const next = new Map(entries);
            for (const [id, online] of next) {
                if (previous.has(id) && previous.get(id) !== online) {
                    changed.set(id, now);
                }
            }
            for (const [id, time] of changed) {
                if (!next.has(id) || now - time > 500) changed.delete(id);
            }
            previous = next;
        },
        { immediate: true }
    );

    function animate(element, done, entering) {
        const time = changed.get(element.dataset.friendId);
        if (
            !isEnabled() ||
            window.matchMedia('(prefers-reduced-motion: reduce)').matches ||
            time === undefined ||
            Date.now() - time > 500 ||
            !element.animate
        ) {
            done();
            return;
        }
        if (!entering) element.inert = true;
        // The virtualizer owns the row transform; animate opacity only.
        const animation = element.animate(
            entering
                ? [{ opacity: 0 }, { opacity: 1 }]
                : [{ opacity: 1 }, { opacity: 0 }],
            { duration: entering ? 180 : 120, easing: 'ease-out' }
        );
        animations.add(animation);
        const finish = () => {
            animations.delete(animation);
            done();
        };
        animation.onfinish = finish;
        animation.oncancel = finish;
    }

    onBeforeUnmount(() => {
        for (const animation of animations) animation.cancel();
        animations.clear();
        changed.clear();
    });

    return {
        presenceEnter: (element, done) => animate(element, done, true),
        presenceLeave: (element, done) => animate(element, done, false)
    };
}
