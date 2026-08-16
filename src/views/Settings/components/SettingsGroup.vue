<template>
    <section class="flex min-w-0 flex-col gap-3">
        <div v-if="title || $slots.description" class="flex flex-col gap-1.5 pl-0.5">
            <h3 v-if="title" class="m-0 text-[0.95rem] leading-tight font-semibold text-foreground">{{ title }}</h3>
            <div v-if="$slots.description" class="text-sm leading-relaxed text-muted-foreground">
                <slot name="description" />
            </div>
        </div>
        <Card class="settings-group-card gap-0 overflow-hidden bg-card/80 p-0 shadow-sm">
            <CardContent class="flex min-w-0 flex-col gap-1 px-4 py-3.5">
                <slot />
            </CardContent>
        </Card>
    </section>
</template>

<script setup>
    import { Card, CardContent } from '@/components/ui/card';

    defineProps({
        title: { type: String, default: '' }
    });
</script>

<style scoped>
    .settings-group-card {
        container-name: settings-group;
        container-type: inline-size;
    }
</style>
