import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Switch,
  Alert,
  Platform,
  TouchableOpacity,
  useColorScheme,
  Animated,
} from 'react-native';
import Slider from '@react-native-community/slider';
import { VolumeBoosterModule, VolumeBoosterEmitter, AudioDeviceInfo } from '../modules/VolumeBoosterModule';
import { initializeStorage, SettingsChangeEvent } from '../storage';
import { SettingsManager } from '../storage/SettingsManager';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

/**
 * Props interface for VolumeBooster component
 * 
 * @interface VolumeBoosterProps
 * Currently no props required - all styling is handled internally
 */
interface VolumeBoosterProps {
  // No props needed - component is self-contained
}

/**
 * Main VolumeBooster React Native Component
 * 
 * This component renders the complete UI for the audio enhancement app,
 * including all controls, monitoring displays, and user interaction handlers.
 * 
 * @param {VolumeBoosterProps} props - Component props (currently unused)
 * @returns {JSX.Element} Complete VolumeBooster UI
 */
const VolumeBooster: React.FC<VolumeBoosterProps> = () => {
  // ============================================================================
  // THEME DETECTION - System Theme Detection
  // ============================================================================

  /** Detect system color scheme (dark/light) */
  const colorScheme = useColorScheme();
  const insets = useSafeAreaInsets();

  // ============================================================================
  // THEME DEFINITIONS - Dark and Light Mode Colors
  // ============================================================================

  /**
   * Theme interface for color definitions
   */
  interface Theme {
    background: string;
    surface: string;
    primary: string;
    secondary: string;
    text: string;
    textSecondary: string;
    textMuted: string;
    border: string;
    sliderTrack: string;
    sliderTrackBackground: string;
    sliderThumb: string;
    switchTrack: string;
    switchThumb: string;
    statusBar: string;
    navigationBar: string;
    warningOrange: string;
    warningGreen: string;
    warningLightGreen: string;
  }

  /**
   * Dark theme color definitions
   */
  const darkTheme: Theme = {
    background: '#000000',
    surface: '#111111',
    primary: '#CCFF00',
    secondary: '#F92672',
    text: '#FFFFFF',
    textSecondary: '#CCCCCC',
    textMuted: '#888888',
    border: '#333333',
    sliderTrack: '#CCFF00',
    sliderTrackBackground: '#999999',
    sliderThumb: '#CCFF00',
    switchTrack: '#666600',
    switchThumb: '#CCFF00',
    statusBar: '#000000',
    navigationBar: '#000000',
    warningOrange: '#FFA500',
    warningGreen: '#25ea25ff',
    warningLightGreen: '#7de37dff',
  };

  /**
   * Light theme color definitions
   */
  const lightTheme: Theme = {
    background: '#FFFFFF',
    surface: '#F5F5F5',
    primary: '#1976D2',
    secondary: '#D32F2F',
    text: '#212121',
    textSecondary: '#424242',
    textMuted: '#757575',
    border: '#E0E0E0',
    sliderTrack: '#1976D2',
    sliderTrackBackground: '#444444',
    sliderThumb: '#1976D2',
    switchTrack: '#BDBDBD',
    switchThumb: '#1976D2',
    statusBar: '#FFFFFF',
    navigationBar: '#FFFFFF',
    warningOrange: '#FFA500',
    warningGreen: '#32CD32',
    warningLightGreen: '#49f249',
  };

  // Use system theme (automatically switches between dark and light)
  const theme = colorScheme === 'dark' ? darkTheme : lightTheme;
  // ============================================================================
  // COMPONENT STATE MANAGEMENT
  // ============================================================================

  /** Current device volume level (0-100%) */
  const [volume, setVolume] = useState(100);

  /** Current audio boost level (0-200%) */
  const [boost, setBoost] = useState(0);

  /** Whether boost uses gradual (1%) or discrete (10%) increments */
  const [gradualBoost, setGradualBoost] = useState(false);

  /** Whether boost applies to app-only or device-wide audio */
  // const [appOnlyBoost, setAppOnlyBoost] = useState(false); // TODO: Commented out for future implementation

  /** Whether boost functionality is enabled or disabled */
  const [boostEnabled, setBoostEnabled] = useState(false);

  /** Whether background mode is enabled for continuous boost */
  const [backgroundModeEnabled, setBackgroundModeEnabled] = useState(false);

  /** Whether the background service is currently running */
  const [backgroundServiceRunning, setBackgroundServiceRunning] = useState(false);

  /** Whether auto-volume mode is enabled (sets device to 100% when app is active) */
  // const [autoVolumeEnabled, setAutoVolumeEnabled] = useState(false); // TODO: Commented out for future implementation

  /** Backup of original device volume before auto-volume was applied */
  // const [originalVolume, setOriginalVolume] = useState<number | null>(null); // TODO: Commented out for future implementation

  /** Flag to track if we're currently in audio playback mode */
  // const [isAudioPlaying, setIsAudioPlaying] = useState(false); // TODO: Commented out for future implementation

  /** Current audio device information for display */
  const [deviceInfo, setDeviceInfo] = useState<AudioDeviceInfo | null>(null);

  /** Whether the native audio module has been initialized */
  const [isInitialized, setIsInitialized] = useState(false);

  /** Whether device info is expanded or collapsed */
  const [isDeviceInfoExpanded, setIsDeviceInfoExpanded] = useState(false);

  /** Reference to track device changes and prevent unnecessary updates */
  const deviceInfoRef = useRef<AudioDeviceInfo | null>(null);

  // ============================================================================
  // LOADING SCREEN ANIMATIONS
  // ============================================================================

  /** Animated values for loading screen effects */
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const progressAnim = useRef(new Animated.Value(0)).current;
  const dotAnim1 = useRef(new Animated.Value(0.3)).current;
  const dotAnim2 = useRef(new Animated.Value(0.3)).current;
  const dotAnim3 = useRef(new Animated.Value(0.3)).current;

  /** Loading stage text */
  const [loadingStage, setLoadingStage] = useState('Starting App...');

  /** Progress tracking for real initialization */
  const [initializationProgress, setInitializationProgress] = useState(0);

  // ============================================================================
  // STORAGE SYSTEM INTEGRATION - New Centralized Storage
  // ============================================================================

  /**
   * Settings change listener for automatic UI updates
   */
  const handleSettingsChange = useCallback((event: SettingsChangeEvent) => {
    console.log(`[VolumeBooster] Settings changed: ${event.key} from ${event.oldValue} to ${event.newValue}`);

    // Update UI state when settings change externally
    switch (event.key) {
      case 'volume':
        setVolume(event.newValue);
        break;
      case 'boostEnabled':
        setBoostEnabled(event.newValue);
        break;
      case 'boost':
        setBoost(event.newValue);
        break;
      case 'gradualBoost':
        setGradualBoost(event.newValue);
        break;
      // case 'appOnlyBoost': // TODO: Commented out for future implementation
      //   setAppOnlyBoost(event.newValue);
      //   break;
      // case 'autoVolumeEnabled': // TODO: Commented out for future implementation
      //   setAutoVolumeEnabled(event.newValue);
      //   break;
    }
  }, []);

  // ============================================================================
  // APP INITIALIZATION - Settings Loading and Audio Setup
  // ============================================================================

  /**
   * Initializes the app using the new centralized storage system
   * 
   * This function:
   * 1. Initializes the storage system
   * 2. Loads saved settings from the centralized storage
   * 3. Applies loaded settings to component state
   * 4. Initializes the native audio system
   * 5. Applies saved settings to the native module
   * 6. Starts monitoring services
   * 7. Sets up settings change listener
   * 
   * Only runs on Android platform as iOS support is not implemented.
   */
  const initializeApp = useCallback(async () => {
    try {
      console.log('[VolumeBooster] Fast initialization starting...');

      // Step 1: Initialize storage and get settings (20%)
      setLoadingStage('Loading Settings...');
      setInitializationProgress(20);
      await initializeStorage();
      const settingsManagerInstance = SettingsManager.getInstance();
      const savedSettings = settingsManagerInstance.getAllSettings();

      // Step 2: Apply settings to UI state (40%)
      setLoadingStage('Applying Settings...');
      setInitializationProgress(40);
      setBoost(savedSettings.boost);
      setGradualBoost(savedSettings.gradualBoost);
      // setAppOnlyBoost(savedSettings.appOnlyBoost); // TODO: Commented out for future implementation
      setBoostEnabled(savedSettings.boostEnabled);
      // setAutoVolumeEnabled(savedSettings.autoVolumeEnabled || false); // TODO: Commented out for future implementation
      settingsManagerInstance.addChangeListener(handleSettingsChange);

      if (Platform.OS === 'android') {
        // Step 3: Initialize audio system (60%)
        setLoadingStage('Initializing Audio...');
        setInitializationProgress(60);
        await VolumeBoosterModule.initializeAudio();

        // Step 4: Parallel operations (80%)
        setLoadingStage('Configuring Audio...');
        setInitializationProgress(80);

        // Run these operations in parallel for speed
        const [currentDeviceVolume, audioDeviceInfo] = await Promise.all([
          VolumeBoosterModule.getVolume(),
          VolumeBoosterModule.getAudioDeviceInfo().catch(() => null)
        ]);

        // Handle volume and device info
        // if (savedSettings.autoVolumeEnabled) { // TODO: Commented out for future implementation
        //   setOriginalVolume(currentDeviceVolume);
        //   setVolume(currentDeviceVolume);
        // } else {
        setVolume(currentDeviceVolume);
        // }

        if (audioDeviceInfo) {
          setDeviceInfo(audioDeviceInfo);
          deviceInfoRef.current = audioDeviceInfo;
        }

        // Step 5: Apply audio settings (90%)
        setLoadingStage('Finalizing...');
        setInitializationProgress(90);

        // Apply settings in parallel
        await Promise.all([
          VolumeBoosterModule.setBoostEnabled(savedSettings.boostEnabled),
          // VolumeBoosterModule.setAppOnlyBoost(savedSettings.appOnlyBoost), // TODO: Commented out for future implementation
          savedSettings.boostEnabled ? VolumeBoosterModule.setBoost(savedSettings.boost) : Promise.resolve()
        ]);

        // Step 6: Start services and check background status (95%)
        setLoadingStage('Starting Services...');
        setInitializationProgress(95);

        // Start monitoring (non-blocking)
        VolumeBoosterModule.startDeviceMonitoring();
        VolumeBoosterModule.startVolumeMonitoring();

        // Check background status in parallel
        Promise.all([
          VolumeBoosterModule.isBackgroundModeEnabled().catch(() => false),
          VolumeBoosterModule.isBackgroundServiceRunning().catch(() => false)
        ]).then(([isBackgroundEnabled, isServiceRunning]) => {
          setBackgroundModeEnabled(isBackgroundEnabled);
          setBackgroundServiceRunning(isServiceRunning);
        });

        // Step 7: Complete (100%)
        setLoadingStage('Ready!');
        setInitializationProgress(100);

        // Quick completion - no delay needed
        setTimeout(() => {
          setIsInitialized(true);
          console.log('[VolumeBooster] Fast initialization completed!');
        }, 200); // Reduced from 500ms to 200ms
      }
    } catch (error) {
      console.error('[VolumeBooster] Failed to initialize app:', error);
      setLoadingStage('Initialization Failed');
      Alert.alert('Error', 'Failed to initialize app');
    }
  }, [handleSettingsChange]);

  /**
   * Updates the original volume backup when user manually changes volume
   * 
   * This ensures the backup always reflects the user's preferred volume level
   * when auto-volume is enabled. Does not update during audio playback.
   */
  // TODO: Commented out for future implementation
  // const updateOriginalVolumeBackup = useCallback((newVolume: number) => {
  //   if (autoVolumeEnabled && newVolume !== 100 && !isAudioPlaying) {
  //     console.log('[VolumeBooster] Updating original volume backup from', originalVolume, 'to', newVolume);
  //     setOriginalVolume(newVolume);
  //   } else if (isAudioPlaying) {
  //     console.log('[VolumeBooster] Skipping backup update during audio playback');
  //   }
  // }, [autoVolumeEnabled, isAudioPlaying, originalVolume]);

  // ============================================================================
  // COMPONENT LIFECYCLE - Initialization and Event Listeners
  // ============================================================================

  /**
   * Main useEffect hook for component initialization
   * 
   * This effect runs once when the component mounts and sets up:
   * 1. Load saved settings from storage
   * 2. Audio system initialization
   * 3. Event listeners for device changes
   * 4. Event listeners for volume changes
   * 5. Cleanup functions for when component unmounts
   * 
   * The effect returns a cleanup function that removes all listeners
   * and stops monitoring when the component is unmounted.
   */
  useEffect(() => {
    initializeApp();

    const deviceSubscription = VolumeBoosterEmitter.addListener(
      'audioDeviceChanged',
      (device: AudioDeviceInfo | null) => {
        if (device === null) {
          setDeviceInfo(null);
          deviceInfoRef.current = null;
        } else if (device.id !== deviceInfoRef.current?.id) {
          setDeviceInfo(device);
          deviceInfoRef.current = device;
        }
      }
    );

    const volumeSubscription = VolumeBoosterEmitter.addListener(
      'volumeChanged',
      (newVolume: number) => {
        console.log('[VolumeBooster] Volume changed to:', newVolume);
        setVolume(newVolume);

        // Update original volume backup if auto-volume is enabled and volume is not 100%
        // updateOriginalVolumeBackup(newVolume); // TODO: Commented out for future implementation

        // Save the new volume to storage
        const settingsManagerInstance = SettingsManager.getInstance();
        settingsManagerInstance.setSetting('volume', newVolume);
      }
    );

    return () => {
      deviceSubscription.remove();
      volumeSubscription.remove();
      const settingsManagerInstance = SettingsManager.getInstance();
      settingsManagerInstance.removeChangeListener(handleSettingsChange);
      VolumeBoosterModule.stopDeviceMonitoring();
      VolumeBoosterModule.stopVolumeMonitoring();

      // Restore original volume if auto-volume was enabled and volume was changed
      // TODO: Commented out for future implementation
      // if (autoVolumeEnabled && originalVolume !== null && Platform.OS === 'android') {
      //   console.log('[VolumeBooster] App closing - checking if volume needs restoration');
      //   VolumeBoosterModule.getVolume().then(currentVolume => {
      //     if (currentVolume === 100) {
      //       console.log('[VolumeBooster] Restoring original volume:', originalVolume);
      //       VolumeBoosterModule.setVolume(originalVolume).catch(error => {
      //         console.error('[VolumeBooster] Failed to restore volume on app close:', error);
      //       });
      //     }
      //   }).catch(error => {
      //     console.error('[VolumeBooster] Failed to check volume on app close:', error);
      //   });
      // }
    };
  }, [initializeApp, handleSettingsChange]); // TODO: Removed auto-volume dependencies for future implementation

  // ============================================================================
  // AUTO-VOLUME HANDLERS - TODO: Commented out for future implementation
  // ============================================================================

  /**
   * Handles auto-volume toggle changes
   * 
   * When enabled: backs up current volume for audio-aware volume management
   * When disabled: restores original volume if it was changed
   */
  // const handleAutoVolumeToggle = async (enabled: boolean) => {
  //   if (!isInitialized || Platform.OS !== 'android') {
  //     Alert.alert('Error', 'Audio system not initialized');
  //     return;
  //   }

  //   try {
  //     console.log('[VolumeBooster] Setting auto-volume to:', enabled);
  //     
  //     if (enabled) {
  //       // Enable auto-volume: backup current volume (don't change yet)
  //       const currentVolume = await VolumeBoosterModule.getVolume();
  //       setOriginalVolume(currentVolume);
  //       
  //       console.log('[VolumeBooster] Auto-volume enabled - original volume backed up:', currentVolume, '%');
  //       console.log('[VolumeBooster] Volume will be set to 100% only when app plays audio');
  //     } else {
  //       // Disable auto-volume: restore original volume if it was changed
  //       if (originalVolume !== null) {
  //         const currentVolume = await VolumeBoosterModule.getVolume();
  //         if (currentVolume === 100) {
  //           // Only restore if volume is currently at 100% (was changed by auto-volume)
  //           console.log('[VolumeBooster] Restoring original volume:', originalVolume);
  //           await VolumeBoosterModule.setVolume(originalVolume);
  //           setVolume(originalVolume);
  //         }
  //         setOriginalVolume(null);
  //         
  //         console.log('[VolumeBooster] Auto-volume disabled - volume restored if needed');
  //       }
  //     }
  //     
  //     setAutoVolumeEnabled(enabled);
  //     
  //     // Save setting using centralized storage
  //     const settingsManagerInstance = SettingsManager.getInstance();
  //     await settingsManagerInstance.setSetting('autoVolumeEnabled', enabled);
  //     
  //   } catch (error) {
  //     console.error('[VolumeBooster] Failed to toggle auto-volume:', error);
  //     Alert.alert('Error', 'Failed to toggle auto-volume');
  //   }
  // };

  /**
   * Sets volume to 100% when app starts playing audio
   * 
   * This function is called when the app begins audio playback
   * It only changes volume if auto-volume is enabled
   */
  // TODO: Commented out for future implementation
  // const handleAudioPlaybackStart = async () => {
  //   if (!autoVolumeEnabled || !isInitialized || Platform.OS !== 'android') {
  //     return;
  //   }

  //   try {
  //     console.log('[VolumeBooster] Audio playback started - setting volume to 100%');
  //     setIsAudioPlaying(true); // Set flag to prevent backup updates
  //     await VolumeBoosterModule.setVolume(100);
  //     setVolume(100);
  //   } catch (error) {
  //     console.error('[VolumeBooster] Failed to set volume for audio playback:', error);
  //   }
  // };

  /**
   * Restores original volume when app finishes playing audio
   * 
   * This function is called when the app stops audio playback
   * It restores the original volume if auto-volume is enabled
   */
  // TODO: Commented out for future implementation
  // const handleAudioPlaybackEnd = async () => {
  //   if (!autoVolumeEnabled || !isInitialized || Platform.OS !== 'android' || originalVolume === null) {
  //     return;
  //   }

  //   try {
  //     console.log('[VolumeBooster] Audio playback ended - restoring original volume:', originalVolume, '%');
  //     await VolumeBoosterModule.setVolume(originalVolume);
  //     setVolume(originalVolume);
  //     
  //     // Small delay to ensure volume restoration completes before allowing backup updates
  //     setTimeout(() => {
  //       setIsAudioPlaying(false); // Clear flag to allow backup updates again
  //     }, 100);
  //   } catch (error) {
  //     console.error('[VolumeBooster] Failed to restore volume after audio playback:', error);
  //     setIsAudioPlaying(false); // Clear flag even on error
  //   }
  // };

  /**
   * Formats volume for display with one decimal place
   * 
   * @param volume Volume value to format
   * @returns Formatted volume string with one decimal place
   */
  const formatVolumeDisplay = (volumeValue: number): string => {
    return volumeValue.toFixed(0);
  };

  // ============================================================================
  // USER INTERACTION HANDLERS
  // ============================================================================

  /**
   * Handles volume slider changes using centralized storage
   * 
   * Updates the device volume level and communicates the change to the native module.
   * The volume is set as a percentage (0-100) and converted to Android volume steps
   * in the native module. Also saves the setting to centralized storage.
   * 
   * @param value Volume percentage (0-100)
   */
  const handleVolumeChange = async (value: number) => {
    console.log('[VolumeBooster] Volume changed to:', value);
    setVolume(value);

    if (isInitialized && Platform.OS === 'android') {
      try {
        await VolumeBoosterModule.setVolume(value);
      } catch (error) {
        console.error('[VolumeBooster] Failed to set volume:', error);
      }
    }

    // Update original volume backup if auto-volume is enabled and volume is not 100%
    // updateOriginalVolumeBackup(value); // TODO: Commented out for future implementation

    // Save setting using centralized storage
    console.log('[VolumeBooster] Saving volume setting to centralized storage...');
    const settingsManagerInstance = SettingsManager.getInstance();
    await settingsManagerInstance.setSetting('volume', value);
  };

  /**
   * Handles boost slider changes using centralized storage
   * 
   * Processes boost level changes with support for both gradual and discrete modes:
   * - Gradual mode: Uses exact slider value (1% increments)
   * - Discrete mode: Snaps to 10% increments (0, 10, 20, 30, etc.)
   * 
   * The boost level is sent to the native module for real-time audio processing.
   * Boost levels above 100% provide additional gain beyond the original maximum.
   * Only works when boost functionality is enabled. Also saves the setting.
   * 
   * @param value Boost percentage (0-200)
   */
  const handleBoostChange = async (value: number) => {
    // BOOST VALUE PROCESSING:
    // - If gradual mode is ON: use exact value (1% increments)
    // - If gradual mode is OFF: snap to 10% increments (0, 10, 20, 30, etc.)
    const boostValue = gradualBoost ? value : Math.round(value / 10) * 10;
    console.log('[VolumeBooster] Boost changed to:', boostValue);
    setBoost(boostValue);

    // Always apply boost to native module (it will handle enabled/disabled state internally)
    if (isInitialized && Platform.OS === 'android') {
      try {
        await VolumeBoosterModule.setBoost(boostValue);
      } catch (error) {
        console.error('[VolumeBooster] Failed to set boost:', error);
      }
    }

    // Save setting using centralized storage
    console.log('[VolumeBooster] Saving boost setting to centralized storage...');
    const settingsManagerInstance = SettingsManager.getInstance();
    await settingsManagerInstance.setSetting('boost', boostValue);
  };

  /**
   * Handles gradual boost mode toggle using centralized storage
   * 
   * Switches between gradual (1% increments) and discrete (10% increments) boost control.
   * When switching from gradual to discrete mode, the current boost value is snapped
   * to the nearest 10% increment to maintain consistency. Also saves the setting.
   * 
   * @param value true for gradual mode, false for discrete mode
   */
  const handleGradualBoostToggle = async (value: boolean) => {
    console.log('[VolumeBooster] Gradual boost toggle changed to:', value);
    setGradualBoost(value);

    if (!value) {
      // Snap to discrete values when switching off gradual mode
      const discreteValue = Math.round(boost / 10) * 10;
      setBoost(discreteValue);
      handleBoostChange(discreteValue);
    }

    // Save setting using centralized storage
    console.log('[VolumeBooster] Saving gradual boost setting to centralized storage...');
    const settingsManagerInstance = SettingsManager.getInstance();
    await settingsManagerInstance.setSetting('gradualBoost', value);
  };

  /**
   * Handles boost enable/disable toggle using centralized storage
   * 
   * Enables or disables the boost functionality. When disabled, boost slider
   * changes are ignored and no audio enhancement is applied. When enabled,
   * the current boost level is applied to the audio system. Also saves the setting.
   * 
   * @param value true to enable boost functionality, false to disable
   */
  const handleBoostEnabledToggle = async (value: boolean) => {
    console.log('[VolumeBooster] Boost enabled toggle changed to:', value);
    setBoostEnabled(value);

    if (isInitialized && Platform.OS === 'android') {
      try {
        // Set the boost enabled state in the native module
        await VolumeBoosterModule.setBoostEnabled(value);

        // Apply current boost level (or 0 if disabled)
        const boostToApply = value ? boost : 0;
        console.log('[VolumeBooster] Applying boost level:', boostToApply);
        await VolumeBoosterModule.setBoost(boostToApply);
      } catch (error) {
        console.error('[VolumeBooster] Failed to toggle boost functionality:', error);
        Alert.alert('Error', 'Failed to toggle boost functionality');
      }
    }

    // Save setting using centralized storage
    console.log('[VolumeBooster] Saving boost enabled setting to centralized storage...');
    const settingsManagerInstance = SettingsManager.getInstance();
    await settingsManagerInstance.setSetting('boostEnabled', value);
  };

  /**
   * Handles app-only boost mode toggle using centralized storage
   * 
   * Switches between app-only and device-wide boost modes:
   * - App-only mode: Boost only affects audio from this app (notifications, sounds, etc.)
   * - Device-wide mode: Boost affects all device audio (music, videos, games, etc.)
   * 
   * When switching modes, the current boost level is reapplied with the new session
   * configuration to ensure seamless transition. Also saves the setting.
   * 
   * @param value true for app-only boost, false for device-wide boost
   */
  // TODO: Commented out for future implementation
  // const handleAppOnlyBoostToggle = async (value: boolean) => {
  //   console.log('[VolumeBooster] App-only boost toggle changed to:', value);
  //   setAppOnlyBoost(value);
  //   
  //   if (isInitialized && Platform.OS === 'android') {
  //     try {
  //       await VolumeBoosterModule.setAppOnlyBoost(value);
  //       // Reapply current boost with new mode (only if boost is enabled)
  //       if (boostEnabled) {
  //         console.log('[VolumeBooster] Reapplying boost with new mode:', boost);
  //         await VolumeBoosterModule.setBoost(boost);
  //       }
  //     } catch (error) {
  //       console.error('[VolumeBooster] Failed to set app-only boost mode:', error);
  //       Alert.alert('Error', 'Failed to change boost mode');
  //     }
  //   }
  //   
  //   // Save setting using centralized storage
  //   console.log('[VolumeBooster] Saving app-only boost setting to centralized storage...');
  //   const settingsManagerInstance = SettingsManager.getInstance();
  //   await settingsManagerInstance.setSetting('appOnlyBoost', value);
  // };

  /**
   * Handles test sound playback
   * 
   * Plays a 440Hz test tone to verify boost functionality. The test sound
   * uses the app's audio session, making it perfect for testing app-only boost mode.
   * 
   * The test sound helps users verify that:
   * - The boost is working correctly
   * - App-only vs device-wide modes are functioning
   * - Audio quality is acceptable at current boost levels
   */
  // const handleTestSound = async () => {
  //   if (isInitialized && Platform.OS === 'android') {
  //     try {
  //       // Start audio playback - trigger auto-volume if enabled
  //       // await handleAudioPlaybackStart(); // TODO: Commented out for future implementation

  //       // Play the test sound
  //       await VolumeBoosterModule.playTestSound();

  //       // Wait for sound to complete (test sound duration is typically 2-3 seconds)
  //       // setTimeout(async () => { // TODO: Commented out for future implementation
  //       //   await handleAudioPlaybackEnd();
  //       // }, 3000); // 3 second delay to allow test sound to complete

  //     } catch (error) {
  //       console.error('Failed to play test sound:', error);
  //       Alert.alert('Error', 'Failed to play test sound');

  //       // Restore volume if there was an error
  //       // await handleAudioPlaybackEnd(); // TODO: Commented out for future implementation
  //     }
  //   }
  // };

  // ============================================================================
  // BACKGROUND SERVICE CONTROL FUNCTIONS
  // ============================================================================

  /**
   * Checks and updates background service status
   * 
   * Periodically checks if the background service is running
   * and updates the UI accordingly.
   */
  const checkBackgroundServiceStatus = useCallback(async () => {
    if (!isInitialized || Platform.OS !== 'android') return;

    try {
      const isServiceRunning = await VolumeBoosterModule.isBackgroundServiceRunning();
      setBackgroundServiceRunning(isServiceRunning);

      if (backgroundModeEnabled && !isServiceRunning) {
        console.warn('[VolumeBooster] Background mode enabled but service not running');
      }
    } catch (error) {
      console.error('[VolumeBooster] Failed to check background service status:', error);
    }
  }, [isInitialized, backgroundModeEnabled]);

  /**
   * Handles background mode toggle
   * 
   * Enables or disables background mode for continuous audio boost.
   * When enabled, starts a foreground service that maintains boost
   * even when the app is closed or backgrounded.
   * 
   * @param enabled true to enable background mode, false to disable
   */
  const handleBackgroundModeToggle = async (enabled: boolean) => {
    if (!isInitialized || Platform.OS !== 'android') {
      Alert.alert('Error', 'Audio system not initialized');
      return;
    }

    try {
      console.log('[VolumeBooster] Setting background mode to:', enabled);

      const result = await VolumeBoosterModule.setBackgroundMode(enabled);
      setBackgroundModeEnabled(result);

      // Check service status after toggling
      const isServiceRunning = await VolumeBoosterModule.isBackgroundServiceRunning();
      setBackgroundServiceRunning(isServiceRunning);

      if (enabled) {
        // Alert.alert(
        //   'Background Mode Enabled',
        //   'Audio boost will continue working even when the app is closed. A notification will show the current boost level.',
        //   [{ text: 'OK' }]
        // );
      } else {
        // Alert.alert(
        //   'Background Mode Disabled',
        //   'Audio boost will only work when the app is active.',
        //   [{ text: 'OK' }]
        // );
      }

      console.log('[VolumeBooster] Background mode toggled successfully:', {
        enabled: result,
        serviceRunning: isServiceRunning
      });
    } catch (error) {
      console.error('[VolumeBooster] Failed to toggle background mode:', error);
      Alert.alert('Error', 'Failed to toggle background mode');
    }
  };

  // ============================================================================
  // BACKGROUND SERVICE STATUS MONITORING
  // ============================================================================

  /**
   * Periodic background service status check
   * 
   * Checks background service status 2 seconds when background mode is enabled
   * to ensure the service is still running and update the UI accordingly.
   */
  useEffect(() => {
    if (!backgroundModeEnabled || !isInitialized) return;

    const timeout = setTimeout(() => {
      checkBackgroundServiceStatus();
    }, 2000); // Check once after 2 seconds

    return () => {
      clearTimeout(timeout);
    };
  }, [backgroundModeEnabled, isInitialized, checkBackgroundServiceStatus]);

  // ============================================================================
  // LOADING SCREEN ANIMATION EFFECTS
  // ============================================================================

  /**
   * Loading screen animations
   * 
   * Creates smooth animations for the loading screen including:
   * - Pulse effect on volume icon
   * - Fade in effect for content
   * - Progress bar animation
   * - Loading dots animation
   */
  useEffect(() => {
    if (!isInitialized && Platform.OS === 'android') {
      // Start fade in animation
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 800,
        useNativeDriver: true,
      }).start();

      // Start pulse animation
      const pulseAnimation = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.1,
            duration: 1000,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 1000,
            useNativeDriver: true,
          }),
        ])
      );
      pulseAnimation.start();

      // Progress bar will be updated by real initialization progress
      // No need for simulated loading - real progress will drive the animation

      // Start loading dots animation
      const dotsAnimation = Animated.loop(
        Animated.sequence([
          Animated.timing(dotAnim1, {
            toValue: 1,
            duration: 600,
            useNativeDriver: true,
          }),
          Animated.timing(dotAnim2, {
            toValue: 1,
            duration: 600,
            useNativeDriver: true,
          }),
          Animated.timing(dotAnim3, {
            toValue: 1,
            duration: 600,
            useNativeDriver: true,
          }),
          Animated.timing(dotAnim1, {
            toValue: 0.3,
            duration: 600,
            useNativeDriver: true,
          }),
          Animated.timing(dotAnim2, {
            toValue: 0.3,
            duration: 600,
            useNativeDriver: true,
          }),
          Animated.timing(dotAnim3, {
            toValue: 0.3,
            duration: 600,
            useNativeDriver: true,
          }),
        ])
      );
      dotsAnimation.start();

      return () => {
        pulseAnimation.stop();
        dotsAnimation.stop();
      };
    }
  }, [isInitialized, fadeAnim, pulseAnim, progressAnim, dotAnim1, dotAnim2, dotAnim3]);

  /**
   * Update progress bar based on real initialization progress
   * 
   * Animates the progress bar to match the actual initialization progress
   */
  useEffect(() => {
    if (!isInitialized && Platform.OS === 'android') {
      // Convert progress percentage (0-100) to animation value (0-1)
      const targetValue = initializationProgress / 100;

      // Use longer duration for the final step to ensure smooth completion
      const duration = initializationProgress === 100 ? 500 : 300;

      Animated.timing(progressAnim, {
        toValue: targetValue,
        duration: duration, // Smooth transition, longer for final step
        useNativeDriver: false,
      }).start();
    }
  }, [initializationProgress, isInitialized, progressAnim]);

  // ============================================================================
  // UTILITY FUNCTIONS - UI Helpers and Information Display
  // ============================================================================

  /**
   * Shows app information dialog with storage status
   * 
   * Displays a modal dialog with app version, platform information,
   * session ID, current settings, and storage status.
   */
  // TODO: Commented out - info button is disabled in header
  // const showAppInfo = async () => {
  //   try {
  //     const settingsManagerInstance = SettingsManager.getInstance();
  //     const storageStatus = await settingsManagerInstance.getStorageInfo();
  //     
  //     const info = `VolumeBooster v(version number)\n\n` +
  //       `Platform: ${Platform.OS}\n` +
  //       `Session ID: ${Math.random().toString(36).substr(2, 9)}\n\n` +
  //       `Current Settings:\n` +
  //       `Volume: ${formatVolumeDisplay(volume)}%\n` +
  //       `Boost: ${boost}%\n` +
  //       `Boost Enabled: ${boostEnabled}\n` +
  //       `Gradual: ${gradualBoost}\n` +
  //       // `App Only: ${appOnlyBoost}\n` + // TODO: Commented out for future implementation
  //       `\n` +
  //       `Storage Status:\n` +
  //       `Initialized: ${storageStatus?.isInitialized || false}\n` +
  //       `Storage Keys: ${storageStatus?.storageInfo?.count || 0}\n\n` +
  //       `Warning: Excessive boost may distort audio or harm speakers.`;
  //     
  //     Alert.alert('App Info', info);
  //   } catch (error) {
  //     console.error('[VolumeBooster] Failed to get storage info:', error);
  //     
  //     const basicInfo = `VolumeBooster v(version number)\n\n` +
  //       `Platform: ${Platform.OS}\n` +
  //       `Session ID: ${Math.random().toString(36).substr(2, 9)}\n\n` +
  //       `Current Settings:\n` +
  //       `Volume: ${formatVolumeDisplay(volume)}%\n` +
  //       `Boost: ${boost}%\n` +
  //       `Boost Enabled: ${boostEnabled}\n` +
  //       `Gradual: ${gradualBoost}\n` +
  //       // `App Only: ${appOnlyBoost}\n` + // TODO: Commented out for future implementation
  //       `\n` +
  //       `Warning: Excessive boost may distort audio or harm speakers.`;
  //     
  //     Alert.alert('App Info', basicInfo);
  //   }
  // };

  /**
   * Clears all saved settings using centralized storage
   * 
   * This function removes all saved settings from storage
   * and resets the app to default values.
   */
  // const clearAllSettings = async () => {
  //   try {
  //     console.log('[VolumeBooster] Clearing all settings using centralized storage...');

  //     const settingsManagerInstance = SettingsManager.getInstance();
  //     const success = await settingsManagerInstance.clearSettings();

  //     if (success) {
  //       // Reset to default values
  //       // setVolume(100);
  //       // Get current device volume to preserve it
  //       const currentDeviceVolume = await VolumeBoosterModule.getVolume();

  //       // Reset to default values but preserve current device volume
  //       setVolume(currentDeviceVolume); // Keep current device volume
  //       setBoost(0);
  //       setGradualBoost(false);
  //       // setAppOnlyBoost(false); // TODO: Commented out for future implementation
  //       setBoostEnabled(false);
  //       // setAutoVolumeEnabled(false); // TODO: Commented out for future implementation

  //       // Clear auto-volume backup since it's disabled
  //       // setOriginalVolume(null); // TODO: Commented out for future implementation

  //       console.log('[VolumeBooster] Settings reset - volume preserved at:', currentDeviceVolume, '%');
  //       Alert.alert('Settings Cleared', 'All settings have been reset to defaults. Device volume preserved.');
  //     } else {
  //       Alert.alert('Error', 'Failed to clear settings');
  //     }
  //   } catch (error) {
  //     console.error('[VolumeBooster] Failed to clear settings:', error);
  //     Alert.alert('Error', 'Failed to clear settings');
  //   }
  // };

  // TODO: Commented out - replaced with collapsible device info display
  // const formatDeviceInfo = (device: AudioDeviceInfo) => {
  //   const sampleRates = device.sampleRates || '';
  //   return `Device Name:\t\t\t\t${device.name}\n` +
  //     `Device Type:\t\t\t\t${device.type} (${device.typeId})\n` +
  //     `Device ID:\t\t\t\t\t\t${device.id}\n\n` +
  //     `Channels:\t\t\t\t\t\t\t\t${device.channels || 'N/A'}\n` +
  //     `Encodings:\t\t\t\t\t\t${device.encodings || 'N/A'}\n\n` +
  //     `Sample Rates: ${sampleRates ? '\n' + sampleRates + 'Hz' : '\tN/A'}`;
  // };

  /**
   * Formats detailed device information for expanded view
   * 
   * @param device AudioDeviceInfo object from native module
   * @returns Formatted string with detailed device information
   */
  const formatDetailedDeviceInfo = (device: AudioDeviceInfo) => {
    const sampleRates = device.sampleRates || '';
    return `Device Type:\t\t\t\t${device.type} (${device.typeId})\n` +
      `Device ID:\t\t\t\t\t\t${device.id}\n\n` +
      `Channels:\t\t\t\t\t\t\t\t${device.channels || 'N/A'}\n` +
      `Encodings:\t\t\t\t\t\t${device.encodings || 'N/A'}\n\n` +
      `Sample Rates: ${sampleRates ? '\n' + sampleRates + 'Hz' : '\tN/A'}`;
  };

  // ============================================================================
  // RENDER LOGIC - Component UI Rendering
  // ============================================================================

  /**
   * Loading screen displayed while audio system initializes
   * 
   * Shows a loading message while the native audio module is being initialized.
   * This prevents users from interacting with controls before the system is ready.
   */
  if (!isInitialized && Platform.OS === 'android') {
    return (
      <Animated.View style={[
        styles.loadingContainer,
        {
          backgroundColor: theme.background,
          opacity: fadeAnim,
          paddingTop: insets.top,
          paddingBottom: insets.bottom
        }
      ]}>
        {/* Loading Animation Container */}
        <View style={styles.loadingAnimationContainer}>
          {/* Animated Volume Icon */}
          <Animated.View style={[
            styles.volumeIconContainer,
            {
              borderColor: theme.primary,
              transform: [{ scale: pulseAnim }]
            }
          ]}>
            <Text style={[styles.volumeIcon, { color: theme.primary }]}>🔊</Text>
          </Animated.View>

          {/* Loading Dots Animation */}
          <View style={styles.loadingDotsContainer}>
            <Animated.View style={[styles.loadingDot, { backgroundColor: theme.primary, opacity: dotAnim1 }]} />
            <Animated.View style={[styles.loadingDot, { backgroundColor: theme.primary, opacity: dotAnim2 }]} />
            <Animated.View style={[styles.loadingDot, { backgroundColor: theme.primary, opacity: dotAnim3 }]} />
          </View>
        </View>

        {/* Loading Text */}
        <Text style={[styles.loadingTitle, { color: theme.text }]}>
          Volume Booster
        </Text>
        <Text style={[styles.loadingSubtitle, { color: theme.textMuted }]}>
          {loadingStage}
        </Text>

        {/* Progress Bar */}
        <View style={[styles.progressBarContainer, { backgroundColor: theme.border }]}>
          <Animated.View style={[
            styles.progressBar,
            {
              backgroundColor: theme.primary,
              width: progressAnim.interpolate({
                inputRange: [0, 1],
                outputRange: ['0%', '100%'],
              })
            }
          ]} />
        </View>

        {/* Loading Tips */}
        <View style={styles.loadingTipsContainer}>
          <Text style={[styles.loadingTip, { color: theme.textMuted }]}>
            💡 Tip: Enable Background Mode to keep boost active when app is closed
          </Text>
        </View>
      </Animated.View>
    );
  }

  /**
   * Main component render
   * 
   * Returns the complete UI layout including:
   * - Header with title and info button
   * - Scrollable content area with all controls
   * - Device information display
   * - Volume control slider
   * - Boost control slider with warnings
   * - Mode toggles (gradual/discrete, app-only/device-wide)
   * - Test sound button
   */
  return (
    <View style={[
      styles.container,
      {
        backgroundColor: theme.background,
        paddingTop: insets.top,
        paddingBottom: insets.bottom,
        paddingLeft: insets.left,
        paddingRight: insets.right
      }
    ]}>
      {/* App Header with Title and Info Button */}
      <View style={[styles.header, { borderBottomColor: theme.border }]}>
        <Text style={[styles.title, { color: theme.text }]}>Volume Booster</Text>
        {/* <Text style={[styles.infoIcon, { color: theme.primary }]} onPress={showAppInfo}>ⓘ</Text> */}
      </View>

      {/* Scrollable Content Area */}
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {/* Device Info - Collapsible */}
        <View style={styles.deviceInfoContainer}>
          {/* <Text style={[styles.deviceInfoText, { color: theme.textMuted }]}>
            {deviceInfo ? formatDeviceInfo(deviceInfo) : 'No Active Output Device Detected'}
          </Text> */}
          {deviceInfo ? (
            <View>
              {/* Device Name with Expand/Collapse Button */}
              <View style={styles.deviceInfoHeader}>
                <Text style={[styles.deviceNameText, { color: theme.text }]}>
                  {deviceInfo.name}
                </Text>
                <TouchableOpacity
                  style={styles.expandButton}
                  onPress={() => setIsDeviceInfoExpanded(!isDeviceInfoExpanded)}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.expandButtonText, { color: theme.primary }]}>
                    {isDeviceInfoExpanded ? '▼' : '▶'}
                  </Text>
                </TouchableOpacity>
              </View>

              {/* Detailed Device Information - Collapsible */}
              {isDeviceInfoExpanded && (
                <Text style={[styles.deviceInfoText, { color: theme.textMuted }]}>
                  {formatDetailedDeviceInfo(deviceInfo)}
                </Text>
              )}
            </View>
          ) : (
            <Text style={[styles.deviceInfoText, { color: theme.textMuted }]}>
              No Active Output Device Detected
            </Text>
          )}
        </View>

        {/* Volume Controls */}
        <View style={styles.controlSection}>
          <View style={styles.controlHeader}>
            <Text style={[styles.controlLabel, { color: theme.text }]}>Volume:</Text>
            <Text style={[styles.controlValue, { color: theme.textSecondary }]}>{formatVolumeDisplay(volume)}%</Text>
            <View style={styles.toggleContainer}>
              <Text style={[styles.switchLabel, { color: boostEnabled ? theme.text : theme.textMuted }]}>
                Boost
              </Text>
              <Switch
                style={styles.switch}
                value={boostEnabled}
                onValueChange={handleBoostEnabledToggle}
                trackColor={{ false: theme.border, true: theme.switchTrack }}
                thumbColor={boostEnabled ? theme.switchThumb : theme.textMuted}
              />
            </View>
          </View>

          <Slider
            style={styles.slider}
            minimumValue={0}
            maximumValue={100}
            value={volume}
            onValueChange={handleVolumeChange}
            minimumTrackTintColor={theme.sliderTrack}
            maximumTrackTintColor={theme.sliderTrackBackground}
            step={1}
          />
        </View>

        {/* Boost Controls */}
        <View style={styles.controlSection}>
          <View style={styles.controlHeader}>
            <Text style={[styles.controlLabel, { color: theme.text }]}>Boost:</Text>
            <Text style={[
              styles.controlValue,
              {
                color: boost > 150 ? theme.secondary : // Red for very high boost (>150%)
                  boost > 100 ? theme.warningOrange : // Orange for high boost (100-150%)
                    boost > 50 ? theme.warningGreen : // Green for moderate boost (50-100%)
                      theme.textSecondary // Normal color for low boost (0-50%)
              }
            ]}>
              {boost}%
              {/* SAFETY WARNING INDICATORS */}
              {boost > 150} {/* Very high boost warning */}
              {boost > 100 && boost <= 150} {/* High boost indicator */}
              {boost > 50 && boost <= 100} {/* Moderate boost indicator */}
            </Text>
            <View style={styles.toggleContainer}>
              <Text style={[styles.switchLabel, { color: boostEnabled && gradualBoost ? theme.text : theme.textMuted }]}>
                Gradual
              </Text>
              <Switch
                style={styles.switch}
                value={gradualBoost}
                onValueChange={handleGradualBoostToggle}
                trackColor={{ false: theme.border, true: theme.switchTrack }}
                thumbColor={gradualBoost ? theme.switchThumb : theme.textMuted}
              // disabled={!boostEnabled}
              />
            </View>
          </View>

          <Slider
            style={styles.slider}
            minimumValue={0}
            maximumValue={200} // BOOST SLIDER CONFIGURATION:
            value={boost}      // - Maximum boost level: 200% (can be increased up to 400%)
            onValueChange={handleBoostChange} // - Minimum: 0% (no boost)
            minimumTrackTintColor={theme.sliderTrack} // - Step size: 1% (gradual) or 10% (discrete)
            maximumTrackTintColor={theme.sliderTrackBackground} // - To change max boost: modify maximumValue
            step={gradualBoost ? 1 : 10} // - To change step size: modify step calculation
            disabled={!boostEnabled} // Disable slider when boost is not enabled
          />

          {/* SAFETY WARNINGS FOR HIGH BOOST LEVELS */}
          {boostEnabled && boost > 150 && (
            <Text style={[styles.warningText, { color: theme.secondary }]}>
              ⚠️ WARNING: Very high boost may cause audio distortion or speaker damage
            </Text>
          )}
          {boostEnabled && boost > 100 && boost <= 150 && (
            <Text style={[styles.warningText, { color: theme.warningOrange }]}>
              ⚡ High boost level - monitor audio quality and use with caution
            </Text>
          )}
          {boostEnabled && boost > 50 && boost <= 100 && (
            <Text style={[styles.warningText, { color: theme.warningGreen }]}>
              🔥 Moderate boost level - monitor audio quality and use with caution
            </Text>
          )}
          {!boostEnabled ? (
            <Text style={[styles.warningText, { color: theme.textMuted }]}>
              💤 Boost functionality is disabled - enable to activate audio enhancement
            </Text>
          ) : (
            boost <= 50 && (
              <Text style={[styles.warningText, { color: theme.warningLightGreen }]}>
                🚀 Boost is enabled - monitor audio quality and use with caution
              </Text>
            )
          )}
        </View>

        {/* App-Only Boost Toggle - TODO: Commented out for future implementation */}
        {/* <View style={styles.controlSection}>
          <View style={styles.controlHeader}>
            <Text style={[styles.controlLabel, { color: theme.text }]}>Mode:</Text>
            <View style={styles.toggleContainer}>
              <Text style={[styles.switchLabel, { color: boostEnabled && appOnlyBoost ? theme.text : theme.textMuted }]}>
                {appOnlyBoost ? 'App Only' : 'Device Wide'}
              </Text>
              <Switch
                style={styles.switch}
                value={appOnlyBoost}
                onValueChange={handleAppOnlyBoostToggle}
                trackColor={{ false: theme.border, true: theme.switchTrack }}
                thumbColor={appOnlyBoost ? theme.switchThumb : theme.textMuted}
                // disabled={!boostEnabled}
              />
            </View>
          </View>
          <Text style={[styles.modeDescription, { color: theme.textMuted }]}>
            {appOnlyBoost 
              ? 'Boost applies only to this app\'s audio (notifications, sounds, etc.)' 
              : 'Boost applies to all device audio (music, videos, games, etc.)'
            }
          </Text>
        </View> */}

        {/* Background Mode Toggle */}
        <View style={styles.controlSection}>
          <View style={styles.controlHeader}>
            <Text style={[styles.controlLabel, { color: theme.text }]}>Background:</Text>
            <View style={styles.toggleContainer}>
              <Text style={[styles.switchLabel, { color: backgroundModeEnabled ? theme.text : theme.textMuted }]}>
                {backgroundModeEnabled ? 'Enabled' : 'Disabled'}
              </Text>
              <Switch
                style={styles.switch}
                value={backgroundModeEnabled}
                onValueChange={handleBackgroundModeToggle}
                trackColor={{ false: theme.border, true: theme.switchTrack }}
                thumbColor={backgroundModeEnabled ? theme.switchThumb : theme.textMuted}
              // disabled={!boostEnabled}
              />
            </View>
          </View>
          <Text style={[styles.modeDescription, { color: theme.textMuted }]}>
            {backgroundModeEnabled
              ? 'Audio boost continues working even when the app is closed'
              : 'Audio boost only works when the app is active'
            }
          </Text>
          {backgroundModeEnabled && (
            <Text style={[styles.statusText, { color: backgroundServiceRunning ? theme.warningGreen : theme.warningOrange }]}>
              Service Status: {backgroundServiceRunning ? 'Running' : 'Not Running'}
            </Text>
          )}
        </View>

        {/* Auto-Volume Toggle - TODO: Commented out for future implementation */}
        {/* <View style={styles.controlSection}>
          <View style={styles.controlHeader}>
            <Text style={[styles.controlLabel, { color: theme.text }]}>Auto-Volume:</Text>
            <View style={styles.toggleContainer}>
              <Text style={[styles.switchLabel, { color: autoVolumeEnabled ? theme.text : theme.textMuted }]}>
                {autoVolumeEnabled ? 'Enabled' : 'Disabled'}
              </Text>
              <Switch
                style={styles.switch}
                value={autoVolumeEnabled}
                onValueChange={handleAutoVolumeToggle}
                trackColor={{ false: theme.border, true: theme.switchTrack }}
                thumbColor={autoVolumeEnabled ? theme.switchThumb : theme.textMuted}
              />
            </View>
          </View>
          <Text style={[styles.modeDescription, { color: theme.textMuted }]}>
            {autoVolumeEnabled ? 
              `🔊 Device volume automatically set to 100% only when app plays audio (Original: ${originalVolume ? formatVolumeDisplay(originalVolume) : 'N/A'}%)` : 
              '📱 Uses current device volume level - no automatic changes'
            }
          </Text>
          {autoVolumeEnabled && originalVolume !== null && (
            <Text style={[styles.statusText, { color: theme.warningGreen }]}>
              Original Volume: {formatVolumeDisplay(originalVolume)}% (restored after audio playback ends)
            </Text>
          )}
        </View> */}

        {/* Test Sound Button */}
        {/* <View style={styles.controlSection}> */}
        {/* <TouchableOpacity
            style={[styles.testButton, { backgroundColor: theme.primary }]}
            onPress={handleTestSound}
            activeOpacity={0.8}
          >
            <Text style={[styles.testButtonText, { color: theme.background }]}>
              🔊 Play Test Sound
            </Text>
          </TouchableOpacity> */}
        {/* <Text style={[styles.testDescription, { color: theme.textMuted }]}> */}
        {/* Play a 440Hz tone to test the boost functionality.  */}
        {/* {appOnlyBoost ? ' This sound will be boosted if app-only mode is enabled.' : ' This sound will be boosted along with all device audio.'} TODO: Commented out for future implementation */}
        {/* This sound will be boosted along with all device audio. */}
        {/* </Text> */}
        {/* </View> */}

        {/* Reset Section - Always visible */}
        {/* <View style={styles.controlSection}>
        <View style={styles.controlHeader}>
          <Text style={[styles.controlLabel, { color: theme.text }]}>Reset:</Text>
        </View>
          <TouchableOpacity
            style={[styles.testButton, styles.debugButton, { backgroundColor: theme.secondary }]}
            onPress={clearAllSettings}
            activeOpacity={0.8}
          >
            <Text style={[styles.testButtonText, { color: theme.background }]}>
              🗑️ Reset To Default
            </Text>
          </TouchableOpacity>
          <Text style={[styles.testDescription, { color: theme.textMuted }]}>
            Clear all saved settings and reset to defaults.
          </Text>
        </View> */}
      </ScrollView>
    </View>
  );
};

