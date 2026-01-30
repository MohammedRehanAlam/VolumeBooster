import { storageManager } from './StorageManager';

/**
 * App settings interface - defines all configurable settings
 */
export interface AppSettings {
  volume: number;
  boost: number;
  gradualBoost: boolean;
  appOnlyBoost: boolean;
  boostEnabled: boolean;
  autoVolumeEnabled: boolean;
}

/**
 * Settings change event interface
 */
export interface SettingsChangeEvent {
  key: keyof AppSettings;
  oldValue: any;
  newValue: any;
  timestamp: number;
}

/**
 * Settings validation result interface
 */
interface ValidationResult {
  isValid: boolean;
  errors: string[];
}

/**
 * Settings Manager Class
 * 
 * Handles all app settings with automatic persistence, validation,
 * and change notifications.
 */
export class SettingsManager {
  private static instance: SettingsManager;
  private settings: AppSettings;
  private storageKey: string = '@VolumeBooster_Settings_v2';
  private changeListeners: Array<(event: SettingsChangeEvent) => void> = [];
  private isInitialized: boolean = false;

  /**
   * Default settings values
   */
  private readonly defaultSettings: AppSettings = {
    volume: 100,
    boost: 0,
    gradualBoost: false,
    appOnlyBoost: false,
    boostEnabled: false,
    autoVolumeEnabled: false,
  };

  /**
   * Private constructor for singleton pattern
   */
  private constructor() {
    this.settings = { ...this.defaultSettings };
  }

  /**
   * Get singleton instance of SettingsManager
   */
  public static getInstance(): SettingsManager {
    if (!SettingsManager.instance) {
      SettingsManager.instance = new SettingsManager();
    }
    return SettingsManager.instance;
  }

  /**
   * Initialize the settings manager
   */
  public async initialize(): Promise<void> {
    try {
      console.log('[SettingsManager] Initializing...');
      
      // Initialize storage manager
      await storageManager.initialize();
      
      // Load settings from storage
      await this.loadSettings();
      
      this.isInitialized = true;
      console.log('[SettingsManager] Initialized successfully with settings:', this.settings);
    } catch (error) {
      console.error('[SettingsManager] Initialization failed:', error);
      throw new Error(`Settings initialization failed: ${error}`);
    }
  }

  /**
   * Load settings from storage
   */
  private async loadSettings(): Promise<void> {
    try {
      console.log('[SettingsManager] Loading settings from storage...');
      
      const result = await storageManager.getItem<AppSettings>(this.storageKey);
      
      if (result.success && result.data) {
        // Validate loaded settings
        const validation = this.validateSettings(result.data);
        
        if (validation.isValid) {
          this.settings = { ...result.data };
          console.log('[SettingsManager] Settings loaded successfully:', this.settings);
        } else {
          console.warn('[SettingsManager] Loaded settings are invalid, using defaults:', validation.errors);
          this.settings = { ...this.defaultSettings };
          await this.saveSettings();
        }
      } else {
        console.log('[SettingsManager] No saved settings found, using defaults');
        this.settings = { ...this.defaultSettings };
        await this.saveSettings();
      }
    } catch (error) {
      console.error('[SettingsManager] Failed to load settings:', error);
      this.settings = { ...this.defaultSettings };
      await this.saveSettings();
    }
  }

  /**
   * Save settings to storage
   */
  private async saveSettings(): Promise<void> {
    try {
      console.log('[SettingsManager] Saving settings to storage:', this.settings);
      
      const result = await storageManager.setItem(this.storageKey, this.settings);
      
      if (result.success) {
        console.log('[SettingsManager] Settings saved successfully');
      } else {
        console.error('[SettingsManager] Failed to save settings:', result.error);
      }
    } catch (error) {
      console.error('[SettingsManager] Failed to save settings:', error);
    }
  }

