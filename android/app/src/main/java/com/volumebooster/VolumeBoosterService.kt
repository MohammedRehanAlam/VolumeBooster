/**
 * VolumeBoosterService - Android Foreground Service for Background Audio Boost
 * 
 * This service runs in the background to maintain audio boost functionality
 * even when the main app is closed or backgrounded. It uses Android's
 * LoudnessEnhancer API to provide continuous audio enhancement.
 * 
 * Key Features:
 * - Runs as foreground service with persistent notification
 * - Maintains LoudnessEnhancer instance independently of app lifecycle
 * - Supports both app-only and device-wide boost modes
 * - Handles audio session management for background operation
 * - Provides service control methods for React Native integration
 * 
 * @author VolumeBooster Team
 * @version 1.0.1
 * @since Android API 21+
 */
package com.volumebooster

import android.app.*
import android.content.Context
import android.content.Intent
import android.media.AudioManager
import android.media.audiofx.LoudnessEnhancer
import android.os.Binder
import android.os.Build
import android.os.IBinder
import android.os.Looper
import android.os.Handler
import androidx.core.app.NotificationCompat
import com.facebook.react.bridge.WritableNativeMap
import com.facebook.react.modules.core.DeviceEventManagerModule

class VolumeBoosterService : Service() {
    
    // ============================================================================
    // SERVICE BINDER AND COMMUNICATION
    // ============================================================================
    
    private val binder = VolumeBoosterBinder()
    
    inner class VolumeBoosterBinder : Binder() {
        fun getService(): VolumeBoosterService = this@VolumeBoosterService
    }
    
    override fun onBind(intent: Intent): IBinder = binder
    
    // ============================================================================
    // SERVICE STATE VARIABLES
    // ============================================================================
    
    private lateinit var audioManager: AudioManager
    private var audioSessionID = 0
    private var loudnessEnhancer: LoudnessEnhancer? = null
    private var isBoostEnabled = false
    private var isAppOnlyBoost = false
    private var currentBoostLevel = 0
    private val handler = Handler(Looper.getMainLooper())
    
    // React Native context for event emission (if available)
    private var reactContext: com.facebook.react.bridge.ReactApplicationContext? = null
    
    // ============================================================================
    // SERVICE LIFECYCLE METHODS
    // ============================================================================
    
