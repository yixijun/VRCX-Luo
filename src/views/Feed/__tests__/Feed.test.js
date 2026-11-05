import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { enableAutoUnmount, mount } from '@vue/test-utils';
import { nextTick, ref } from 'vue';

const mocks = vi.hoisted(() => ({
    feedTable: null,
    feedTableData: null,
    feedTableLookup: vi.fn(),
    setPageIndex: vi.fn(),
    setSorting: vi.fn(),
    scrollToTop: vi.fn(),
    pagination: null,
    sorting: null,
    filteredRows: [{ id: 'r1' }],
    tablePageSizes: [10, 25, 50],
    tablePageSize: 25,
    maxTableSize: 100
}));

mocks.feedTable = ref({
    loading: false,
    vip: false,
    filter: [],
    search: '',
    dateFrom: '',
    dateTo: ''
});
mocks.feedTableData = ref([]);
mocks.pagination = ref({
    pageIndex: 2,
    pageSize: 10
});
mocks.sorting = ref([{ id: 'created_at', desc: true }]);

vi.mock('pinia', () => ({
    storeToRefs: (store) => store
}));

vi.mock('vue-i18n', () => ({
    useI18n: () => ({
        t: (key) => key,
        locale: { value: 'en-US' }
    })
}));

vi.mock('@internationalized/date', () => ({
    getLocalTimeZone: () => 'UTC',
    today: () => ({})
}));

vi.mock('../../../stores', () => ({
    useFeedStore: () => ({
        feedTable: mocks.feedTable,
        feedTableData: mocks.feedTableData,
        feedTableLookup: mocks.feedTableLookup
    }),
    useAppearanceSettingsStore: () => ({
        weekStartsOn: ref(0),
        tablePageSizes: mocks.tablePageSizes,
        tablePageSize: mocks.tablePageSize
    }),
    useVrcxStore: () => ({
        maxTableSize: mocks.maxTableSize
    }),
    useGalleryStore: () => ({
        showGalleryPage: vi.fn()
    })
}));

vi.mock('../../../lib/table/useVrcxVueTable', () => ({
    useVrcxVueTable: () => ({
        table: {
            setPageIndex: mocks.setPageIndex,
            setSorting: mocks.setSorting,
            getFilteredRowModel: () => ({ rows: mocks.filteredRows })
        },
        pagination: mocks.pagination,
        sorting: mocks.sorting
    })
}));

vi.mock('../columns.jsx', () => ({
    columns: []
}));

vi.mock('../../../components/ui/data-table', () => ({
    DataTableLayout: {
        props: ['table', 'totalItems', 'onPageSizeChange'],
        methods: { scrollToTop: mocks.scrollToTop },
        template:
            '<div data-testid="data-table-layout">' +
            '<slot name="toolbar" />' +
            '<button data-testid="set-page-size" @click="onPageSizeChange?.(50)">set-page-size</button>' +
            '<button data-testid="next-page" @click="table.setPageIndex(1)">next-page</button>' +
            '<button data-testid="first-page" @click="table.setPageIndex(0)">first-page</button>' +
            '<button data-testid="sort-oldest" @click="table.setSorting([{ id: \'created_at\', desc: false }])">sort-oldest</button>' +
            '<button data-testid="sort-newest" @click="table.setSorting([{ id: \'created_at\', desc: true }])">sort-newest</button>' +
            '<span data-testid="total-items">{{ totalItems }}</span>' +
            '</div>'
    }
}));

vi.mock('../../../components/ui/button', () => ({
    Button: {
        emits: ['click'],
        template: '<button @click="$emit(\'click\')"><slot /></button>'
    }
}));

vi.mock('../../../components/ui/popover', () => ({
    Popover: {
        props: ['open'],
        emits: ['update:open'],
        template: '<div><slot /></div>'
    },
    PopoverTrigger: { template: '<div><slot /></div>' },
    PopoverContent: { template: '<div><slot /></div>' }
}));

vi.mock('../../../components/ui/toggle-group', () => ({
    ToggleGroup: {
        emits: ['update:model-value'],
        template:
            '<div data-testid="toggle-group">' +
            '<button data-testid="select-gps" @click="$emit(\'update:model-value\', [\'GPS\'])">gps</button>' +
            '<button data-testid="select-all" @click="$emit(\'update:model-value\', [\'All\'])">all</button>' +
            '<slot />' +
            '</div>'
    },
    ToggleGroupItem: {
        props: ['value'],
        template: '<button :data-value="value"><slot /></button>'
    }
}));

vi.mock('../../../components/ui/toggle', () => ({
    Toggle: {
        props: ['modelValue'],
        emits: ['update:modelValue'],
        template:
            '<button :data-testid="$attrs[\'data-testid\'] || \'vip-toggle\'" :aria-pressed="modelValue" @click="$emit(\'update:modelValue\', !modelValue)"><slot /></button>'
    }
}));

