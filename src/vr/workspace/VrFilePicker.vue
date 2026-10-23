<template>
    <Teleport to="body"
        ><div class="vr-picker-backdrop" @keydown.esc.stop.prevent="finishVrFilePicker()">
            <section
                ref="dialog"
                tabindex="-1"
                class="vr-file-picker"
                role="dialog"
                aria-modal="true"
                aria-label="VR 文件选择器">
                <header>
                    <div>
                        <h2>
                            {{
                                request.title ||
                                (request.mode === 'directory'
                                    ? '选择文件夹'
                                    : request.mode === 'save'
                                      ? '保存文件'
                                      : request.mode === 'files'
                                        ? '选择多个文件'
                                        : '选择文件')
                            }}
                        </h2>
                        <p>{{ request.defaultFilter || '使用手柄浏览文件夹并选择' }}</p>
                    </div>
                    <button @click="finishVrFilePicker()">取消</button>
                </header>
                <div class="vr-picker-path">
                    <button :disabled="busy" @click="load('')">快捷位置</button
                    ><button :disabled="busy || !listing.path" @click="load(listing.parent)">上一级</button
                    ><input
                        v-model="path"
                        aria-label="目录路径"
                        placeholder="输入文件夹路径"
                        @keydown.enter="load(path)" /><button :disabled="busy" @click="load(path)">打开</button>
                </div>
                <p v-if="error" role="alert" class="vr-picker-error">{{ error }}</p>
                <label v-if="request.mode === 'save'" class="vr-picker-path"
                    >文件名 <input v-model="filename" aria-label="保存的文件名"
                /></label>
                <div class="vr-picker-files" :aria-busy="busy">
                    <button
                        v-for="entry in visibleEntries"
                        :key="entry.path"
                        :class="{ chosen: selected === entry.path || selectedFiles.includes(entry.path) }"
                        :disabled="busy"
                        @click="entry.directory ? load(entry.path) : select(entry.path)">
                        <i :class="entry.directory ? 'ri-folder-line' : 'ri-file-line'" /><span>{{ entry.name }}</span>
                    </button>
                    <p v-if="!busy && !visibleEntries.length">此页没有符合类型的文件</p>
                </div>
                <footer>
                    <button :disabled="busy || offset === 0" @click="load(listing.path, offset - 64)">上一页</button
                    ><span
                        >第 {{ offset / 64 + 1 }} 页{{
                            request.mode === 'files' ? ` · 已选 ${selectedFiles.length} 个` : ''
                        }}</span
                    ><button :disabled="busy || !listing.hasMore" @click="load(listing.path, offset + 64)">
                        下一页</button
                    ><button class="vr-picker-confirm" :disabled="busy || !canConfirm" @click="confirm">
                        {{ request.mode === 'directory' ? '选择此文件夹' : '确认选择' }}
                    </button>
                </footer>
            </section>
        </div></Teleport
    >
</template>

<script setup>
    import { computed, onMounted, onBeforeUnmount, ref } from 'vue';
    import {
        vrFilePicker,
        finishVrFilePicker,
        matchesVrFileFilter,
        buildVrSavePath
    } from '../../services/vrWorkspaceFilePicker';
    const request = vrFilePicker.value;
    const dialog = ref(null);
    const path = ref(request.defaultPath || '');
    const listing = ref({ path: '', parent: '', entries: [], hasMore: false });
    const offset = ref(0);
    const busy = ref(false);
    const error = ref('');
    const selected = ref('');
    const selectedFiles = ref([]);
    const filename = ref(request.filename || 'download');
    const canConfirm = computed(() =>
        request.mode === 'directory'
            ? !!listing.value.path
            : request.mode === 'save'
              ? !!buildVrSavePath(listing.value.path, filename.value)
              : request.mode === 'files'
                ? selectedFiles.value.length > 0
                : !!selected.value
    );
    function select(path) {
        if (request.mode === 'save') {
            filename.value = listing.value.entries.find((entry) => entry.path === path)?.name || filename.value;
            return;
        }
        if (request.mode !== 'files') {
            selected.value = path;
            return;
        }
        const index = selectedFiles.value.indexOf(path);
        if (index === -1) selectedFiles.value.push(path);
        else selectedFiles.value.splice(index, 1);
    }
    function confirm() {
        finishVrFilePicker(
            request.mode === 'directory'
                ? listing.value.path
                : request.mode === 'save'
                  ? buildVrSavePath(listing.value.path, filename.value)
                  : request.mode === 'files'
                    ? selectedFiles.value
                    : selected.value
        );
    }
    const visibleEntries = computed(() =>
        listing.value.entries.filter(
            (entry) => entry.directory || (request.mode !== 'directory' && matchesVrFileFilter(entry.name, request))
        )
    );
    let generation = 0;
    async function load(target, nextOffset = 0) {
        const current = ++generation;
        busy.value = true;
        error.value = '';
        selected.value = '';
        try {
            const result = JSON.parse(await AppApi.ListVrWorkspaceDirectory(target || '', nextOffset));
            if (current !== generation) return;
            if (result.error) throw new Error(result.error);
            listing.value = result;
            path.value = result.path;
            offset.value = nextOffset;
        } catch (e) {
            if (current === generation) error.value = e.message;
        } finally {
            if (current === generation) busy.value = false;
        }
    }
    onMounted(() => {
        dialog.value?.focus({ preventScroll: true });
        load(path.value);
    });
    onBeforeUnmount(() => {
        generation++;
        if (vrFilePicker.value === request) finishVrFilePicker();
    });
</script>

<style scoped>
    .vr-picker-backdrop {
        position: fixed;
        inset: 0;
        z-index: 10000;
        background: rgb(0 0 0 / 0.65);
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 24px;
    }
    .vr-file-picker {
        width: 1160px;
        height: 900px;
        max-height: calc(100vh - 48px);
        display: flex;
        flex-direction: column;
        gap: 20px;
        padding: 28px;
        border: 1px solid var(--border);
        border-radius: 20px;
        background: var(--background);
        color: var(--foreground);
    }
    header,
    footer,
    .vr-picker-path {
        display: flex;
        align-items: center;
        gap: 14px;
    }
    header > div {
        flex: 1;
    }
    h2 {
        font-size: 28px;
        font-weight: 600;
    }
    p {
        color: var(--muted-foreground);
        font-size: 18px;
    }
    button,
    input {
        border: 1px solid var(--border);
        border-radius: 10px;
        padding: 12px 18px;
        font-size: 20px;
        min-height: 52px;
        background: var(--card);
        color: var(--foreground);
    }
    input {
        flex: 1;
        min-width: 0;
    }
    button:hover,
    button.chosen {
        background: var(--accent);
        border-color: var(--primary);
    }
    button:disabled {
        opacity: 0.4;
    }
    .vr-picker-files {
        flex: 1;
        min-height: 0;
        overflow: auto;
        display: grid;
        grid-template-columns: 1fr 1fr;
        align-content: start;
        gap: 12px;
    }
    .vr-picker-files button {
        display: flex;
        text-align: left;
        align-items: center;
        gap: 16px;
        min-width: 0;
        min-height: 72px;
    }
    .vr-picker-files span {
        overflow-wrap: anywhere;
    }
    .vr-picker-files i {
        color: var(--primary);
        font-size: 28px;
        flex-shrink: 0;
    }
    footer {
        flex-shrink: 0;
    }
    .vr-picker-confirm {
        margin-left: auto;
    }
    .vr-picker-error {
        color: var(--destructive);
    }
</style>
