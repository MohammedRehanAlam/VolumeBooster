/**
 * VolumeBooster - Main UI Component for Audio Enhancement App
 * 
 * This is the primary React Native component that provides the user interface
 * for the VolumeBooster app. It handles all user interactions, displays real-time
 * audio device information, and manages the boost controls.
 * 
 * Key Features:
 * - Volume control slider (0-100%)
 * - Audio boost slider (0-200%) with color-coded warnings
 * - App-only vs Device-wide boost mode toggle
 * - Gradual vs Discrete boost control toggle
 * - Real-time audio device monitoring and display
 * - Test sound generation for boost verification
 * - Safety warnings for high boost levels
 * 
 * Architecture:
 * This component acts as the bridge between the user interface and the native
 * Android audio processing module. It manages state, handles user interactions,
 * and communicates with the native module through the VolumeBoosterModule interface.
 * 
 * @author VolumeBooster Team
 * @version 1.0.0
 * @since React Native 0.81+
 */

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
} from 'react-native';
import Slider from '@react-native-community/slider';
import { VolumeBoosterModule, VolumeBoosterEmitter, AudioDeviceInfo } from '../modules/VolumeBoosterModule';
import { initializeStorage, SettingsChangeEvent } from '../storage';
import { SettingsManager } from '../storage/SettingsManager';

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
    warningGreen: '#32CD32',
    warningLightGreen: '#49f249',
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
  const [appOnlyBoost, setAppOnlyBoost] = useState(false);
  
  /** Whether boost functionality is enabled or disabled */
  const [boostEnabled, setBoostEnabled] = useState(false);
  
  /** Whether background mode is enabled for continuous boost */
  const [backgroundModeEnabled, setBackgroundModeEnabled] = useState(false);
  
  /** Whether the background service is currently running */
  const [backgroundServiceRunning, setBackgroundServiceRunning] = useState(false);
  
  /** Current audio device information for display */
  const [deviceInfo, setDeviceInfo] = useState<AudioDeviceInfo | null>(null);
  
  /** Whether the native audio module has been initialized */
  const [isInitialized, setIsInitialized] = useState(false);
  
  /** Reference to track device changes and prevent unnecessary updates */
  const deviceInfoRef = useRef<AudioDeviceInfo | null>(null);

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
      case 'appOnlyBoost':
        setAppOnlyBoost(event.newValue);
        break;
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
      console.log('[VolumeBooster] Initializing app with new storage system...');
      
      // Initialize storage system
      await initializeStorage();
      
      // Get settings manager instance
      const settingsManagerInstance = SettingsManager.getInstance();
      
      // Get saved settings from centralized storage
      const savedSettings = settingsManagerInstance.getAllSettings();
      console.log('[VolumeBooster] Loaded settings from centralized storage:', savedSettings);
      
      // Apply loaded settings to component state
      setVolume(savedSettings.volume);
      setBoost(savedSettings.boost);
      setGradualBoost(savedSettings.gradualBoost);
      setAppOnlyBoost(savedSettings.appOnlyBoost);
      setBoostEnabled(savedSettings.boostEnabled);
      
      // Add settings change listener
      settingsManagerInstance.addChangeListener(handleSettingsChange);
      
      // Initialize audio system
      if (Platform.OS === 'android') {
        console.log('[VolumeBooster] Initializing Android audio system...');
        await VolumeBoosterModule.initializeAudio();
        setIsInitialized(true);
        
        // Apply saved settings to native module
        console.log('[VolumeBooster] Applying settings to native module...');
        await VolumeBoosterModule.setVolume(savedSettings.volume);
        await VolumeBoosterModule.setAppOnlyBoost(savedSettings.appOnlyBoost);
        
        // Only apply boost if it was enabled
        if (savedSettings.boostEnabled) {
          console.log('[VolumeBooster] Applying saved boost level:', savedSettings.boost);
          await VolumeBoosterModule.setBoost(savedSettings.boost);
        } else {
          console.log('[VolumeBooster] Boost was disabled, not applying boost level');
        }
        
        // Start monitoring services
        VolumeBoosterModule.startDeviceMonitoring();
        VolumeBoosterModule.startVolumeMonitoring();
        
        // Check background service status
        try {
          const isBackgroundEnabled = await VolumeBoosterModule.isBackgroundModeEnabled();
          const isServiceRunning = await VolumeBoosterModule.isBackgroundServiceRunning();
          setBackgroundModeEnabled(isBackgroundEnabled);
          setBackgroundServiceRunning(isServiceRunning);
          
          console.log('[VolumeBooster] Background service status:', {
            enabled: isBackgroundEnabled,
            running: isServiceRunning
          });
        } catch (error) {
          console.warn('[VolumeBooster] Failed to check background service status:', error);
        }
        
        // Get initial device info
        const device = await VolumeBoosterModule.getAudioDeviceInfo();
        if (device) {
          setDeviceInfo(device);
          deviceInfoRef.current = device;
        }
        
        console.log('[VolumeBooster] App initialization completed successfully');
      }
    } catch (error) {
      console.error('[VolumeBooster] Failed to initialize app:', error);
      Alert.alert('Error', 'Failed to initialize app');
    }
  }, [handleSettingsChange]);

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
        setVolume(newVolume);
      }
    );

    return () => {
      deviceSubscription.remove();
      volumeSubscription.remove();
      const settingsManagerInstance = SettingsManager.getInstance();
      settingsManagerInstance.removeChangeListener(handleSettingsChange);
      VolumeBoosterModule.stopDeviceMonitoring();
      VolumeBoosterModule.stopVolumeMonitoring();
    };
  }, [initializeApp, handleSettingsChange]);

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
    
    // Only apply boost if boost functionality is enabled
    if (boostEnabled && isInitialized && Platform.OS === 'android') {
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
        if (value) {
          // Enable boost - apply current boost level
          console.log('[VolumeBooster] Enabling boost with level:', boost);
          await VolumeBoosterModule.setBoost(boost);
        } else {
          // Disable boost - set boost to 0
          console.log('[VolumeBooster] Disabling boost');
          await VolumeBoosterModule.setBoost(0);
        }
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
  const handleAppOnlyBoostToggle = async (value: boolean) => {
    console.log('[VolumeBooster] App-only boost toggle changed to:', value);
    setAppOnlyBoost(value);
    
    if (isInitialized && Platform.OS === 'android') {
      try {
        await VolumeBoosterModule.setAppOnlyBoost(value);
        // Reapply current boost with new mode (only if boost is enabled)
        if (boostEnabled) {
          console.log('[VolumeBooster] Reapplying boost with new mode:', boost);
          await VolumeBoosterModule.setBoost(boost);
        }
      } catch (error) {
        console.error('[VolumeBooster] Failed to set app-only boost mode:', error);
        Alert.alert('Error', 'Failed to change boost mode');
      }
    }
    
    // Save setting using centralized storage
    console.log('[VolumeBooster] Saving app-only boost setting to centralized storage...');
    const settingsManagerInstance = SettingsManager.getInstance();
    await settingsManagerInstance.setSetting('appOnlyBoost', value);
  };

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
  const handleTestSound = async () => {
    if (isInitialized && Platform.OS === 'android') {
      try {
        await VolumeBoosterModule.playTestSound();
      } catch (error) {
        console.error('Failed to play test sound:', error);
        Alert.alert('Error', 'Failed to play test sound');
      }
    }
  };

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
  // UTILITY FUNCTIONS - UI Helpers and Information Display
  // ============================================================================
  
  /**
   * Shows app information dialog with storage status
   * 
   * Displays a modal dialog with app version, platform information,
   * session ID, current settings, and storage status.
   */
  const showAppInfo = async () => {
    try {
      const settingsManagerInstance = SettingsManager.getInstance();
      const storageStatus = await settingsManagerInstance.getStorageInfo();
      
      const info = `VolumeBooster v1.0.0\n\n` +
        `Platform: ${Platform.OS}\n` +
        `Session ID: ${Math.random().toString(36).substr(2, 9)}\n\n` +
        `Current Settings:\n` +
        `Volume: ${volume}%\n` +
        `Boost: ${boost}%\n` +
        `Boost Enabled: ${boostEnabled}\n` +
        `Gradual: ${gradualBoost}\n` +
        `App Only: ${appOnlyBoost}\n\n` +
        `Storage Status:\n` +
        `Initialized: ${storageStatus?.isInitialized || false}\n` +
        `Storage Keys: ${storageStatus?.storageInfo?.count || 0}\n\n` +
        `Warning: Excessive boost may distort audio or harm speakers.`;
      
      Alert.alert('App Info', info);
    } catch (error) {
      console.error('[VolumeBooster] Failed to get storage info:', error);
      
      const basicInfo = `VolumeBooster v1.0.0\n\n` +
        `Platform: ${Platform.OS}\n` +
        `Session ID: ${Math.random().toString(36).substr(2, 9)}\n\n` +
        `Current Settings:\n` +
        `Volume: ${volume}%\n` +
        `Boost: ${boost}%\n` +
        `Boost Enabled: ${boostEnabled}\n` +
        `Gradual: ${gradualBoost}\n` +
        `App Only: ${appOnlyBoost}\n\n` +
        `Warning: Excessive boost may distort audio or harm speakers.`;
      
      Alert.alert('App Info', basicInfo);
    }
  };

  /**
   * Clears all saved settings using centralized storage
   * 
   * This function removes all saved settings from storage
   * and resets the app to default values.
   */
  const clearAllSettings = async () => {
    try {
      console.log('[VolumeBooster] Clearing all settings using centralized storage...');
      
      const settingsManagerInstance = SettingsManager.getInstance();
      const success = await settingsManagerInstance.clearSettings();
      
      if (success) {
        // Reset to default values
        setVolume(100);
        setBoost(0);
        setGradualBoost(false);
        setAppOnlyBoost(false);
        setBoostEnabled(false);
        
        Alert.alert('Settings Cleared', 'All settings have been reset to defaults');
      } else {
        Alert.alert('Error', 'Failed to clear settings');
      }
    } catch (error) {
      console.error('[VolumeBooster] Failed to clear settings:', error);
      Alert.alert('Error', 'Failed to clear settings');
    }
  };

  /**
   * Formats audio device information for display
   * 
   * Converts the AudioDeviceInfo object into a formatted string for display
   * in the UI. Includes device name, type, ID, channels, encodings, and sample rates.
   * 
   * @param device AudioDeviceInfo object from native module
   * @returns Formatted string with device information
   */
  const formatDeviceInfo = (device: AudioDeviceInfo) => {
    const sampleRates = device.sampleRates || '';
    return `Device Name:\t\t\t\t${device.name}\n` +
      `Device Type:\t\t\t\t${device.type} (${device.typeId})\n` +
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
      <View style={[styles.loadingContainer, { backgroundColor: theme.background }]}>
        <Text style={[styles.loadingText, { color: theme.text }]}>Initializing Audio System...</Text>
      </View>
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
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      {/* App Header with Title and Info Button */}
      <View style={[styles.header, { borderBottomColor: theme.border }]}>
        <Text style={[styles.title, { color: theme.text }]}>Volume Booster</Text>
        <Text style={[styles.infoIcon, { color: theme.primary }]} onPress={showAppInfo}>ⓘ</Text>
      </View>

      {/* Scrollable Content Area */}
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {/* Device Info */}
        <View style={styles.deviceInfoContainer}>
          <Text style={[styles.deviceInfoText, { color: theme.textMuted }]}>
            {deviceInfo ? formatDeviceInfo(deviceInfo) : 'No Active Output Device Detected'}
          </Text>
        </View>

        {/* Volume Controls */}
        <View style={styles.controlSection}>
          <View style={styles.controlHeader}>
            <Text style={[styles.controlLabel, { color: theme.text }]}>Volume:</Text>
            <Text style={[styles.controlValue, { color: theme.textSecondary }]}>{volume}%</Text>
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
                disabled={!boostEnabled}
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
              ⚠️ WARNING: Very high boost may cause audio distortion or speaker damage!
            </Text>
          )}
          {boostEnabled && boost > 100 && boost <= 150 && (
            <Text style={[styles.warningText, { color: theme.warningOrange }]}>
              ⚡ High boost level - monitor audio quality
            </Text>
          )}
          {boostEnabled && boost > 50 && boost <= 100 && (
            <Text style={[styles.warningText, { color: theme.warningGreen }]}>
              🔥 Moderate boost active - audio enhanced
            </Text>
          )}
          {!boostEnabled ? (
            <Text style={[styles.warningText, { color: theme.textMuted }]}>
              💤 Boost functionality is disabled - enable to activate audio enhancement
            </Text>
          ) : (
            boost <= 50 && (
              <Text style={[styles.warningText, { color: theme.warningLightGreen }]}>
                🚀 Boost is enabled - monitor audio quality and use responsibly
              </Text>
            )
          )}
        </View>

        {/* App-Only Boost Toggle */}
        <View style={styles.controlSection}>
          <View style={styles.controlHeader}>
            <Text style={[styles.controlLabel, { color: theme.text }]}>Boost Mode:</Text>
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
                disabled={!boostEnabled}
              />
            </View>
          </View>
          <Text style={[styles.modeDescription, { color: theme.textMuted }]}>
            {appOnlyBoost 
              ? 'Boost applies only to this app\'s audio (notifications, sounds, etc.)' 
              : 'Boost applies to all device audio (music, videos, games, etc.)'
            }
          </Text>
        </View>

        {/* Background Mode Toggle */}
        <View style={styles.controlSection}>
          <View style={styles.controlHeader}>
            <Text style={[styles.controlLabel, { color: theme.text }]}>Background Mode:</Text>
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
                disabled={!boostEnabled}
              />
            </View>
          </View>
          <Text style={[styles.modeDescription, { color: theme.textMuted }]}>
            {backgroundModeEnabled 
              ? 'Audio boost continues working even when the app is closed. A notification will show the current boost level.' 
              : 'Audio boost only works when the app is active.'
            }
          </Text>
          {backgroundModeEnabled && (
            <Text style={[styles.statusText, { color: backgroundServiceRunning ? theme.warningGreen : theme.warningOrange }]}>
              Service Status: {backgroundServiceRunning ? 'Running' : 'Not Running'}
            </Text>
          )}
        </View>

        {/* Test Sound Button */}
        <View style={styles.controlSection}>
          <TouchableOpacity
            style={[styles.testButton, { backgroundColor: theme.primary }]}
            onPress={handleTestSound}
            activeOpacity={0.8}
          >
            <Text style={[styles.testButtonText, { color: theme.background }]}>
              🔊 Play Test Sound
            </Text>
          </TouchableOpacity>
          <Text style={[styles.testDescription, { color: theme.textMuted }]}>
            Play a 440Hz tone to test the boost functionality. 
            {appOnlyBoost ? ' This sound will be boosted if app-only mode is enabled.' : ' This sound will be boosted along with all device audio.'}
          </Text>
        </View>

        {/* Reset Section - Always visible */}
        <View style={styles.controlSection}>
          <Text style={[styles.controlLabel, { color: theme.text }]}>Reset:</Text>
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
        </View>
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
  },
  loadingText: {
    fontSize: 18,
    textAlign: 'center',
    fontFamily: 'monospace',
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
    paddingHorizontal: 24,
  },
  deviceInfoContainer: {
    marginVertical: 24,
    paddingHorizontal: 14,
  },
  deviceInfoText: {
    fontSize: 16,
    fontFamily: 'monospace',
    lineHeight: 24,
  },
  controlSection: {
    marginBottom: 42,
  },
  controlHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
    paddingHorizontal: 14,
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
    paddingHorizontal: 14,
    lineHeight: 20,
  },
  testButton: {
    marginHorizontal: 14,
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
    paddingHorizontal: 14,
    lineHeight: 20,
  },
  testDescription: {
    fontSize: 14,
    fontFamily: 'monospace',
    marginTop: 12,
    paddingHorizontal: 14,
    lineHeight: 20,
  },
  warningText: {
    fontSize: 14,
    fontFamily: 'monospace',
    marginTop: 8,
    paddingHorizontal: 14,
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

