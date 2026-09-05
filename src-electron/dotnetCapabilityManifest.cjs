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

const ARGUMENT_TYPES = Object.freeze({
    any: Object.freeze({ type: 'any' }),
    array: Object.freeze({ type: 'array' }),
    boolean: Object.freeze({ type: 'boolean' }),
    integer: Object.freeze({ type: 'integer' }),
    number: Object.freeze({ type: 'number' }),
    object: Object.freeze({ type: 'object' }),
    string: Object.freeze({ type: 'string' }),
    stringOrNull: Object.freeze({
        type: 'string',
        allowNullish: true
    }),
    bytes: Object.freeze({ type: 'bytes' })
});

function optional(argumentType) {
    return Object.freeze({ ...argumentType, allowNullish: true });
}

function createMethodSchema(minArgs, maxArgs, validators = []) {
    return Object.freeze({
        minArgs,
        maxArgs,
        validators: Object.freeze(validators)
    });
}

const noArgs = () => createMethodSchema(0, 0);
const exact = (...validators) =>
    createMethodSchema(validators.length, validators.length, validators);
const range = (minArgs, maxArgs, validators) =>
    createMethodSchema(minArgs, maxArgs, validators);

const DOTNET_CAPABILITY_SCHEMAS = Object.fromEntries(
    Object.entries(DOTNET_CAPABILITIES).map(([className, methods]) => [
        className,
        Object.freeze(
            Object.fromEntries(
                methods.map((methodName) => [methodName, noArgs()])
            )
        )
    ])
);

function defineSchemas(className, schemas) {
    DOTNET_CAPABILITY_SCHEMAS[className] = Object.freeze({
        ...DOTNET_CAPABILITY_SCHEMAS[className],
        ...schemas
    });
}

const {
    any,
    array,
    boolean,
    integer,
    number,
    object,
    string,
    stringOrNull,
    bytes
} = ARGUMENT_TYPES;

defineSchemas('AppApiElectron', {
    AddScreenshotMetadata: range(3, 4, [
        string,
        string,
        string,
        optional(boolean)
    ]),
    ChangeTheme: exact(integer),
    CleanupMemory: exact(boolean),
    CopyImageToClipboard: exact(string),
    CropAllPrints: exact(string),
    CropPrint: exact(any),
    CropPrintImage: exact(string),
    DesktopNotification: range(1, 4, [
        string,
        optional(stringOrNull),
        optional(stringOrNull),
        optional(boolean)
    ]),
    DownloadUpdate: exact(string, string, integer),
    ExecuteVrOverlayFunction: exact(string, string),
    FileLength: exact(string),
    FindScreenshotsBySearch: range(1, 2, [string, optional(integer)]),
    GetColourBulk: exact(array),
    GetColourFromUserID: exact(string),
    GetExtraScreenshotData: exact(string, boolean),
    GetFileBase64: exact(string),
    GetImage: exact(string, string, string),
    GetScreenshotMetadata: exact(string),
    GetUGCPhotoLocation: range(0, 1, [optional(string)]),
    GetVRChatModerations: exact(string),
    GetVRChatRegistryKey: exact(string),
    GetVRChatRegistryKeyString: exact(string),
    GetVRChatUserModeration: exact(string, string),
    HandleClosePromptChoice: exact(string, boolean),
    MD5File: exact(string),
    OnProcessStateChanged: exact(any),
    OpenCalendarFile: exact(string),
    OpenDiscordProfile: exact(string),
    OpenFileSelectorDialog: range(0, 3, [
        optional(stringOrNull),
        optional(stringOrNull),
        optional(stringOrNull)
    ]),
    OpenFolderAndSelectItem: range(1, 2, [string, optional(boolean)]),
    OpenFolderSelectorDialog: range(0, 1, [optional(stringOrNull)]),
    OpenLink: exact(string),
    OpenUGCPhotosFolder: range(0, 1, [optional(string)]),
    OVRTNotification: range(6, 7, [
        boolean,
        boolean,
        string,
        string,
        integer,
        number,
        optional(stringOrNull)
    ]),
    PopulateImageHosts: exact(string),
    ReadVrcRegJsonFile: exact(string),
    ResizeImageToFitLimits: exact(string),
    ResizePrintImage: exact(bytes),
    RestartApplication: exact(boolean),
    SaveEmojiToFile: exact(string, string, string, string),
    SavePrintToFile: exact(string, string, string, string),
    SaveStickerToFile: exact(string, string, string, string),
    SendIpc: exact(string, string),
    SetAppLauncherSettings: exact(boolean, boolean, boolean),
    SetStartup: exact(boolean),
    SetTrayIconNotification: exact(boolean),
    SetVR: exact(boolean, boolean, boolean, boolean, integer),
    SetVRChatRegistry: exact(string),
    SetVRChatRegistryKey: range(2, 3, [string, any, optional(integer)]),
    SetVRChatRegistryKeyAsync: exact(string, any, integer),
    SetVRChatUserModeration: exact(string, string, integer),
    SetZoom: exact(number),
    SignFile: exact(string),
    StartGame: exact(string),
    StartGameFromPath: exact(string, string),
    TryOpenInstanceInVrc: exact(string),
    UpdateTrayNotifications: exact(string),
    WriteConfigFile: exact(string),
    XSNotification: range(4, 5, [
        string,
        string,
        integer,
        number,
        optional(stringOrNull)
    ])
});

