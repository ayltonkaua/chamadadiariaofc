/**
 * Pagination Hook
 * 
 * Generic hook for paginated data fetching with infinite scroll support.
 */

import { useState, useCallback, useEffect, useRef } from 'react';

export interface PaginationOptions {
    /** Initial page size */
    pageSize?: number;
    /** Initial page number (1-indexed) */
    initialPage?: number;
}

export interface PaginatedResult<T> {
    items: T[];
    page: number;
    pageSize: number;
    totalItems: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPreviousPage: boolean;
    isLoading: boolean;
    error: Error | null;
}

export interface UsePaginationReturn<T> extends PaginatedResult<T> {
    /** Go to next page */
    nextPage: () => void;
    /** Go to previous page */
    previousPage: () => void;
    /** Go to specific page */
    goToPage: (page: number) => void;
    /** Refresh current page */
    refresh: () => void;
    /** Reset to first page */
    reset: () => void;
    /** Append items (for infinite scroll) */
    appendItems: (newItems: T[]) => void;
}

/**
 * Hook for managing paginated data
 * 
 * @example
 * ```tsx
 * const { items, nextPage, isLoading, hasNextPage } = usePagination({
 *   fetchFn: (page, pageSize) => alunoService.findPaginated(turmaId, page, pageSize),
 *   pageSize: 20
 * });
 * ```
 */
export function usePagination<T>(
    fetchFn: (page: number, pageSize: number) => Promise<{ data: T[]; total: number }>,
    options: PaginationOptions = {}
): UsePaginationReturn<T> {
    const { pageSize = 20, initialPage = 1 } = options;

    const [items, setItems] = useState<T[]>([]);
    const [page, setPage] = useState(initialPage);
    const [totalItems, setTotalItems] = useState(0);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<Error | null>(null);

    const isMounted = useRef(true);

    const totalPages = Math.ceil(totalItems / pageSize);
    const hasNextPage = page < totalPages;
    const hasPreviousPage = page > 1;

    const fetchData = useCallback(async (targetPage: number) => {
        setIsLoading(true);
        setError(null);

        try {
            const result = await fetchFn(targetPage, pageSize);

            if (isMounted.current) {
                setItems(result.data);
                setTotalItems(result.total);
                setPage(targetPage);
            }
        } catch (err) {
            if (isMounted.current) {
                setError(err instanceof Error ? err : new Error('Unknown error'));
            }
        } finally {
            if (isMounted.current) {
                setIsLoading(false);
            }
        }
    }, [fetchFn, pageSize]);

    useEffect(() => {
        isMounted.current = true;
        fetchData(initialPage);

        return () => {
            isMounted.current = false;
        };
    }, [fetchData, initialPage]);

    const nextPage = useCallback(() => {
        if (hasNextPage && !isLoading) {
            fetchData(page + 1);
        }
    }, [hasNextPage, isLoading, page, fetchData]);

    const previousPage = useCallback(() => {
        if (hasPreviousPage && !isLoading) {
            fetchData(page - 1);
        }
    }, [hasPreviousPage, isLoading, page, fetchData]);

    const goToPage = useCallback((targetPage: number) => {
        if (targetPage >= 1 && targetPage <= totalPages && !isLoading) {
            fetchData(targetPage);
        }
    }, [totalPages, isLoading, fetchData]);

    const refresh = useCallback(() => {
        fetchData(page);
    }, [page, fetchData]);

    const reset = useCallback(() => {
        setItems([]);
        setPage(initialPage);
        setTotalItems(0);
        fetchData(initialPage);
    }, [initialPage, fetchData]);

    const appendItems = useCallback((newItems: T[]) => {
        setItems(prev => [...prev, ...newItems]);
    }, []);

    return {
        items,
        page,
        pageSize,
        totalItems,
        totalPages,
        hasNextPage,
        hasPreviousPage,
        isLoading,
        error,
        nextPage,
        previousPage,
        goToPage,
        refresh,
        reset,
        appendItems,
    };
}

/**
 * Hook for infinite scroll with intersection observer
 */
export function useInfiniteScroll(
    onLoadMore: () => void,
    options: { threshold?: number; enabled?: boolean } = {}
) {
    const { threshold = 0.5, enabled = true } = options;
    const observerRef = useRef<IntersectionObserver | null>(null);
    const targetRef = useRef<HTMLDivElement | null>(null);

    useEffect(() => {
        if (!enabled) return;

        observerRef.current = new IntersectionObserver(
            (entries) => {
                if (entries[0].isIntersecting) {
                    onLoadMore();
                }
            },
            { threshold }
        );

        if (targetRef.current) {
            observerRef.current.observe(targetRef.current);
        }

        return () => {
            observerRef.current?.disconnect();
        };
    }, [onLoadMore, threshold, enabled]);

    return { targetRef };
}
