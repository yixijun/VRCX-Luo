import { describe, expect, test, vi } from 'vitest';
import { flushPromises, mount } from '@vue/test-utils';

import MemoryCleanupDialog from '../MemoryCleanupDialog.vue';

const translations = {
    'view.tools.system_tools.memory_cleanup': 'Memory Cleanup',
    'view.tools.system_tools.memory_cleanup_16gb_notice': 'Designed for 16 GB memory.',
    'view.tools.system_tools.memory_cleanup_available': 'Available memory',
    'view.tools.system_tools.memory_cleanup_load': 'Memory load',
    'view.tools.system_tools.memory_cleanup_target_total': 'Target processes',
    'view.tools.system_tools.memory_cleanup_result': 'Cleanup result',
    'view.tools.system_tools.memory_cleanup_freed': 'Freed about {size}.',
    'view.tools.system_tools.memory_cleanup_process': 'Process',
    'view.tools.system_tools.memory_cleanup_working_set': 'Working set',
    'view.tools.system_tools.memory_cleanup_private': 'Private memory',
    'view.tools.system_tools.memory_cleanup_empty': 'No target process is running.',
    'view.tools.system_tools.memory_cleanup_notice': 'Normal cleanup only trims related processes.',
    'view.tools.system_tools.memory_cleanup_run': 'Clean Related Processes',
    'view.tools.system_tools.memory_cleanup_deep_run': 'Deep Cleanup',
    'view.tools.system_tools.memory_cleanup_deep_tooltip': 'Purge system memory lists.',
    'view.tools.system_tools.memory_cleanup_request_admin': 'Request Admin',
    'view.tools.system_tools.memory_cleanup_request_admin_tooltip': 'Restart through UAC.',
    'view.tools.system_tools.memory_cleanup_admin_failed': 'Failed to request administrator rights',
    'view.tools.system_tools.memory_cleanup_operation_SeProfileSingleProcessPrivilege': 'Enable profile privilege',
    'view.tools.system_tools.memory_cleanup_operation_SeIncreaseQuotaPrivilege': 'Enable quota privilege',
    'view.tools.system_tools.memory_cleanup_operation_modifiedPageList': 'Modified page list',
    'view.tools.system_tools.memory_cleanup_operation_standbyList': 'Standby list',
    'view.tools.system_tools.memory_cleanup_operation_lowPriorityStandbyList': 'Low priority standby list',
    'view.tools.system_tools.memory_cleanup_operation_systemFileCache': 'System file cache',
    'view.tools.system_tools.memory_cleanup_operation_ok': 'OK',
    'view.tools.system_tools.memory_cleanup_operation_failed': 'Failed',
    'view.tools.system_tools.memory_cleanup_done': 'Memory cleanup completed',
    'view.tools.system_tools.memory_cleanup_failed': 'Memory cleanup failed',
    'common.actions.refresh': 'Refresh'
};

vi.mock('vue-i18n', () => ({
    useI18n: () => ({
        t: (key, params = {}) =>
            (translations[key] || key).replace(/\{(\w+)\}/g, (_, name) => params[name] ?? '')
    })
}));

vi.mock('vue-sonner', () => ({
    toast: {
        error: vi.fn(),
        success: vi.fn()
    }
}));

vi.mock('@/components/ui/dialog', () => ({
    Dialog: { template: '<div><slot /></div>', props: ['open'] },
    DialogContent: { template: '<section><slot /></section>' },
    DialogFooter: { template: '<footer><slot /></footer>' },
    DialogHeader: { template: '<header><slot /></header>' },
    DialogTitle: { template: '<h2><slot /></h2>' }
}));

vi.mock('@/components/ui/alert', () => ({
    Alert: { template: '<div><slot /></div>' },
    AlertDescription: { template: '<p><slot /></p>' },
    AlertTitle: { template: '<strong><slot /></strong>' }
}));

vi.mock('@/components/ui/button', () => ({
    Button: {
        template: '<button :disabled="disabled" :title="title"><slot /></button>',
        props: ['disabled', 'title']
    }
}));

