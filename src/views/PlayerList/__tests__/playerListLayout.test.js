import { describe, expect, test } from 'vitest';

import { calculatePlayerListLayout } from '../playerListLayout';

describe('calculatePlayerListLayout', () => {
    test('shrinks the summary to its content in a tall window', () => {
        const layout = calculatePlayerListLayout({
            containerHeight: 900,
            summaryContentHeight: 180
        });

        expect(layout.summarySize).toBe(20);
        expect(layout.tableMinSize).toBe(32);
    });

    test('caps a long summary so the player table stays usable', () => {
        const layout = calculatePlayerListLayout({
            containerHeight: 900,
            summaryContentHeight: 800
        });

        expect(layout.summarySize).toBe(68);
        expect(layout.summaryMaxSize).toBe(68);
        expect(layout.tableMinSize).toBe(32);
    });

    test('reserves more room for the player table in a short window', () => {
        const layout = calculatePlayerListLayout({
            containerHeight: 400,
            summaryContentHeight: 300
        });

        expect(layout.summaryMaxSize).toBe(40);
        expect(layout.summarySize).toBe(40);
        expect(layout.tableMinSize).toBe(60);
    });

    test('keeps a manual pixel offset while still recalculating the adaptive size', () => {
        const layout = calculatePlayerListLayout({
            containerHeight: 900,
            summaryContentHeight: 180,
            summaryOffset: 90
        });

        expect(layout.summarySize).toBe(30);

        const resizedLayout = calculatePlayerListLayout({
            containerHeight: 600,
            summaryContentHeight: 144,
            summaryOffset: 90
        });

        expect(resizedLayout.summarySize).toBe(39);
    });
});
