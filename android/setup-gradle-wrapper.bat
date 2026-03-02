@echo off
REM ============================================================
REM  Gradle Wrapper Bootstrap - Downloads gradle-wrapper.jar
REM  for Gradle 8.9 (required by AGP 8.7.0)
REM
REM  Usage: setup-gradle-wrapper.bat
REM  After success, run: gradlew.bat tasks
REM ============================================================

setlocal

set WRAPPER_DIR=%~dp0gradle\wrapper
set JAR_FILE=%WRAPPER_DIR%\gradle-wrapper.jar
set JAR_URL=https://raw.githubusercontent.com/gradle/gradle/v8.9.0/gradle/wrapper/gradle-wrapper.jar

if not exist "%WRAPPER_DIR%" mkdir "%WRAPPER_DIR%"

if exist "%JAR_FILE%" (
    echo gradle-wrapper.jar already exists.
    goto verify
)

echo.
echo Downloading gradle-wrapper.jar for Gradle 8.9...
echo Source: %JAR_URL%
echo.

REM Method 1: PowerShell (preferred, available on Windows 10+)
where powershell >NUL 2>&1
if %ERRORLEVEL% equ 0 (
    echo Trying PowerShell...
    powershell -NoProfile -ExecutionPolicy Bypass -Command ^
        "[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12; Invoke-WebRequest -Uri '%JAR_URL%' -OutFile '%JAR_FILE%' -UseBasicParsing" 2>NUL
    if exist "%JAR_FILE%" goto verify
    echo   PowerShell download failed.
)

REM Method 2: curl (available in newer Windows builds and Git Bash)
where curl >NUL 2>&1
if %ERRORLEVEL% equ 0 (
    echo Trying curl...
    curl -fsSL -o "%JAR_FILE%" "%JAR_URL%" 2>NUL
    if exist "%JAR_FILE%" goto verify
    echo   curl download failed.
)

REM Method 3: Node.js
where node >NUL 2>&1
if %ERRORLEVEL% equ 0 (
    echo Trying Node.js...
    node "%~dp0download-wrapper.js" 2>NUL
    if exist "%JAR_FILE%" goto verify
    echo   Node.js download failed.
)

echo.
echo ERROR: Could not download gradle-wrapper.jar automatically.
echo.
echo Please download manually:
echo   URL:  %JAR_URL%
echo   Save: %JAR_FILE%
echo.
exit /b 1

:verify
for %%A in ("%JAR_FILE%") do set JAR_SIZE=%%~zA
echo.
echo gradle-wrapper.jar: %JAR_SIZE% bytes

if %JAR_SIZE% LSS 10000 (
    echo WARNING: File is suspiciously small (expected ~43KB^).
    echo It may be corrupt. Try deleting and re-downloading.
    del "%JAR_FILE%" 2>NUL
    exit /b 1
)

echo.
echo ============================================================
echo   Gradle wrapper is ready!
echo   Run: gradlew.bat tasks
echo ============================================================
echo.
exit /b 0
