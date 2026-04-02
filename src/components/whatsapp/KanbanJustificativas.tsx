import React, { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { whatsappBotService } from '@/domains/whatsappBot';
import type { JustificativaPendente, JustificativaStatus } from '@/domains/whatsappBot/types';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import { toast } from 'sonner';
import { Check, X, Clock, MessageSquare, AlertCircle, Trash2 } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import ModalMotivoRecusa from './ModalMotivoRecusa';

export default function KanbanJustificativas() {
    const { user } = useAuth();
    const [justificativas, setJustificativas] = useState<JustificativaPendente[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isProcessing, setIsProcessing] = useState<string | null>(null);

    // Modal de Recusa
    const [recusaModalOpen, setRecusaModalOpen] = useState(false);
    const [recusaTarget, setRecusaTarget] = useState<JustificativaPendente | null>(null);

    // Dialog de exclusão
    const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
    const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);

    const escolaId = user?.escola_id;

    useEffect(() => {
        if (!escolaId) return;
        fetchJustificativas();

        // Subscribe to real-time changes
        const channel = supabase
            .channel('public:whatsapp_justificativas')
            .on('postgres_changes', { 
                event: '*', 
                schema: 'public', 
                table: 'whatsapp_justificativas',
                filter: `escola_id=eq.${escolaId}` 
            }, () => {
                fetchJustificativas();
            })
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [escolaId]);

    const fetchJustificativas = async () => {
        try {
            // @ts-ignore
            const { data, error } = await supabase
                .from('whatsapp_justificativas')
                .select(`
                    id, escola_id, aluno_id, data_falta, telefone_origem, 
                    mensagem_pai, status, data_recebimento, reviewer_id, data_revisao,
                    alunos ( nome, matricula, turmas ( nome ) )
                `)
                .eq('escola_id', escolaId)
                .order('data_recebimento', { ascending: false });

            if (error) throw error;

            // Transform relational data match the TS interface
            const formatted = (data || []).map((item: any) => ({
                ...item,
                aluno: item.alunos ? {
                    nome: item.alunos.nome,
                    matricula: item.alunos.matricula,
                    turma: item.alunos.turmas ? { nome: item.alunos.turmas.nome } : undefined
                } : undefined
            }));

            setJustificativas(formatted);
        } catch (error: any) {
            console.error('Error fetching justificativas:', error);
            toast.error('Erro ao carregar as justificativas pendentes.');
        } finally {
            setIsLoading(false);
        }
    };

    const handleAction = async (id: string, newStatus: JustificativaStatus) => {
        setIsProcessing(id);
        try {
            // @ts-ignore
            const { data, error } = await supabase.rpc('processar_justificativa_kanban', {
                p_justificativa_id: id,
                p_novo_status: newStatus,
                p_reviewer_id: user?.id
            });

            if (error) throw error;

            toast.success(`Justificativa ${newStatus === 'APROVADA' ? 'aprovada' : 'recusada'} com sucesso!`);
            // Optimistic update
            setJustificativas(prev => prev.map(j => j.id === id ? { ...j, status: newStatus } : j));
        } catch (error: any) {
            console.error(`Error processing justificativa:`, error);
            toast.error('Erro ao processar justificativa.');
        } finally {
            setIsProcessing(null);
        }
    };

    // =====================
    // RECUSA COM MODAL
    // =====================

    const handleRecusarClick = (j: JustificativaPendente) => {
        setRecusaTarget(j);
        setRecusaModalOpen(true);
    };

    const handleRecusaConfirm = async (motivo: string) => {
        if (!recusaTarget || !escolaId) return;

        const j = recusaTarget;
        const nomeAluno = j.aluno?.nome || 'Aluno';
        const telefone = j.telefone_origem;

        // 1. Processar recusa via RPC
        await handleAction(j.id, 'RECUSADA');

        // 2. Enviar notificação para o responsável via WhatsApp
        try {
            const mensagem = `🤖 *Aviso da Escola:*\n\nOlá, a justificativa de falta do aluno(a) *${nomeAluno}* foi *recusada* pelo seguinte motivo:\n\n_"${motivo}"_\n\nEntre em contato com a secretaria da escola para mais informações.`;

            await whatsappBotService.sendManual(escolaId, {
                telefone,
                mensagem,
            });

            toast.success('Responsável notificado via WhatsApp.');
        } catch (err: any) {
            console.error('Erro ao enviar notificação de recusa:', err);
            toast.error('Recusa processada, mas houve erro ao notificar o responsável.');
        }

        // 3. Deletar o ticket do Kanban para limpeza
        try {
            // @ts-ignore
            const { error: deleteError } = await supabase
                .from('whatsapp_justificativas')
                .delete()
                .eq('id', j.id);

            if (deleteError) throw deleteError;

            // Remover do state local
            setJustificativas(prev => prev.filter(item => item.id !== j.id));
        } catch (err: any) {
            console.error('Erro ao deletar justificativa recusada:', err);
            // Não é crítico — já foi recusada
        }

        setRecusaTarget(null);
    };

    // =====================
    // EXCLUIR JUSTIFICATIVA
    // =====================
    const handleDeleteClick = (id: string) => {
        setDeleteTargetId(id);
        setDeleteDialogOpen(true);
    };

    const handleConfirmDelete = async () => {
        if (!deleteTargetId) return;
        setIsDeleting(true);
        try {
            // @ts-ignore
            const { error } = await supabase
                .from('whatsapp_justificativas')
                .delete()
                .eq('id', deleteTargetId);

            if (error) throw error;

            setJustificativas(prev => prev.filter(j => j.id !== deleteTargetId));
            toast.success('Justificativa excluída.');
            setDeleteDialogOpen(false);
            setDeleteTargetId(null);
        } catch (err: any) {
            console.error('Erro ao excluir justificativa:', err);
            toast.error('Erro ao excluir justificativa.');
        } finally {
            setIsDeleting(false);
        }
    };

    const pendentes = justificativas.filter(j => j.status === 'PENDENTE');
    const aprovadas = justificativas.filter(j => j.status === 'APROVADA');
    const recusadas = justificativas.filter(j => j.status === 'RECUSADA');

    if (isLoading) {
        return (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 animate-pulse">
                {[1, 2, 3].map(i => (
                    <div key={i} className="bg-slate-100 rounded-xl p-4 h-96">
                        <Skeleton className="h-6 w-1/2 mb-4 bg-slate-200" />
                        <Skeleton className="h-32 w-full mb-3 bg-slate-200" />
                        <Skeleton className="h-32 w-full bg-slate-200" />
                    </div>
                ))}
            </div>
        );
    }

    return (
        <>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 h-[calc(100vh-280px)] overflow-hidden">
                {/* Coluna PENDENTE */}
                <div className="flex flex-col bg-slate-50 border border-slate-200 rounded-xl overflow-hidden shadow-sm">
                    <div className="bg-slate-100 border-b border-slate-200 p-3 flex justify-between items-center shrink-0">
                        <h3 className="font-semibold text-slate-700 flex items-center gap-2">
                            <Clock className="w-4 h-4 text-orange-500" /> Novas Justificativas
                        </h3>
                        <Badge variant="secondary" className="bg-orange-100 text-orange-700 hover:bg-orange-100">{pendentes.length}</Badge>
                    </div>
                    <div className="p-3 overflow-y-auto flex-1 space-y-3 custom-scrollbar">
                        {pendentes.length === 0 ? (
                            <div className="h-full flex flex-col items-center justify-center text-slate-400 p-6 text-center">
                                <MessageSquare className="w-8 h-8 opacity-20 mb-2" />
                                <p className="text-sm">Nenhuma justificativa nova aguardando aprovação.</p>
                            </div>
                        ) : (
                            pendentes.map(j => (
                                <JustificativaCard 
                                    key={j.id} 
                                    j={j} 
                                    isProcessing={isProcessing === j.id} 
                                    onAction={handleAction} 
                                    onRecusar={handleRecusarClick}
                                    onDelete={handleDeleteClick}
                                />
                            ))
                        )}
                    </div>
                </div>

                {/* Coluna APROVADAS */}
                <div className="flex flex-col bg-emerald-50/30 border border-emerald-100 rounded-xl overflow-hidden shadow-sm">
                    <div className="bg-emerald-100/50 border-b border-emerald-200 p-3 flex justify-between items-center shrink-0">
                        <h3 className="font-semibold text-emerald-800 flex items-center gap-2">
                            <Check className="w-4 h-4 text-emerald-600" /> Aprovadas (Falta Abonada)
                        </h3>
                        <Badge variant="secondary" className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100">{aprovadas.length}</Badge>
                    </div>
                    <div className="p-3 overflow-y-auto flex-1 space-y-3 custom-scrollbar opacity-80 hover:opacity-100 transition-opacity">
                        {aprovadas.map(j => (
                            <JustificativaCard key={j.id} j={j} isProcessing={false} onAction={handleAction} onRecusar={handleRecusarClick} onDelete={handleDeleteClick} readOnly />
                        ))}
                    </div>
                </div>

                {/* Coluna RECUSADAS */}
                <div className="flex flex-col bg-rose-50/30 border border-rose-100 rounded-xl overflow-hidden shadow-sm">
                    <div className="bg-rose-100/50 border-b border-rose-200 p-3 flex justify-between items-center shrink-0">
                        <h3 className="font-semibold text-rose-800 flex items-center gap-2">
                            <X className="w-4 h-4 text-rose-600" /> Recusadas
                        </h3>
                        <Badge variant="secondary" className="bg-rose-100 text-rose-700 hover:bg-rose-100">{recusadas.length}</Badge>
                    </div>
                    <div className="p-3 overflow-y-auto flex-1 space-y-3 custom-scrollbar opacity-80 hover:opacity-100 transition-opacity">
                        {recusadas.map(j => (
                            <JustificativaCard key={j.id} j={j} isProcessing={false} onAction={handleAction} onRecusar={handleRecusarClick} onDelete={handleDeleteClick} readOnly />
                        ))}
                    </div>
                </div>
            </div>

            {/* Modal de Recusa */}
            <ModalMotivoRecusa
                open={recusaModalOpen}
                onClose={() => { setRecusaModalOpen(false); setRecusaTarget(null); }}
                onConfirm={handleRecusaConfirm}
                alunoNome={recusaTarget?.aluno?.nome || 'Aluno'}
                telefonePai={recusaTarget?.telefone_origem || ''}
            />

            {/* Dialog de Confirmação de Exclusão */}
            <ConfirmDialog
                open={deleteDialogOpen}
                onOpenChange={(open) => { setDeleteDialogOpen(open); if (!open) setDeleteTargetId(null); }}
                title="Excluir Justificativa"
                description="Tem certeza que deseja excluir esta justificativa? Esta ação não pode ser desfeita."
                confirmLabel="Excluir"
                variant="destructive"
                onConfirm={handleConfirmDelete}
                loading={isDeleting}
            />
        </>
    );
}

// -------------------------------------------------------------
// Componente Interno do Card
// -------------------------------------------------------------
function JustificativaCard({ 
    j, 
    isProcessing, 
    onAction, 
    onRecusar,
    onDelete,
    readOnly = false 
}: { 
    j: JustificativaPendente, 
    isProcessing: boolean, 
    onAction: (id: string, status: JustificativaStatus) => void,
    onRecusar: (j: JustificativaPendente) => void,
    onDelete: (id: string) => void,
    readOnly?: boolean
}) {
    // Formata a data (ex: '15 de Março')
    const dataFaltaFmt = format(new Date(j.data_falta + 'T12:00:00Z'), "dd 'de' MMMM", { locale: ptBR });
    const horaRecib = format(new Date(j.data_recebimento), "HH:mm");

    return (
        <Card className="p-3 border-slate-200 shadow-sm bg-white hover:shadow-md transition-shadow relative group">
            {/* Botão excluir */}
            <button
                onClick={() => onDelete(j.id)}
                className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity text-slate-400 hover:text-rose-500 p-1 rounded"
                title="Excluir justificativa"
            >
                <Trash2 className="w-3.5 h-3.5" />
            </button>

            <div className="flex justify-between items-start mb-2">
                <div>
                    <h4 className="font-semibold text-slate-800 text-sm">{j.aluno?.nome || 'Aluno Desconhecido'}</h4>
                    <p className="text-xs text-slate-500 font-medium">Turma: {j.aluno?.turma?.nome || 'Sem turma'}</p>
                </div>
                <span className="text-[10px] text-slate-400 bg-slate-50 px-1.5 py-0.5 rounded border border-slate-100 mr-5">Às {horaRecib}</span>
            </div>

            <div className="bg-indigo-50/50 border border-indigo-100 rounded-md p-2.5 my-3 relative">
                <div className="absolute -left-1.5 top-3 w-3 h-3 bg-indigo-50/50 border-t border-l border-indigo-100 transform -rotate-45"></div>
                <p className="text-sm text-slate-700 italic">"{j.mensagem_pai}"</p>
                <p className="text-[10px] text-slate-400 mt-2 flex items-center justify-end">
                    Originado de: {j.telefone_origem}
                </p>
            </div>

            <div className="flex gap-2 items-center text-xs text-slate-600 bg-orange-50/50 p-1.5 rounded text-center justify-center border border-orange-100/50">
                <AlertCircle className="w-3 h-3 text-orange-500" />
                Referente à falta de: <strong>{dataFaltaFmt}</strong>
            </div>

            {!readOnly && (
                <div className="grid grid-cols-2 gap-2 mt-3 pt-3 border-t border-slate-100">
                    <Button 
                        size="sm" 
                        variant="outline" 
                        className="text-rose-600 border-rose-200 hover:bg-rose-50 hover:text-rose-700 h-8 text-xs"
                        disabled={isProcessing}
                        onClick={() => onRecusar(j)}
                    >
                        <X className="w-3.5 h-3.5 mr-1" /> Recusar
                    </Button>
                    <Button 
                        size="sm" 
                        className="bg-emerald-500 hover:bg-emerald-600 text-white h-8 text-xs"
                        disabled={isProcessing}
                        onClick={() => onAction(j.id, 'APROVADA')}
                    >
                        <Check className="w-3.5 h-3.5 mr-1" /> Aceitar Justificativa
                    </Button>
                </div>
            )}
        </Card>
    );
}
