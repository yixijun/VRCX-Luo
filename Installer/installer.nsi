;--------------------------------
; NSIS input encoding

    !pragma codepage UTF8

;--------------------------------
;Plugins
;https://nsis.sourceforge.io/ApplicationID_plug-in
;https://nsis.sourceforge.io/ShellExecAsUser_plug-in
;https://nsis.sourceforge.io/NsProcess_plugin
;https://nsis.sourceforge.io/Inetc_plug-in

!addplugindir "Plugins\x86-unicode"

;--------------------------------
;Version
    !include "version_define.nsh"

    !define PRODUCT_VERSION ${PRODUCT_VERSION_FROM_FILE}
    !define VERSION ${PRODUCT_VERSION_FROM_FILE}

    VIProductVersion "${PRODUCT_VERSION}"
    VIFileVersion "${VERSION}"
    VIAddVersionKey "FileVersion" "${VERSION}"
    VIAddVersionKey "ProductName" "VRCX-Luo"
    VIAddVersionKey "ProductVersion" "${PRODUCT_VERSION}"
    VIAddVersionKey "LegalCopyright" "Copyright vrcx-team, pypy, natsumi"
    VIAddVersionKey "FileDescription" "Friendship management tool for VRChat"

;--------------------------------
;Include Modern UI

    !include "MUI2.nsh"
    !include "FileFunc.nsh"
    !include "LogicLib.nsh"

;--------------------------------
;General

    SetCompressor /SOLID lzma
    SetCompressorDictSize 16
    Unicode True
    Name "VRCX-Luo"
    OutFile "VRCX-Luo_Setup.exe"
    InstallDir "$PROGRAMFILES64\VRCX-Luo"
    InstallDirRegKey HKLM "Software\VRCX-Luo" "InstallDir"
    RequestExecutionLevel admin
    ShowInstDetails show

;--------------------------------
;Variables

    VAR upgradeInstallation

;--------------------------------
;Interface Settings

    !define MUI_ABORTWARNING

;--------------------------------
;Icons

    !define MUI_ICON "../images/VRCX.ico"
    !define MUI_UNICON "../images/VRCX.ico"

;--------------------------------
;Pages

    !define MUI_PAGE_CUSTOMFUNCTION_PRE SkipIfUpgrade
    !insertmacro MUI_PAGE_LICENSE "..\LICENSE"

    !define MUI_PAGE_CUSTOMFUNCTION_PRE SkipIfUpgrade
    !insertmacro MUI_PAGE_DIRECTORY

    !insertmacro MUI_PAGE_INSTFILES

    ;------------------------------
    ; Finish Page

    ; Checkbox to launch VRCX.
    !define MUI_FINISHPAGE_RUN
    !define MUI_FINISHPAGE_RUN_TEXT "Launch VRCX-Luo"
    !define MUI_FINISHPAGE_RUN_FUNCTION launchVRCX

    ; Checkbox to create desktop shortcut.
    !define MUI_FINISHPAGE_SHOWREADME
    !define MUI_FINISHPAGE_SHOWREADME_TEXT "Create desktop shortcut"
    !define MUI_FINISHPAGE_SHOWREADME_FUNCTION createDesktopShortcut

    !define MUI_PAGE_CUSTOMFUNCTION_PRE SkipIfUpgrade
    !insertmacro MUI_PAGE_FINISH

    !insertmacro MUI_UNPAGE_CONFIRM
    !insertmacro MUI_UNPAGE_INSTFILES
    !insertmacro MUI_UNPAGE_FINISH

;--------------------------------
;Languages

    !insertmacro MUI_LANGUAGE "English"

;--------------------------------
;Macros

;--------------------------------
;Functions

Function SkipIfUpgrade
    StrCmp $upgradeInstallation 0 noUpgrade
        Abort
    noUpgrade:
FunctionEnd

Function .onInit
    StrCpy $upgradeInstallation 0

    ReadRegStr $R0 HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\VRCX-Luo" "UninstallString"
    StrCmp $R0 "" notInstalled
        StrCpy $upgradeInstallation 1
    notInstalled:

    ; If VRCX is already running, display a warning message
    loop:
    StrCpy $1 "VRCX-Luo.exe"
    nsProcess::_FindProcess "$1"
    Pop $R1
    ${If} $R1 = 0
        MessageBox MB_OKCANCEL|MB_ICONEXCLAMATION "VRCX-Luo 依旧在运行。$\n$\n点击“确定”结束进程，或者“取消”退出安装程序。" /SD IDOK IDCANCEL cancel
            nsExec::ExecToStack "taskkill /IM VRCX-Luo.exe"
    ${Else}
        Goto done
    ${EndIf}
    Sleep 1000
    Goto loop

    cancel:
        Abort
    done:
