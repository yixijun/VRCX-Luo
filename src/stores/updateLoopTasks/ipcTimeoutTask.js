/**
 * Creates the IPC timeout task.
 *
 * @param {object} dependencies
 * @param {(enabled: boolean) => void} dependencies.setIpcEnabled
 * @returns {{ tick: () => void, setNext: (value: number) => void }}
 */
export function createIpcTimeoutTask({ setIpcEnabled }) {
    let nextTimeout = 0;

    return {
        tick() {
            if (--nextTimeout <= 0) {
                setIpcEnabled(false);
            }
        },

        setNext(value) {
            nextTimeout = value;
        }
    };
}
