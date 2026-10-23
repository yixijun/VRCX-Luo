import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { buildVrWorkspaceCatalog } from '../catalog';
import { mapWorkspacePoint } from '../input';

describe('VR workspace feature coverage', () => {
    it('includes every named content route, alongside dynamic dashboards', () => {
        const source = readFileSync('src/plugins/router.js', 'utf8');
        const names = [
            ...new Set(
                [...source.matchAll(/name: '([^']+)'/g)].map(
                    (match) => match[1]
                )
            )
        ].filter((name) => !['login', 'charts'].includes(name));
        const entries = buildVrWorkspaceCatalog(
            names.map((name) => ({
                name,
                path: name === 'dashboard' ? '/dashboard/:id' : `/${name}`
            })),
            [{ id: 'custom', name: '自定义' }]
        );
        for (const name of names)
            expect(
                entries.some((entry) => entry.to.name === name),
                name
            ).toBe(true);
        expect(
            entries.find((entry) => entry.to.name === 'dashboard').to.params
        ).toEqual({ id: 'custom' });
    });
    it('automatically exposes future content pages and excludes login and redirects', () => {
        const entries = buildVrWorkspaceCatalog([
            { name: 'future', path: '/future' },
            { name: 'login' },
            { name: 'charts', redirect: '/charts/instance' }
        ]);
        expect(entries.map((entry) => entry.id)).toEqual(['future']);
    });
});

describe('VR workspace hit region', () => {
    const root = { left: 0, top: 512, width: 1024, height: 1024 };
    const image = { left: 0, top: 612, width: 1024, height: 924 };
    it.each([
        [0, 0],
        [0, 1],
        [1, 0],
        [1, 1],
        [0.5, 0.5]
    ])('maps viewport edge %s, %s through the letterbox', (x, y) => {
        // 1280x1024 fits as 1024x819.2, centered inside the image area.
        const px = x * 1024;
        const py = 612 + (924 - 819.2) / 2 + y * 819.2;
        const mapped = mapWorkspacePoint(
            root,
            image,
            px / 1024,
            (py - 512) / 1024
        );
        expect(mapped.x).toBeCloseTo(x);
        expect(mapped.y).toBeCloseTo(y);
    });
    it('rejects toolbar, blank borders and invalid coordinates', () => {
        expect(mapWorkspacePoint(root, image, 0.5, 0.01)).toBeNull();
        expect(mapWorkspacePoint(root, image, 0.5, 0.11)).toBeNull();
        expect(mapWorkspacePoint(root, image, NaN, 0.5)).toBeNull();
        expect(mapWorkspacePoint(root, image, 1.1, 0.5)).toBeNull();
    });
});
