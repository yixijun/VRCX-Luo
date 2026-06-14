import { Checkbox } from '@/components/ui/checkbox';
import { i18n } from '@/plugins';
import { ArrowUpDown } from 'lucide-vue-next';
import { Button } from '@/components/ui/button';
import UserIdentityInline from '@/components/UserIdentityInline.vue';

const { t } = i18n.global;

const sortButton = ({ column, label, descFirst = false }) => (
    <Button
        variant="ghost"
        size="sm"
        class="-ml-2 h-8 px-2"
        onClick={() => {
            const sorted = column.getIsSorted();
            if (!sorted && descFirst) {
                column.toggleSorting(true);
                return;
            }
            column.toggleSorting(sorted === 'asc');
        }}
    >
        {label}
        <ArrowUpDown class="ml-1 h-4 w-4" />
    </Button>
);

export const createColumns = ({
    randomUserColours,
    userImage,
    onShowUser,
    onSelectionChange
}) => [
    {
        id: 'selected',
        header: () => null,
        size: 55,
        enableSorting: false,
        cell: ({ row }) => {
            const original = row.original;
            return (
                <div
                    class="flex items-center justify-center"
                    onClick={(e) => e.stopPropagation()}
                >
                    <Checkbox
                        modelValue={!!original?.$selected}
                        onUpdate:modelValue={(value) => {
                            original.$selected = value;
                            onSelectionChange?.(original);
                        }}
                    />
                </div>
            );
        }
    },
    {
        id: 'displayName',
        accessorFn: (row) => row?.user?.displayName ?? row?.$displayName ?? '',
        header: ({ column }) =>
            sortButton({
                column,
                label: t('dialog.group_member_moderation.display_name')
            }),
        size: 160,
        cell: ({ row }) => {
            const original = row.original;
            const useColors = !!(randomUserColours?.value ?? randomUserColours);
            const colorStyle = useColors
                ? { color: original?.user?.$userColour }
                : null;

            return (
                <span
                    style="cursor: pointer"
                    onClick={(e) => {
                        e.stopPropagation();
                        onShowUser?.(original?.userId);
                    }}
                >
                    <UserIdentityInline
                        user={original?.user}
                        userId={original?.userId}
                        displayName={original?.$displayName}
                        imageResolver={userImage}
                        nameStyle={colorStyle}
                    />
                </span>
            );
        }
    },
    {
        accessorKey: 'managerNotes',
        header: ({ column }) =>
            sortButton({
                column,
                label: t('dialog.group_member_moderation.notes')
            }),
        cell: ({ row }) => (
            <span onClick={(e) => e.stopPropagation()}>
                {row.original?.managerNotes}
            </span>
        )
    }
];
