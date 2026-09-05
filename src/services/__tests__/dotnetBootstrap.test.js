import { describe, expect, it, vi } from 'vitest';

import { initializeDotnet } from '../../../src-electron/dotnetBootstrap.cjs';

describe('initializeDotnet', () => {
    it('initializes Electron host objects in the existing order', () => {
        const calls = [];
        const interopApi = {
            getDotNetObject: vi.fn(
                (className) =>
                    new Proxy(
                        {},
                        {
                            get:
                                (_, methodName) =>
                                (...args) =>
                                    calls.push([className, methodName, args])
                        }
                    )
            )
        };
        const args = ['--no-updater'];

        initializeDotnet({
            interopApi,
            version: '2026.03.28',
            args
        });

        expect(calls).toEqual([
            ['ProgramElectron', 'PreInit', ['2026.03.28', args]],
            ['VRCXStorage', 'Load', []],
            ['ProgramElectron', 'Init', []],
            ['SQLite', 'Init', []],
            ['AppApiElectron', 'Init', []],
            ['Discord', 'Init', []],
            ['WebApi', 'Init', []],
            ['LogWatcher', 'Init', []],
            ['SystemMonitorElectron', 'Init', []],
            ['AppApiVrElectron', 'Init', []]
        ]);
        expect(interopApi.getDotNetObject).toHaveBeenCalledTimes(10);
    });
});