    override fun onCreate() {
        super.onCreate()
        initializeAudioSystem()
        createNotificationChannel()
    }
    
    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        when (intent?.action) {
            ACTION_START_SERVICE -> {
                startForeground(NOTIFICATION_ID, createNotification())
            }
            ACTION_STOP_SERVICE -> {
                stopForeground(true)
                stopSelf()
            }
            ACTION_SET_BOOST -> {
                val boostLevel = intent.getIntExtra(EXTRA_BOOST_LEVEL, 0)
                val appOnly = intent.getBooleanExtra(EXTRA_APP_ONLY, false)
                setBoost(boostLevel, appOnly)
            }
            ACTION_ENABLE_BOOST -> {
                val enabled = intent.getBooleanExtra(EXTRA_ENABLED, false)
                enableBoost(enabled)
            }
        }
        return START_STICKY // Restart service if killed by system
    }
    
    override fun onDestroy() {
        super.onDestroy()
        cleanupAudioResources()
    }
    
    // ============================================================================
    // AUDIO SYSTEM INITIALIZATION
    // ============================================================================
    
    private fun initializeAudioSystem() {
        try {
            audioManager = getSystemService(Context.AUDIO_SERVICE) as AudioManager
            audioSessionID = audioManager.generateAudioSessionId()
            
            // Initialize with device-wide boost by default
            loudnessEnhancer = LoudnessEnhancer(0)
            
            // Don't change the current volume - preserve user's volume setting
            // The boost will work with whatever volume the user has set
            android.util.Log.d("VolumeBoosterService", "Audio system initialized - preserving current volume")
            
        } catch (e: Exception) {
            android.util.Log.e("VolumeBoosterService", "Failed to initialize audio system", e)
        }
    }
    
    private fun cleanupAudioResources() {
        try {
            loudnessEnhancer?.release()
            loudnessEnhancer = null
        } catch (e: Exception) {
            android.util.Log.e("VolumeBoosterService", "Error cleaning up audio resources", e)
        }
    }
    
    // ============================================================================
    // BOOST CONTROL METHODS
    // ============================================================================
    
    fun setBoost(boostLevel: Int, appOnly: Boolean) {
        try {
            currentBoostLevel = boostLevel
            isAppOnlyBoost = appOnly
            
            // Reinitialize loudness enhancer with appropriate session ID
            loudnessEnhancer?.release()
            loudnessEnhancer = if (appOnly) {
                LoudnessEnhancer(audioSessionID)
            } else {
                LoudnessEnhancer(0)
            }
            
            // Apply boost if enabled
            if (isBoostEnabled && boostLevel > 0) {
                val gainInMillibels = boostLevel * 25 // Convert percentage to millibels
                loudnessEnhancer?.setTargetGain(gainInMillibels)
                loudnessEnhancer?.setEnabled(true)
            }
            
            // Update notification
            updateNotification()
            
        } catch (e: Exception) {
            android.util.Log.e("VolumeBoosterService", "Failed to set boost", e)
        }
    }
    
    fun enableBoost(enabled: Boolean) {
        try {
            isBoostEnabled = enabled
            
            if (enabled && currentBoostLevel > 0) {
                val gainInMillibels = currentBoostLevel * 25
                loudnessEnhancer?.setTargetGain(gainInMillibels)
                loudnessEnhancer?.setEnabled(true)
            } else {
                // When disabling boost, set gain to 0 and disable
                loudnessEnhancer?.setTargetGain(0)
                loudnessEnhancer?.setEnabled(false)
            }
            
            // Update notification
            updateNotification()
            
        } catch (e: Exception) {
            android.util.Log.e("VolumeBoosterService", "Failed to enable/disable boost", e)
        }
    }
    
    fun getCurrentBoostLevel(): Int = currentBoostLevel
    
    fun isBoostActive(): Boolean = isBoostEnabled && currentBoostLevel > 0
    
    fun isAppOnlyMode(): Boolean = isAppOnlyBoost
    
    // ============================================================================
    // NOTIFICATION MANAGEMENT
    // ============================================================================
    
    private fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                CHANNEL_ID,
                "Volume Booster Service",
                NotificationManager.IMPORTANCE_LOW
            ).apply {
                description = "Keeps audio boost active in the background"
                setShowBadge(false)
                enableLights(false)
                enableVibration(false)
            }
            
            val notificationManager = getSystemService(NotificationManager::class.java)
            notificationManager.createNotificationChannel(channel)
        }
    }
    
    private fun createNotification(): Notification {
        val boostText = if (isBoostActive()) {
            "Boost: ${currentBoostLevel}% ${if (isAppOnlyBoost) "(App Only)" else "(Device Wide)"}"
        } else {
            "Boost: Disabled"
        }
        
        val intent = Intent(this, MainActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TASK
        }
        
        val pendingIntent = PendingIntent.getActivity(
            this, 0, intent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )
        
        return NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle("Volume Booster")
            .setContentText(boostText)
            .setSmallIcon(android.R.drawable.ic_media_play)
            .setContentIntent(pendingIntent)
            .setOngoing(true)
            .setSilent(true)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .build()
    }
    
    private fun updateNotification() {
        if (isBoostActive()) {
            val notification = createNotification()
            val notificationManager = getSystemService(NotificationManager::class.java)
            notificationManager.notify(NOTIFICATION_ID, notification)
        }
    }
    
    // ============================================================================
    // REACT NATIVE INTEGRATION
    // ============================================================================
    
    fun setReactContext(context: com.facebook.react.bridge.ReactApplicationContext?) {
        reactContext = context
    }
    
    private fun emitEvent(eventName: String, data: Any?) {
        reactContext?.let { context ->
            try {
                val eventEmitter = context.getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
                eventEmitter.emit(eventName, data)
            } catch (e: Exception) {
                android.util.Log.e("VolumeBoosterService", "Failed to emit event: $eventName", e)
            }
        }
    }
    
    // ============================================================================
    // STATIC METHODS FOR SERVICE CONTROL
    // ============================================================================
    
    companion object {
        private const val CHANNEL_ID = "VolumeBoosterServiceChannel"
        private const val NOTIFICATION_ID = 1001
        
        const val ACTION_START_SERVICE = "com.volumebooster.START_SERVICE"
        const val ACTION_STOP_SERVICE = "com.volumebooster.STOP_SERVICE"
        const val ACTION_SET_BOOST = "com.volumebooster.SET_BOOST"
        const val ACTION_ENABLE_BOOST = "com.volumebooster.ENABLE_BOOST"
        
        const val EXTRA_BOOST_LEVEL = "boost_level"
        const val EXTRA_APP_ONLY = "app_only"
        const val EXTRA_ENABLED = "enabled"
        
        fun startService(context: Context) {
            val intent = Intent(context, VolumeBoosterService::class.java).apply {
                action = ACTION_START_SERVICE
            }
            context.startForegroundService(intent)
        }
        
        fun stopService(context: Context) {
            val intent = Intent(context, VolumeBoosterService::class.java).apply {
                action = ACTION_STOP_SERVICE
            }
            context.startService(intent)
        }
        
        fun setBoost(context: Context, boostLevel: Int, appOnly: Boolean) {
            val intent = Intent(context, VolumeBoosterService::class.java).apply {
                action = ACTION_SET_BOOST
                putExtra(EXTRA_BOOST_LEVEL, boostLevel)
                putExtra(EXTRA_APP_ONLY, appOnly)
            }
            context.startService(intent)
        }
        
        fun enableBoost(context: Context, enabled: Boolean) {
            val intent = Intent(context, VolumeBoosterService::class.java).apply {
                action = ACTION_ENABLE_BOOST
                putExtra(EXTRA_ENABLED, enabled)
            }
            context.startService(intent)
        }
    }
}
