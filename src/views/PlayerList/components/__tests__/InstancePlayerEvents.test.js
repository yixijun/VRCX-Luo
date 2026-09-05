import { beforeEach, describe, expect, test, vi } from 'vitest';
import { flushPromises, mount } from '@vue/test-utils';

const mocks = vi.hoisted(() => ({
    getGameLogByLocation: vi.fn(),
    lookupUser: vi.fn(),
    friends: new Map()
}));

vi.mock('vue-i18n', () => ({
    useI18n: () => ({
        t: (key) => key
    })
}));

vi.mock('../../../../services/database', () => ({
    database: {
        getGameLogByLocation: (...args) => mocks.getGameLogByLocation(...args)
    }
}));

vi.mock('../../../../coordinators/userCoordinator', () => ({
    lookupUser: (...args) => mocks.lookupUser(...args)
}));

vi.mock('../../../../shared/utils', () => ({
    formatDateFilter: (value, format) => `${format}:${value}`
}));

vi.mock('../../../../stores', () => ({
    useFriendStore: () => ({
        friends: mocks.friends
    })
}));

vi.mock('../../../../components/UserIdentityInline.vue', () => ({
    default: {
        props: ['displayName'],
        template: '<span data-testid="event-user">{{ displayName }}</span>'
    }
}));

vi.mock('../../../../components/ui/badge', () => ({
    Badge: { template: '<span><slot /></span>' }
}));

vi.mock('../../../../components/ui/button', () => ({
    Button: {
        props: ['disabled'],
        emits: ['click'],
        template:
            '<button data-testid="event-button" :disabled="disabled" @click="$emit(\'click\', $event)"><slot /></button>'
    }
}));

vi.mock('../../../../components/ui/dropdown-menu', () => ({
    DropdownMenu: { template: '<div data-testid="presence-dropdown"><slot /></div>' },
    DropdownMenuTrigger: {
        template: '<div data-testid="presence-menu-trigger" v-bind="$attrs"><slot /></div>'
    },
    DropdownMenuContent: {
        template: '<div data-testid="presence-filter-content" v-bind="$attrs"><slot /></div>'
    },
    DropdownMenuSeparator: { template: '<hr />' }
}));

vi.mock('../../../../components/ui/toggle-group', () => ({
    ToggleGroup: {
        props: ['modelValue'],
        emits: ['update:model-value'],
        template:
            '<div v-bind="$attrs" data-testid="presence-filter" :data-filter="$attrs[\'data-testid\']">' +
            '<template v-if="$attrs[\'data-testid\'] === \'presence-direction-filter\'">' +
            '<button data-testid="filter-direction-all" @click="$emit(\'update:model-value\', \'all\')">all</button>' +
            '<button data-testid="filter-joined" @click="$emit(\'update:model-value\', \'joined\')">joined</button>' +
            '<button data-testid="filter-left" @click="$emit(\'update:model-value\', \'left\')">left</button>' +
            '</template>' +
            '<template v-else>' +
            '<button data-testid="filter-all" @click="$emit(\'update:model-value\', \'all\')">all</button>' +
            '<button data-testid="filter-friends" @click="$emit(\'update:model-value\', \'friends\')">friends</button>' +
            '<button data-testid="filter-strangers" @click="$emit(\'update:model-value\', \'strangers\')">strangers</button>' +
            '</template>' +
            '<slot />' +
            '</div>'
    },
    ToggleGroupItem: {
        props: ['value'],
        template: '<span :data-value="value"><slot /></span>'
    }
}));

vi.mock('lucide-vue-next', () => ({
    ArrowRightLeft: { template: '<span />' },
    LogIn: { template: '<span />' },
    LogOut: { template: '<span />' },
    ListFilter: { template: '<span />' },
    UsersRound: { template: '<span />' },
    RefreshCw: { template: '<span />' }
}));

import InstancePlayerEvents from '../InstancePlayerEvents.vue';

