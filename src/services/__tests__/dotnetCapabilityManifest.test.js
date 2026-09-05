import { describe, expect, it } from 'vitest';

import manifest from '../../../src-electron/dotnetCapabilityManifest.cjs';
import InteropApi from '../../../src-electron/InteropApi.js';

const {
    assertAllowedDotNetCall,
    DOTNET_CAPABILITIES,
    DOTNET_CAPABILITY_SCHEMAS,
    isAllowedDotNetClass,
    isAllowedDotNetMethod
} = manifest;

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

    it('defines a parameter schema for every allowlisted method', () => {
        for (const [className, methods] of Object.entries(
            DOTNET_CAPABILITIES
        )) {
            expect(
                Object.keys(DOTNET_CAPABILITY_SCHEMAS[className]).sort()
            ).toEqual([...methods].sort());
        }
    });

    it('enforces method-specific arity and primitive argument types', () => {
        expect(() =>
            assertAllowedDotNetCall('AppApiElectron', 'SetVR', [
                true,
                false,
                true,
                false,
                1
            ])
        ).not.toThrow();
        expect(() =>
            assertAllowedDotNetCall('AppApiElectron', 'SetVR', [
                true,
                false,
                true,
                false,
                'left'
            ])
        ).toThrow(/argument 5 is invalid/);
        expect(() =>
            assertAllowedDotNetCall('AppApiElectron', 'GetVersion', [
                'unexpected'
            ])
        ).toThrow(/expected 0 arguments/);
        expect(() =>
            assertAllowedDotNetCall('AppApiElectron', 'OpenLink', [{}])
        ).toThrow(/argument 1 is invalid/);
    });

    it('keeps optional and host-specific values compatible with existing calls', () => {
        expect(() =>
            assertAllowedDotNetCall(
                'AppApiElectron',
                'OpenFileSelectorDialog',
                [null, '.json', 'JSON Files (*.json)|*.json']
            )
        ).not.toThrow();
        expect(() =>
            assertAllowedDotNetCall('AppApiElectron', 'SetVRChatRegistryKey', [
                'KEY',
                'value'
            ])
        ).not.toThrow();
        expect(() =>
            assertAllowedDotNetCall('SQLite', 'Execute', [
                'select @value',
                new Map([['value', null]])
            ])
        ).not.toThrow();
        expect(() =>
            assertAllowedDotNetCall('Discord', 'SetAssets', [
                null,
                'state',
                null,
                'large',
                'large text',
                null,
                null,
                0,
                0,
                null,
                0,
                0,
                null,
                null,
                null,
                0,
                0
            ])
        ).not.toThrow();
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
