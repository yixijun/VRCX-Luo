import { useRemoteAccessStore } from '../stores/remoteAccess';

async function initRemoteAccessOnStartup() {
    await useRemoteAccessStore().init();
}

export { initRemoteAccessOnStartup };
