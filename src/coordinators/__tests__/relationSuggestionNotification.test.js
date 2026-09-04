import { describe, expect, it, vi } from 'vitest';

import { showRelationSuggestionNotification } from '../../services/relationSuggestionNotification';

function createDomButton() {
    return {
        addEventListener: vi.fn()
    };
}

describe('showRelationSuggestionNotification', () => {
    it('configures the prompt DOM and wires accept/ignore actions', () => {
        const suggestion = { key: 'suggestion-1' };
        const onAccept = vi.fn();
        const onIgnore = vi.fn();
        const yesButton = createDomButton();
        const noButton = createDomButton();
        const progressBar = { style: {} };
        const parentElement = {
            style: { setProperty: vi.fn() }
        };
        const barDom = {
            style: { setProperty: vi.fn() },
            parentElement,
            querySelector: vi.fn((selector) => {
                if (selector === '.noty_progressbar') return progressBar;
                if (selector === '.noty-btn-yes') return yesButton;
                if (selector === '.noty-btn-no') return noButton;
                return null;
            })
        };
        const close = vi.fn();
        const show = vi.fn();
        let options;
        const createNotification = vi.fn((nextOptions) => {
            options = nextOptions;
            return { close, show };
        });

        const notification = showRelationSuggestionNotification({
            suggestion,
            otherUserName: 'Friend',
            onAccept,
            onIgnore,
            createNotification
        });

        expect(notification).toEqual({ close, show });
        expect(createNotification).toHaveBeenCalledOnce();
        expect(options.text).toContain('<strong>Friend</strong>');
        expect(options.timeout).toBe(6000);
        expect(options.progressBar).toBe(true);
        expect(show).toHaveBeenCalledOnce();

        options.callbacks.onShow.call({ barDom });

        expect(barDom.style.setProperty).toHaveBeenCalledWith(
            'z-index',
            '2147483647',
            'important'
        );
        expect(parentElement.style.setProperty).toHaveBeenCalledWith(
            'pointer-events',
            'auto',
            'important'
        );
        expect(progressBar.style).toEqual({
            backgroundColor: '#9ca3af',
            opacity: '0.8'
        });

        yesButton.addEventListener.mock.calls[0][1]();
        expect(onAccept).toHaveBeenCalledWith(suggestion);
        expect(close).toHaveBeenCalledOnce();
        noButton.addEventListener.mock.calls[0][1]();
        expect(onIgnore).toHaveBeenCalledWith(suggestion);
        expect(close).toHaveBeenCalledTimes(2);
    });

    it('keeps missing optional DOM controls harmless', () => {
        const barDom = {
            style: { setProperty: vi.fn() },
            parentElement: null,
            querySelector: vi.fn(() => null)
        };
        let onShow;
        const show = vi.fn();

        showRelationSuggestionNotification({
            suggestion: {},
            otherUserName: 'Friend',
            onAccept: vi.fn(),
            onIgnore: vi.fn(),
            createNotification: (options) => {
                onShow = options.callbacks.onShow;
                return { show, close: vi.fn() };
            }
        });

        expect(() => onShow.call({ barDom })).not.toThrow();
        expect(show).toHaveBeenCalledOnce();
    });
});
