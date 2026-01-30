// Export storage managers
export { StorageManager, storageManager } from './StorageManager';
export { SettingsManager, settingsManager } from './SettingsManager';

// Export types
export type { AppSettings, SettingsChangeEvent } from './SettingsManager';
export type { StorageResult } from './StorageManager';

/**
 * Initialize all storage systems
 * 
 * This function initializes both the StorageManager and SettingsManager
 * in the correct order. Call this once when the app starts.
 */
export const initializeStorage = async (): Promise<void> => {
  try {
    console.log('[Storage] Initializing storage systems...');
    
    // Import SettingsManager dynamically to avoid circular dependency
    const { SettingsManager } = await import('./SettingsManager');
    const settingsManagerInstance = SettingsManager.getInstance();
    
    // Initialize settings manager (which also initializes storage manager)
    await settingsManagerInstance.initialize();
    
    console.log('[Storage] All storage systems initialized successfully');
  } catch (error) {
    console.error('[Storage] Failed to initialize storage systems:', error);
    throw error;
  }
};

/**
 * Get storage status information
 * 
 * Returns comprehensive information about the storage systems
 * including settings, storage info, and initialization status.
 */
export const getStorageStatus = async () => {
  try {
    // Import managers dynamically to avoid circular dependency
    const { SettingsManager } = await import('./SettingsManager');
    const { StorageManager } = await import('./StorageManager');
    
    const settingsManagerInstance = SettingsManager.getInstance();
    const storageManagerInstance = StorageManager.getInstance();
    
    const settingsInfo = await settingsManagerInstance.getStorageInfo();
    const storageInfo = await storageManagerInstance.getStorageInfo();
    
    return {
      settings: settingsInfo,
      storage: storageInfo,
      timestamp: Date.now()
    };
  } catch (error) {
    console.error('[Storage] Failed to get storage status:', error);
    return null;
  }
};
