package com.volumebooster

// Android Audio System Imports
import android.content.Context
import android.content.ComponentName
import android.content.Intent
import android.content.ServiceConnection
import android.media.AudioDeviceInfo
import android.media.AudioFormat
import android.media.AudioManager
import android.media.AudioTrack
import android.media.audiofx.LoudnessEnhancer
import android.os.Build
import android.os.Handler
import android.os.IBinder
import android.os.Looper
import android.view.KeyEvent

// React Native Bridge Imports
import com.facebook.react.bridge.*
import com.facebook.react.modules.core.DeviceEventManagerModule

// Math Utilities for Test Sound Generation
import kotlin.math.sin
import kotlin.math.PI

/**
 * Main VolumeBooster Native Module Class
 * 
 * This class extends ReactContextBaseJavaModule to provide native Android functionality
 * to the React Native JavaScript layer. It manages all audio-related operations including
 * volume control, boost processing, device monitoring, and test sound generation.
 */
class VolumeBoosterModule(private val reactContext: ReactApplicationContext) : ReactContextBaseJavaModule(reactContext) {

    // ============================================================================
    // CLASS VARIABLES - Audio System State Management
    // ============================================================================
    
    /** Android AudioManager instance for volume control and device management */
    private lateinit var audioManager: AudioManager
    
    /** Unique audio session ID for app-only boost mode */
    private var audioSessionID = 0
    
    /** LoudnessEnhancer instance for audio boost processing (fallback for foreground) */
    private var loudnessEnhancer: LoudnessEnhancer? = null
    
    /** AudioTrack instance for test sound generation */
    private var audioTrack: AudioTrack? = null
    
    /** Flag to control boost enable/disable state */
    private var isBoostEnabled = true
    
    /** Flag to control app-only vs device-wide boost mode */
    private var isAppOnlyBoost = false
    
    /** Current boost level for tracking */
    private var currentBoostLevel = 0
    
    /** Last detected audio device ID for change detection */
    private var lastDeviceId: Int? = null
    
    /** Last detected volume level for change detection */
    private var lastVolumeLevel: Int = -1
    
    /** Handler for background monitoring tasks */
    private val handler = Handler(Looper.getMainLooper())
    
    /** Background service connection and state */
    private var volumeBoosterService: VolumeBoosterService? = null
    private var isServiceBound = false
    private var isBackgroundModeEnabled = false
    
    /** Service connection for binding to VolumeBoosterService */
    private val serviceConnection = object : ServiceConnection {
        override fun onServiceConnected(name: ComponentName?, service: IBinder?) {
            val binder = service as VolumeBoosterService.VolumeBoosterBinder
            volumeBoosterService = binder.getService()
            volumeBoosterService?.setReactContext(reactContext)
            isServiceBound = true
        }
        
        override fun onServiceDisconnected(name: ComponentName?) {
            volumeBoosterService = null
            isServiceBound = false
        }
    }

    // ============================================================================
    // REACT NATIVE MODULE CONFIGURATION
    // ============================================================================
    
    /**
     * Returns the module name for React Native bridge
     * This name must match the module name used in JavaScript
     */
    override fun getName(): String {
        return "VolumeBooster"
    }

    // ============================================================================
    // AUDIO SYSTEM INITIALIZATION
    // ============================================================================
    
