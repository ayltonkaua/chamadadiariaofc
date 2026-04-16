import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { MessageCircle, PhoneOff, GripVertical, AlertTriangle, ChevronDown, ChevronUp, History } from 'lucide-react';
import { RegistrarContatoModal } from './RegistrarContatoModal';
import type { AlunoRiscoData, AlunoFaltasConsecutivasData } from '@/domains';

interface AlunoBuscaCardProps {
    aluno: AlunoRiscoData | AlunoFaltasConsecutivasData;
    escolaId: string;
    telefone: string | null;
    isConsecutiva?: boolean;
    buscaAtivaResumo?: { contatado: boolean; ultimoContato: string | null; totalContatos: number; ultimoStatus?: string; historico?: any[] } | null;
    onContactRegistered: (novoRegistro?: any) => void;
    // Props for drag and drop
    innerRef?: (element?: HTMLElement | null) => void;
    draggableProps?: any;
    dragHandleProps?: any;
}

export function AlunoBuscaCard({ aluno, escolaId, telefone, isConsecutiva, buscaAtivaResumo, onContactRegistered, innerRef, draggableProps, dragHandleProps }: AlunoBuscaCardProps) {
    const [isExpanded, setIsExpanded] = useState(false);
    const nome = aluno.aluno_nome || 'Aluno Sem Nome';
    
    // Pegar iniciais do nome
    const iniciais = nome.split(' ').slice(0, 2).map((n: string) => n[0]).join('').toUpperCase();
    
    const faltasSeguidas = 'contagem_faltas_consecutivas' in aluno ? aluno.contagem_faltas_consecutivas : 0;
    const totalFaltas = 'total_faltas' in aluno ? aluno.total_faltas : 0;

    // Tratar o telefone para WhatsApp
    const limparTelefone = (tel: string | null) => tel ? tel.replace(/\D/g, '') : '';
    const numLimpo = limparTelefone(telefone);
    const isTelefoneValido = numLimpo.length >= 10;

    const abrirWhatsApp = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (!isTelefoneValido) return;
        const texto = `Olá, sou da coordenação da escola. Notamos ausências recentes do(a) aluno(a) ${nome} e gostaríamos de saber se está tudo bem.`;
        window.open(`https://wa.me/55${numLimpo}?text=${encodeURIComponent(texto)}`, '_blank');
    };

    // Recidivism logic
    const isRecidivism = isConsecutiva && buscaAtivaResumo && buscaAtivaResumo.totalContatos > 0;

    return (
        <Card 
            ref={innerRef}
            {...draggableProps}
            className={`transition-all border hover:shadow-md bg-white overflow-hidden relative cursor-grab active:cursor-grabbing w-full ${isConsecutiva ? 'border-red-300' : 'border-amber-300'}`}
        >
            <CardContent className="p-3">
                <div className="flex gap-2">
                    {/* Avatar / Initials */}
                    <div className="flex-shrink-0">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm text-white ${isConsecutiva ? 'bg-red-500' : 'bg-amber-500'}`}>
                            {iniciais}
                        </div>
                    </div>
                
                    {/* Main Info */}
                    <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between">
                            <div className="truncate">
                                <h3 className="font-semibold text-gray-900 text-sm truncate" title={nome}>{nome}</h3>
                                <div className="text-xs text-gray-500 truncate">{aluno.turma_nome || 'Sem Turma'}</div>
                            </div>
                            
                            {/* Drag Handle */}
                            <div {...dragHandleProps} className="text-gray-300 hover:text-gray-500 p-1 -mr-2 -mt-1 cursor-grab active:cursor-grabbing">
                                <GripVertical className="h-4 w-4" />
                            </div>
                        </div>

                        {/* Badges / Metrics */}
                        <div className="flex flex-wrap gap-1 mt-2">
                            {isConsecutiva ? (
                                <Badge variant="destructive" className="text-[10px] px-1.5 py-0 h-4 font-bold bg-red-100 text-red-700 hover:bg-red-200 border-red-200">
                                    {faltasSeguidas} faltas seguidas
                                </Badge>
                            ) : (
                                <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 bg-amber-50 text-amber-700 border-amber-200">
                                    {totalFaltas} faltas (Global)
                                </Badge>
                            )}
                            
                            {isRecidivism && (
                                <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 font-medium flex items-center gap-1 bg-violet-50 text-violet-700 border-violet-200">
                                    <AlertTriangle className="h-2.5 w-2.5" />
                                    Recaída ({buscaAtivaResumo.totalContatos}x)
                                </Badge>
                            )}
                        </div>
                    </div>
                </div>

                {/* Footer Actions / Info */}
                <div className="mt-3 pt-3 border-t flex flex-col gap-2">
                    {buscaAtivaResumo?.contatado ? (
                        <div className="flex items-center justify-between">
                            <div className="text-[10px] text-gray-500 flex items-center gap-1">
                                <History className="h-3 w-3" />
                                Último: {new Date(buscaAtivaResumo.ultimoContato!).toLocaleDateString('pt-BR')}
                            </div>
                            <button 
                                onClick={(e) => { e.stopPropagation(); setIsExpanded(!isExpanded); }} 
                                className="text-[10px] text-blue-600 hover:text-blue-800 flex items-center font-medium bg-blue-50 px-2 py-1 rounded"
                            >
                                {isExpanded ? 'Ocultar' : 'Ver Histórico'}
                                {isExpanded ? <ChevronUp className="h-3 w-3 ml-0.5" /> : <ChevronDown className="h-3 w-3 ml-0.5" />}
                            </button>
                        </div>
                    ) : (
                        <div className="text-[10px] text-gray-400 italic">Nenhum contato registrado</div>
                    )}

                    <div className="flex gap-2 w-full pt-1">
                        {isTelefoneValido ? (
                            <Button size="sm" variant="outline" className="flex-1 h-7 text-xs bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100 hover:text-emerald-800" onClick={abrirWhatsApp}>
                                <MessageCircle className="w-3 h-3 mr-1" />
                                Zap
                            </Button>
                        ) : (
                            <Button size="sm" variant="outline" disabled className="flex-1 h-7 text-xs text-gray-400 bg-gray-50">
                                <PhoneOff className="w-3 h-3 mr-1" />
                                S/ Num
                            </Button>
                        )}
                        <RegistrarContatoModal 
                            alunoId={aluno.aluno_id} 
                            nomeAluno={nome} 
                            escolaId={escolaId} 
                            onSuccess={onContactRegistered} 
                        />
                    </div>
                </div>

                {/* Timeline Expansion */}
                {isExpanded && buscaAtivaResumo?.historico && (
                    <div className="mt-3 pt-3 border-t bg-gray-50/50 -mx-3 -mb-3 p-3">
                        <div className="space-y-4 relative before:absolute before:inset-0 before:ml-2 before:-translate-x-px before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-gray-200 before:to-transparent">
                            {buscaAtivaResumo.historico.map((h: any, i: number) => (
                                <div key={i} className="relative pl-6">
                                    <span className="absolute left-0 top-1.5 w-4 h-4 rounded-full bg-white border-2 border-blue-400 ring-2 ring-transparent flex items-center justify-center" />
                                    <div className="text-[10px] font-bold text-gray-600 mb-0.5 uppercase tracking-wider flex justify-between">
                                        <span>{new Date(h.data_contato).toLocaleString('pt-BR')}</span>
                                        {h.status_funil && <span className="text-blue-600">{h.status_funil.replace(/_/g, ' ')}</span>}
                                    </div>
                                    <div className="text-xs font-semibold text-gray-800">{h.forma_contato} <span className="font-normal text-gray-500">por {h.monitor_responsavel || 'Sistema'}</span></div>
                                    <div className="text-xs text-gray-600 mt-1 bg-white p-2 rounded shadow-sm border border-gray-100 relative">
                                        <div className="absolute -left-1.5 top-2 w-1.5 h-1.5 bg-white border-l border-t border-gray-100 rotate-45" />
                                        "{h.justificativa_faltas}"
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
