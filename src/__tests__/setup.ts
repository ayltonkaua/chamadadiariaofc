/**
 * Test Setup
 * 
 * Global test configuration and mocks.
 */

import '@testing-library/jest-dom';
import { vi } from 'vitest';

// Mock navigator.onLine
Object.defineProperty(navigator, 'onLine', {
    value: true,
    writable: true,
    configurable: true,
});

// Mock Supabase client
vi.mock('@/integrations/supabase/client', () => ({
    supabase: {
        from: vi.fn(() => ({
            select: vi.fn().mockReturnThis(),
            insert: vi.fn().mockReturnThis(),
            update: vi.fn().mockReturnThis(),
            delete: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            in: vi.fn().mockReturnThis(),
            order: vi.fn().mockReturnThis(),
            limit: vi.fn().mockReturnThis(),
            single: vi.fn().mockReturnThis(),
            maybeSingle: vi.fn().mockReturnThis(),
        })),
        auth: {
            getSession: vi.fn(),
            getUser: vi.fn(),
            signInWithPassword: vi.fn(),
            signOut: vi.fn(),
            onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe: vi.fn() } } })),
        },
        rpc: vi.fn(),
    },
}));

// Mock IndexedDB
vi.mock('idb-keyval', () => ({
    get: vi.fn(),
    set: vi.fn(),
    del: vi.fn(),
    clear: vi.fn(),
}));

// Suppress console errors in tests (optional)
// vi.spyOn(console, 'error').mockImplementation(() => {});
