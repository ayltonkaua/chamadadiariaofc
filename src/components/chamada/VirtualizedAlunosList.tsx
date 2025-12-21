/**
 * VirtualizedAlunosList Component v1.0
 * 
 * Virtualized list for large student lists using @tanstack/react-virtual.
 * Features:
 * - Automatic fallback to regular map() for lists < 15 items
 * - Fixed row height (64px) for consistent virtualization
 * - Maintains identical visual layout to original
 * 
 * Phase 2: Performance optimization for 50+ students
 */

import React, { useRef, memo, useCallback } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { Button } from '@/components/ui/button';
import { MessageSquare, FileText } from 'lucide-react';
import type { Aluno } from '@/domains';

// Types
type PresencaStatus = 'presente' | 'falta' | 'atestado';

interface VirtualizedAlunosListProps {
    alunos: Aluno[];
    presencas: Record<string, PresencaStatus>;
    onToggleStatus: (alunoId: string) => void;
    onSetStatus: (alunoId: string, status: PresencaStatus, e: React.MouseEvent) => void;
    onObservacao: (alunoId: string, alunoNome: string) => void;
}

// Threshold for enabling virtualization
const VIRTUALIZATION_THRESHOLD = 15;
const ROW_HEIGHT = 64; // Fixed height for each row

// Memoized row component to prevent re-renders
const AlunoRow = memo(({
    aluno,
    status,
    onToggle,
    onSetStatus,
    onObservacao
}: {
    aluno: Aluno;
    status: PresencaStatus;
    onToggle: () => void;
    onSetStatus: (status: PresencaStatus, e: React.MouseEvent) => void;
    onObservacao: () => void;
}) => {
    const isPresente = status === 'presente';
    const isFalta = status === 'falta';
    const isAtestado = status === 'atestado';

    return (
        <div
            onClick={onToggle}
            className={`
                flex items-center justify-between p-3 rounded-lg border-l-[6px] 
                shadow-sm cursor-pointer transition-all bg-white active:scale-[0.99]
                ${isPresente ? 'border-l-emerald-500' : isFalta ? 'border-l-red-500 bg-red-50/20' : 'border-l-blue-400'}
            `}
            style={{ height: ROW_HEIGHT - 12 }} // Subtract margin
        >
            <div className="flex items-center gap-3">
                <div className={`
                    h-10 w-10 rounded-full flex items-center justify-center 
                    font-bold text-sm border transition-colors
                    ${isPresente ? 'bg-emerald-100 text-emerald-700 border-emerald-200' :
                        isFalta ? 'bg-red-100 text-red-700 border-red-200' :
                            'bg-blue-100 text-blue-700 border-blue-200'}
                `}>
                    {aluno.nome.substring(0, 2).toUpperCase()}
                </div>
                <div>
                    <p className={`font-semibold text-sm ${isFalta ? 'text-red-700' : 'text-slate-800'}`}>
                        {aluno.nome}
                    </p>
                    <p className="text-xs text-slate-400 font-mono">{aluno.matricula}</p>
                </div>
            </div>
            <div className="flex gap-1" onClick={e => e.stopPropagation()}>
                <Button
                    variant="ghost"
                    size="icon"
                    className="h-9 w-9 text-slate-300 hover:text-purple-600"
                    onClick={onObservacao}
                >
                    <MessageSquare size={18} />
                </Button>
                <Button
                    variant={isAtestado ? "default" : "ghost"}
                    size="icon"
                    className={`h-9 w-9 ${isAtestado ? 'bg-blue-500 text-white hover:bg-blue-600' : 'text-slate-300 hover:text-blue-500'}`}
                    onClick={(e) => onSetStatus(isAtestado ? 'presente' : 'atestado', e)}
                >
                    <FileText size={18} />
                </Button>
            </div>
        </div>
    );
});

AlunoRow.displayName = 'AlunoRow';

// Main virtualized list component
const VirtualizedAlunosList: React.FC<VirtualizedAlunosListProps> = memo(({
    alunos,
    presencas,
    onToggleStatus,
    onSetStatus,
    onObservacao
}) => {
    const parentRef = useRef<HTMLDivElement>(null);

    // Use virtualizer only for large lists
    const shouldVirtualize = alunos.length >= VIRTUALIZATION_THRESHOLD;

    const virtualizer = useVirtualizer({
        count: alunos.length,
        getScrollElement: () => parentRef.current,
        estimateSize: () => ROW_HEIGHT,
        overscan: 5, // Render 5 extra items above/below viewport
    });

    // Memoized callbacks to prevent re-renders
    const createToggleHandler = useCallback((alunoId: string) => {
        return () => onToggleStatus(alunoId);
    }, [onToggleStatus]);

    const createSetStatusHandler = useCallback((alunoId: string) => {
        return (status: PresencaStatus, e: React.MouseEvent) => onSetStatus(alunoId, status, e);
    }, [onSetStatus]);

    const createObservacaoHandler = useCallback((alunoId: string, alunoNome: string) => {
        return () => onObservacao(alunoId, alunoNome);
    }, [onObservacao]);

    // Empty state
    if (alunos.length === 0) {
        return (
            <div className="text-center py-10 text-gray-400 border-2 border-dashed rounded-lg">
                <p>Nenhum aluno encontrado.</p>
            </div>
        );
    }

    // Small lists: standard render (no virtualization overhead)
    if (!shouldVirtualize) {
        return (
            <div className="space-y-3">
                {alunos.map((aluno) => (
                    <AlunoRow
                        key={aluno.id}
                        aluno={aluno}
                        status={presencas[aluno.id]}
                        onToggle={createToggleHandler(aluno.id)}
                        onSetStatus={createSetStatusHandler(aluno.id)}
                        onObservacao={createObservacaoHandler(aluno.id, aluno.nome)}
                    />
                ))}
            </div>
        );
    }

    // Large lists: virtualized render
    return (
        <div
            ref={parentRef}
            className="overflow-auto"
            style={{
                height: Math.min(alunos.length * ROW_HEIGHT, 600), // Max 600px height
                contain: 'strict' // Performance optimization
            }}
        >
            <div
                style={{
                    height: `${virtualizer.getTotalSize()}px`,
                    width: '100%',
                    position: 'relative',
                }}
            >
                {virtualizer.getVirtualItems().map((virtualRow) => {
                    const aluno = alunos[virtualRow.index];
                    return (
                        <div
                            key={aluno.id}
                            style={{
                                position: 'absolute',
                                top: 0,
                                left: 0,
                                width: '100%',
                                height: `${virtualRow.size}px`,
                                transform: `translateY(${virtualRow.start}px)`,
                            }}
                            className="pb-3"
                        >
                            <AlunoRow
                                aluno={aluno}
                                status={presencas[aluno.id]}
                                onToggle={createToggleHandler(aluno.id)}
                                onSetStatus={createSetStatusHandler(aluno.id)}
                                onObservacao={createObservacaoHandler(aluno.id, aluno.nome)}
                            />
                        </div>
                    );
                })}
            </div>
        </div>
    );
});

VirtualizedAlunosList.displayName = 'VirtualizedAlunosList';

export default VirtualizedAlunosList;
export { AlunoRow, VIRTUALIZATION_THRESHOLD };
