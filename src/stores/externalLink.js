import { ref } from 'vue';
import { defineStore } from 'pinia';

export const useExternalLinkStore = defineStore('ExternalLink', () => {
    const externalLinkDialog = ref({
        visible: false,
        link: ''
    });

    function showExternalLinkDialog(link) {
        if (!link) {
            return;
        }
        externalLinkDialog.value = {
            visible: true,
            link: String(link)
        };
    }

    function closeExternalLinkDialog() {
        externalLinkDialog.value.visible = false;
    }

    return {
        externalLinkDialog,
        showExternalLinkDialog,
        closeExternalLinkDialog
    };
});
