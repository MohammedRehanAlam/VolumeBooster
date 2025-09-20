/**
 * StorageManager - Centralized Storage Management for VolumeBooster App
 * 
 * This module provides a robust, centralized storage system using AsyncStorage
 * with proper error handling, logging, and synchronization mechanisms.
 * 
 * Features:
 * - Centralized storage operations
 * - Automatic error handling and retry logic
 * - Comprehensive logging for debugging
 * - Type-safe storage operations
 * - Backup and restore functionality
 * 
 * @author VolumeBooster Team
 * @version 1.0.0
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Storage configuration interface
 */
interface StorageConfig {
  retryAttempts: number;
  retryDelay: number;
  enableLogging: boolean;
}

/**
 * Storage operation result interface
 */
export interface StorageResult<T> {
  success: boolean;
  data?: T;
  error?: string;
}

/**
 * Centralized Storage Manager Class
 * 
 * Handles all AsyncStorage operations with proper error handling,
 * retry logic, and comprehensive logging.
 */
export class StorageManager {
  private static instance: StorageManager;
  private config: StorageConfig;
  private isInitialized: boolean = false;

  /**
   * Private constructor for singleton pattern
   */
  private constructor() {
    this.config = {
      retryAttempts: 3,
      retryDelay: 1000, // 1 second
      enableLogging: __DEV__, // Enable logging in development mode
    };
  }

  /**
   * Get singleton instance of StorageManager
   */
  public static getInstance(): StorageManager {
    if (!StorageManager.instance) {
      StorageManager.instance = new StorageManager();
    }
    return StorageManager.instance;
  }

  /**
   * Initialize the storage manager
   */
  public async initialize(): Promise<void> {
    try {
      this.log('StorageManager initializing...');
      
      // Test AsyncStorage availability
      await AsyncStorage.getItem('__test__');
      await AsyncStorage.removeItem('__test__');
      
      this.isInitialized = true;
      this.log('StorageManager initialized successfully');
    } catch (error) {
      this.log('StorageManager initialization failed:', error);
      throw new Error(`Storage initialization failed: ${error}`);
    }
  }

  /**
   * Set a value in AsyncStorage with retry logic
   */
  public async setItem<T>(key: string, value: T): Promise<StorageResult<void>> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    let lastError: Error | null = null;
    
    for (let attempt = 1; attempt <= this.config.retryAttempts; attempt++) {
      try {
        this.log(`Setting item '${key}' (attempt ${attempt}/${this.config.retryAttempts})`);
        
        const jsonValue = JSON.stringify(value);
        await AsyncStorage.setItem(key, jsonValue);
        
        this.log(`Successfully set item '${key}'`);
        return { success: true };
      } catch (error) {
        lastError = error as Error;
        this.log(`Failed to set item '${key}' (attempt ${attempt}):`, error);
        
        if (attempt < this.config.retryAttempts) {
          await this.delay(this.config.retryDelay);
        }
      }
    }

    return {
      success: false,
      error: `Failed to set item '${key}' after ${this.config.retryAttempts} attempts: ${lastError?.message}`
    };
  }

  /**
   * Get a value from AsyncStorage with retry logic
   */
  public async getItem<T>(key: string): Promise<StorageResult<T>> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    let lastError: Error | null = null;
    
    for (let attempt = 1; attempt <= this.config.retryAttempts; attempt++) {
      try {
        this.log(`Getting item '${key}' (attempt ${attempt}/${this.config.retryAttempts})`);
        
        const jsonValue = await AsyncStorage.getItem(key);
        
        if (jsonValue === null) {
          this.log(`Item '${key}' not found`);
          return { success: true, data: undefined };
        }
        
        const parsedValue = JSON.parse(jsonValue) as T;
        this.log(`Successfully got item '${key}':`, parsedValue);
        
        return { success: true, data: parsedValue };
      } catch (error) {
        lastError = error as Error;
        this.log(`Failed to get item '${key}' (attempt ${attempt}):`, error);
        
        if (attempt < this.config.retryAttempts) {
          await this.delay(this.config.retryDelay);
        }
      }
    }

    return {
      success: false,
      error: `Failed to get item '${key}' after ${this.config.retryAttempts} attempts: ${lastError?.message}`
    };
  }

  /**
   * Remove an item from AsyncStorage with retry logic
   */
  public async removeItem(key: string): Promise<StorageResult<void>> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    let lastError: Error | null = null;
    
    for (let attempt = 1; attempt <= this.config.retryAttempts; attempt++) {
      try {
        this.log(`Removing item '${key}' (attempt ${attempt}/${this.config.retryAttempts})`);
        
        await AsyncStorage.removeItem(key);
        
        this.log(`Successfully removed item '${key}'`);
        return { success: true };
      } catch (error) {
        lastError = error as Error;
        this.log(`Failed to remove item '${key}' (attempt ${attempt}):`, error);
        
        if (attempt < this.config.retryAttempts) {
          await this.delay(this.config.retryDelay);
        }
      }
    }

    return {
      success: false,
      error: `Failed to remove item '${key}' after ${this.config.retryAttempts} attempts: ${lastError?.message}`
    };
  }

  /**
   * Get all keys from AsyncStorage
   */
  public async getAllKeys(): Promise<StorageResult<string[]>> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    try {
      this.log('Getting all storage keys');
      
      const keys = await AsyncStorage.getAllKeys();
      
      this.log(`Found ${keys.length} storage keys:`, keys);
      return { success: true, data: [...keys] };
    } catch (error) {
      this.log('Failed to get all keys:', error);
      return {
        success: false,
        error: `Failed to get all keys: ${error}`
      };
    }
  }

  /**
   * Clear all AsyncStorage data
   */
  public async clearAll(): Promise<StorageResult<void>> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    try {
      this.log('Clearing all storage data');
      
      await AsyncStorage.clear();
      
      this.log('Successfully cleared all storage data');
      return { success: true };
    } catch (error) {
      this.log('Failed to clear all storage:', error);
      return {
        success: false,
        error: `Failed to clear all storage: ${error}`
      };
    }
  }

  /**
   * Check if a key exists in storage
   */
  public async hasKey(key: string): Promise<StorageResult<boolean>> {
    const result = await this.getItem(key);
    return {
      success: result.success,
      data: result.data !== undefined,
      error: result.error
    };
  }

  /**
   * Get storage size information
   */
  public async getStorageInfo(): Promise<StorageResult<{ keys: string[], count: number }>> {
    const keysResult = await this.getAllKeys();
    
    if (!keysResult.success) {
      return {
        success: false,
        error: keysResult.error
      };
    }

    return {
      success: true,
      data: {
        keys: [...(keysResult.data || [])],
        count: keysResult.data?.length || 0
      }
    };
  }

  /**
   * Delay utility for retry logic
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Logging utility
   */
  private log(message: string, data?: any): void {
    if (this.config.enableLogging) {
      if (data !== undefined) {
        console.log(`[StorageManager] ${message}`, data);
      } else {
        console.log(`[StorageManager] ${message}`);
      }
    }
  }

  /**
   * Update configuration
   */
  public updateConfig(newConfig: Partial<StorageConfig>): void {
    this.config = { ...this.config, ...newConfig };
    this.log('Configuration updated:', this.config);
  }

  /**
   * Get current configuration
   */
  public getConfig(): StorageConfig {
    return { ...this.config };
  }
}

/**
 * Export singleton instance for easy access
 */
export const storageManager = StorageManager.getInstance();
