import { describe, expect, it } from 'vitest';

import {
    buildTrayToolTip,
    normalizeTrayNotificationSnapshot
} from '../../../src-electron/trayNotificationProjection.cjs';

describe('tray notification projection', () => {
    it('normalizes invalid and bounded notification snapshots', () => {
        expect(normalizeTrayNotificationSnapshot(null)).toEqual({
            total: 0,
            items: []
        });

        const snapshot = normalizeTrayNotificationSnapshot({
            total: '2',
            items: [
                {
                    id: 123,
                    type: 'invite',
                    category: 'friend',
                    categoryLabel: '好友',
                    typeLabel: '邀请',
                    icon: 'send',
                    accent: 'primary',
                    priority: 90,
                    createdAt: '2026-09-10T10:00:00.000Z',
                    title: 'Friend',
                    body: 'Online',
                    actions: [
                        { id: 1, label: 'Open' },
                        { id: 2, label: 'Ignore' },
                        { id: 3, label: 'Later' },
                        { id: 4, label: 'Extra' }
                    ]
                },
                { title: '', body: null },
                { title: 'Second' },
                { title: 'Third' },
                { title: 'Ignored fifth' }
            ]
        });

        expect(snapshot).toEqual({
            total: 2,
            items: [
                {
                    id: '123',
                    type: 'invite',
                    category: 'friend',
                    categoryLabel: '好友',
                    typeLabel: '邀请',
                    icon: 'send',
                    accent: 'primary',
                    priority: 90,
                    createdAt: '2026-09-10T10:00:00.000Z',
                    title: 'Friend',
                    body: 'Online',
                    actions: [
                        { id: '1', label: 'Open', icon: '' },
                        { id: '2', label: 'Ignore', icon: '' },
                        { id: '3', label: 'Later', icon: '' }
                    ]
                },
                {
                    id: '',
                    type: '',
                    category: '',
                    categoryLabel: '',
                    typeLabel: '',
                    icon: '',
                    accent: '',
                    priority: 0,
                    createdAt: '',
                    title: '通知',
                    body: '',
                    actions: []
                },
                {
                    id: '',
                    type: '',
                    category: '',
                    categoryLabel: '',
                    typeLabel: '',
                    icon: '',
                    accent: '',
                    priority: 0,
                    createdAt: '',
                    title: 'Second',
                    body: '',
                    actions: []
                },
                {
                    id: '',
                    type: '',
                    category: '',
                    categoryLabel: '',
                    typeLabel: '',
                    icon: '',
                    accent: '',
                    priority: 0,
                    createdAt: '',
                    title: 'Third',
                    body: '',
                    actions: []
                }
            ]
        });
    });

    it('uses item count as fallback total and preserves tooltip formatting', () => {
        const snapshot = normalizeTrayNotificationSnapshot({
            total: 'not-a-number',
            items: [
                { title: 'One', body: 'Body' },
                { title: 'Two' },
                { title: 'Three', body: 'Details' },
                { title: 'Four', body: 'Hidden from tooltip' }
            ]
        });

        expect(snapshot.total).toBe(4);
        expect(buildTrayToolTip(snapshot)).toBe(
            'VRCX-Luo · 4 条待处理通知\nOne：Body\nTwo\nThree：Details'
        );
        expect(buildTrayToolTip({ total: 0, items: [] })).toBe('VRCX-Luo');
    });
});
