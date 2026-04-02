import React, { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { whatsappBotService } from '@/domains/whatsappBot';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import { 
    Check, X, Clock, UserPlus, Phone, GraduationCap, 
    User, BookOpen, Filter, RefreshCw 
} from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

// =====================
// Types
// =====================

type CadastroStatus = 'PENDENTE' | 'APROVADO' | 'REJEITADO';

interface PreCadastro {
    id: string;
    escola_id: string;
    aluno_id: string;
    nome_responsavel: string;
    telefone_responsavel: string;
    status: CadastroStatus;
    created_at: string;
    revisado_por: string | null;
    revisado_em: string | null;
    // Relational
    aluno?: {
        nome: string;
        matricula: string;
        telefone_responsavel: string | null;
        telefone_responsavel_2: string | null;
        turma?: {
            nome: string;
        };
    };
}

// =====================
// Helpers
// =====================

function formatPhone(phone: string): string {
    const cleaned = phone.replace(/\D/g, '');
    if (cleaned.length === 13 && cleaned.startsWith('55')) {
        const ddd = cleaned.substring(2, 4);
        const p1 = cleaned.substring(4, 5);
        const p2 = cleaned.substring(5, 9);
        const p3 = cleaned.substring(9, 13);
        return `(${ddd}) ${p1} ${p2}-${p3}`;
    }
    if (cleaned.length === 12 && cleaned.startsWith('55')) {
        const ddd = cleaned.substring(2, 4);
        const p1 = cleaned.substring(4, 8);
        const p2 = cleaned.substring(8, 12);
        return `(${ddd}) ${p1}-${p2}`;
    }
    return phone;
}

// =====================
// Main Component
// =====================

export default function BotCadastroResponsavel() {
    const { user } = useAuth();
    const escolaId = user?.escola_id;

    const [cadastros, setCadastros] = useState<PreCadastro[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isProcessing, setIsProcessing] = useState<string | null>(null);
    const [filtroStatus, setFiltroStatus] = useState<CadastroStatus | 'TODOS'>('PENDENTE');

    // =====================
    // Data Fetching
    // =====================
    useEffect(() => {
        if (!escolaId) return;
        fetchCadastros();

        // Real-time
        const channel = supabase
            .channel('public:whatsapp_pre_cadastros')
            .on('postgres_changes', {
                event: '*',
                schema: 'public',
                table: 'whatsapp_pre_cadastros',
                filter: `escola_id=eq.${escolaId}`,
            }, () => {
                fetchCadastros();
            })
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [escolaId]);

    const fetchCadastros = async () => {
        if (!escolaId) return;
        try {
            // @ts-ignore — tabela nova não está nos tipos auto-gerados
            const { data, error } = await supabase
                .from('whatsapp_pre_cadastros')
                .select(`
                    id, escola_id, aluno_id, nome_responsavel, telefone_responsavel,
                    status, created_at, revisado_por, revisado_em,
                    alunos ( nome, matricula, telefone_responsavel, telefone_responsavel_2, turmas ( nome ) )
                `)
                .eq('escola_id', escolaId)
                .order('created_at', { ascending: false });

            if (error) throw error;

            const formatted = (data || []).map((item: any) => ({
                ...item,
                aluno: item.alunos ? {
                    nome: item.alunos.nome,
                    matricula: item.alunos.matricula,
                    telefone_responsavel: item.alunos.telefone_responsavel,
                    telefone_responsavel_2: item.alunos.telefone_responsavel_2,
                    turma: item.alunos.turmas ? { nome: item.alunos.turmas.nome } : undefined,
                } : undefined,
            }));

            setCadastros(formatted);
        } catch (error: any) {
            console.error('Error fetching pre-cadastros:', error);
            toast.error('Erro ao carregar pré-cadastros.');
        } finally {
            setIsLoading(false);
        }
    };

    // =====================
    // Aprovar — grava no aluno e atualiza status
    // =====================
    const handleAprovar = async (cadastro: PreCadastro) => {
        if (!user?.id || !escolaId) return;
        setIsProcessing(cadastro.id);

        try {
            const aluno = cadastro.aluno;
            if (!aluno) throw new Error('Aluno não encontrado');

            // Decidir em qual campo gravar o telefone
            const updatePayload: Record<string, string> = {
                nome_responsavel: cadastro.nome_responsavel,
            };

            if (!aluno.telefone_responsavel) {
                updatePayload.telefone_responsavel = cadastro.telefone_responsavel;
            } else if (!aluno.telefone_responsavel_2) {
                updatePayload.telefone_responsavel_2 = cadastro.telefone_responsavel;
            } else {
                updatePayload.telefone_responsavel = cadastro.telefone_responsavel;
            }

            // 1. Atualizar o aluno
            // @ts-ignore
            const { error: updateError } = await supabase
                .from('alunos')
                .update(updatePayload)
                .eq('id', cadastro.aluno_id);

            if (updateError) throw updateError;

            // 2. Marcar como aprovado
            // @ts-ignore
            const { error: statusError } = await supabase
                .from('whatsapp_pre_cadastros')
                .update({
                    status: 'APROVADO',
                    revisado_por: user.id,
                    revisado_em: new Date().toISOString(),
                })
                .eq('id', cadastro.id);

            if (statusError) throw statusError;

            // 3. Notificar o responsável via WhatsApp
            try {
                const nomeAluno = aluno.nome || 'seu filho(a)';
                const mensagem = `✅ *Cadastro Aprovado!*\n\nOlá, *${cadastro.nome_responsavel}*!\n\nSeu cadastro como responsável do(a) aluno(a) *${nomeAluno}* foi *aprovado* pela secretaria. \n\nAgora você pode utilizar todos os recursos do bot, incluindo justificativas de faltas. Basta enviar uma mensagem a qualquer momento!`;

                await whatsappBotService.sendManual(escolaId, {
                    telefone: cadastro.telefone_responsavel,
                    mensagem,
                });
            } catch (notifErr: any) {
                console.error('Erro ao notificar aprovação:', notifErr);
                // Não bloquear a aprovação por falha na notificação
            }

            toast.success(`Cadastro de ${cadastro.nome_responsavel} aprovado! Responsável notificado via WhatsApp.`);

            setCadastros(prev => prev.map(c =>
                c.id === cadastro.id ? { ...c, status: 'APROVADO' as CadastroStatus } : c
            ));
        } catch (error: any) {
            console.error('Error approving cadastro:', error);
            toast.error('Erro ao aprovar cadastro: ' + error.message);
        } finally {
            setIsProcessing(null);
        }
    };

    // =====================
    // Rejeitar
    // =====================
    const handleRejeitar = async (cadastro: PreCadastro) => {
        if (!user?.id || !escolaId) return;
        
        const motivo = prompt(`Motivo da rejeição do cadastro de ${cadastro.nome_responsavel}:`);
        if (!motivo) return; // Cancelou o prompt
        
        setIsProcessing(cadastro.id);

        try {
            // 1. Marcar como rejeitado
            // @ts-ignore
            const { error } = await supabase
                .from('whatsapp_pre_cadastros')
                .update({
                    status: 'REJEITADO',
                    revisado_por: user.id,
                    revisado_em: new Date().toISOString(),
                })
                .eq('id', cadastro.id);

            if (error) throw error;

            // 2. Notificar o responsável via WhatsApp com o motivo
            try {
                const nomeAluno = cadastro.aluno?.nome || 'o aluno informado';
                const mensagem = `❌ *Cadastro Não Aprovado*\n\nOlá, *${cadastro.nome_responsavel}*!\n\nSeu cadastro como responsável do(a) aluno(a) *${nomeAluno}* não foi aprovado pela secretaria.\n\n*Motivo:* _"${motivo}"_\n\nPara mais informações, entre em contato com a secretaria da escola presencialmente.`;

                await whatsappBotService.sendManual(escolaId, {
                    telefone: cadastro.telefone_responsavel,
                    mensagem,
                });
                toast.success('Cadastro rejeitado. Responsável notificado via WhatsApp.');
            } catch (notifErr: any) {
                console.error('Erro ao notificar rejeição:', notifErr);
                toast.success('Cadastro rejeitado, mas houve erro ao notificar o responsável.');
            }

            setCadastros(prev => prev.map(c =>
                c.id === cadastro.id ? { ...c, status: 'REJEITADO' as CadastroStatus } : c
            ));
        } catch (error: any) {
            console.error('Error rejecting cadastro:', error);
            toast.error('Erro ao rejeitar cadastro.');
        } finally {
            setIsProcessing(null);
        }
    };

    // =====================
    // Filtro
    // =====================
    const filteredCadastros = filtroStatus === 'TODOS'
        ? cadastros
        : cadastros.filter(c => c.status === filtroStatus);

    const pendentesCount = cadastros.filter(c => c.status === 'PENDENTE').length;

    // =====================
    // Render
    // =====================
    if (isLoading) {
        return (
            <div className="space-y-4">
                {[1, 2, 3].map(i => (
                    <Skeleton key={i} className="h-32 w-full rounded-xl" />
                ))}
            </div>
        );
    }

    return (
        <div className="space-y-5">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-violet-500 to-violet-600 flex items-center justify-center shadow-sm">
                        <UserPlus className="h-5 w-5 text-white" />
                    </div>
                    <div>
                        <h2 className="text-lg font-bold text-slate-800">Cadastro de Responsáveis</h2>
                        <p className="text-xs text-slate-500">Pré-cadastros recebidos via WhatsApp aguardando aprovação</p>
                    </div>
                    {pendentesCount > 0 && (
                        <Badge className="bg-orange-100 text-orange-700 hover:bg-orange-100 border-orange-200 ml-2">
                            {pendentesCount} pendente{pendentesCount > 1 ? 's' : ''}
                        </Badge>
                    )}
                </div>

                <div className="flex items-center gap-2">
                    {/* Filtros */}
                    <div className="flex bg-slate-100 rounded-lg p-0.5 gap-0.5">
                        {([
                            { value: 'PENDENTE', label: 'Pendentes', icon: Clock },
                            { value: 'APROVADO', label: 'Aprovados', icon: Check },
                            { value: 'REJEITADO', label: 'Rejeitados', icon: X },
                            { value: 'TODOS', label: 'Todos', icon: Filter },
                        ] as const).map(({ value, label, icon: Icon }) => (
                            <button
                                key={value}
                                onClick={() => setFiltroStatus(value)}
                                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all flex items-center gap-1 ${
                                    filtroStatus === value
                                        ? 'bg-white text-slate-800 shadow-sm'
                                        : 'text-slate-500 hover:text-slate-700'
                                }`}
                            >
                                <Icon className="w-3 h-3" />
                                {label}
                            </button>
                        ))}
                    </div>

                    <Button
                        variant="outline"
                        size="sm"
                        onClick={fetchCadastros}
                        className="h-8 px-3"
                    >
                        <RefreshCw className="w-3.5 h-3.5 mr-1" />
                        Atualizar
                    </Button>
                </div>
            </div>

            {/* Empty State */}
            {filteredCadastros.length === 0 && (
                <div className="flex flex-col items-center justify-center py-16 text-slate-400">
                    <UserPlus className="w-12 h-12 opacity-20 mb-3" />
                    <p className="text-sm font-medium">
                        {filtroStatus === 'PENDENTE' 
                            ? 'Nenhum cadastro pendente de aprovação'
                            : 'Nenhum cadastro encontrado com este filtro'}
                    </p>
                    <p className="text-xs mt-1 opacity-70">
                        Novos cadastros aparecerão aqui automaticamente quando pais se cadastrarem via WhatsApp
                    </p>
                </div>
            )}

            {/* Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {filteredCadastros.map(cadastro => (
                    <CadastroCard
                        key={cadastro.id}
                        cadastro={cadastro}
                        isProcessing={isProcessing === cadastro.id}
                        onAprovar={handleAprovar}
                        onRejeitar={handleRejeitar}
                    />
                ))}
            </div>
        </div>
    );
}

// =====================
// Card Component
// =====================
function CadastroCard({
    cadastro,
    isProcessing,
    onAprovar,
    onRejeitar,
}: {
    cadastro: PreCadastro;
    isProcessing: boolean;
    onAprovar: (c: PreCadastro) => void;
    onRejeitar: (c: PreCadastro) => void;
}) {
    const dataCriacao = format(new Date(cadastro.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR });
    const isPendente = cadastro.status === 'PENDENTE';
    const isAprovado = cadastro.status === 'APROVADO';
    const isRejeitado = cadastro.status === 'REJEITADO';

    const borderColor = isPendente
        ? 'border-orange-200 hover:border-orange-300'
        : isAprovado
            ? 'border-emerald-200'
            : 'border-rose-200';

    const statusBadge = isPendente
        ? <Badge className="bg-orange-100 text-orange-700 hover:bg-orange-100 text-[10px] px-2 py-0.5">Pendente</Badge>
        : isAprovado
            ? <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100 text-[10px] px-2 py-0.5">Aprovado</Badge>
            : <Badge className="bg-rose-100 text-rose-700 hover:bg-rose-100 text-[10px] px-2 py-0.5">Rejeitado</Badge>;

    return (
        <Card className={`p-4 ${borderColor} shadow-sm bg-white hover:shadow-md transition-all`}>
            {/* Header */}
            <div className="flex justify-between items-start mb-3">
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                        <User className="w-4 h-4 text-violet-500 flex-shrink-0" />
                        <h4 className="font-semibold text-slate-800 text-sm truncate">
                            {cadastro.nome_responsavel}
                        </h4>
                    </div>
                    <p className="text-[11px] text-slate-400 ml-6">{dataCriacao}</p>
                </div>
                {statusBadge}
            </div>

            {/* Info Grid */}
            <div className="space-y-2 mb-3">
                <div className="flex items-center gap-2 bg-slate-50 rounded-lg p-2.5">
                    <GraduationCap className="w-4 h-4 text-indigo-500 flex-shrink-0" />
                    <div className="min-w-0">
                        <p className="text-xs text-slate-500 leading-none mb-0.5">Aluno(a)</p>
                        <p className="text-sm font-medium text-slate-800 truncate">
                            {cadastro.aluno?.nome || 'Desconhecido'}
                        </p>
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                    <div className="flex items-center gap-2 bg-slate-50 rounded-lg p-2.5">
                        <BookOpen className="w-3.5 h-3.5 text-amber-500 flex-shrink-0" />
                        <div className="min-w-0">
                            <p className="text-[10px] text-slate-500 leading-none mb-0.5">Turma</p>
                            <p className="text-xs font-medium text-slate-700 truncate">
                                {cadastro.aluno?.turma?.nome || 'Sem turma'}
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2 bg-slate-50 rounded-lg p-2.5">
                        <Phone className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0" />
                        <div className="min-w-0">
                            <p className="text-[10px] text-slate-500 leading-none mb-0.5">Telefone</p>
                            <p className="text-xs font-medium text-slate-700 truncate">
                                {formatPhone(cadastro.telefone_responsavel)}
                            </p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Actions */}
            {isPendente && (
                <div className="grid grid-cols-2 gap-2 pt-3 border-t border-slate-100">
                    <Button
                        size="sm"
                        variant="outline"
                        className="text-rose-600 border-rose-200 hover:bg-rose-50 hover:text-rose-700 h-8 text-xs"
                        disabled={isProcessing}
                        onClick={() => onRejeitar(cadastro)}
                    >
                        <X className="w-3.5 h-3.5 mr-1" /> Rejeitar
                    </Button>
                    <Button
                        size="sm"
                        className="bg-emerald-500 hover:bg-emerald-600 text-white h-8 text-xs"
                        disabled={isProcessing}
                        onClick={() => onAprovar(cadastro)}
                    >
                        <Check className="w-3.5 h-3.5 mr-1" /> Aprovar
                    </Button>
                </div>
            )}

            {/* Approved/Rejected info */}
            {!isPendente && cadastro.revisado_em && (
                <div className={`text-[10px] pt-2 border-t border-slate-100 ${isAprovado ? 'text-emerald-600' : 'text-rose-500'}`}>
                    {isAprovado ? '✅' : '❌'} {isAprovado ? 'Aprovado' : 'Rejeitado'} em{' '}
                    {format(new Date(cadastro.revisado_em), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                </div>
            )}
        </Card>
    );
}