vi.mock('@/components/ui/progress', () => ({
    Progress: {
        template: '<div data-testid="progress" :data-value="modelValue"></div>',
        props: ['modelValue']
    }
}));

vi.mock('@/components/ui/tooltip', () => ({
    TooltipWrapper: {
        template: '<span><slot /></span>',
        props: ['content', 'side']
    }
}));

function mockSnapshot(isAdministrator = false) {
    globalThis.AppApi = {
        GetMemoryCleanupSnapshot: vi.fn().mockResolvedValue(
            JSON.stringify({
                TotalAvailableMemoryBytes: 1000,
                MemoryLoadBytes: 400,
                IsAdministrator: isAdministrator,
                TargetProcessWorkingSetBytes: 100,
                Processes: [
                    {
                        Id: 1,
                        Name: 'VRCX-Luo',
                        WorkingSetBytes: 100,
                        PrivateMemoryBytes: 200
                    }
                ]
            })
        ),
        RestartAsAdministrator: vi.fn().mockResolvedValue(true),
        CleanupMemory: vi.fn().mockResolvedValue(
            JSON.stringify({
                FreedBytes: 100,
                Before: {
                    TargetProcessWorkingSetBytes: 100,
                    TotalAvailableMemoryBytes: 1000,
                    MemoryLoadBytes: 400,
                    Processes: []
                },
                After: {
                    TargetProcessWorkingSetBytes: 0,
                    TotalAvailableMemoryBytes: 1000,
                    MemoryLoadBytes: 300,
                    Processes: []
                },
                Deep: {
                    Requested: true,
                    Ran: true,
                    Status: 'completed',
                    Operations: [
                        {
                            Kind: 'cleanup',
                            Name: 'standbyList',
                            Ok: true
                        }
                    ]
                }
            })
        )
    };
}

describe('MemoryCleanupDialog', () => {
    test('renders localized actions and memory progress bars', async () => {
        mockSnapshot(false);

        const wrapper = mount(MemoryCleanupDialog, {
            props: { visible: true }
        });
        await flushPromises();

        expect(wrapper.text()).toContain('Refresh');
        expect(wrapper.text()).toContain('!');
        expect(wrapper.text()).not.toContain('common.refresh');
        expect(wrapper.findAll('[data-testid="progress"]')).toHaveLength(3);

        const adminButton = wrapper
            .findAll('button')
            .find((button) => button.text().includes('Request Admin'));

        expect(adminButton.exists()).toBe(true);
        expect(adminButton.attributes('disabled')).toBeUndefined();
        expect(adminButton.attributes('title')).toBe('Restart through UAC.');
    });

    test('requests administrator restart when deep cleanup is clicked without elevation', async () => {
        mockSnapshot(false);

        const wrapper = mount(MemoryCleanupDialog, {
            props: { visible: true }
        });
        await flushPromises();

        const adminButton = wrapper
            .findAll('button')
            .find((button) => button.text().includes('Request Admin'));

        await adminButton.trigger('click');

        expect(globalThis.AppApi.RestartAsAdministrator).toHaveBeenCalledTimes(1);
    });

    test('shows deep cleanup action when already elevated', async () => {
        mockSnapshot(true);

        const wrapper = mount(MemoryCleanupDialog, {
            props: { visible: true }
        });
        await flushPromises();

        expect(wrapper.text()).toContain('Deep Cleanup');
        expect(wrapper.text()).not.toContain('Request Admin');
    });

    test('runs deep cleanup and shows operation results when already elevated', async () => {
        mockSnapshot(true);

        const wrapper = mount(MemoryCleanupDialog, {
            props: { visible: true }
        });
        await flushPromises();

        const deepButton = wrapper
            .findAll('button')
            .find((button) => button.text().includes('Deep Cleanup'));

        await deepButton.trigger('click');
        await flushPromises();

        expect(globalThis.AppApi.CleanupMemory).toHaveBeenCalledWith(true);
        expect(wrapper.text()).toContain('Standby list');
        expect(wrapper.text()).toContain('OK');
    });
});
