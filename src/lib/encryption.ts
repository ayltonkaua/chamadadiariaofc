/**
 * Offline Storage Encryption Module
 * 
 * Provides AES-256 encryption for sensitive data stored in IndexedDB.
 * Uses a device-specific key derived from browser fingerprint.
 */

import CryptoJS from 'crypto-js';

/**
 * Generates a deterministic encryption key based on device/browser characteristics.
 * This ensures the same key is used across sessions on the same device.
 * 
 * NOTA: Para segurança LGPD ideal, considere adicionar uma senha do usuário.
 */
function getDeviceKey(): string {
    const factors = [
        navigator.userAgent,
        navigator.language,
        screen.width.toString(),
        screen.height.toString(),
        new Date().getTimezoneOffset().toString(),
        // Fallback ID if available
        'chamada-diaria-v2'
    ];

    // Create a hash of the factors
    const raw = factors.join('|');
    return CryptoJS.SHA256(raw).toString();
}

// Cached key for performance
let cachedKey: string | null = null;

function getKey(): string {
    if (!cachedKey) {
        cachedKey = getDeviceKey();
    }
    return cachedKey;
}

/**
 * Encrypts data using AES-256
 */
export function encryptData<T>(data: T): string {
    const json = JSON.stringify(data);
    const encrypted = CryptoJS.AES.encrypt(json, getKey());
    return encrypted.toString();
}

/**
 * Decrypts data encrypted with encryptData
 */
export function decryptData<T>(encryptedData: string): T | null {
    try {
        const bytes = CryptoJS.AES.decrypt(encryptedData, getKey());
        const json = bytes.toString(CryptoJS.enc.Utf8);

        if (!json) {
            console.warn('Decryption returned empty string - possibly wrong key');
            return null;
        }

        return JSON.parse(json) as T;
    } catch (error) {
        console.error('Failed to decrypt data:', error);
        return null;
    }
}

/**
 * Checks if data looks like it's encrypted (base64-like string)
 */
export function isEncrypted(data: unknown): boolean {
    if (typeof data !== 'string') return false;
    // AES encrypted data starts with "U2Fsd" (base64 of "Salted__")
    return data.startsWith('U2Fsd');
}
