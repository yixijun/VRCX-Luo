@echo off
setlocal

echo ===================================================
echo   VRCX-Luo Local Windows Portable Build Script
echo ===================================================
echo.

:: --- [0/4] Check and Auto-Install .NET SDK ---
dotnet --version >nul 2>&1
if %errorlevel% neq 0 (
    echo [INFO] .NET SDK not found.
    echo [INFO] Attempting to auto-install .NET 10 SDK via winget...
    echo.
    winget install Microsoft.DotNet.SDK.10 --accept-package-agreements --accept-source-agreements
    if %errorlevel% neq 0 (
        echo.
        echo [ERROR] Auto-install failed. Please install .NET 10 SDK manually:
        echo https://dotnet.microsoft.com/download/dotnet/10.0
        pause
        exit /b 1
    )
    echo.
    echo [SUCCESS] .NET 10 SDK installed! 
    echo [IMPORTANT] Windows requires a shell restart to recognize new environment variables.
    echo Please CLOSE this window and RE-RUN the script.
    pause
    exit /b 0
)

:: --- [1/4] Check Node.js ^& npm ---
node --version >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Node.js not found. Please install Node.js v24 or later from https://nodejs.org/
    pause
    exit /b 1
)

call npm --version >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] npm part of Node.js not found. Please ensure Node.js is correctly installed.
    pause
    exit /b 1
)

:: --- [2/4] Install Node Dependencies ---
if not exist "node_modules\" (
    echo [INFO] node_modules not found. Running "npm install"...
    call npm install
    if %errorlevel% neq 0 (
        echo [ERROR] npm install failed!
        pause
        exit /b 1
    )
)

:: --- [3/4] Building Frontend ---
echo [INFO] Building Frontend...
call npm run prod
if %errorlevel% neq 0 (
    echo [ERROR] Frontend build failed! Check errors above.
    pause
    exit /b 1
)
echo.

:: --- [4/4] Building Backend ---
echo [INFO] Building Backend...
:: Kill any running instances
taskkill /F /IM VRCX-Luo.exe /T >nul 2>&1

call dotnet build Dotnet\VRCX-Cef.csproj -p:Configuration=Release -p:Platform=x64
if %errorlevel% neq 0 (
    echo [ERROR] Backend build failed!
    pause
    exit /b 1
)
echo.

:: --- Finalize ---
echo [INFO] Merging Resources...
if not exist "build\Cef\html" mkdir "build\Cef\html"
xcopy "build\html" "build\Cef\html" /E /I /H /Y /Q
if %errorlevel% neq 0 (
    echo [ERROR] Resource merge failed!
    pause
    exit /b 1
)
echo.

echo ===================================================
echo [SUCCESS] Local build completed successfully!
echo.
echo You can run the portable executable here:
echo %~dp0build\Cef\VRCX-Luo.exe
echo ===================================================
pause
