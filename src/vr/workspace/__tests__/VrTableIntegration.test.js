import { afterEach, describe, expect, it, vi } from 'vitest';
import { defineComponent, h, nextTick, ref } from 'vue';
import { mount } from '@vue/test-utils';
import { getCoreRowModel, useVueTable } from '@tanstack/vue-table';
import { i18n } from '../../../plugins/i18n';
import { vrWorkspace } from '../../../services/vrWorkspace';
import DataTableLayout from '../../../components/ui/data-table/DataTableLayout.vue';

vi.mock('@/stores/', () => ({
    useAppearanceSettingsStore: () => ({ isDataTableStriped: ref(false) })
}));
let wrapper;
afterEach(() => {
    wrapper?.unmount();
    vrWorkspace.active = false;
});

describe('shared list presentation in desktop and VR', () => {
    it('switches the same filtered table model to VR cards and restores the desktop table', async () => {
        const rowClick = vi.fn();
        const host = defineComponent({
            setup() {
                const table = useVueTable({
                    data: [{ name: 'Visible friend' }],
                    columns: [
                        {
                            accessorKey: 'name',
                            header: 'Name',
                            meta: { label: 'Name' }
                        }
                    ],
                    getCoreRowModel: getCoreRowModel()
                });
                return () =>
                    h(
                        DataTableLayout,
                        {
                            table,
                            showPagination: false,
                            enableColumnReorder: false,
                            enableColumnVisibility: false,
                            onRowClick: rowClick
                        },
                        { toolbar: () => h('button', 'Original filters') }
                    );
            }
        });
        wrapper = mount(host, { global: { plugins: [i18n] } });
        expect(wrapper.find('table').exists()).toBe(true);
        expect(wrapper.find('article').exists()).toBe(false);
        vrWorkspace.active = true;
        await nextTick();
        expect(wrapper.find('table').exists()).toBe(false);
        expect(wrapper.get('article').text()).toContain('Visible friend');
        expect(wrapper.get('.vr-data-toolbar').text()).toBe('Original filters');
        await wrapper.get('article').trigger('click');
        expect(rowClick.mock.calls[0][0].original.name).toBe('Visible friend');
        vrWorkspace.active = false;
        await nextTick();
        expect(wrapper.find('article').exists()).toBe(false);
        expect(wrapper.get('table').text()).toContain('Visible friend');
    });
});
