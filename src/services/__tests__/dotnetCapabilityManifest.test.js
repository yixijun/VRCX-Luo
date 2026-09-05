import { describe, expect, it } from 'vitest';

import manifest from '../../../src-electron/dotnetCapabilityManifest.cjs';
import InteropApi from '../../../src-electron/InteropApi.js';

const { assertAllowedDotNetCall, isAllowedDotNetClass, isAllowedDotNetMethod } =
    manifest;

describe('dotnet capability manifest', () => {
    it('contains every renderer-facing Electron host class', () => {
        expect(isAllowedDotNetClass('AppApiElectron')).toBe(true);
        expect(isAllowedDotNetClass('AppApiVrElectron')).toBe(true);
        expect(isAllowedDotNetClass('WebApi')).toBe(true);
        expect(isAllowedDotNetClass('VRCXStorage')).toBe(true);
        expect(isAllowedDotNetClass('SQLite')).toBe(true);
        expect(isAllowedDotNetClass('LogWatcher')).toBe(true);
        expect(isAllowedDotNetClass('Discord')).toBe(true);
        expect(isAllowedDotNetClass('AssetBundleManager')).toBe(true);
        expect(isAllowedDotNetClass('Update')).toBe(true);
        expect(isAllowedDotNetClass('UnknownHostClass')).toBe(false);
    });

    it('allows known methods and rejects arbitrary method names', () => {
        expect(isAllowedDotNetMethod('AppApiElectron', 'GetVersion')).toBe(
            true
        );
        expect(
            isAllowedDotNetMethod(
                'AppApiVrElectron',
                'GetExecuteVrOverlayFunctionQueue'
            )
        ).toBe(true);
        expect(isAllowedDotNetMethod('WebApi', 'ExecuteJson')).toBe(true);
        expect(isAllowedDotNetMethod('AppApiElectron', 'constructor')).toBe(
            false
        );
        expect(
            isAllowedDotNetMethod('AppApiElectron', 'RunArbitraryCode')
        ).toBe(false);
    });

    it('validates the IPC argument envelope without restricting valid values', () => {
        expect(() =>
            assertAllowedDotNetCall('AppApiElectron', 'GetVersion', [])
        ).not.toThrow();
        expect(() =>
            assertAllowedDotNetCall('SQLite', 'Execute', [
                'select @value',
                { value: null }
            ])
        ).not.toThrow();
        expect(() =>
            assertAllowedDotNetCall('UnknownHostClass', 'GetVersion', [])
        ).toThrow(/not allowed/);
        expect(() =>
            assertAllowedDotNetCall('AppApiElectron', 'RunArbitraryCode', [])
        ).toThrow(/not allowed/);
        expect(() =>
            assertAllowedDotNetCall('AppApiElectron', 'GetVersion', undefined)
        ).toThrow(/args must be an array/);
    });

    it('enforces the manifest at the main-process .NET boundary', () => {
        const interopApi = new InteropApi();

        expect(() => interopApi.getDotNetObject('UnknownHostClass')).toThrow(
            /class is not allowed/
        );
        expect(() =>
            interopApi.callMethod('AppApiElectron', 'RunArbitraryCode', [])
        ).toThrow(/call is not allowed/);
    });
});
