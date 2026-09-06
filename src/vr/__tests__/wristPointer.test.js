import { describe, expect, it, vi } from 'vitest';

import {
    defaultWristPointer,
    dispatchWristPointerClick,
    getWristPointerStyle,
    normalizeWristPointer
} from '../wristPointer';

describe('wristPointer', () => {
    it('accepts the JSON payload used by the CEF bridge', () => {
        expect(
            normalizeWristPointer(
                JSON.stringify({
                    x: 0.2,
                    y: 0.8,
                    visible: true,
                    pressed: true,
                    hand: 'right'
                })
            )
        ).toEqual({
            x: 0.2,
            y: 0.8,
            visible: true,
            pressed: true,
            hand: 'right'
        });
    });

    it('clamps malformed coordinates and preserves hidden pointer state', () => {
        expect(
            normalizeWristPointer({
                x: 3,
                y: -1,
                visible: false,
                pressed: 'yes'
            })
        ).toEqual({
            x: 1,
            y: 0,
            visible: false,
            pressed: false,
            hand: 'right'
        });
        expect(normalizeWristPointer('not-json')).toEqual(defaultWristPointer);
    });

    it('converts normalized coordinates to CSS percentages', () => {
        expect(getWristPointerStyle({ x: 0.125, y: 0.625 })).toEqual({
            left: '12.5%',
            top: '62.5%'
        });
    });

    it('routes a click to the opted-in wrist action under the cursor', () => {
        const wrist = document.createElement('div');
        wrist.className = 'wrist';
        const action = document.createElement('button');
        action.dataset.vrAction = 'page-next';
        const click = vi.spyOn(action, 'click');
        wrist.append(action);
        document.body.append(wrist);
        vi.spyOn(wrist, 'getBoundingClientRect').mockReturnValue({
            left: 10,
            top: 20,
            width: 512,
            height: 510,
            right: 522,
            bottom: 530,
            x: 10,
            y: 20,
            toJSON: () => {}
        });
        const documentRef = {
            querySelector: () => wrist,
            elementFromPoint: () => action
        };

        expect(
            dispatchWristPointerClick(
                { x: 0.25, y: 0.5, visible: true },
                documentRef
            )
        ).toBe(true);
        expect(click).toHaveBeenCalledOnce();
    });

    it('does not click arbitrary content or hidden pointers', () => {
        const wrist = document.createElement('div');
        wrist.className = 'wrist';
        document.body.append(wrist);
        const documentRef = {
            querySelector: () => wrist,
            elementFromPoint: () => wrist
        };

        expect(
            dispatchWristPointerClick(
                { x: 0.5, y: 0.5, visible: true },
                documentRef
            )
        ).toBe(false);
        expect(
            dispatchWristPointerClick(
                { x: 0.5, y: 0.5, visible: false },
                documentRef
            )
        ).toBe(false);
    });
});
