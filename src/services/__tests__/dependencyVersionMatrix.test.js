import { describe, expect, it } from 'vitest';

import {
    createVersionMatrix,
    inspectVersionMatrix,
    parseCsprojManifest
} from '../../../build-scripts/dependencyVersionMatrix.cjs';

const packageJson = {
    name: 'fixture',
    version: '2026.09.05',
    dependencies: { 'node-api-dotnet': '^0.9.19' },
    devDependencies: {
        electron: '^40.4.1',
        'electron-builder': '^26.8.1',
        pinia: '^3.0.4',
        typescript: '^5.9.3',
        vite: '^8.0.10',
        vitest: '^4.1.5',
        vue: '^3.5.33',
        'vue-i18n': '^11.4.0'
    }
};

const packageLock = {
    version: 3,
    packages: {
        '': { version: '2026.09.05' },
        'node_modules/node-api-dotnet': { version: '0.9.19' },
        'node_modules/electron': { version: '40.4.1' },
        'node_modules/electron-builder': { version: '26.8.1' },
        'node_modules/pinia': { version: '3.0.4' },
        'node_modules/typescript': { version: '5.9.3' },
        'node_modules/vite': { version: '8.0.16' },
        'node_modules/vitest': { version: '4.1.5' },
        'node_modules/vue': { version: '3.5.33' },
        'node_modules/vue-i18n': { version: '11.4.0' }
    }
};

describe('dependency version matrix', () => {
    it('parses target frameworks and package references', () => {
        expect(
            parseCsprojManifest(
                'VRCX-Electron.csproj',
                '<TargetFramework>net9.0</TargetFramework><PackageReference Include="NLog" Version="6.1.2" />'
            )
        ).toEqual({
            fileName: 'VRCX-Electron.csproj',
            targetFramework: 'net9.0',
            packageReferences: [{ name: 'NLog', version: '6.1.2' }]
        });
    });

    it('accepts complete manifests and reports cross-project drift separately', () => {
        const result = createVersionMatrix({
            packageJson,
            packageLock,
            csprojFiles: [
                {
                    fileName: 'VRCX-Electron.csproj',
                    content:
                        '<TargetFramework>net9.0</TargetFramework><PackageReference Include="Microsoft.JavaScript.NodeApi" Version="0.9.19" /><PackageReference Include="Microsoft.JavaScript.NodeApi.Generator" Version="0.9.19" /><PackageReference Include="NLog" Version="6.1.2" />'
                },
                {
                    fileName: 'VRCX-Electron-arm64.csproj',
                    content:
                        '<TargetFramework>net9.0</TargetFramework><PackageReference Include="Microsoft.JavaScript.NodeApi" Version="0.9.18" /><PackageReference Include="Microsoft.JavaScript.NodeApi.Generator" Version="0.9.18" /><PackageReference Include="NLog" Version="6.0.7" />'
                }
            ]
        });

        expect(result.errors).toEqual([]);
        expect(result.drifts).toEqual([
            {
                dependency: 'Microsoft.JavaScript.NodeApi',
                entries: [
                    { project: 'VRCX-Electron.csproj', version: '0.9.19' },
                    { project: 'VRCX-Electron-arm64.csproj', version: '0.9.18' }
                ]
            },
            {
                dependency: 'Microsoft.JavaScript.NodeApi.Generator',
                entries: [
                    { project: 'VRCX-Electron.csproj', version: '0.9.19' },
                    { project: 'VRCX-Electron-arm64.csproj', version: '0.9.18' }
                ]
            },
            {
                dependency: 'NLog',
                entries: [
                    { project: 'VRCX-Electron.csproj', version: '6.1.2' },
                    { project: 'VRCX-Electron-arm64.csproj', version: '6.0.7' }
                ]
            }
        ]);
    });

    it('rejects lock drift and mismatched coupled package versions', () => {
        const result = inspectVersionMatrix({
            package: {
                name: 'fixture',
                version: '2026.09.05',
                lockRootVersion: '2026.08.23',
                critical: []
            },
            dotnet: {
                projects: [
                    {
                        fileName: 'VRCX-Cef.csproj',
                        targetFramework: 'net10.0',
                        packageReferences: [
                            {
                                name: 'CefSharp.OffScreen.NETCore',
                                version: '146.0.100'
                            },
                            {
                                name: 'CefSharp.WinForms.NETCore',
                                version: '145.0.100'
                            }
                        ]
                    }
                ],
                sharedPackages: []
            }
        });

        expect(result.errors).toEqual([
            'package-lock root version is 2026.08.23; expected 2026.09.05',
            'VRCX-Cef.csproj: coupled packages CefSharp.OffScreen.NETCore / CefSharp.WinForms.NETCore must share a version'
        ]);
    });
});
