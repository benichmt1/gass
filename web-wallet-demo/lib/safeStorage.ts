'use client';

/**
 * Safe storage utility to handle storage access issues
 * This utility provides a fallback mechanism for storage operations
 * and prevents errors when storage is not available
 */

// Type for storage options
type StorageType = 'localStorage' | 'sessionStorage' | 'memory';

// In-memory storage fallback
const memoryStorage: Record<string, string> = {};

// Check if we're in a browser environment
const isBrowser = typeof window !== 'undefined';

// Check if a specific storage type is available
const isStorageAvailable = (type: StorageType): boolean => {
  if (!isBrowser) return false;
  
  try {
    if (type === 'memory') return true;
    
    const storage = window[type];
    const testKey = '_storage_test_';
    storage.setItem(testKey, 'test');
    storage.removeItem(testKey);
    return true;
  } catch (e) {
    return false;
  }
};

// Get the best available storage
const getBestStorage = (): { type: StorageType; storage: Storage | typeof memoryStorage } => {
  if (isBrowser) {
    if (isStorageAvailable('localStorage')) {
      return { type: 'localStorage', storage: window.localStorage };
    }
    if (isStorageAvailable('sessionStorage')) {
      return { type: 'sessionStorage', storage: window.sessionStorage };
    }
  }
  return { type: 'memory', storage: memoryStorage };
};

// Safe storage API
export const safeStorage = {
  // Get a value from storage
  get: (key: string, defaultValue: any = null): any => {
    try {
      const { type, storage } = getBestStorage();
      
      if (type === 'memory') {
        return storage[key] ? JSON.parse(storage[key]) : defaultValue;
      }
      
      const value = (storage as Storage).getItem(key);
      return value !== null ? JSON.parse(value) : defaultValue;
    } catch (e) {
      console.warn(`Error getting item from storage: ${e}`);
      return defaultValue;
    }
  },
  
  // Set a value in storage
  set: (key: string, value: any): boolean => {
    try {
      const { type, storage } = getBestStorage();
      const stringValue = JSON.stringify(value);
      
      if (type === 'memory') {
        storage[key] = stringValue;
      } else {
        (storage as Storage).setItem(key, stringValue);
      }
      return true;
    } catch (e) {
      console.warn(`Error setting item in storage: ${e}`);
      return false;
    }
  },
  
  // Remove a value from storage
  remove: (key: string): boolean => {
    try {
      const { type, storage } = getBestStorage();
      
      if (type === 'memory') {
        delete storage[key];
      } else {
        (storage as Storage).removeItem(key);
      }
      return true;
    } catch (e) {
      console.warn(`Error removing item from storage: ${e}`);
      return false;
    }
  },
  
  // Clear all values from storage
  clear: (): boolean => {
    try {
      const { type, storage } = getBestStorage();
      
      if (type === 'memory') {
        Object.keys(storage).forEach(key => {
          delete storage[key];
        });
      } else {
        (storage as Storage).clear();
      }
      return true;
    } catch (e) {
      console.warn(`Error clearing storage: ${e}`);
      return false;
    }
  },
  
  // Check if storage is available
  isAvailable: (type?: StorageType): boolean => {
    if (type) {
      return isStorageAvailable(type);
    }
    return isStorageAvailable('localStorage') || 
           isStorageAvailable('sessionStorage') || 
           isStorageAvailable('memory');
  },
  
  // Get the type of storage being used
  getStorageType: (): StorageType => {
    return getBestStorage().type;
  }
};

export default safeStorage;