    /**
     * Initializes the audio system and sets up the LoudnessEnhancer
     * 
     * This method:
     * 1. Gets the Android AudioManager service
     * 2. Generates a unique audio session ID for app-only boost mode
     * 3. Initializes LoudnessEnhancer with device-wide boost (session ID 0)
     * 4. Sets device volume to maximum for optimal boost effect
     * 5. Initializes volume level tracking
     * 
     * @param promise Promise to resolve with max volume level or reject with error
     */
    @ReactMethod
    fun initializeAudio(promise: Promise) {
        try {
            audioManager = reactContext.getSystemService(Context.AUDIO_SERVICE) as AudioManager
            audioSessionID = audioManager.generateAudioSessionId()
            
            // Initialize with device-wide boost by default
            loudnessEnhancer = LoudnessEnhancer(0)
            
            val maxVolume = audioManager.getStreamMaxVolume(AudioManager.STREAM_MUSIC)
            // audioManager.setStreamVolume(AudioManager.STREAM_MUSIC, maxVolume, 0)
            
            // Don't change the current volume - just track it
            val currentVolume = audioManager.getStreamVolume(AudioManager.STREAM_MUSIC)
            lastVolumeLevel = ((currentVolume.toFloat() / maxVolume) * 100).toInt()
            
            promise.resolve(maxVolume)
        } catch (e: Exception) {
            promise.reject("INIT_ERROR", "Failed to initialize audio", e)
        }
    }

    // ============================================================================
    // VOLUME CONTROL METHODS
    // ============================================================================
    
    /**
     * Sets the device volume level
     * 
     * Converts percentage (0-100) to actual Android volume steps
     * Uses STREAM_MUSIC for media volume control
     * 
     * @param volume Volume percentage (0-100)
     * @param promise Promise to resolve on success or reject on error
     */
    @ReactMethod
    fun setVolume(volume: Double, promise: Promise) {
        try {
            val maxVolume = audioManager.getStreamMaxVolume(AudioManager.STREAM_MUSIC)
            val actualVolume = ((volume.toFloat() / 100) * maxVolume).toInt()
            audioManager.setStreamVolume(AudioManager.STREAM_MUSIC, actualVolume, 0)
            promise.resolve(null)
        } catch (e: Exception) {
            promise.reject("VOLUME_ERROR", "Failed to set volume", e)
        }
    }

    /**
     * Gets the current device volume level
     * 
     * Retrieves the current STREAM_MUSIC volume and converts it to percentage (0-100)
     * This is used to sync the app with the actual device volume when opening
     * 
     * @param promise Promise to resolve with current volume percentage
     */
    @ReactMethod
    fun getVolume(promise: Promise) {
        try {
            val maxVolume = audioManager.getStreamMaxVolume(AudioManager.STREAM_MUSIC)
            val currentVolume = audioManager.getStreamVolume(AudioManager.STREAM_MUSIC)
            val volumePercentage = (currentVolume.toFloat() / maxVolume) * 100
            promise.resolve(volumePercentage.toDouble())
        } catch (e: Exception) {
            promise.reject("VOLUME_ERROR", "Failed to get volume", e)
        }
    }

    // ============================================================================
    // AUDIO BOOST METHODS
    // ============================================================================
    