vi.mock('../../../components/ui/input-group', () => ({
    InputGroupField: {
        props: ['modelValue'],
        emits: ['update:modelValue', 'change', 'keyup.enter'],
        template:
            '<input data-testid="feed-search" :value="modelValue" @input="$emit(\'update:modelValue\', $event.target.value)" @change="$emit(\'change\')" />'
    }
}));

vi.mock('../../../components/ui/range-calendar', () => ({
    RangeCalendar: {
        emits: ['update:modelValue'],
        template:
            '<button data-testid="set-date-range" @click="$emit(\'update:modelValue\', { start: { year: 2026, month: 3, day: 1 }, end: { year: 2026, month: 3, day: 2 } })">set-date-range</button>'
    }
}));

vi.mock('../../../components/ui/badge', () => ({
    Badge: { template: '<span><slot /></span>' }
}));

vi.mock('../../../components/ui/tooltip', () => ({
    TooltipWrapper: { template: '<div><slot /></div>' }
}));

vi.mock('lucide-vue-next', () => ({
    ListFilter: { template: '<span />' },
    Upload: { template: '<span />' },
    Star: { template: '<span />' }
}));

import Feed from '../Feed.vue';

enableAutoUnmount(afterEach);

function clickButtonByText(wrapper, text) {
    const button = wrapper
        .findAll('button')
        .find((node) => node.text().includes(text));
    if (!button) {
        throw new Error(`Cannot find button with text: ${text}`);
    }
    return button.trigger('click');
}

