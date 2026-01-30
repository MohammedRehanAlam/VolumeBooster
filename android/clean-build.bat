@echo off
REM ============================================================================
REM VolumeBooster - Android Clean Build Script
REM ============================================================================
REM This script thoroughly cleans all Android build artifacts including .cxx
REM files to prevent build conflicts and ensure a fresh build.
REM ============================================================================

echo.
echo ============================================
echo VolumeBooster - Clean Build
echo ============================================
echo.

cd /d "%~dp0"

echo [1/5] Cleaning Gradle cache...
call gradlew clean
if errorlevel 1 (
    echo ERROR: Gradle clean failed
    exit /b 1
)

echo.
echo [2/5] Removing .gradle folders...
if exist .gradle rmdir /s /q .gradle
if exist app\.gradle rmdir /s /q app\.gradle

echo.
echo [3/5] Removing build folders...
if exist build rmdir /s /q build
if exist app\build rmdir /s /q app\build

echo.
echo [4/5] Removing .cxx folders (C++ build artifacts)...
if exist .cxx rmdir /s /q .cxx
if exist app\.cxx rmdir /s /q app\.cxx
if exist .externalNativeBuild rmdir /s /q .externalNativeBuild
if exist app\.externalNativeBuild rmdir /s /q app\.externalNativeBuild

echo.
echo [5/5] Cleaning Gradle daemon...
call gradlew --stop

echo.
echo ============================================
echo Clean completed successfully!
echo ============================================
echo.
echo You can now rebuild with: gradlew assembleDebug
echo Or run from project root: npm run android
echo.

pause

