# 🔊 VolumeBooster - React Native Audio Enhancement App

A powerful React Native implementation of volume boosting functionality with **background processing capabilities**. This app allows users to boost audio levels beyond system limits with fine adjustments, real-time audio device monitoring, intelligent boost modes, and **continuous background operation**.

## 🚀 Key Features

### **Audio Enhancement**
- **Volume Control**: Standard device volume slider (0-100%) with device synchronization
- **Audio Boost**: Loudness enhancement beyond system limits (0-200%)
- **App-Only vs Device-Wide Boost**: Toggle between boosting only app audio or all device audio
- **Gradual vs Discrete Boost**: Toggle between continuous (1%) and step-based (10%) boost control
- **Independent Controls**: All toggles work independently for flexible configuration

### **🔄 Background Processing** ⭐ **NEW**
- **Background Mode**: Audio boost continues working even when app is closed
- **Foreground Service**: Android foreground service maintains boost functionality
- **Service Status Monitoring**: Real-time service health checking
- **Battery Optimized**: Efficient background operation with minimal resource usage
- **Volume Preservation**: Background mode preserves current device volume

### **🎯 Smart Volume Management** ⭐ **NEW**
- **Auto-Volume Mode**: Automatically sets device volume to 100% only during audio playback
- **Volume Synchronization**: App syncs with actual device volume on startup
- **Original Volume Backup**: Remembers and restores original volume after playback
- **Manual Volume Updates**: Backup updates when user manually changes volume

### **Real-Time Monitoring**
- **Live Device Detection**: Automatic detection of audio output devices
- **Device Information Display**: Shows device name, type, channels, encodings, and sample rates
- **Volume Monitoring**: Real-time tracking of system volume changes

### **User Experience**
- **Dark/Light Theme**: Automatic system theme detection with modern UI
- **Safety Warnings**: Visual indicators and warnings for high boost levels
- **Test Sound**: Built-in 440Hz test tone to verify boost functionality
- **Instant Toggle**: Seamless background mode switching without popup interruptions
- **Modern Loading Screen**: Animated loading with progress tracking
- **Immersive Edge-to-Edge UI**: Translucent status bar and safe area handling for a modern look
- **Cross-platform**: Works on Android (iOS support can be added)

## 📊 Boost Levels & Safety

| Boost Range | Color | dB Gain | Warning Level |
|-------------|-------|---------|---------------|
| **0-50%** | Normal | 0-12.5 dB | None |
| **50-100%** | Green | 12.5-25 dB | Moderate |
| **100-150%** | Orange | 25-37.5 dB | High |
| **150-200%** | Red | 37.5-50 dB | ⚠️ Dangerous |

## 🚀 Quick Start

1. Install dependencies:
```bash
npm install
```

2. Run on Android:
```bash
npx react-native run-android
```

3. **Configure Audio Settings**:
   - **Volume Control**: Adjust device volume (0-100%)
   - **Boost Level**: Set audio boost (0-200%) with safety warnings
   - **Boost Mode**: Choose App-Only or Device-Wide boost
   - **Gradual Control**: Toggle between 1% and 10% increments

4. **Enable Background Mode** (Optional):
   - Toggle the "Background Mode" switch in the app
   - Audio boost will continue working even when app is closed

5. **Use Auto-Volume** (Optional):
   - Enable "Auto-Volume" for smart volume management
   - Device volume automatically sets to 100% only during audio playback
   - Original volume is restored after playback ends

## 🔄 Background Mode Usage

### **How to Use Background Mode:**
1. **Set Boost Level**: Adjust boost slider to desired level (0-200%)
2. **Enable Background Mode**: Toggle the "Background Mode" switch
3. **Close App**: Audio boost continues working in background
4. **Disable When Done**: Toggle background mode off to stop service

### **Background Mode Features:**
- ✅ **Continuous Boost**: Works even when app is closed
- ✅ **Service Monitoring**: Automatic health checking every 2 seconds
- ✅ **Status Indicators**: Real-time service status display
- ✅ **Battery Efficient**: Optimized background operation
- ✅ **Instant Control**: Seamless toggle without interruptions

## 🎯 Auto-Volume Mode Usage

### **How Auto-Volume Works:**
1. **Enable Auto-Volume**: Toggle the "Auto-Volume" switch
2. **Backup Current Volume**: App remembers your current volume level
3. **Audio Playback Detection**: When app plays audio (test sound, etc.)
4. **Automatic Volume Boost**: Device volume temporarily sets to 100%
5. **Volume Restoration**: Original volume restored after playback ends

### **Auto-Volume Features:**
- ✅ **Smart Detection**: Only activates during actual audio playback
- ✅ **Volume Backup**: Remembers your preferred volume level
- ✅ **Automatic Restoration**: Returns to original volume after playback
- ✅ **Manual Updates**: Backup updates when you manually change volume
- ✅ **Playback Protection**: Prevents backup updates during temporary volume changes

## 🔧 Integration Guide

Want to add volume boosting functionality to your React Native app? 