FunctionEnd

Function .onInstSuccess
    ${If} $upgradeInstallation = 1
        Call launchVRCX
    ${EndIf}
FunctionEnd

Function createDesktopShortcut
    CreateShortcut "$DESKTOP\VRCX-Luo.lnk" "$INSTDIR\VRCX-Luo.exe"
FunctionEnd

Function launchVRCX
    SetOutPath $INSTDIR
    ShellExecAsUser::ShellExecAsUser "" "$INSTDIR\VRCX-Luo.exe" ""
FunctionEnd

;--------------------------------
;Installer Sections

Section "Install" SecInstall
    StrCmp $upgradeInstallation 0 noUpgrade
        DetailPrint "Uninstall previous version..."
        ExecWait '"$INSTDIR\Uninstall.exe" /S _?=$INSTDIR'
        Delete $INSTDIR\Uninstall.exe
        Goto afterUpgrade
    noUpgrade:

    inetc::get "https://aka.ms/vs/17/release/vc_redist.x64.exe" $TEMP\vcredist_x64.exe
    ExecWait "$TEMP\vcredist_x64.exe /install /quiet /norestart"
    Delete "$TEMP\vcredist_x64.exe"

    afterUpgrade:

    SetOutPath "$INSTDIR"

    File /r /x *.log /x *.pdb "..\build\Cef\*.*"

    WriteRegStr HKLM "Software\VRCX-Luo" "InstallDir" $INSTDIR
    WriteUninstaller "$INSTDIR\Uninstall.exe"
    WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\VRCX-Luo" "DisplayName" "VRCX-Luo"
    WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\VRCX-Luo" "Publisher" "yixijun"
    WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\VRCX" "DisplayVersion" "${VERSION}"
    WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\VRCX" "DisplayArch" "x64"
    WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\VRCX" "InstallLocation" "$INSTDIR"
    WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\VRCX-Luo" "UninstallString" "$\"$INSTDIR\Uninstall.exe$\""
    WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\VRCX-Luo" "DisplayIcon" "$\"$INSTDIR\VRCX.ico$\""

    ${GetSize} "$INSTDIR" "/S=0K" $0 $1 $2
    IntFmt $0 "0x%08X" $0
    WriteRegDWORD HKLM  "Software\Microsoft\Windows\CurrentVersion\Uninstall\VRCX-Luo" "EstimatedSize" "$0"

    ${GetParameters} $R2
    ${GetOptions} $R2 /SKIP_SHORTCUT= $3
    StrCmp $3 "true" noShortcut
        CreateShortCut "$SMPROGRAMS\VRCX-Luo.lnk" "$INSTDIR\VRCX-Luo.exe"
        ApplicationID::Set "$SMPROGRAMS\VRCX-Luo.lnk" "VRCX-Luo"
    noShortcut:

    WriteRegStr HKCU "Software\Classes\vrcx-luo" "" "URL:vrcx-luo"
    WriteRegStr HKCU "Software\Classes\vrcx-luo" "FriendlyTypeName" "VRCX-Luo"
    WriteRegStr HKCU "Software\Classes\vrcx" "URL Protocol" ""
    WriteRegExpandStr HKCU "Software\Classes\vrcx\DefaultIcon" "" "$INSTDIR\VRCX.ico"
    WriteRegStr HKCU "Software\Classes\vrcx\shell" "" "open"
    WriteRegStr HKCU "Software\Classes\vrcx-luo\shell\open" "FriendlyAppName" "VRCX-Luo"
    WriteRegStr HKCU "Software\Classes\vrcx-luo\shell\open\command" "" '"$INSTDIR\VRCX-Luo.exe" /uri="%1" /params="%2 %3 %4"'
SectionEnd

;--------------------------------
;Uninstaller Section

Section "Uninstall"
    ; If VRCX is already running, display a warning message and exit
    StrCpy $1 "VRCX-Luo.exe"
    nsProcess::_FindProcess "$1"
    Pop $R1
    ${If} $R1 = 0
        MessageBox MB_OK|MB_ICONEXCLAMATION "VRCX-Luo 依旧在运行。无法卸载此软件。$\n请先关闭 VRCX-Luo 并重试。" /SD IDOK
        Abort
    ${EndIf}

    RMDir /r "$INSTDIR"

    DeleteRegKey HKLM "Software\VRCX-Luo"
    DeleteRegKey HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\VRCX-Luo"
    DeleteRegKey HKCU "Software\Classes\vrcx-luo"

    ${IfNot} ${Silent}
        Delete "$SMPROGRAMS\VRCX.lnk"
        Delete "$DESKTOP\VRCX-Luo.lnk"
    ${EndIf}
SectionEnd
