import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('../accountSession.js', () => ({
    AccountSession: class AccountSession {}
}));
vi.mock('../sqlite.js', () => ({
    default: { execute: vi.fn() }
}));

import { accountHub } from '../accountHub.js';
import { lookupAggregatedFeed } from '../aggregatedView.js';
import sqliteService from '../sqlite.js';

describe('aggregated view account metadata', () => {
    afterEach(() => {
        vi.restoreAllMocks();
        accountHub.reset();
    });

    it('maps feed rows to the primary and secondary session metadata', async () => {
        accountHub.setPrimary('usr-primary', 'usrprimary');
        accountHub.sessions.set('usr-secondary', {
            userId: 'usr-secondary',
            userPrefix: 'usrsecondary',
            label: 'Secondary',
            userInfo: { id: 'usr-secondary', displayName: 'Secondary' },
            friendsCache: new Map()
        });

        vi.spyOn(sqliteService, 'execute').mockImplementation(
            async (callback) => {
                const row = Array(24).fill(null);
                row[0] = 'usrsecondary';
                row[1] = 7;
                row[2] = '2026-09-04T00:00:00.000Z';
                row[3] = 'usr-friend';
                row[4] = 'Friend';
                row[5] = 'GPS';
                row[6] = 'wrld_world:instance';
                callback(row);
            }
        );

        const [row] = await lookupAggregatedFeed(['usrsecondary'], [], 1);

        expect(accountHub.allSessions).toHaveLength(2);
        expect(accountHub.primaryPrefix).toBe('usrprimary');
        expect(row).toMatchObject({
            $accountId: 'usr-secondary',
            $accountLabel: 'Secondary'
        });
    });
});