    /**
     * Sets the audio boost level using Android LoudnessEnhancer API
     * 
     * This is the core method that applies real-time audio enhancement.
     * It supports both app-only and device-wide boost modes.
     * 
     * BOOST CALCULATION FORMULA:
     * - boostLevel * 25 = gain in millibels (mB)
     * - 1000 mB = 1 dB
     * - Examples: 100% = 25 dB, 200% = 50 dB
     * 
     * SESSION ID MANAGEMENT:
     * - App-only mode: Uses app's unique audioSessionID
     * - Device-wide mode: Uses session ID 0 (global)
     * 
     * @param boostLevel Boost percentage (0-200)
     * @param promise Promise to resolve on success or reject on error
     */
    @ReactMethod
    fun setBoost(boostLevel: Int, promise: Promise) {
        try {
            // Track current boost level
            currentBoostLevel = boostLevel
            
            if (isBackgroundModeEnabled && isServiceBound && volumeBoosterService != null) {
                // Use background service for boost control
                volumeBoosterService?.setBoost(boostLevel, isAppOnlyBoost)
            } else {
                // Use local LoudnessEnhancer for foreground boost
                // Initialize LoudnessEnhancer with appropriate session ID
                if (isAppOnlyBoost) {
                    // For app-only boost, use the app's audio session ID
                    // This means boost only affects audio from this specific app
                    loudnessEnhancer?.release()
                    loudnessEnhancer = LoudnessEnhancer(audioSessionID)
                } else {
                    // For device-wide boost, use session ID 0 (global)
                    // This means boost affects ALL audio on the device
                    loudnessEnhancer?.release()
                    loudnessEnhancer = LoudnessEnhancer(0)
                }
                
                // BOOST CALCULATION:
                // Android LoudnessEnhancer uses millibels (mB) where 1000 mB = 1 dB
                // Formula: boostLevel * 25 = gain in millibels
                // Examples:
                // - 100% boost = 100 * 25 = 2500 mB = 25 dB
                // - 200% boost = 200 * 25 = 5000 mB = 50 dB
                // 
                // TO CHANGE MAX BOOST LEVEL:
                // 1. Change the multiplier (currently 25) to adjust gain per percentage
                // 2. Higher multiplier = more gain per percentage point
                // 3. Lower multiplier = less gain per percentage point
                // 4. Android LoudnessEnhancer max is ~100 dB (10,000 mB)
                // 5. So theoretical max with current formula: 400% (400 * 25 = 10,000 mB)
                loudnessEnhancer?.setTargetGain(boostLevel * 25)
                loudnessEnhancer?.enabled = true
                
                // Restart audio playback to apply the boost effect
                if (isBoostEnabled) {
                    restartAudioPlayback()
                }
            }
            
            promise.resolve(null)
        } catch (e: Exception) {
            promise.reject("BOOST_ERROR", "Failed to set boost", e)
        }
    }

    /**
     * Sets the boost enabled state
     * 
     * This method controls whether boost functionality is active or not.
     * When disabled, boost changes are ignored and no audio enhancement is applied.
     * 
     * @param enabled true to enable boost functionality, false to disable
     * @param promise Promise to resolve on success or reject on error
     */
    @ReactMethod
    fun setBoostEnabled(enabled: Boolean, promise: Promise) {
        try {
            isBoostEnabled = enabled
            
            if (isBackgroundModeEnabled && isServiceBound && volumeBoosterService != null) {
                // Use background service for boost control
                volumeBoosterService?.enableBoost(enabled)
            } else {
                // Use local LoudnessEnhancer for foreground boost
                if (loudnessEnhancer != null) {
                    if (!enabled) {
                        // If disabling boost, turn off loudness enhancer and set gain to 0
                        loudnessEnhancer?.setTargetGain(0)
                        loudnessEnhancer?.enabled = false
                    } else {
                        // If enabling boost, turn on loudness enhancer
                        loudnessEnhancer?.enabled = true
                    }
                }
            }
            
            promise.resolve(null)
        } catch (e: Exception) {
            promise.reject("BOOST_ENABLED_ERROR", "Failed to set boost enabled state", e)
        }
    }

    /**
     * Toggles between app-only and device-wide boost modes
     * 
     * This method switches the LoudnessEnhancer session ID:
     * - App-only mode: Uses app's unique audioSessionID
     * - Device-wide mode: Uses session ID 0 (global)
     * 
     * When switching modes, the LoudnessEnhancer is recreated with the new session ID
     * to ensure proper audio isolation or global effect.
     * 
     * @param enabled true for app-only boost, false for device-wide boost
     * @param promise Promise to resolve on success or reject on error
     */
    @ReactMethod
    fun setAppOnlyBoost(enabled: Boolean, promise: Promise) {
        try {
            isAppOnlyBoost = enabled
            
            if (isBackgroundModeEnabled && isServiceBound && volumeBoosterService != null) {
                // Use background service for boost control
                volumeBoosterService?.setBoost(currentBoostLevel, enabled)
            } else {
                // Reinitialize loudness enhancer with appropriate session ID
                loudnessEnhancer?.release()
                loudnessEnhancer = if (enabled) {
                    LoudnessEnhancer(audioSessionID)
                } else {
                    LoudnessEnhancer(0)
                }
            }
            
            promise.resolve(null)
        } catch (e: Exception) {
            promise.reject("APP_ONLY_BOOST_ERROR", "Failed to set app-only boost mode", e)
        }
    }