**📚 [Complete Integration Guide →](./doc/VOLUME_BOOSTER_README.md#integration-guide---use-in-your-own-project)**

The `VolumeBooster` component is completely self-contained and can be easily integrated into any React Native project. See the detailed documentation for step-by-step instructions, required dependencies, and customization options.

## 🏗️ Project Structure

```
VolumeBooster/
├── 📱 React Native App
│   ├── App.tsx                    # Main app entry point with theme management
│   ├── src/
│   │   ├── components/
│   │   │   └── VolumeBooster.tsx  # Main UI component with all controls
│   │   ├── modules/
│   │   │   └── VolumeBoosterModule.ts # TypeScript interface for native module
│   │   └── index.ts              # Main exports
│   └── package.json              # Dependencies and scripts
│
├── 🤖 Android Native Implementation
│   └── android/app/src/main/java/com/volumebooster/
│       ├── VolumeBoosterModule.kt    # Core audio processing logic
│       ├── VolumeBoosterService.kt  # Background foreground service ⭐ NEW
│       ├── VolumeBoosterPackage.kt  # React Native module registration
│       ├── MainActivity.kt          # Android activity
│       └── MainApplication.kt       # Android application class
│
├── 📚 Documentation
│   ├── README.md                   # This file - project overview
│   └── doc/
│       └── VOLUME_BOOSTER_README.md # Detailed technical documentation
│
└── ⚙️ Configuration Files
    ├── tsconfig.json               # TypeScript configuration
    ├── babel.config.js            # Babel configuration
    ├── metro.config.js             # Metro bundler configuration
    └── jest.config.js              # Testing configuration
```

## 🔧 Technical Architecture

### **Audio Processing Flow**
```
User Input (Slider) 
    ↓
React Native UI (VolumeBooster.tsx)
    ↓
TypeScript Interface (VolumeBoosterModule.ts)
    ↓
Android Native Module (VolumeBoosterModule.kt)
    ↓
Android LoudnessEnhancer API
    ↓
Audio Output (Boosted Sound)
```

### **🔄 Background Processing Flow** ⭐ **NEW**
```
Background Mode Toggle
    ↓
VolumeBoosterService (Foreground Service)
    ↓
Persistent Notification Display
    ↓
Continuous Audio Boost (Even When App Closed)
    ↓
Service Status Monitoring (Every 2 seconds)
```

### **🎯 Auto-Volume Processing Flow** ⭐ **NEW**
```
Auto-Volume Toggle ON
    ↓
Backup Current Device Volume
    ↓
Audio Playback Detection
    ↓
Set Device Volume to 100%
    ↓
Audio Playback Ends
    ↓
Restore Original Volume
```

### **Key Components**

#### **React Native Layer**
- **VolumeBooster.tsx**: Main UI component handling user interactions (self-contained with themes)
- **VolumeBoosterModule.ts**: TypeScript interface bridging JS and native code
- **SettingsManager.ts**: Centralized settings management with persistence

#### **Android Native Layer**
- **VolumeBoosterModule.kt**: Core audio processing using LoudnessEnhancer API
- **VolumeBoosterService.kt**: Background foreground service for continuous boost
- **VolumeBoosterPackage.kt**: React Native module registration
- **Audio Session Management**: Handles app-only vs device-wide boost modes

### **Audio Boost Implementation**
- **Formula**: `boostLevel * 25 = gain in millibels`
- **Max Gain**: 50 dB (200% boost)
- **Session Control**: Uses Android AudioSessionId for app-only boost
- **Real-time Processing**: Immediate audio enhancement without delay
- **Background Processing**: Continuous boost via foreground service
- **Independent Controls**: All toggles work independently for flexible configuration

## 📖 Documentation

For detailed technical documentation, integration guide, and API reference, see [doc/VOLUME_BOOSTER_README.md](./doc/VOLUME_BOOSTER_README.md).

## 🔧 Troubleshooting

### Build Issues or Conflicts?

If you're experiencing Android build issues, conflicts, or errors:

**Quick Fix:**
```bash
cd android
clean-build.bat    # Windows
# OR
./clean-build.sh   # macOS/Linux
```

**Documentation:**
- **[QUICK_FIX.md](./QUICK_FIX.md)** - Fast solutions for common build problems
- **[ANDROID_BUILD_CLEAN.md](./doc/ANDROID_BUILD_CLEAN.md)** - Complete guide to `.cxx` files and build artifacts

### Common Issues:

| Issue | Solution |
|-------|----------|
| Build conflicts after git pull | `npm run clean:android:deep` |
| "Execution failed for CMake" | Run deep clean script |
| "Duplicate class" errors | `npm run clean:android:deep` |
| `.cxx` files causing issues | Already ignored in `.gitignore` ✓ |

## ⚠️ Safety Warning

**HIGH BOOST LEVELS CAN CAUSE:**
- Audio distortion and clipping
- Potential speaker damage
- Hearing damage risk
- **Use responsibly and monitor audio quality!**
