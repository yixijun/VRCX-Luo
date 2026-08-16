import { cva } from 'class-variance-authority';

export { default as Button } from './Button.vue';

export const buttonVariants = cva(
    "inline-flex min-w-0 items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-[color,background-color,border-color,box-shadow,transform] duration-150 disabled:pointer-events-none disabled:bg-muted disabled:text-muted-foreground disabled:shadow-none disabled:opacity-100 aria-disabled:pointer-events-none aria-disabled:bg-muted aria-disabled:text-muted-foreground aria-disabled:shadow-none aria-disabled:opacity-100 data-[disabled]:pointer-events-none data-[disabled]:bg-muted data-[disabled]:text-muted-foreground data-[disabled]:shadow-none data-[disabled]:opacity-100 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 shrink-0 [&_svg]:shrink-0 outline-none focus-visible:border-ring focus-visible:ring-ring/40 focus-visible:ring-[3px] aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive cursor-pointer select-none",
    {
        variants: {
            variant: {
                default:
                    'bg-primary text-primary-foreground shadow-xs hover:bg-primary/90 hover:shadow-sm',
                destructive:
                    'bg-destructive text-white hover:bg-destructive/90 focus-visible:ring-destructive/20 dark:focus-visible:ring-destructive/40 dark:bg-destructive/60',
                outline:
                    'border bg-background/80 shadow-xs hover:bg-accent hover:text-accent-foreground hover:border-ring/40 dark:bg-input/30 dark:border-input dark:hover:bg-input/50',
                secondary:
                    'bg-secondary text-secondary-foreground hover:bg-secondary/80',
                ghost: 'hover:bg-accent hover:text-accent-foreground dark:hover:bg-accent/50',
                link: 'text-primary underline-offset-4 hover:underline'
            },
            size: {
                default: 'min-h-9 px-4 py-2 has-[>svg]:px-3',
                sm: 'min-h-8 gap-1.5 px-3 py-1.5 has-[>svg]:px-2.5',
                lg: 'min-h-10 px-5 py-2.5 has-[>svg]:px-4',
                icon: 'size-9 min-h-9 min-w-9',
                'icon-sm': 'size-8 min-h-8 min-w-8',
                'icon-lg': 'size-10 min-h-10 min-w-10'
            }
        },
        defaultVariants: {
            variant: 'default',
            size: 'default'
        }
    }
);