    // ============================================================================
    // AUDIO DEVICE MONITORING METHODS
    // ============================================================================
    
    /**
     * Gets information about the currently active audio output device
     * 
     * This method scans all available audio output devices and returns information
     * about the currently active one. It prioritizes:
     * 1. Currently active output device (Bluetooth, headphones, etc.)
     * 2. Built-in speaker as fallback
     * 
     * Returns detailed device information including:
     * - Device name and type
     * - Supported channels and encodings
     * - Sample rates
     * - Device ID and type ID
     * 
     * @param promise Promise to resolve with device info or null if no device found
     */
    @ReactMethod
    fun getAudioDeviceInfo(promise: Promise) {
        try {
            val devices = audioManager.getDevices(AudioManager.GET_DEVICES_OUTPUTS)
            val activeDevice = devices.firstOrNull { isActiveOutputDevice(it) }
                ?: devices.firstOrNull { it.type == AudioDeviceInfo.TYPE_BUILTIN_SPEAKER }

            if (activeDevice == null) {
                promise.resolve(null)
                return
            }

            val deviceInfo = WritableNativeMap().apply {
                putString("name", activeDevice.productName?.toString() ?: "N/A")
                putString("type", getDeviceType(activeDevice.type))
                putInt("typeId", activeDevice.type)
                putInt("id", activeDevice.id)
                putString("channels", activeDevice.channelCounts.joinToString())
                putString("encodings", getEncodingFormat(activeDevice.encodings))
                putString("sampleRates", activeDevice.sampleRates.joinToString())
            }
            
            promise.resolve(deviceInfo)
        } catch (e: Exception) {
            promise.reject("DEVICE_ERROR", "Failed to get device info", e)
        }
    }

    /**
     * Starts continuous monitoring of audio device changes
     * 
     * This method runs a background task that checks for audio device changes every 1.8 seconds.
     * When a device change is detected, it emits an 'audioDeviceChanged' event to React Native.
     * 
     * MONITORING LOGIC:
     * - Checks for active output devices (Bluetooth, headphones, speakers)
     * - Only emits events when device actually changes (not on every check)
     * - Handles cases where no device is detected
     * - Uses Handler for background execution
     * 
     * The monitoring continues until stopDeviceMonitoring() is called.
     */
    @ReactMethod
    fun startDeviceMonitoring() {
        handler.post(object : Runnable {
            override fun run() {
                try {
                    val devices = audioManager.getDevices(AudioManager.GET_DEVICES_OUTPUTS)
                    val activeDevice = devices.firstOrNull { isActiveOutputDevice(it) }
                        ?: devices.firstOrNull { it.type == AudioDeviceInfo.TYPE_BUILTIN_SPEAKER }

                    // If no active device found
                    if (activeDevice == null) {
                        if (lastDeviceId != null) { // Only update UI if previously there was a device
                            lastDeviceId = null
                            val eventEmitter = reactContext.getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
                            eventEmitter.emit("audioDeviceChanged", null)
                        }
                        handler.postDelayed(this, 1800)
                        return
                    }

                    // Avoid unnecessary UI updates if the same device is still active
                    if (activeDevice.id == lastDeviceId) {
                        handler.postDelayed(this, 1800)
                        return
                    }
                    lastDeviceId = activeDevice.id

                    val deviceInfo = WritableNativeMap().apply {
                        putString("name", activeDevice.productName?.toString() ?: "N/A")
                        putString("type", getDeviceType(activeDevice.type))
                        putInt("typeId", activeDevice.type)
                        putInt("id", activeDevice.id)
                        putString("channels", activeDevice.channelCounts.joinToString())
                        putString("encodings", getEncodingFormat(activeDevice.encodings))
                        putString("sampleRates", activeDevice.sampleRates.joinToString())
                    }
                    
                    val eventEmitter = reactContext.getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
                    eventEmitter.emit("audioDeviceChanged", deviceInfo)
                } catch (e: Exception) {
                    // Handle error silently for monitoring
                }
                handler.postDelayed(this, 1800)
            }
        })
    }

