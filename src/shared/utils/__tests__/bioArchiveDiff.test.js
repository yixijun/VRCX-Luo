import { describe, expect, test } from 'vitest';

import {
    collapseEqualBioArchiveDiffSpans,
    formatBioArchiveDiff,
    formatLatestBioDiff,
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

    test('does not highlight visually equivalent slash characters', () => {
        const previousBio = 'CN60%⁄EN50%⁄JPN1.145141919810%';
        const currentBio = 'CN60%/EN50%/JPN1.145141919810%';
        const formatDifference = (previous, current) =>
            previous === current
                ? current
                : `<span class="x-text-removed">${previous}</span> <span class="x-text-added">${current}</span>`;

        expect(
            formatBioArchiveDiff(
                previousBio,
                currentBio,
                formatDifference
            )
        ).toBe(currentBio);
    });

    test('still highlights real text changes near equivalent slashes', () => {
        const formatDifference = (previous, current) =>
            previous === current
                ? current
                : `<span class="x-text-removed">${previous}</span> <span class="x-text-added">${current}</span>`;
        const result = formatBioArchiveDiff(
            'CN60%⁄EN50%',
            'CN61%/EN50%',
            formatDifference
        );

        expect(result).toContain('x-text-removed');
        expect(result).toContain('CN60%/EN50%');
        expect(result).toContain('x-text-added');
        expect(result).toContain('CN61%/EN50%');
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

    test('compares only the latest bio change instead of widening to older records', () => {
        const formatDifference = (previousBio, currentBio) => `${previousBio} -> ${currentBio}`;
        const latestRecord = {
            previousBio: '保留内容',
            bio: '保留内容，新增一句'
        };

        expect(formatLatestBioDiff(latestRecord, latestRecord.bio, formatDifference)).toBe(
            '保留内容 -> 保留内容,新增一句'
        );
    });

    test('matches the archive diff when the first captured bio was added from empty', () => {
        const formatDifference = (previousBio, currentBio) =>
            `<span class="x-text-added">${currentBio}</span>`;

        expect(
            formatLatestBioDiff(
                { previousBio: '', bio: '整段简介' },
                '整段简介',
                formatDifference
            )
        ).toBe('<span class="x-text-added">整段简介</span>');
    });

    test('marks text as added when an older empty bio record establishes the baseline', () => {
        const formatDifference = (previousBio, currentBio) =>
            `<span class="x-text-added">${currentBio}</span>`;

        expect(
            formatLatestBioDiff(
                { previousBio: '', bio: '改变自己，改变世界' },
                '改变自己，改变世界',
                formatDifference
            )
        ).toBe('<span class="x-text-added">改变自己,改变世界</span>');
    });

    test('marks a live bio added after the latest captured empty bio', () => {
        const formatDifference = (previousBio, currentBio) =>
            `<span class="x-text-added">${currentBio}</span>`;

        expect(
            formatLatestBioDiff(
                { previousBio: '', bio: '' },
                '新的简介',
                formatDifference
            )
        ).toBe('<span class="x-text-added">新的简介</span>');
    });
});
