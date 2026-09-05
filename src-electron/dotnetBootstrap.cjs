/**
 * Initializes the Electron .NET host objects.
 *
 * The call order is part of the host interface: ProgramElectron receives the
 * process arguments before the remaining objects are initialized, and the VR
 * object is initialized last. Keeping that sequence in one module gives the
 * composition root a small, testable seam without changing any host calls.
 *
 * @param {object} dependencies
 * @param {{getDotNetObject: (className: string) => object}} dependencies.interopApi
 * @param {string} dependencies.version
 * @param {string[]} dependencies.args
 */
function initializeDotnet({ interopApi, version, args }) {
    interopApi.getDotNetObject('ProgramElectron').PreInit(version, args);
    interopApi.getDotNetObject('VRCXStorage').Load();
    interopApi.getDotNetObject('ProgramElectron').Init();
    interopApi.getDotNetObject('SQLite').Init();
    interopApi.getDotNetObject('AppApiElectron').Init();
    interopApi.getDotNetObject('Discord').Init();
    interopApi.getDotNetObject('WebApi').Init();
    interopApi.getDotNetObject('LogWatcher').Init();
    interopApi.getDotNetObject('SystemMonitorElectron').Init();
    interopApi.getDotNetObject('AppApiVrElectron').Init();
}

module.exports = { initializeDotnet };