    /**
     * Stops audio device monitoring
     * 
     * Removes all pending monitoring tasks from the Handler queue.
     * This should be called when the app is paused or destroyed to prevent
     * unnecessary background processing.
     */
    @ReactMethod
    fun stopDeviceMonitoring() {
        handler.removeCallbacksAndMessages(null)
    }

    /**
     * Starts continuous monitoring of volume level changes
     * 
     * This method runs a background task that checks for volume changes every 500ms.
     * When a volume change is detected, it emits a 'volumeChanged' event to React Native.
     * 
     * VOLUME MONITORING:
     * - Converts Android volume steps to percentage (0-100)
     * - Only emits events when volume actually changes
     * - Uses STREAM_MUSIC for media volume tracking
     * - Runs every 500ms for responsive UI updates
     * 
     * The monitoring continues until stopVolumeMonitoring() is called.
     */
    @ReactMethod
    fun startVolumeMonitoring() {
        handler.post(object : Runnable {
            override fun run() {
                try {
                    val currentVolume = audioManager.getStreamVolume(AudioManager.STREAM_MUSIC)
                    val maxVolume = audioManager.getStreamMaxVolume(AudioManager.STREAM_MUSIC)
                    val volumePercentage = ((currentVolume.toFloat() / maxVolume) * 100).toInt()
                    
                    // Only emit if volume has changed
                    if (volumePercentage != lastVolumeLevel) {
                        lastVolumeLevel = volumePercentage
                        val eventEmitter = reactContext.getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
                        eventEmitter.emit("volumeChanged", volumePercentage)
                    }
                } catch (e: Exception) {
                    // Handle error silently for monitoring
                }
                handler.postDelayed(this, 500) // Check every 500ms for volume changes
            }
        })
    }

    @ReactMethod
    fun stopVolumeMonitoring() {
        handler.removeCallbacksAndMessages(null)
    }

    // ============================================================================
    // TEST SOUND GENERATION
    // ============================================================================
    
    /**
     * Generates and plays a test sound (440Hz sine wave) for boost verification
     * 
     * This method creates a pure 440Hz tone (A note) using AudioTrack to test
     * the boost functionality. The sound is generated programmatically and played
     * through the app's audio session, making it perfect for testing app-only boost mode.
     * 
     * TEST SOUND SPECIFICATIONS:
     * - Frequency: 440Hz (A4 note)
     * - Duration: 1 second
     * - Sample Rate: 44.1kHz
     * - Format: PCM 16-bit mono
     * - Session: Uses app's audioSessionID for proper boost testing
     * 
     * The sound is automatically stopped after 1 second and resources are cleaned up.
     * 
     * @param promise Promise to resolve on success or reject on error
     */
    @ReactMethod
    fun playTestSound(promise: Promise) {
        try {
            val sampleRate = 44100
            val duration = 1.0 // 1 second
            val numSamples = (sampleRate * duration).toInt()
            val samples = ShortArray(numSamples)
            
            // Generate a 440Hz sine wave (A note)
            val frequency = 440.0
            for (i in 0 until numSamples) {
                val sample = (sin(2 * PI * frequency * i / sampleRate) * Short.MAX_VALUE).toInt()
                samples[i] = sample.toShort()
            }
            
            // Create AudioTrack with the app's session ID
            val bufferSize = AudioTrack.getMinBufferSize(
                sampleRate,
                AudioFormat.CHANNEL_OUT_MONO,
                AudioFormat.ENCODING_PCM_16BIT
            )
            
            audioTrack?.release()
            audioTrack = AudioTrack.Builder()
                .setAudioAttributes(android.media.AudioAttributes.Builder()
                    .setUsage(android.media.AudioAttributes.USAGE_MEDIA)
                    .setContentType(android.media.AudioAttributes.CONTENT_TYPE_MUSIC)
                    .build())
                .setAudioFormat(AudioFormat.Builder()
                    .setEncoding(AudioFormat.ENCODING_PCM_16BIT)
                    .setSampleRate(sampleRate)
                    .setChannelMask(AudioFormat.CHANNEL_OUT_MONO)
                    .build())
                .setBufferSizeInBytes(bufferSize)
                .setSessionId(audioSessionID) // Use app's session ID
                .build()
            
            audioTrack?.play()
            audioTrack?.write(samples, 0, samples.size)
            
            // Stop after duration
            handler.postDelayed({
                audioTrack?.stop()
                audioTrack?.release()
                audioTrack = null
            }, (duration * 1000).toLong())
            
            promise.resolve(null)
        } catch (e: Exception) {
            promise.reject("TEST_SOUND_ERROR", "Failed to play test sound", e)
        }
    }

