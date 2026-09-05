package com.volumebooster

import android.app.*
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
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
    private var isReceiverRegistered = false
    
    // React Native context for event emission (if available)
    private var reactContext: com.facebook.react.bridge.ReactApplicationContext? = null
    
    // Receiver for hardware/external volume change events to dynamically update proportional boost
    private val volumeReceiver = object : BroadcastReceiver() {
        override fun onReceive(context: Context?, intent: Intent?) {
            if (intent?.action == "android.media.VOLUME_CHANGED_ACTION") {
                if (isBoostEnabled && currentBoostLevel > 0) {
                    try {
                        val gainInMillibels = calculateGainInMb(currentBoostLevel)
                        loudnessEnhancer?.setTargetGain(gainInMillibels)
                    } catch (e: Exception) {
                        android.util.Log.e("VolumeBoosterService", "Error updating boost on volume change", e)
                    }
                }
            }
        }
    }
    
    // ============================================================================
    // SERVICE LIFECYCLE METHODS
    // ============================================================================
    
    override fun onCreate() {
        super.onCreate()
        initializeAudioSystem()
        createNotificationChannel()
        
        try {
            val filter = IntentFilter("android.media.VOLUME_CHANGED_ACTION")
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                registerReceiver(volumeReceiver, filter, Context.RECEIVER_EXPORTED)
            } else {
                registerReceiver(volumeReceiver, filter)
            }
            isReceiverRegistered = true
        } catch (e: Exception) {
            android.util.Log.e("VolumeBoosterService", "Failed to register volumeReceiver", e)
        }
    }
    
    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        when (intent?.action) {
            ACTION_START_SERVICE -> {
                val boostLevel = intent.getIntExtra(EXTRA_BOOST_LEVEL, currentBoostLevel)
                val appOnly = intent.getBooleanExtra(EXTRA_APP_ONLY, isAppOnlyBoost)
                val enabled = intent.getBooleanExtra(EXTRA_ENABLED, true)
                
                isBoostEnabled = enabled
                isAppOnlyBoost = appOnly
                currentBoostLevel = boostLevel
                
                startForeground(NOTIFICATION_ID, createNotification())
                
                if (isBoostEnabled && currentBoostLevel > 0) {
                    setBoost(currentBoostLevel, isAppOnlyBoost)
                }
            }
            ACTION_STOP_SERVICE -> {
                cleanupAudioResources()
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
                    stopForeground(STOP_FOREGROUND_REMOVE)
                } else {
                    @Suppress("DEPRECATION")
                    stopForeground(true)
                }
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
    
    override fun onTaskRemoved(rootIntent: Intent?) {
        super.onTaskRemoved(rootIntent)
        val prefs = getSharedPreferences("VolumeBoosterPrefs", Context.MODE_PRIVATE)
        val isBgEnabled = prefs.getBoolean("backgroundModeEnabled", false)
        android.util.Log.d("VolumeBoosterService", "onTaskRemoved: backgroundModeEnabled=$isBgEnabled")
        
        if (!isBgEnabled) {
            enableBoost(false)
            cleanupAudioResources()
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
                stopForeground(STOP_FOREGROUND_REMOVE)
            } else {
                @Suppress("DEPRECATION")
                stopForeground(true)
            }
            stopSelf()
        } else {
            updateNotification()
        }
    }

    override fun onDestroy() {
        super.onDestroy()
        if (isReceiverRegistered) {
            try {
                unregisterReceiver(volumeReceiver)
            } catch (e: Exception) {
                android.util.Log.e("VolumeBoosterService", "Error unregistering volumeReceiver", e)
            }
            isReceiverRegistered = false
        }
        cleanupAudioResources()
    }
    
    // ============================================================================
    // AUDIO SYSTEM INITIALIZATION
    // ============================================================================
    
    private fun initializeAudioSystem() {
        try {
            audioManager = getSystemService(Context.AUDIO_SERVICE) as AudioManager
            audioSessionID = audioManager.generateAudioSessionId()
            android.util.Log.d("VolumeBoosterService", "Audio system initialized - preserving current volume")
        } catch (e: Exception) {
            android.util.Log.e("VolumeBoosterService", "Failed to initialize audio system", e)
        }
    }
    
    private fun cleanupAudioResources() {
        try {
            loudnessEnhancer?.setTargetGain(0)
            loudnessEnhancer?.enabled = false
        } catch (e: Exception) {
            android.util.Log.e("VolumeBoosterService", "Error disabling LoudnessEnhancer in cleanup", e)
        }
        try {
            loudnessEnhancer?.release()
        } catch (e: Exception) {
            android.util.Log.e("VolumeBoosterService", "Error cleaning up audio resources", e)
        }
        loudnessEnhancer = null
    }
    
    // ============================================================================
    // BOOST CONTROL METHODS
    // ============================================================================
    
    private fun getStreamVolumePercentage(): Int {
        return try {
            val current = audioManager.getStreamVolume(AudioManager.STREAM_MUSIC)
            val max = audioManager.getStreamMaxVolume(AudioManager.STREAM_MUSIC)
            if (max > 0) {
                ((current.toFloat() / max) * 100).toInt()
            } else {
                100
            }
        } catch (e: Exception) {
            100
        }
    }

    fun calculateGainInMb(boostLevel: Int): Int {
        if (boostLevel <= 0) return 0
        val volumePercent = getStreamVolumePercentage()
        // Proportional boost: base boost scaled by the actual current volume level
        // e.g. at 30% volume and 200% boost, gain is based on 30% of max gain (5000 mB * 0.30 = 1500 mB)
        val maxGainForBoost = boostLevel * 25
        val scaledGain = (maxGainForBoost * (volumePercent.toFloat() / 100f)).toInt()
        return scaledGain.coerceAtLeast(0)
    }

    fun setBoost(boostLevel: Int, appOnly: Boolean) {
        try {
            val sessionChanged = (isAppOnlyBoost != appOnly)
            currentBoostLevel = boostLevel
            isAppOnlyBoost = appOnly
            
            val targetSessionId = if (appOnly) audioSessionID else 0
            if (sessionChanged || loudnessEnhancer == null) {
                cleanupAudioResources()
                loudnessEnhancer = LoudnessEnhancer(targetSessionId)
            }
            
            // Apply boost if enabled
            if (isBoostEnabled && boostLevel > 0) {
                val gainInMillibels = calculateGainInMb(boostLevel)
                loudnessEnhancer?.setTargetGain(gainInMillibels)
                loudnessEnhancer?.enabled = true
            } else {
                loudnessEnhancer?.setTargetGain(0)
                loudnessEnhancer?.enabled = false
            }
            
            // Update notification
            updateNotification()
            
        } catch (e: Exception) {
            android.util.Log.e("VolumeBoosterService", "Failed to set boost, attempting recreate", e)
            cleanupAudioResources()
            try {
                val targetSessionId = if (appOnly) audioSessionID else 0
                loudnessEnhancer = LoudnessEnhancer(targetSessionId)
                if (isBoostEnabled && boostLevel > 0) {
                    val gainInMillibels = calculateGainInMb(boostLevel)
                    loudnessEnhancer?.setTargetGain(gainInMillibels)
                    loudnessEnhancer?.enabled = true
                }
            } catch (ex: Exception) {
                android.util.Log.e("VolumeBoosterService", "Failed to recreate LoudnessEnhancer in service", ex)
            }
            updateNotification()
        }
    }
    
    fun enableBoost(enabled: Boolean) {
        try {
            isBoostEnabled = enabled
            
            if (enabled && currentBoostLevel > 0) {
                if (loudnessEnhancer == null) {
                    val targetSessionId = if (isAppOnlyBoost) audioSessionID else 0
                    loudnessEnhancer = LoudnessEnhancer(targetSessionId)
                }
                val gainInMillibels = calculateGainInMb(currentBoostLevel)
                loudnessEnhancer?.setTargetGain(gainInMillibels)
                loudnessEnhancer?.enabled = true
            } else {
                // When disabling boost, set gain to 0 and disable
                loudnessEnhancer?.setTargetGain(0)
                loudnessEnhancer?.enabled = false
            }
            
            // Update notification
            updateNotification()
            
        } catch (e: Exception) {
            android.util.Log.e("VolumeBoosterService", "Failed to enable/disable boost", e)
        }
    }
    
    fun syncState(enabled: Boolean, boostLevel: Int, appOnly: Boolean) {
        isBoostEnabled = enabled
        isAppOnlyBoost = appOnly
        currentBoostLevel = boostLevel
        setBoost(boostLevel, appOnly)
    }

    fun updateVolumeAndBoost() {
        if (isBoostEnabled && currentBoostLevel > 0) {
            try {
                val gainInMillibels = calculateGainInMb(currentBoostLevel)
                loudnessEnhancer?.setTargetGain(gainInMillibels)
                loudnessEnhancer?.enabled = true
            } catch (e: Exception) {
                android.util.Log.e("VolumeBoosterService", "Error updating volume and boost", e)
            }
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
        
        fun startService(context: Context, boostLevel: Int = 0, appOnly: Boolean = false, enabled: Boolean = true) {
            val intent = Intent(context, VolumeBoosterService::class.java).apply {
                action = ACTION_START_SERVICE
                putExtra(EXTRA_BOOST_LEVEL, boostLevel)
                putExtra(EXTRA_APP_ONLY, appOnly)
                putExtra(EXTRA_ENABLED, enabled)
            }
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                context.startForegroundService(intent)
            } else {
                context.startService(intent)
            }
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