  /**
   * Validate settings object
   */
  private validateSettings(settings: any): ValidationResult {
    const errors: string[] = [];
    
    // Check if settings is an object
    if (typeof settings !== 'object' || settings === null) {
      errors.push('Settings must be an object');
      return { isValid: false, errors };
    }

    // Validate each setting
    if (typeof settings.volume !== 'number' || settings.volume < 0 || settings.volume > 100) {
      errors.push('Volume must be a number between 0 and 100');
    }

    if (typeof settings.boost !== 'number' || settings.boost < 0 || settings.boost > 200) {
      errors.push('Boost must be a number between 0 and 200');
    }

    if (typeof settings.gradualBoost !== 'boolean') {
      errors.push('GradualBoost must be a boolean');
    }

    if (typeof settings.appOnlyBoost !== 'boolean') {
      errors.push('AppOnlyBoost must be a boolean');
    }

    if (typeof settings.boostEnabled !== 'boolean') {
      errors.push('BoostEnabled must be a boolean');
    }

    if (typeof settings.autoVolumeEnabled !== 'boolean') {
      errors.push('AutoVolumeEnabled must be a boolean');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Get a specific setting value
   */
  public getSetting<K extends keyof AppSettings>(key: K): AppSettings[K] {
    if (!this.isInitialized) {
      console.warn('[SettingsManager] Settings manager not initialized, returning default value');
      return this.defaultSettings[key];
    }
    
    return this.settings[key];
  }

  /**
   * Get all settings
   */
  public getAllSettings(): AppSettings {
    if (!this.isInitialized) {
      console.warn('[SettingsManager] Settings manager not initialized, returning default settings');
      return { ...this.defaultSettings };
    }
    
    return { ...this.settings };
  }

  /**
   * Set a specific setting value
   */
  public async setSetting<K extends keyof AppSettings>(key: K, value: AppSettings[K]): Promise<boolean> {
    if (!this.isInitialized) {
      console.error('[SettingsManager] Settings manager not initialized');
      return false;
    }

    const oldValue = this.settings[key];
    
    // Validate the new value
    const tempSettings = { ...this.settings, [key]: value };
    const validation = this.validateSettings(tempSettings);
    
    if (!validation.isValid) {
      console.error('[SettingsManager] Invalid setting value:', validation.errors);
      return false;
    }

    // Update the setting
    this.settings[key] = value;
    
    // Save to storage
    await this.saveSettings();
    
    // Notify listeners
    this.notifyChangeListeners({
      key,
      oldValue,
      newValue: value,
      timestamp: Date.now()
    });

    console.log(`[SettingsManager] Setting '${key}' updated from ${oldValue} to ${value}`);
    return true;
  }

  /**
   * Set multiple settings at once
   */
  public async setMultipleSettings(settings: Partial<AppSettings>): Promise<boolean> {
    if (!this.isInitialized) {
      console.error('[SettingsManager] Settings manager not initialized');
      return false;
    }

    try {
      console.log('[SettingsManager] Setting multiple settings:', settings);
      
      // Validate all settings
      const tempSettings = { ...this.settings, ...settings };
      const validation = this.validateSettings(tempSettings);
      
      if (!validation.isValid) {
        console.error('[SettingsManager] Invalid settings:', validation.errors);
        return false;
      }

      // Update settings
      const oldSettings = { ...this.settings };
      this.settings = { ...tempSettings };
      
      // Save to storage
      await this.saveSettings();
      
      // Notify listeners for each changed setting
      Object.keys(settings).forEach(key => {
        const typedKey = key as keyof AppSettings;
        if (oldSettings[typedKey] !== this.settings[typedKey]) {
          this.notifyChangeListeners({
            key: typedKey,
            oldValue: oldSettings[typedKey],
            newValue: this.settings[typedKey],
            timestamp: Date.now()
          });
        }
      });

      console.log('[SettingsManager] Multiple settings updated successfully');
      return true;
    } catch (error) {
      console.error('[SettingsManager] Failed to set multiple settings:', error);
      return false;
    }
  }

  /**
   * Reset all settings to defaults
   */
  public async resetToDefaults(): Promise<boolean> {
    if (!this.isInitialized) {
      console.error('[SettingsManager] Settings manager not initialized');
      return false;
    }

    try {
      console.log('[SettingsManager] Resetting settings to defaults');
      
      const oldSettings = { ...this.settings };
      this.settings = { ...this.defaultSettings };
      
      // Save to storage
      await this.saveSettings();
      
      // Notify listeners for each changed setting
      Object.keys(this.defaultSettings).forEach(key => {
        const typedKey = key as keyof AppSettings;
        if (oldSettings[typedKey] !== this.settings[typedKey]) {
          this.notifyChangeListeners({
            key: typedKey,
            oldValue: oldSettings[typedKey],
            newValue: this.settings[typedKey],
            timestamp: Date.now()
          });
        }
      });

      console.log('[SettingsManager] Settings reset to defaults successfully');
      return true;
    } catch (error) {
      console.error('[SettingsManager] Failed to reset settings:', error);
      return false;
    }
  }

  /**
   * Clear all settings from storage
   */
  public async clearSettings(): Promise<boolean> {
    try {
      console.log('[SettingsManager] Clearing all settings from storage');
      
      const result = await storageManager.removeItem(this.storageKey);
      
      if (result.success) {
        console.log('[SettingsManager] Settings cleared successfully');
        return true;
      } else {
        console.error('[SettingsManager] Failed to clear settings:', result.error);
        return false;
      }
    } catch (error) {
      console.error('[SettingsManager] Failed to clear settings:', error);
      return false;
    }
  }

  /**
   * Add a change listener
   */
  public addChangeListener(listener: (event: SettingsChangeEvent) => void): void {
    this.changeListeners.push(listener);
    console.log('[SettingsManager] Change listener added');
  }

  /**
   * Remove a change listener
   */
  public removeChangeListener(listener: (event: SettingsChangeEvent) => void): void {
    const index = this.changeListeners.indexOf(listener);
    if (index > -1) {
      this.changeListeners.splice(index, 1);
      console.log('[SettingsManager] Change listener removed');
    }
  }

  /**
   * Notify all change listeners
   */
  private notifyChangeListeners(event: SettingsChangeEvent): void {
    this.changeListeners.forEach(listener => {
      try {
        listener(event);
      } catch (error) {
        console.error('[SettingsManager] Error in change listener:', error);
      }
    });
  }

  /**
   * Get storage information
   */
  public async getStorageInfo(): Promise<any> {
    try {
      const info = await storageManager.getStorageInfo();
      return {
        settingsKey: this.storageKey,
        settings: this.settings,
        storageInfo: info.data,
        isInitialized: this.isInitialized,
        listenersCount: this.changeListeners.length
      };
    } catch (error) {
      console.error('[SettingsManager] Failed to get storage info:', error);
      return null;
    }
  }

  /**
   * Check if settings manager is initialized
   */
  public isReady(): boolean {
    return this.isInitialized;
  }
}

/**
 * Export singleton instance for easy access
 */
export const settingsManager = SettingsManager.getInstance();
