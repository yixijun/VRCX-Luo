import { describe, expect, test } from 'vitest';

import {
    collapseEqualBioArchiveDiffSpans,
    normalizeBioForArchiveDiff
} from '../bioArchiveDiff';

describe('shared/utils/bioArchiveDiff', () => {
    test('normalizes full-width punctuation for archive diffs', () => {
        expect(normalizeBioForArchiveDiff('半个作者？')).toBe('半个作者?');
        expect(normalizeBioForArchiveDiff('（test）')).toBe('(test)');
    });

    test('normalizes low quotation marks that visually replace commas', () => {
        expect(normalizeBioForArchiveDiff('Kitsune\u201A maintenance\u201A monitoring\u201A')).toBe(
            'Kitsune, maintenance, monitoring,'
        );
    });

    test('collapses adjacent equal removed and added spans', () => {
        const html =
            'Together with my collaborator <span class="x-text-removed">Kitsune,</span> <span class="x-text-added">Kitsune,</span> I oversee daily server <span class="x-text-removed">maintenance,</span> <span class="x-text-added">maintenance,</span> security <span class="x-text-removed">monitoring,</span> <span class="x-text-added">monitoring,</span> and community management.';

        const collapsed = collapseEqualBioArchiveDiffSpans(html);

        expect(collapsed).toContain('collaborator Kitsune, I oversee');
        expect(collapsed).toContain('server maintenance, security monitoring, and');
        expect(collapsed).not.toContain('x-text-removed">Kitsune,');
        expect(collapsed).not.toContain('x-text-added">Kitsune,');
        expect(collapsed).not.toContain('x-text-removed">maintenance,');
        expect(collapsed).not.toContain('x-text-added">monitoring,');
    });
});
