import { beforeEach, describe, expect, it } from 'vitest';

import {
    clearDialogMotionOrigin,
    dialogMotionOrigin,
    setDialogMotionOrigin
} from '../dialogMotionOrigin';

describe('dialog motion origin', () => {
    beforeEach(() => {
        clearDialogMotionOrigin();
    });

    it('stores a normalized rectangle from the clicked element', () => {
        setDialogMotionOrigin({
            getBoundingClientRect: () => ({
                left: 12.5,
                top: 24,
                width: 220,
                height: 164,
                right: 232.5,
                bottom: 188
            })
        });

        expect(dialogMotionOrigin.value).toEqual({
            left: 12.5,
            top: 24,
            width: 220,
            height: 164
        });
    });

    it('clears the origin when the source rectangle is invalid', () => {
        setDialogMotionOrigin({
            left: 10,
            top: 20,
            width: 100,
            height: 80
        });
        setDialogMotionOrigin({ left: 10, top: 20, width: 0, height: 80 });

        expect(dialogMotionOrigin.value).toBe(null);
    });
});