    // ============================================================================
    // UTILITY METHODS - Audio Processing Helpers
    // ============================================================================
    
    /**
     * Restarts audio playback to apply boost effects
     * 
     * This method simulates media key events (pause/play) to restart audio playback.
     * This is necessary because LoudnessEnhancer effects are only applied to active
     * audio streams. By restarting playback, we ensure the boost effect is applied
     * to the current audio session.
     * 
     * The method sends multiple pause/play key events to ensure proper audio restart
     * across different media players and audio apps.
     */
    private fun restartAudioPlayback() {
        isBoostEnabled = false
        audioManager.dispatchMediaKeyEvent(KeyEvent(KeyEvent.ACTION_DOWN, KeyEvent.KEYCODE_MEDIA_PAUSE))
        audioManager.dispatchMediaKeyEvent(KeyEvent(KeyEvent.ACTION_UP, KeyEvent.KEYCODE_MEDIA_PAUSE))
        audioManager.dispatchMediaKeyEvent(KeyEvent(KeyEvent.ACTION_DOWN, KeyEvent.KEYCODE_MEDIA_PLAY))
        audioManager.dispatchMediaKeyEvent(KeyEvent(KeyEvent.ACTION_UP, KeyEvent.KEYCODE_MEDIA_PLAY))
        audioManager.dispatchMediaKeyEvent(KeyEvent(KeyEvent.ACTION_DOWN, KeyEvent.KEYCODE_MEDIA_PAUSE))
        audioManager.dispatchMediaKeyEvent(KeyEvent(KeyEvent.ACTION_UP, KeyEvent.KEYCODE_MEDIA_PAUSE))
        audioManager.dispatchMediaKeyEvent(KeyEvent(KeyEvent.ACTION_DOWN, KeyEvent.KEYCODE_MEDIA_PLAY))
        audioManager.dispatchMediaKeyEvent(KeyEvent(KeyEvent.ACTION_UP, KeyEvent.KEYCODE_MEDIA_PLAY))
    }

    /**
     * Determines if an audio device is currently active for output
     * 
     * This method checks various device types to determine if they are actively
     * being used for audio output. Different device types have different
     * activation criteria.
     * 
     * DEVICE TYPE CHECKS:
     * - Bluetooth A2DP: Checks if Bluetooth A2DP is enabled
     * - Wired Headphones/Headset: Always considered active when connected
     * - Built-in Speaker: Checks if speakerphone mode is on
     * - Other types: Not considered active
     * 
     * @param device AudioDeviceInfo to check
     * @return true if device is active, false otherwise
     */
    private fun isActiveOutputDevice(device: AudioDeviceInfo): Boolean {
        return when (device.type) {
            AudioDeviceInfo.TYPE_BLUETOOTH_A2DP -> audioManager.isBluetoothA2dpOn
            AudioDeviceInfo.TYPE_WIRED_HEADPHONES, AudioDeviceInfo.TYPE_WIRED_HEADSET -> true
            AudioDeviceInfo.TYPE_BUILTIN_SPEAKER -> audioManager.isSpeakerphoneOn
            else -> false
        }
    }

