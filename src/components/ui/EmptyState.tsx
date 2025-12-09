import React from 'react';
import { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

interface EmptyStateProps {
    icon: LucideIcon;
    title: string;
    description: string;
    className?: string;
    action?: React.ReactNode;
}

export function EmptyState({ icon: Icon, title, description, className, action }: EmptyStateProps) {
    return (
        <div className={cn("flex flex-col items-center justify-center py-12 text-center border-2 border-dashed rounded-lg bg-slate-50/50", className)}>
            <div className="bg-white p-4 rounded-full shadow-sm mb-4">
                <Icon className="w-8 h-8 text-gray-400" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-1">{title}</h3>
            <p className="text-sm text-gray-500 max-w-sm mb-6 px-4">
                {description}
            </p>
            {action && (
                <div className="flex gap-3">
                    {action}
                </div>
            )}
        </div>
    );
}
