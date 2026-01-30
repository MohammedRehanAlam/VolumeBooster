# 🔧 Quick Fix: Android Build Issues & .cxx Files

## ⚡ Having Build Conflicts? Run This:

### Windows (PowerShell or CMD):
```bash
cd android
clean-build.bat
cd ..
npm run android
```

### macOS/Linux:
```bash
cd android
chmod +x clean-build.sh
./clean-build.sh
cd ..
npm run android
```

## 📋 What are .cxx files?

**Location:** `android/app/build/intermediates/cxx/`

**What they are:**
- Temporary C++ build artifacts from React Native
- Generated automatically during Android builds
- Machine-specific and environment-specific
- **Should NEVER be committed to Git** ✓ (Already configured in .gitignore)

**Why they're generated:**
- React Native's JSI (JavaScript Interface) uses C++
- Native modules like `react-native-reanimated`, `react-native-gesture-handler` use C++
- Hermes JavaScript engine integration
- Performance-critical native code

## ✅ Your Project Status:

| Check | Status | Location |
|-------|--------|----------|
| `.gitignore` configured | ✅ YES | Lines 160-164, 127, 169 |
| `.cxx` tracked in git | ✅ NO | Properly ignored |
| Build folder ignored | ✅ YES | `android/app/build/` |
| Clean scripts created | ✅ YES | `android/clean-build.bat` & `.sh` |

## 🚀 Quick Commands:

```bash
# Normal build
npm run android

# Quick clean before build
npm run clean:android

# Deep clean (removes .cxx and all build artifacts)
npm run clean:android:deep

# If still having issues - nuclear option:
cd android
clean-build.bat
cd ..
rm -rf node_modules
npm install
npm run android
```

## 🛑 Common Build Errors & Solutions:

### Error: "Execution failed for task ':app:configureCMakeDebug'"
```bash
cd android && clean-build.bat && cd .. && npm run android
```

### Error: "Duplicate class found"
```bash
npm run clean:android:deep && npm run android
```

### Error: "ninja: error: unknown target"
```bash
cd android
rmdir /s /q app\.cxx app\build
gradlew assembleDebug
```

### Error: App crashes on startup after rebuild
```bash
npm run clean:android:deep
npx react-native clean-cache
npm run android
```

## 📝 Remember:

1. **`.cxx` files regenerate automatically** - Don't worry about deleting them
2. **Already ignored in Git** - Won't be committed ✓
3. **Clean before switching branches** - Prevents conflicts
4. **Deep clean when adding/removing native modules** - Ensures fresh build

## 📚 More Details:

See `doc/ANDROID_BUILD_CLEAN.md` for comprehensive documentation.

---

**TL;DR:** Run `cd android && clean-build.bat` whenever you have build issues. The `.cxx` files will regenerate automatically and won't conflict.