    /**
     * Converts Android device type ID to human-readable string
     * 
     * Maps Android AudioDeviceInfo type constants to descriptive names
     * for display in the UI. Covers all common audio device types.
     * 
     * @param type Android AudioDeviceInfo type constant
     * @return Human-readable device type string
     */
    private fun getDeviceType(type: Int): String {
        return when (type) {
            AudioDeviceInfo.TYPE_BLUETOOTH_A2DP, AudioDeviceInfo.TYPE_BLUETOOTH_SCO -> "Bluetooth"
            AudioDeviceInfo.TYPE_WIRED_HEADPHONES, AudioDeviceInfo.TYPE_WIRED_HEADSET -> "Wired Headphones"
            AudioDeviceInfo.TYPE_USB_DEVICE, AudioDeviceInfo.TYPE_USB_HEADSET -> "USB Audio"
            AudioDeviceInfo.TYPE_HDMI, AudioDeviceInfo.TYPE_HDMI_ARC -> "HDMI Output"
            AudioDeviceInfo.TYPE_BUILTIN_SPEAKER -> "Device Speaker"
            AudioDeviceInfo.TYPE_BUILTIN_EARPIECE -> "Earpiece"
            else -> "Unknown Device"
        }
    }

    /**
     * Converts Android audio encoding formats to human-readable strings
     * 
     * Maps Android AudioFormat encoding constants to descriptive names
     * for display in the UI. Covers PCM, compressed, and advanced audio formats.
     * 
     * @param formats Array of Android AudioFormat encoding constants
     * @return Comma-separated string of encoding format names
     */
    private fun getEncodingFormat(formats: IntArray): String {
        val encodingMap = mapOf(
            AudioFormat.ENCODING_PCM_16BIT to "PCM 16-bit",
            AudioFormat.ENCODING_PCM_8BIT to "PCM 8-bit",
            AudioFormat.ENCODING_PCM_FLOAT to "PCM Float",
            AudioFormat.ENCODING_AC3 to "Dolby AC3",
            AudioFormat.ENCODING_E_AC3 to "Dolby Digital+",
            AudioFormat.ENCODING_DTS to "DTS",
            AudioFormat.ENCODING_DTS_HD to "DTS-HD",
            AudioFormat.ENCODING_AAC_ELD to "AAC ELD",
            AudioFormat.ENCODING_AAC_HE_V1 to "AAC HE v1",
            AudioFormat.ENCODING_AAC_HE_V2 to "AAC HE v2"
        )
        return formats.joinToString { encodingMap[it] ?: "Unknown Format" }
    }

    // ============================================================================
    // BACKGROUND SERVICE CONTROL METHODS
    // ============================================================================
    
    /**
     * Enables or disables background mode for audio boost
     * 
     * When background mode is enabled:
     * - Starts the VolumeBoosterService as a foreground service
     * - Binds to the service for communication
     * - Audio boost continues working even when app is closed
     * - Shows persistent notification indicating boost is active
     * 
     * When background mode is disabled:
     * - Stops the foreground service
     * - Unbinds from the service
     * - Audio boost only works when app is active
     * 
     * @param enabled true to enable background mode, false to disable
     * @param promise Promise to resolve on success or reject on error
     */
    @ReactMethod
    fun setBackgroundMode(enabled: Boolean, promise: Promise) {
        try {
            isBackgroundModeEnabled = enabled
            
            if (enabled) {
                // Start foreground service
                VolumeBoosterService.startService(reactContext)
                
                // Bind to service for communication
                val intent = Intent(reactContext, VolumeBoosterService::class.java)
                reactContext.bindService(intent, serviceConnection, Context.BIND_AUTO_CREATE)
                
                promise.resolve(true)
            } else {
                // Stop foreground service
                VolumeBoosterService.stopService(reactContext)
                
                // Unbind from service
                if (isServiceBound) {
                    reactContext.unbindService(serviceConnection)
                    isServiceBound = false
                    volumeBoosterService = null
                }
                
                promise.resolve(false)
            }
        } catch (e: Exception) {
            promise.reject("BACKGROUND_MODE_ERROR", "Failed to set background mode", e)
        }
    }
    
