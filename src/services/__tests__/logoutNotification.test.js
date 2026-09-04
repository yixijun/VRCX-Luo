import { describe, expect, it, vi } from 'vitest';

import { showLogoutGreeting } from '../logoutNotification';

describe('showLogoutGreeting', () => {
    it('creates and shows an escaped success notification', () => {
        const show = vi.fn();
        const createNotification = vi.fn(() => ({ show }));
        const translate = vi.fn((key, params) => `${key}:${params.name}`);
        const escapeDisplayName = vi.fn(() => 'Safe &lt;Name&gt;');

        const notification = showLogoutGreeting({
            displayName: '<Name>',
            translate,
            escapeDisplayName,
            createNotification
        });

        expect(notification).toEqual({ show });
        expect(escapeDisplayName).toHaveBeenCalledWith('<Name>');
        expect(translate).toHaveBeenCalledWith('message.auth.logout_greeting', {
            name: '<strong>Safe &lt;Name&gt;</strong>'
        });
        expect(createNotification).toHaveBeenCalledWith({
            type: 'success',
            text: 'message.auth.logout_greeting:<strong>Safe &lt;Name&gt;</strong>'
        });
        expect(show).toHaveBeenCalledOnce();
    });
});
