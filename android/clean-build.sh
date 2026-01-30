#!/bin/bash
# ============================================================================
# VolumeBooster - Android Clean Build Script (macOS/Linux)
# ============================================================================
# This script thoroughly cleans all Android build artifacts including .cxx
# files to prevent build conflicts and ensure a fresh build.
# ============================================================================

set -e  # Exit on error

echo ""
echo "============================================"
echo "VolumeBooster - Clean Build"
echo "============================================"
echo ""

cd "$(dirname "$0")"

echo "[1/5] Cleaning Gradle cache..."
./gradlew clean

echo ""
echo "[2/5] Removing .gradle folders..."
rm -rf .gradle
rm -rf app/.gradle

echo ""
echo "[3/5] Removing build folders..."
rm -rf build
rm -rf app/build

echo ""
echo "[4/5] Removing .cxx folders (C++ build artifacts)..."
rm -rf .cxx
rm -rf app/.cxx
rm -rf .externalNativeBuild
rm -rf app/.externalNativeBuild

echo ""
echo "[5/5] Cleaning Gradle daemon..."
./gradlew --stop

echo ""
echo "============================================"
echo "Clean completed successfully!"
echo "============================================"
echo ""
echo "You can now rebuild with: ./gradlew assembleDebug"
echo "Or run from project root: npm run android"
echo ""