    /**
     * Checks if background mode is currently enabled
     * 
     * @param promise Promise to resolve with boolean indicating background mode status
     */
    @ReactMethod
    fun isBackgroundModeEnabled(promise: Promise) {
        promise.resolve(isBackgroundModeEnabled)
    }
    
    /**
     * Checks if the background service is currently running
     * 
     * @param promise Promise to resolve with boolean indicating service status
     */
    @ReactMethod
    fun isBackgroundServiceRunning(promise: Promise) {
        promise.resolve(isServiceBound && volumeBoosterService != null)
    }
    
    /**
     * Gets the current boost level from the background service
     * 
     * @param promise Promise to resolve with current boost level (0-200)
     */
    @ReactMethod
    fun getBackgroundBoostLevel(promise: Promise) {
        try {
            if (isServiceBound && volumeBoosterService != null) {
                val boostLevel = volumeBoosterService?.getCurrentBoostLevel() ?: 0
                promise.resolve(boostLevel)
            } else {
                promise.resolve(0)
            }
        } catch (e: Exception) {
            promise.reject("GET_BOOST_ERROR", "Failed to get background boost level", e)
        }
    }
    
    /**
     * Checks if boost is currently active in background service
     * 
     * @param promise Promise to resolve with boolean indicating boost status
     */
    @ReactMethod
    fun isBackgroundBoostActive(promise: Promise) {
        try {
            if (isServiceBound && volumeBoosterService != null) {
                val isActive = volumeBoosterService?.isBoostActive() ?: false
                promise.resolve(isActive)
            } else {
                promise.resolve(false)
            }
        } catch (e: Exception) {
            promise.reject("BOOST_STATUS_ERROR", "Failed to get background boost status", e)
        }
    }

    // ============================================================================
    // LIFECYCLE MANAGEMENT - Resource Cleanup
    // ============================================================================
    
    /**
     * Cleanup method called when React Native module is destroyed
     * 
     * This method is called when the React Native bridge is destroyed or the app
     * is being terminated. It ensures all audio resources are properly released
     * to prevent memory leaks and audio system conflicts.
     * 
     * CLEANUP ACTIONS:
     * - Releases LoudnessEnhancer resources
     * - Releases AudioTrack resources
     * - Removes all pending Handler tasks
     * - Prevents background monitoring from continuing
     * - Unbinds from background service if connected
     */
    override fun onCatalystInstanceDestroy() {
        super.onCatalystInstanceDestroy()
        
        // Cleanup local audio resources
        loudnessEnhancer?.release()
        audioTrack?.release()
        handler.removeCallbacksAndMessages(null)
        
        // Cleanup background service connection
        if (isServiceBound) {
            try {
                reactContext.unbindService(serviceConnection)
            } catch (e: Exception) {
                android.util.Log.e("VolumeBoosterModule", "Error unbinding service", e)
            }
            isServiceBound = false
            volumeBoosterService = null
        }
        
        // Stop background service if running
        if (isBackgroundModeEnabled) {
            try {
                VolumeBoosterService.stopService(reactContext)
            } catch (e: Exception) {
                android.util.Log.e("VolumeBoosterModule", "Error stopping service", e)
            }
        }
    }
}
