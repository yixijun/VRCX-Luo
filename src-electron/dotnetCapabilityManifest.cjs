/**
 * Renderer-facing .NET capabilities.
 *
 * This is intentionally kept as a data-only manifest so the preload script,
 * main process and contract tests can share the same allowlist. The method
 * names cover the existing AppApi/global interfaces plus the public methods
 * currently implemented by the Electron host classes.
 */
const DOTNET_CAPABILITIES = Object.freeze({
    AppApiElectron: Object.freeze([
        'AddScreenshotMetadata',
        'CancelUpdate',
        'ChangeTheme',
        'CheckForUpdateExe',
        'CheckGameRunning',
        'CheckUpdateProgress',
        'CleanupMemory',
        'CopyImageToClipboard',
        'CropAllPrints',
        'CropPrint',
        'CropPrintImage',
        'CurrentCulture',
        'CurrentLanguage',
        'CustomCss',
        'CustomScript',
        'DeleteAllScreenshotMetadata',
        'DeleteScreenshotMetadata',
        'DeleteVRChatRegistryFolder',
        'DesktopNotification',
        'DoFunny',
        'DownloadUpdate',
        'ExecuteVrOverlayFunction',
        'FileLength',
        'FindScreenshotsBySearch',
        'FlashWindow',
        'FocusWindow',
        'GetClipboard',
        'GetColourBulk',
        'GetColourFromUserID',
        'GetExtraScreenshotData',
        'GetFileBase64',
        'GetImage',
        'GetLastScreenshot',
        'GetLaunchCommand',
        'GetMemoryCleanupSnapshot',
        'GetScreenshotMetadata',
        'GetUGCPhotoLocation',
        'GetVersion',
        'GetVRChatAppDataLocation',
        'GetVRChatCacheLocation',
        'GetVRChatModerations',
        'GetVRChatPhotosLocation',
        'GetVRChatRegistry',
        'GetVRChatRegistryJson',
        'GetVRChatRegistryKey',
        'GetVRChatRegistryKeyString',
        'GetVRChatScreenshotsLocation',
        'GetVRChatUserModeration',
        'GetVRChatWinePath',
        'GetZoom',
        'HandleClosePromptChoice',
        'HasVRChatRegistryFolder',
        'Init',
        'IPCAnnounceStart',
        'IsGameRunning',
        'IsSteamVRRunning',
        'MD5File',
        'OnProcessStateChanged',
        'OpenCalendarFile',
        'OpenCrashVrcCrashDumps',
        'OpenDiscordProfile',
        'OpenFileSelectorDialog',
        'OpenFolderAndSelectItem',
        'OpenFolderSelectorDialog',
        'OpenLink',
        'OpenShortcutFolder',
        'OpenUGCPhotosFolder',
        'OpenVrcAppDataFolder',
        'OpenVrcPhotosFolder',
        'OpenVrcScreenshotsFolder',
        'OpenVrcxAppDataFolder',
        'OVRTNotification',
        'PopulateImageHosts',
        'QuitGame',
        'ReadConfigFile',
        'ReadConfigFileSafe',
        'ReadVrcRegJsonFile',
        'ResizeImageToFitLimits',
        'ResizePrintImage',
        'RestartApplication',
        'RestartAsAdministrator',
        'SaveEmojiToFile',
        'SavePrintToFile',
        'SaveStickerToFile',
        'SendIpc',
        'SetAppLauncherSettings',
        'SetStartup',
        'SetTrayIconNotification',
        'SetUserAgent',
        'SetVR',
        'SetVRChatRegistry',
        'SetVRChatRegistryKey',
        'SetVRChatRegistryKeyAsync',
        'SetVRChatUserModeration',
        'SetZoom',
        'ShowDevTools',
        'SignFile',
        'StartGame',
        'StartGameFromPath',
        'StartSteamVR',
        'TryOpenInstanceInVrc',
        'UpdateTrayNotifications',
        'VrcClosedGracefully',
        'WriteConfigFile',
        'XSNotification'
    ]),
    AppApiVrElectron: Object.freeze([
        'CpuUsage',
        'CurrentCulture',
        'CustomVrScript',
        'GetExecuteVrOverlayFunctionQueue',
        'GetUptime',
        'GetVRDevices',
        'Init',
        'ToggleSystemMonitor',
        'VrInit'
    ]),
    WebApi: Object.freeze([
        'ClearCookies',
        'CreateSecondaryClient',
        'DestroySecondaryClient',
        'Execute',
        'ExecuteAs',
        'ExecuteAsJson',
        'ExecuteJson',
        'Exit',
        'GetCookies',
        'GetSecondaryCookies',
        'Init',
        'SaveCookies',
        'SetCookies',
        'SetSecondaryCookies'
    ]),
    VRCXStorage: Object.freeze([
        'Clear',
        'Flush',
        'Get',
        'GetAll',
        'GetArray',
        'GetObject',
        'Load',
        'Remove',
        'Save',
        'Set',
        'SetArray',
        'SetObject'
    ]),
    SQLite: Object.freeze([
        'Execute',
        'ExecuteJson',
        'ExecuteNonQuery',
        'Exit',
        'Init'
    ]),
    LogWatcher: Object.freeze([
        'Exit',
        'Get',
        'GetLogLines',
        'Init',
        'Reset',
        'SetDateTill'
    ]),
    Discord: Object.freeze(['Exit', 'Init', 'SetActive', 'SetAssets']),
    AssetBundleManager: Object.freeze([
        'CheckVRChatCache',
        'DeleteAllCache',
        'DeleteCache',
        'DirSize',
        'GetAssetId',
        'GetAssetVersion',
        'GetCacheSize',
        'GetVRChatCacheFullLocation',
        'GetVRChatCacheLocation',
        'SweepCache'
    ]),
    ProgramElectron: Object.freeze(['Init', 'PreInit']),
    SystemMonitorElectron: Object.freeze(['Init', 'Start']),
    Update: Object.freeze([
        'CancelUpdate',
        'Check',
        'DownloadInstallRedist',
        'DownloadUpdate',
        'Init'
    ])
});

function isAllowedDotNetClass(className) {
    return (
        typeof className === 'string' &&
        Object.prototype.hasOwnProperty.call(DOTNET_CAPABILITIES, className)
    );
}

function isAllowedDotNetMethod(className, methodName) {
    return (
        isAllowedDotNetClass(className) &&
        typeof methodName === 'string' &&
        DOTNET_CAPABILITIES[className].includes(methodName)
    );
}

function assertAllowedDotNetCall(className, methodName, args) {
    if (!isAllowedDotNetMethod(className, methodName)) {
        throw new Error(`.NET call is not allowed: ${className}.${methodName}`);
    }
    if (!Array.isArray(args)) {
        throw new TypeError('.NET call args must be an array');
    }
}

module.exports = {
    DOTNET_CAPABILITIES,
    assertAllowedDotNetCall,
    isAllowedDotNetClass,
    isAllowedDotNetMethod
};
