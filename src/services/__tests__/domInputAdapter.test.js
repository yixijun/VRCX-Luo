import { describe, expect, it } from 'vitest';

import { resolveInputElement } from '../domInputAdapter';

describe('resolveInputElement', () => {
    it('resolves a selector through the supplied document adapter', () => {
        const input = { value: 'selected' };
        const documentRef = {
            querySelector: (selector) =>
                selector === '#image-input' ? input : null
        };

        expect(resolveInputElement('#image-input', documentRef)).toBe(input);
        expect(resolveInputElement('#missing', documentRef)).toBeNull();
    });

    it('supports selector callbacks and direct input objects', () => {
        const input = { value: 'selected' };
        expect(resolveInputElement(() => input)).toBe(input);
        expect(resolveInputElement(input)).toBe(input);
    });

    it('returns null when no selector is supplied', () => {
        expect(resolveInputElement('')).toBeNull();
        expect(resolveInputElement(null)).toBeNull();
    });
});
