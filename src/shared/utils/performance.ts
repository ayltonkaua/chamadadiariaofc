/**
 * Performance Utilities
 * 
 * Common utilities for optimizing React applications.
 */

/**
 * Debounce function - delays execution until after wait milliseconds
 * have elapsed since the last time it was invoked.
 */
export function debounce<T extends (...args: any[]) => any>(
    func: T,
    wait: number
): (...args: Parameters<T>) => void {
    let timeoutId: ReturnType<typeof setTimeout> | null = null;

    return function (...args: Parameters<T>) {
        if (timeoutId) {
            clearTimeout(timeoutId);
        }

        timeoutId = setTimeout(() => {
            func(...args);
        }, wait);
    };
}

/**
 * Throttle function - ensures function is called at most once per wait period.
 */
export function throttle<T extends (...args: any[]) => any>(
    func: T,
    wait: number
): (...args: Parameters<T>) => void {
    let lastTime = 0;
    let timeoutId: ReturnType<typeof setTimeout> | null = null;

    return function (...args: Parameters<T>) {
        const now = Date.now();
        const remaining = wait - (now - lastTime);

        if (remaining <= 0) {
            if (timeoutId) {
                clearTimeout(timeoutId);
                timeoutId = null;
            }
            lastTime = now;
            func(...args);
        } else if (!timeoutId) {
            timeoutId = setTimeout(() => {
                lastTime = Date.now();
                timeoutId = null;
                func(...args);
            }, remaining);
        }
    };
}

/**
 * Memoize function with LRU cache
 */
export function memoize<T extends (...args: any[]) => any>(
    func: T,
    options: { maxSize?: number; keyResolver?: (...args: Parameters<T>) => string } = {}
): T {
    const { maxSize = 100, keyResolver } = options;
    const cache = new Map<string, ReturnType<T>>();
    const keys: string[] = [];

    return function (...args: Parameters<T>): ReturnType<T> {
        const key = keyResolver ? keyResolver(...args) : JSON.stringify(args);

        if (cache.has(key)) {
            return cache.get(key)!;
        }

        const result = func(...args);
        cache.set(key, result);
        keys.push(key);

        // LRU eviction
        if (keys.length > maxSize) {
            const oldestKey = keys.shift()!;
            cache.delete(oldestKey);
        }

        return result;
    } as T;
}

/**
 * Chunk array into smaller arrays for batch processing
 */
export function chunk<T>(array: T[], size: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += size) {
        chunks.push(array.slice(i, i + size));
    }
    return chunks;
}

/**
 * Process items in batches with progress callback
 */
export async function processBatches<T, R>(
    items: T[],
    processor: (item: T) => Promise<R>,
    options: {
        batchSize?: number;
        onProgress?: (processed: number, total: number) => void;
        onBatchComplete?: (results: R[]) => void;
    } = {}
): Promise<R[]> {
    const { batchSize = 10, onProgress, onBatchComplete } = options;
    const batches = chunk(items, batchSize);
    const allResults: R[] = [];
    let processed = 0;

    for (const batch of batches) {
        const batchResults = await Promise.all(batch.map(processor));
        allResults.push(...batchResults);
        processed += batch.length;

        onProgress?.(processed, items.length);
        onBatchComplete?.(batchResults);
    }

    return allResults;
}

/**
 * Retry function with exponential backoff
 */
export async function retry<T>(
    fn: () => Promise<T>,
    options: { maxAttempts?: number; baseDelay?: number; maxDelay?: number } = {}
): Promise<T> {
    const { maxAttempts = 3, baseDelay = 1000, maxDelay = 10000 } = options;

    let lastError: Error;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        try {
            return await fn();
        } catch (error) {
            lastError = error instanceof Error ? error : new Error(String(error));

            if (attempt === maxAttempts) {
                throw lastError;
            }

            const delay = Math.min(baseDelay * Math.pow(2, attempt - 1), maxDelay);
            await new Promise(resolve => setTimeout(resolve, delay));
        }
    }

    throw lastError!;
}

/**
 * Compare two objects shallowly for equality
 */
export function shallowEqual(a: any, b: any): boolean {
    if (a === b) return true;
    if (typeof a !== 'object' || typeof b !== 'object') return false;
    if (a === null || b === null) return false;

    const keysA = Object.keys(a);
    const keysB = Object.keys(b);

    if (keysA.length !== keysB.length) return false;

    for (const key of keysA) {
        if (!Object.prototype.hasOwnProperty.call(b, key) || a[key] !== b[key]) {
            return false;
        }
    }

    return true;
}