describe('Feed.vue', () => {
    beforeEach(() => {
        mocks.feedTable.value = {
            loading: false,
            vip: false,
            filter: [],
            search: '',
            dateFrom: '',
            dateTo: ''
        };
        mocks.feedTableData.value = [];
        mocks.feedTableLookup.mockReset();
        mocks.setPageIndex.mockReset().mockImplementation((pageIndex) => {
            mocks.pagination.value = { ...mocks.pagination.value, pageIndex };
        });
        mocks.setSorting.mockReset().mockImplementation((sorting) => {
            mocks.sorting.value = sorting;
        });
        mocks.scrollToTop.mockReset();
        mocks.pagination.value = { pageIndex: 2, pageSize: 10 };
        mocks.sorting.value = [{ id: 'created_at', desc: true }];
        mocks.filteredRows = [{ id: 'r1' }];
        mocks.maxTableSize = 100;
    });

    test('applies date filter from calendar and triggers lookup', async () => {
        const wrapper = mount(Feed);

        await wrapper.get('[data-testid="set-date-range"]').trigger('click');
        await clickButtonByText(wrapper, 'common.actions.confirm');

        expect(mocks.feedTable.value.dateFrom).toContain('T');
        expect(mocks.feedTable.value.dateTo).toContain('T');
        expect(new Date(mocks.feedTable.value.dateFrom).getTime()).toBeLessThan(
            new Date(mocks.feedTable.value.dateTo).getTime()
        );
        expect(mocks.feedTableLookup).toHaveBeenCalledTimes(1);
    });

    test('clears date filter and triggers lookup', async () => {
        mocks.feedTable.value.dateFrom = '2026-03-01T00:00:00.000Z';
        mocks.feedTable.value.dateTo = '2026-03-02T23:59:59.999Z';
        const wrapper = mount(Feed);

        await clickButtonByText(wrapper, 'common.actions.clear');

        expect(mocks.feedTable.value.dateFrom).toBe('');
        expect(mocks.feedTable.value.dateTo).toBe('');
        expect(mocks.feedTableLookup).toHaveBeenCalledTimes(1);
    });

    test('updates feed type filters via toggle group', async () => {
        const wrapper = mount(Feed);

        await wrapper.get('[data-testid="select-gps"]').trigger('click');
        expect(mocks.feedTable.value.filter).toEqual(['GPS']);

        await wrapper.get('[data-testid="select-all"]').trigger('click');
        expect(mocks.feedTable.value.filter).toEqual([]);
        expect(mocks.feedTableLookup).toHaveBeenCalledTimes(2);
    });

    test('resets page index when page size changes', async () => {
        const wrapper = mount(Feed);

        await wrapper.get('[data-testid="set-page-size"]').trigger('click');

        expect(mocks.pagination.value).toEqual({
            pageIndex: 0,
            pageSize: 50
        });
    });

    test('caps total items when table length is slightly above max table size', () => {
        mocks.filteredRows = Array.from({ length: 120 }, (_, i) => ({ id: i }));
        mocks.maxTableSize = 100;
        const wrapper = mount(Feed);

        expect(wrapper.get('[data-testid="total-items"]').text()).toBe('100');
    });

    test('builds stable row id fallback for rows without id', () => {
        const wrapper = mount(Feed);

        const key = wrapper.vm.getFeedRowId({
            type: 'Online',
            created_at: '2026-03-01T00:00:00.000Z',
            userId: 'usr_123',
            location: 'wrld_abc',
            message: 'hello'
        });

        expect(key).toBe(
            'Online:2026-03-01T00:00:00.000Z:usr_123:wrld_abc:hello'
        );
    });

    test('follows incoming activity at the top without a manual lookup', async () => {
        const wrapper = mount(Feed);
        await nextTick();
        expect(wrapper.find('[data-testid="feed-live-updates"]').exists()).toBe(
            false
        );
        expect(mocks.pagination.value.pageIndex).toBe(0);
        expect(mocks.sorting.value).toEqual([{ id: 'created_at', desc: true }]);
        mocks.scrollToTop.mockClear();
        mocks.setPageIndex.mockClear();
        mocks.setSorting.mockClear();

        mocks.feedTableData.value = [
            {
                type: 'Online',
                created_at: '2026-11-05T11:00:00.000Z',
                userId: 'usr_1'
            }
        ];
        await nextTick();
        await nextTick();

        expect(mocks.setPageIndex).toHaveBeenCalledWith(0);
        expect(mocks.setSorting).toHaveBeenCalledWith([
            { id: 'created_at', desc: true }
        ]);
        expect(mocks.scrollToTop).toHaveBeenCalledOnce();
        expect(mocks.feedTableLookup).not.toHaveBeenCalled();
        wrapper.unmount();
    });

    test('starts at the latest activity even with an older persisted time sort', async () => {
        mocks.sorting.value = [{ id: 'created_at', desc: false }];
        const wrapper = mount(Feed);
        await nextTick();

        expect(mocks.pagination.value.pageIndex).toBe(0);
        expect(mocks.sorting.value).toEqual([{ id: 'created_at', desc: true }]);
        expect(mocks.scrollToTop).toHaveBeenCalledOnce();
        wrapper.unmount();
    });

    test('preserves older pages and automatically follows again on the first page', async () => {
        const wrapper = mount(Feed);
        await nextTick();
        await wrapper.get('[data-testid="next-page"]').trigger('click');
        mocks.setPageIndex.mockClear();
        mocks.scrollToTop.mockClear();

        mocks.feedTableData.value = [{ id: 'new-activity' }];
        await nextTick();
        await nextTick();
        expect(mocks.feedTableData.value[0].id).toBe('new-activity');
        expect(mocks.pagination.value.pageIndex).toBe(1);
        expect(mocks.setPageIndex).not.toHaveBeenCalled();
        expect(mocks.scrollToTop).not.toHaveBeenCalled();

        await wrapper.get('[data-testid="first-page"]').trigger('click');
        mocks.setPageIndex.mockClear();
        mocks.feedTableData.value = [{ id: 'next-activity' }];
        await nextTick();
        await nextTick();
        expect(mocks.setPageIndex).toHaveBeenCalledWith(0);
        expect(mocks.scrollToTop).toHaveBeenCalledOnce();
        wrapper.unmount();
    });

    test('preserves an older time sort and automatically follows when newest sorting returns', async () => {
        const wrapper = mount(Feed);
        await nextTick();
        await wrapper.get('[data-testid="sort-oldest"]').trigger('click');
        mocks.setSorting.mockClear();
        mocks.setPageIndex.mockClear();
        mocks.scrollToTop.mockClear();

        mocks.feedTableData.value = [{ id: 'new-activity' }];
        await nextTick();
        await nextTick();
        expect(mocks.sorting.value).toEqual([
            { id: 'created_at', desc: false }
        ]);
        expect(mocks.setSorting).not.toHaveBeenCalled();
        expect(mocks.setPageIndex).not.toHaveBeenCalled();
        expect(mocks.scrollToTop).not.toHaveBeenCalled();

        await wrapper.get('[data-testid="sort-newest"]').trigger('click');
        mocks.feedTableData.value = [{ id: 'next-activity' }];
        await nextTick();
        await nextTick();
        expect(mocks.setPageIndex).toHaveBeenCalledWith(0);
        expect(mocks.scrollToTop).toHaveBeenCalledOnce();
        wrapper.unmount();
    });

    test('does not scroll again when a lookup returns the same newest activity', async () => {
        mocks.feedTableData.value = [{ id: 'latest' }];
        const wrapper = mount(Feed);
        await nextTick();
        mocks.scrollToTop.mockClear();

        mocks.feedTableData.value = [{ id: 'latest' }];
        await nextTick();
        await nextTick();

        expect(mocks.scrollToTop).not.toHaveBeenCalled();
        wrapper.unmount();
    });
});
