/**
 * StandardLoader Component v1.0
 * 
 * Unified loading indicator for consistent visual experience.
 * Phase 5: Visual consistency
 * 
 * Variants:
 * - spinner: Rotating loader icon
 * - skeleton: Placeholder skeleton animation
 * - dots: Animated dots
 */

import React, { memo } from 'react';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

type LoaderVariant = 'spinner' | 'skeleton' | 'dots';
type LoaderSize = 'sm' | 'md' | 'lg' | 'xl';

interface StandardLoaderProps {
    variant?: LoaderVariant;
    size?: LoaderSize;
    text?: string;
    className?: string;
    fullScreen?: boolean;
}

const SIZE_MAP: Record<LoaderSize, { icon: string; text: string; container: string }> = {
    sm: { icon: 'h-4 w-4', text: 'text-xs', container: 'p-2' },
    md: { icon: 'h-6 w-6', text: 'text-sm', container: 'p-4' },
    lg: { icon: 'h-8 w-8', text: 'text-base', container: 'p-6' },
    xl: { icon: 'h-12 w-12', text: 'text-lg', container: 'p-8' },
};

// Spinner variant
const SpinnerLoader = memo(({ size, text, className }: { size: LoaderSize; text?: string; className?: string }) => {
    const sizeConfig = SIZE_MAP[size];
    return (
        <div className={cn('flex flex-col items-center justify-center gap-2', sizeConfig.container, className)}>
            <Loader2 className={cn('animate-spin text-primary', sizeConfig.icon)} />
            {text && <span className={cn('text-muted-foreground', sizeConfig.text)}>{text}</span>}
        </div>
    );
});
SpinnerLoader.displayName = 'SpinnerLoader';

// Skeleton variant - line placeholder
const SkeletonLine = memo(({ className }: { className?: string }) => (
    <div className={cn('h-4 bg-slate-200 rounded animate-pulse', className)} />
));
SkeletonLine.displayName = 'SkeletonLine';

// Skeleton variant - card placeholder
const SkeletonCard = memo(({ className }: { className?: string }) => (
    <div className={cn('bg-white rounded-lg border p-4 space-y-3 animate-pulse', className)}>
        <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-slate-200" />
            <div className="flex-1 space-y-2">
                <div className="h-4 bg-slate-200 rounded w-3/4" />
                <div className="h-3 bg-slate-200 rounded w-1/2" />
            </div>
        </div>
    </div>
));
SkeletonCard.displayName = 'SkeletonCard';

// Skeleton loader - list of placeholders
const SkeletonLoader = memo(({ count = 3, className }: { count?: number; className?: string }) => (
    <div className={cn('space-y-3', className)}>
        {Array.from({ length: count }).map((_, i) => (
            <SkeletonCard key={i} />
        ))}
    </div>
));
SkeletonLoader.displayName = 'SkeletonLoader';

// Dots variant
const DotsLoader = memo(({ size, text, className }: { size: LoaderSize; text?: string; className?: string }) => {
    const sizeConfig = SIZE_MAP[size];
    return (
        <div className={cn('flex flex-col items-center justify-center gap-2', sizeConfig.container, className)}>
            <div className="flex gap-1">
                {[0, 1, 2].map((i) => (
                    <div
                        key={i}
                        className={cn(
                            'bg-primary rounded-full animate-bounce',
                            size === 'sm' ? 'h-1.5 w-1.5' : size === 'md' ? 'h-2 w-2' : 'h-3 w-3'
                        )}
                        style={{ animationDelay: `${i * 150}ms` }}
                    />
                ))}
            </div>
            {text && <span className={cn('text-muted-foreground', sizeConfig.text)}>{text}</span>}
        </div>
    );
});
DotsLoader.displayName = 'DotsLoader';

// Main StandardLoader component
const StandardLoader: React.FC<StandardLoaderProps> = memo(({
    variant = 'spinner',
    size = 'md',
    text,
    className,
    fullScreen = false
}) => {
    const wrapperClass = fullScreen
        ? 'fixed inset-0 flex items-center justify-center bg-white/80 backdrop-blur-sm z-50'
        : 'flex items-center justify-center';

    if (variant === 'skeleton') {
        return <SkeletonLoader className={className} />;
    }

    if (variant === 'dots') {
        return (
            <div className={wrapperClass}>
                <DotsLoader size={size} text={text} className={className} />
            </div>
        );
    }

    // Default: spinner
    return (
        <div className={wrapperClass}>
            <SpinnerLoader size={size} text={text} className={className} />
        </div>
    );
});

StandardLoader.displayName = 'StandardLoader';

export default StandardLoader;
export { SkeletonCard, SkeletonLine, SkeletonLoader };