defineSchemas('AppApiVrElectron', {
    ToggleSystemMonitor: exact(boolean)
});

defineSchemas('WebApi', {
    CreateSecondaryClient: exact(string),
    DestroySecondaryClient: exact(string),
    Execute: exact(object),
    ExecuteAs: exact(string, object),
    ExecuteAsJson: exact(string, string),
    ExecuteJson: exact(string),
    GetSecondaryCookies: exact(string),
    SetCookies: exact(string),
    SetSecondaryCookies: exact(string, string)
});

defineSchemas('VRCXStorage', {
    Get: exact(string),
    GetArray: exact(string),
    GetObject: exact(string),
    Remove: exact(string),
    Set: exact(string, string),
    SetArray: exact(string, array),
    SetObject: exact(string, object)
});

defineSchemas('SQLite', {
    Execute: range(1, 2, [string, optional(object)]),
    ExecuteJson: range(1, 2, [string, optional(object)]),
    ExecuteNonQuery: range(1, 2, [string, optional(object)])
});

defineSchemas('LogWatcher', {
    SetDateTill: exact(string)
});

defineSchemas('Discord', {
    SetActive: exact(boolean),
    SetAssets: exact(
        stringOrNull,
        stringOrNull,
        stringOrNull,
        stringOrNull,
        stringOrNull,
        stringOrNull,
        stringOrNull,
        number,
        number,
        stringOrNull,
        number,
        number,
        stringOrNull,
        stringOrNull,
        stringOrNull,
        number,
        number
    )
});

defineSchemas('AssetBundleManager', {
    CheckVRChatCache: exact(string, integer, string, integer),
    DeleteCache: exact(string, integer, string, integer),
    DirSize: exact(any),
    GetAssetId: range(1, 2, [string, optional(string)]),
    GetAssetVersion: range(1, 2, [integer, optional(integer)]),
    GetVRChatCacheFullLocation: range(2, 4, [
        string,
        integer,
        optional(string),
        optional(integer)
    ])
});

defineSchemas('ProgramElectron', {
    PreInit: exact(string, array)
});

defineSchemas('SystemMonitorElectron', {
    Start: exact(boolean)
});

defineSchemas('Update', {
    DownloadUpdate: exact(string, string, integer),
    Init: range(0, 1, [optional(string)])
});

Object.freeze(DOTNET_CAPABILITY_SCHEMAS);

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

function isValidArgument(value, argumentType) {
    if (
        argumentType.allowNullish === true &&
        (value === null || value === undefined)
    ) {
        return true;
    }

    switch (argumentType.type) {
        case 'any':
            return true;
        case 'array':
            return Array.isArray(value);
        case 'boolean':
            return typeof value === 'boolean';
        case 'integer':
            return Number.isInteger(value);
        case 'number':
            return typeof value === 'number' && Number.isFinite(value);
        case 'object':
            return (
                value !== null &&
                typeof value === 'object' &&
                !Array.isArray(value)
            );
        case 'bytes':
            return Array.isArray(value) || ArrayBuffer.isView(value);
        case 'string':
            return typeof value === 'string';
        default:
            return false;
    }
}

function describeMethodSchema(schema) {
    if (schema.minArgs === schema.maxArgs) {
        return `${schema.minArgs} argument${schema.minArgs === 1 ? '' : 's'}`;
    }
    return `${schema.minArgs}-${schema.maxArgs} arguments`;
}

function assertAllowedDotNetCall(className, methodName, args) {
    if (!isAllowedDotNetMethod(className, methodName)) {
        throw new Error(`.NET call is not allowed: ${className}.${methodName}`);
    }
    if (!Array.isArray(args)) {
        throw new TypeError('.NET call args must be an array');
    }

    const schema = DOTNET_CAPABILITY_SCHEMAS[className]?.[methodName];
    if (!schema) {
        throw new Error(
            `.NET call has no parameter schema: ${className}.${methodName}`
        );
    }
    if (args.length < schema.minArgs || args.length > schema.maxArgs) {
        throw new TypeError(
            `.NET call arguments are invalid for ${className}.${methodName}: expected ${describeMethodSchema(schema)}, received ${args.length}`
        );
    }

    for (let index = 0; index < args.length; index += 1) {
        const argumentType = schema.validators[index];
        if (!argumentType || !isValidArgument(args[index], argumentType)) {
            throw new TypeError(
                `.NET call argument ${index + 1} is invalid for ${className}.${methodName}`
            );
        }
    }
}

module.exports = {
    ARGUMENT_TYPES,
    DOTNET_CAPABILITIES,
    DOTNET_CAPABILITY_SCHEMAS,
    assertAllowedDotNetCall,
    isAllowedDotNetClass,
    isAllowedDotNetMethod
};
