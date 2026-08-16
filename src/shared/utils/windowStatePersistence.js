/**
 * Coalesces rapid window position/size updates into one persistence call.
 * Window move events can fire hundreds of times during a single drag.
 */
export function createWindowStateSaver(save, delay = 300) {
    let timer = null;
    let latestState;

    const schedule = (state) => {
        latestState = state;
        if (timer !== null) {
            clearTimeout(timer);
        }
        timer = setTimeout(() => {
            timer = null;
            const stateToSave = latestState;
            latestState = undefined;
            save(stateToSave);
        }, delay);
    };

    schedule.cancel = () => {
        if (timer !== null) {
            clearTimeout(timer);
            timer = null;
        }
        latestState = undefined;
    };

    return schedule;
}