// ============================================================================
// STYLESHEET - Component Styling Definitions
// ============================================================================

/**
 * StyleSheet for VolumeBooster component
 * 
 * Defines all visual styling for the component including:
 * - Layout containers and positioning
 * - Typography and text styling
 * - Interactive elements (sliders, buttons, switches)
 * - Color-coded boost level indicators
 * - Responsive design considerations
 * 
 * All styles use theme-aware colors for dark/light mode support.
 */
const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  loadingAnimationContainer: {
    alignItems: 'center',
    marginBottom: 40,
  },
  volumeIconContainer: {
    width: 120,
    height: 120,
    borderRadius: 60, // Perfect circle
    borderWidth: 3,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 30,
  },
  volumeIcon: {
    fontSize: 60, // Slightly larger for better visibility
    fontWeight: 'bold',
    textAlign: 'center',
    lineHeight: 70, // Match font size for perfect centering with up and down margin
  },
  loadingDotsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginHorizontal: 4,
    opacity: 0.7,
  },
  loadingTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    fontFamily: 'monospace',
    textAlign: 'center',
    marginBottom: 8,
  },
  loadingSubtitle: {
    fontSize: 16,
    fontFamily: 'monospace',
    textAlign: 'center',
    marginBottom: 30,
    lineHeight: 22,
  },
  progressBarContainer: {
    width: '100%',
    height: 4,
    borderRadius: 2,
    marginBottom: 30,
    overflow: 'hidden',
  },
  progressBar: {
    width: '100%',
    height: '100%',
    borderRadius: 2,
    opacity: 0.8,
  },
  loadingTipsContainer: {
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  loadingTip: {
    fontSize: 14,
    fontFamily: 'monospace',
    textAlign: 'center',
    lineHeight: 20,
    fontStyle: 'italic',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 16,
    borderBottomWidth: 1,
  },
  title: {
    fontSize: 26,
    fontWeight: 'bold',
    fontFamily: 'monospace',
  },
  infoIcon: {
    fontSize: 24,
    fontFamily: 'monospace',
    padding: 4,
  },
  scrollView: {
    flex: 1,
    paddingHorizontal: 24, // Increased from 12 for better spacing
  },
  deviceInfoContainer: {
    marginVertical: 24,
  },
  deviceInfoHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  deviceNameText: {
    fontSize: 18,
    fontFamily: 'monospace',
    fontWeight: 'bold',
    flex: 1,
  },
  expandButton: {
    padding: 8,
    marginLeft: 12,
  },
  expandButtonText: {
    fontSize: 16,
    fontFamily: 'monospace',
    fontWeight: 'bold',
  },
  deviceInfoText: {
    fontSize: 16,
    fontFamily: 'monospace',
    lineHeight: 24,
    marginTop: 8,
  },
  controlSection: {
    marginBottom: 42,
  },
  controlHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
  },
  controlLabel: {
    fontSize: 18,
    fontFamily: 'monospace',
  },
  controlValue: {
    fontSize: 18,
    fontFamily: 'monospace',
    marginLeft: 8,
  },
  toggleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 'auto',
  },
  switch: {
    marginLeft: 8,
  },
  switchLabel: {
    fontSize: 16,
    fontFamily: 'monospace',
  },
  modeDescription: {
    fontSize: 14,
    fontFamily: 'monospace',
    marginTop: 8,
    lineHeight: 20,
  },
  testButton: {
    marginTop: 12, // Added spacing
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  testButtonText: {
    fontSize: 18,
    fontFamily: 'monospace',
    fontWeight: 'bold',
  },
  debugButton: {
    marginTop: 8,
  },
  statusText: {
    fontSize: 14,
    fontFamily: 'monospace',
    marginTop: 8,
    lineHeight: 20,
  },
  testDescription: {
    fontSize: 14,
    fontFamily: 'monospace',
    marginTop: 12,
    lineHeight: 20,
  },
  warningText: {
    fontSize: 14,
    fontFamily: 'monospace',
    marginTop: 8,
    lineHeight: 20,
    fontWeight: 'bold',
  },
  slider: {
    width: '100%',
    height: 40,
  },
});

// ============================================================================
// COMPONENT EXPORT
// ============================================================================

/**
 * Default export of VolumeBooster component
 * 
 * This component is the main UI for the VolumeBooster app and should be
 * imported and used in the main App.tsx file.
 */
export default VolumeBooster;

