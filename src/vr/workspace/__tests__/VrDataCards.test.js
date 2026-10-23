import { afterEach, describe, expect, it, vi } from 'vitest';
import { defineComponent, h, ref } from 'vue';
import { flushPromises, mount } from '@vue/test-utils';
import {
    getCoreRowModel,
    getExpandedRowModel,
    getSortedRowModel,
    useVueTable
} from '@tanstack/vue-table';
import { i18n } from '../../../plugins/i18n';
import VrDataCards from '../VrDataCards.vue';

let wrapper;
afterEach(() => wrapper?.unmount());
function open() {
    const act = vi.fn();
    const rowClick = vi.fn();
    let table, data;
    const host = defineComponent({
        setup() {
            data = ref(
                Array.from({ length: 30 }, (_, id) => ({
                    id,
                    name: `Friend ${String(id).padStart(2, '0')}`
                }))
            );
            table = useVueTable({
                get data() {
                    return data.value;
                },
                columns: [
                    {
                        accessorKey: 'name',
                        header: ({ column }) =>
                            h(
                                'button',
                                {
                                    onClick: () =>
                                        column.toggleSorting(
                                            column.getIsSorted() === 'asc'
                                        )
                                },
                                'Sort name'
                            ),
                        meta: { label: 'Name' }
                    },
                    {
                        id: 'actions',
                        header: 'Actions',
                        cell: ({ row }) =>
                            h(
                                'button',
                                {
                                    onClick: (event) => {
                                        event.stopPropagation();
                                        act(row.original.id);
                                    }
                                },
                                'Invite'
                            ),
                        meta: { label: 'Actions' }
                    },
                    {
                        id: 'expander',
                        cell: ({ row }) =>
                            h(
                                'button',
                                {
                                    onClick: (event) => {
                                        event.stopPropagation();
                                        row.toggleExpanded();
                                    }
                                },
                                'Details'
                            )
                    },
                    { id: '__spacer', cell: () => 'Spacer must not render' }
                ],
                getCoreRowModel: getCoreRowModel(),
                getSortedRowModel: getSortedRowModel(),
                getExpandedRowModel: getExpandedRowModel(),
                getRowCanExpand: () => true,
                initialState: { pagination: { pageIndex: 0, pageSize: 50 } }
            });
            return () =>
                h(VrDataCards, {
                    table,
                    onRowClick: rowClick,
                    expandedRenderer: ({ row }) =>
                        h('div', `Expanded ${row.original.id}`)
                });
        }
    });
    wrapper = mount(host, { global: { plugins: [i18n] } });
    return { act, rowClick, table, data };
}
const button = (text) =>
    wrapper.findAll('button').find((item) => item.text() === text);

describe('VR record cards with the real table model', () => {
    it('renders only twelve records and adds records when scrolled or requested', async () => {
        open();
        expect(wrapper.findAll('article')).toHaveLength(12);
        expect(wrapper.text()).not.toContain('Spacer must not render');
        await wrapper.get('.vr-record-more').trigger('click');
        expect(wrapper.findAll('article')).toHaveLength(24);
        await wrapper.get('.vr-record-scroller').trigger('scroll');
        expect(wrapper.findAll('article')).toHaveLength(30);
    });
    it('keeps cell actions and row actions separate', async () => {
        const { act, rowClick, table } = open();
        await button('Invite').trigger('click');
        expect(act).toHaveBeenCalledWith(0);
        expect(rowClick).not.toHaveBeenCalled();
        await wrapper.get('article').trigger('keydown.enter');
        expect(rowClick).toHaveBeenCalledWith(table.getRowModel().rows[0]);
    });
    it('uses real sorting and hides fields through the original column state', async () => {
        const { table } = open();
        await button('排序与字段').trigger('click');
        await button('Sort name').trigger('click');
        await button('Sort name').trigger('click');
        expect(wrapper.get('article').text()).toContain('Friend 29');
        table.getColumn('name').toggleVisibility(false);
        await flushPromises();
        expect(wrapper.get('article').text()).not.toContain('Friend 29');
        expect(wrapper.get('.vr-record-columns input').element.checked).toBe(
            false
        );
    });
    it('retains expanded details and resets the rendered batch when pages change', async () => {
        const { table } = open();
        await button('Details').trigger('click');
        expect(wrapper.get('.vr-record-expanded').text()).toBe('Expanded 0');
        await wrapper.get('.vr-record-more').trigger('click');
        table.setPageIndex(1);
        await flushPromises();
        expect(wrapper.findAll('article')).toHaveLength(12);
    });
});
