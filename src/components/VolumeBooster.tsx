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

import React, { useState, useEffect, useRef } from 'react';
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
  
  /** Current audio device information for display */
  const [deviceInfo, setDeviceInfo] = useState<AudioDeviceInfo | null>(null);
  
  /** Whether the native audio module has been initialized */
  const [isInitialized, setIsInitialized] = useState(false);
  
  /** Reference to track device changes and prevent unnecessary updates */
  const deviceInfoRef = useRef<AudioDeviceInfo | null>(null);

  // ============================================================================
  // COMPONENT LIFECYCLE - Initialization and Event Listeners
  // ============================================================================
  
  /**
   * Main useEffect hook for component initialization
   * 
   * This effect runs once when the component mounts and sets up:
   * 1. Audio system initialization
   * 2. Event listeners for device changes
   * 3. Event listeners for volume changes
   * 4. Cleanup functions for when component unmounts
   * 
   * The effect returns a cleanup function that removes all listeners
   * and stops monitoring when the component is unmounted.
   */
  useEffect(() => {
    initializeAudio();
    
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
      VolumeBoosterModule.stopDeviceMonitoring();
      VolumeBoosterModule.stopVolumeMonitoring();
    };
  }, []);

  // ============================================================================
  // AUDIO SYSTEM INITIALIZATION
  // ============================================================================
  
  /**
   * Initializes the native audio system
   * 
   * This function:
   * 1. Calls the native module to initialize audio processing
   * 2. Starts device monitoring for real-time device detection
   * 3. Starts volume monitoring for real-time volume tracking
   * 4. Gets initial device information for display
   * 5. Handles initialization errors with user-friendly alerts
   * 
   * Only runs on Android platform as iOS support is not implemented.
   */
  const initializeAudio = async () => {
    try {
      if (Platform.OS === 'android') {
        await VolumeBoosterModule.initializeAudio();
        setIsInitialized(true);
        VolumeBoosterModule.startDeviceMonitoring();
        VolumeBoosterModule.startVolumeMonitoring();
        
        // Get initial device info
        const device = await VolumeBoosterModule.getAudioDeviceInfo();
        if (device) {
          setDeviceInfo(device);
          deviceInfoRef.current = device;
        }
      }
    } catch (error) {
      console.error('Failed to initialize audio:', error);
      Alert.alert('Error', 'Failed to initialize audio system');
    }
  };

  // ============================================================================
  // USER INTERACTION HANDLERS
  // ============================================================================
  
  /**
   * Handles volume slider changes
   * 
   * Updates the device volume level and communicates the change to the native module.
   * The volume is set as a percentage (0-100) and converted to Android volume steps
   * in the native module.
   * 
   * @param value Volume percentage (0-100)
   */
  const handleVolumeChange = async (value: number) => {
    setVolume(value);
    if (isInitialized && Platform.OS === 'android') {
      try {
        await VolumeBoosterModule.setVolume(value);
      } catch (error) {
        console.error('Failed to set volume:', error);
      }
    }
  };

  /**
   * Handles boost slider changes
   * 
   * Processes boost level changes with support for both gradual and discrete modes:
   * - Gradual mode: Uses exact slider value (1% increments)
   * - Discrete mode: Snaps to 10% increments (0, 10, 20, 30, etc.)
   * 
   * The boost level is sent to the native module for real-time audio processing.
   * Boost levels above 100% provide additional gain beyond the original maximum.
   * 
   * @param value Boost percentage (0-200)
   */
  const handleBoostChange = async (value: number) => {
    // BOOST VALUE PROCESSING:
    // - If gradual mode is ON: use exact value (1% increments)
    // - If gradual mode is OFF: snap to 10% increments (0, 10, 20, 30, etc.)
    const boostValue = gradualBoost ? value : Math.round(value / 10) * 10;
    setBoost(boostValue);
    
    if (isInitialized && Platform.OS === 'android') {
      try {
        await VolumeBoosterModule.setBoost(boostValue);
      } catch (error) {
        console.error('Failed to set boost:', error);
      }
    }
  };

  /**
   * Handles gradual boost mode toggle
   * 
   * Switches between gradual (1% increments) and discrete (10% increments) boost control.
   * When switching from gradual to discrete mode, the current boost value is snapped
   * to the nearest 10% increment to maintain consistency.
   * 
   * @param value true for gradual mode, false for discrete mode
   */
  const handleGradualBoostToggle = (value: boolean) => {
    setGradualBoost(value);
    if (!value) {
      // Snap to discrete values when switching off gradual mode
      const discreteValue = Math.round(boost / 10) * 10;
      setBoost(discreteValue);
      handleBoostChange(discreteValue);
    }
  };

  /**
   * Handles app-only boost mode toggle
   * 
   * Switches between app-only and device-wide boost modes:
   * - App-only mode: Boost only affects audio from this app (notifications, sounds, etc.)
   * - Device-wide mode: Boost affects all device audio (music, videos, games, etc.)
   * 
   * When switching modes, the current boost level is reapplied with the new session
   * configuration to ensure seamless transition.
   * 
   * @param value true for app-only boost, false for device-wide boost
   */
  const handleAppOnlyBoostToggle = async (value: boolean) => {
    setAppOnlyBoost(value);
    if (isInitialized && Platform.OS === 'android') {
      try {
        await VolumeBoosterModule.setAppOnlyBoost(value);
        // Reapply current boost with new mode
        await VolumeBoosterModule.setBoost(boost);
      } catch (error) {
        console.error('Failed to set app-only boost mode:', error);
        Alert.alert('Error', 'Failed to change boost mode');
      }
    }
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
  // UTILITY FUNCTIONS - UI Helpers and Information Display
  // ============================================================================
  
  /**
   * Shows app information dialog
   * 
   * Displays a modal dialog with app version, platform information,
   * session ID, and safety warnings. This provides users with
   * important information about the app and its capabilities.
   */
  const showAppInfo = () => {
    const info = `VolumeBooster v1.0.0\n\n` +
      `Platform: ${Platform.OS}\n` +
      `Session ID: ${Math.random().toString(36).substr(2, 9)}\n\n` +
      `Warning: Excessive boost may distort audio or harm speakers.`;
    
    Alert.alert('App Info', info);
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
      <View style={[styles.container, { backgroundColor: theme.background }]}>
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
              <Text style={[styles.switchLabel, { color: gradualBoost ? theme.text : theme.textMuted }]}>
                Gradual
              </Text>
              <Switch
                style={styles.switch}
                value={gradualBoost}
                onValueChange={handleGradualBoostToggle}
                trackColor={{ false: theme.border, true: theme.switchTrack }}
                thumbColor={gradualBoost ? theme.switchThumb : theme.textMuted}
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
          />
          
          {/* SAFETY WARNINGS FOR HIGH BOOST LEVELS */}
          {boost > 150 && (
            <Text style={[styles.warningText, { color: theme.secondary }]}>
              ⚠️ WARNING: Very high boost may cause audio distortion or speaker damage!
            </Text>
          )}
          {boost > 100 && boost <= 150 && (
            <Text style={[styles.warningText, { color: theme.warningOrange }]}>
              ⚡ High boost level - monitor audio quality
            </Text>
          )}
          {boost > 50 && boost <= 100 && (
            <Text style={[styles.warningText, { color: theme.warningGreen }]}>
              🔥 Moderate boost active - audio enhanced
            </Text>
          )}
        </View>

        {/* App-Only Boost Toggle */}
        <View style={styles.controlSection}>
          <View style={styles.controlHeader}>
            <Text style={[styles.controlLabel, { color: theme.text }]}>Boost Mode:</Text>
            <View style={styles.toggleContainer}>
              <Text style={[styles.switchLabel, { color: appOnlyBoost ? theme.text : theme.textMuted }]}>
                {appOnlyBoost ? 'App Only' : 'Device Wide'}
              </Text>
              <Switch
                style={styles.switch}
                value={appOnlyBoost}
                onValueChange={handleAppOnlyBoostToggle}
                trackColor={{ false: theme.border, true: theme.switchTrack }}
                thumbColor={appOnlyBoost ? theme.switchThumb : theme.textMuted}
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
  loadingText: {
    fontSize: 18,
    textAlign: 'center',
    marginTop: 100,
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