describe('InstancePlayerEvents.vue', () => {
    beforeEach(() => {
        mocks.getGameLogByLocation.mockReset();
        mocks.lookupUser.mockReset();
        mocks.friends = new Map([
            ['usr_friend', { ref: { id: 'usr_friend', displayName: 'Friend' } }]
        ]);
    });

    test('loads room activity and filters friends or strangers without changing the query', async () => {
        const events = [
            {
                rowId: 3,
                created_at: '2026-09-05T10:03:00.000Z',
                type: 'OnPlayerLeft',
                displayName: 'Stranger',
                userId: 'usr_stranger'
            },
            {
                rowId: 2,
                created_at: '2026-09-05T10:02:00.000Z',
                type: 'OnPlayerJoined',
                displayName: 'Friend',
                userId: 'usr_friend'
            },
            {
                rowId: 1,
                created_at: '2026-09-05T10:01:00.000Z',
                displayName: 'Ignored event',
                userId: 'usr_ignored',
                type: 'VideoPlay'
            }
        ];
        mocks.getGameLogByLocation.mockResolvedValue(events);

        const wrapper = mount(InstancePlayerEvents, {
            props: { location: 'wrld_123:instance_1' }
        });
        await flushPromises();

        expect(mocks.getGameLogByLocation).toHaveBeenCalledWith(
            'wrld_123:instance_1',
            ['OnPlayerJoined', 'OnPlayerLeft']
        );
        expect(wrapper.findAll('.instance-player-events__row')).toHaveLength(2);
        expect(wrapper.text()).toContain('short:2026-09-05T10:03:00.000Z');
        expect(wrapper.text()).toContain('view.player_list.presence.left');
        expect(wrapper.findAll('[data-filter]').map((group) => group.attributes('data-filter'))).toEqual([
            'presence-identity-filter',
            'presence-direction-filter'
        ]);
        expect(wrapper.get('[data-testid="presence-menu-trigger"]').exists()).toBe(true);
        expect(wrapper.get('[data-testid="presence-filter-menu"]').classes()).toContain('flex-col');
        expect(wrapper.get('[data-testid="presence-identity-row"]').classes()).toEqual(
            expect.arrayContaining(['grid', 'grid-cols-[auto_minmax(0,1fr)]', 'items-center'])
        );
        expect(wrapper.get('[data-testid="presence-direction-row"]').classes()).toEqual(
            expect.arrayContaining(['grid', 'grid-cols-[auto_minmax(0,1fr)]', 'items-center'])
        );

        await wrapper.get('[data-testid="filter-friends"]').trigger('click');
        expect(wrapper.findAll('.instance-player-events__row')).toHaveLength(1);
        expect(wrapper.text()).toContain('Friend');
        expect(wrapper.text()).not.toContain('Stranger');

        await wrapper.get('[data-testid="filter-strangers"]').trigger('click');
        expect(wrapper.findAll('.instance-player-events__row')).toHaveLength(1);
        expect(wrapper.text()).toContain('Stranger');
        expect(wrapper.text()).not.toContain('Friend');

        await wrapper.get('[data-testid="filter-direction-all"]').trigger('click');
        await wrapper.get('[data-testid="filter-all"]').trigger('click');
        await wrapper.get('[data-testid="filter-joined"]').trigger('click');
        expect(wrapper.findAll('.instance-player-events__row')).toHaveLength(1);
        expect(wrapper.text()).toContain('Friend');
        expect(wrapper.text()).not.toContain('Stranger');

        await wrapper.get('[data-testid="filter-left"]').trigger('click');
        expect(wrapper.findAll('.instance-player-events__row')).toHaveLength(1);
        expect(wrapper.text()).toContain('Stranger');
        expect(wrapper.text()).not.toContain('Friend');
    });

    test('refreshes the current room and opens the selected player', async () => {
        mocks.getGameLogByLocation.mockResolvedValue([
            {
                rowId: 1,
                created_at: '2026-09-05T10:00:00.000Z',
                type: 'OnPlayerJoined',
                displayName: 'Friend',
                userId: 'usr_friend'
            }
        ]);

        const wrapper = mount(InstancePlayerEvents, {
            props: { location: 'wrld_123:instance_1' }
        });
        await flushPromises();

        await wrapper.find('.instance-player-events__row').trigger('click');
        expect(mocks.lookupUser).toHaveBeenCalledWith(
            expect.objectContaining({ userId: 'usr_friend' })
        );

        await wrapper
            .get('[data-testid="refresh-player-events"]')
            .trigger('click');
        await flushPromises();
        expect(mocks.getGameLogByLocation).toHaveBeenCalledTimes(2);
    });

    test('shows an empty state without querying when no room is selected', async () => {
        mocks.getGameLogByLocation.mockResolvedValue([]);
        const wrapper = mount(InstancePlayerEvents);
        await flushPromises();

        expect(mocks.getGameLogByLocation).not.toHaveBeenCalled();
        expect(wrapper.text()).toContain('view.player_list.presence.empty');
    });
});
