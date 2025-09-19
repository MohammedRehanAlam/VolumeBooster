/**
 * VolumeBoosterModule - TypeScript Interface for Native Audio Module
 * 
 * This file defines the TypeScript interface that bridges the React Native JavaScript
 * layer with the Android native audio processing module. It provides type safety
 * and IntelliSense support for all native module methods and data structures.
 * 
 * Key Features:
 * - Type-safe method signatures for all native functions
 * - AudioDeviceInfo interface for device information
 * - Event emitter setup for real-time updates
 * - Promise-based async operations
 * - Error handling with typed rejections
 * 
 * Architecture:
 * React Native UI → This Interface → Android Native Module → Android Audio APIs
 * 
 * @author VolumeBooster Team
 * @version 1.0.0
 * @since React Native 0.81+
 */

import { NativeModules, NativeEventEmitter } from 'react-native';

// ============================================================================
// NATIVE MODULE INTERFACE DEFINITIONS
// ============================================================================

/**
 * Interface defining all methods available in the native VolumeBooster module
 * 
 * This interface provides type safety for all native module operations including
 * audio initialization, volume control, boost processing, device monitoring,
 * and test sound generation.
 * 
 * All methods return Promises for async operations and include proper error handling.
 */
interface VolumeBoosterModule {
  /**
   * Initializes the native audio system
   * 
   * Sets up the Android AudioManager, generates a unique audio session ID,
   * initializes the LoudnessEnhancer, and prepares the system for audio processing.
   * 
   * @returns Promise<number> Resolves with maximum volume level
   * @throws Rejects with "INIT_ERROR" if initialization fails
   */
  initializeAudio(): Promise<number>;

  /**
   * Sets the device volume level
   * 
   * Converts percentage (0-100) to Android volume steps and applies
   * the volume change to the STREAM_MUSIC audio stream.
   * 
   * @param volume Volume percentage (0-100)
   * @returns Promise<void> Resolves when volume is set successfully
   * @throws Rejects with "VOLUME_ERROR" if volume setting fails
   */
  setVolume(volume: number): Promise<void>;

  /**
   * Sets the audio boost level
   * 
   * Applies real-time audio enhancement using Android LoudnessEnhancer API.
   * Supports boost levels from 0-200% with the formula: boostLevel * 25 = gain in millibels.
   * 
   * @param boostLevel Boost percentage (0-200)
   * @returns Promise<void> Resolves when boost is applied successfully
   * @throws Rejects with "BOOST_ERROR" if boost application fails
   */
  setBoost(boostLevel: number): Promise<void>;

  /**
   * Toggles between app-only and device-wide boost modes
   * 
   * Switches the LoudnessEnhancer session ID to control whether boost affects
   * only the app's audio or all device audio.
   * 
   * @param enabled true for app-only boost, false for device-wide boost
   * @returns Promise<void> Resolves when mode is changed successfully
   * @throws Rejects with "APP_ONLY_BOOST_ERROR" if mode change fails
   */
  setAppOnlyBoost(enabled: boolean): Promise<void>;

  /**
   * Plays a test sound for boost verification
   * 
   * Generates and plays a 440Hz sine wave tone using AudioTrack to test
   * the boost functionality. The sound uses the app's audio session.
   * 
   * @returns Promise<void> Resolves when test sound starts playing
   * @throws Rejects with "TEST_SOUND_ERROR" if test sound fails
   */
  playTestSound(): Promise<void>;

  /**
   * Gets information about the currently active audio output device
   * 
   * Scans all available audio output devices and returns detailed information
   * about the currently active one, including name, type, capabilities, etc.
   * 
   * @returns Promise<AudioDeviceInfo | null> Resolves with device info or null if no device
   * @throws Rejects with "DEVICE_ERROR" if device info retrieval fails
   */
  getAudioDeviceInfo(): Promise<AudioDeviceInfo | null>;

  /**
   * Starts continuous monitoring of audio device changes
   * 
   * Begins background monitoring that checks for audio device changes every 1.8 seconds
   * and emits 'audioDeviceChanged' events when changes are detected.
   */
  startDeviceMonitoring(): void;

  /**
   * Stops audio device monitoring
   * 
   * Removes all pending device monitoring tasks to prevent unnecessary
   * background processing when monitoring is no longer needed.
   */
  stopDeviceMonitoring(): void;

  /**
   * Starts continuous monitoring of volume level changes
   * 
   * Begins background monitoring that checks for volume changes every 500ms
   * and emits 'volumeChanged' events when changes are detected.
   */
  startVolumeMonitoring(): void;

  /**
   * Stops volume level monitoring
   * 
   * Removes all pending volume monitoring tasks to prevent unnecessary
   * background processing when monitoring is no longer needed.
   */
  stopVolumeMonitoring(): void;
}

// ============================================================================
// DATA STRUCTURE INTERFACES
// ============================================================================

/**
 * Interface defining the structure of audio device information
 * 
 * This interface represents the data structure returned by the native module
 * when querying for audio device information. It provides comprehensive
 * details about the currently active audio output device.
 * 
 * All fields are populated by the Android native module based on
 * AudioDeviceInfo and AudioManager APIs.
 */
interface AudioDeviceInfo {
  /** Human-readable device name (e.g., "Samsung Galaxy Buds", "Built-in Speaker") */
  name: string;
  
  /** Device type description (e.g., "Bluetooth", "Wired Headphones", "USB Audio") */
  type: string;
  
  /** Android AudioDeviceInfo type ID constant */
  typeId: number;
  
  /** Unique device identifier */
  id: number;
  
  /** Supported audio channels (e.g., "2", "6", "8") */
  channels: string;
  
  /** Supported audio encodings (e.g., "PCM 16-bit", "AAC") */
  encodings: string;
  
  /** Supported sample rates in Hz (e.g., "44100, 48000, 96000") */
  sampleRates: string;
}

// ============================================================================
// NATIVE MODULE ACCESS AND EVENT EMITTER SETUP
// ============================================================================

/**
 * Access to the native VolumeBooster module
 * 
 * This extracts the VolumeBooster module from NativeModules and provides
 * type-safe access to all native methods. The module name must match
 * the getName() method in the Android native module.
 */
const { VolumeBooster } = NativeModules as { VolumeBooster: VolumeBoosterModule };

/**
 * Event emitter for real-time updates from native module
 * 
 * This emitter receives events from the Android native module including:
 * - 'audioDeviceChanged': When audio output device changes
 * - 'volumeChanged': When system volume level changes
 * 
 * Components can subscribe to these events for real-time UI updates.
 */
export const VolumeBoosterEmitter = new NativeEventEmitter(VolumeBooster as any);

// ============================================================================
// MODULE EXPORTS
// ============================================================================

/**
 * Exported native module interface
 * 
 * This provides type-safe access to all native module methods from
 * React Native components. All methods are async and return Promises.
 */
export const VolumeBoosterModule = VolumeBooster;

/**
 * Exported AudioDeviceInfo type
 * 
 * This type can be imported by components that need to work with
 * audio device information data structures.
 */
export type { AudioDeviceInfo };
