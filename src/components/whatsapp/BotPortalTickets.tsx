import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { MessageSquare, Phone, CheckCircle2, Clock, AlertCircle } from 'lucide-react';

interface Solicitacao {
    id: string;
    assunto: string;
    mensagem: string;
    telefone_contato: string;
    status: string;
    created_at: string;
    alunos: { nome: string } | null;
}

export default function BotPortalTickets() {
    const { user } = useAuth();
    const escolaId = user?.escola_id || '';
    const [tickets, setTickets] = useState<Solicitacao[]>([]);
    const [loading, setLoading] = useState(true);

    const loadTickets = async () => {
        if (!escolaId) return;
        setLoading(true);
        try {
            const { data, error } = await (supabase as any)
                .from('solicitacoes_aluno')
                .select(`
                    id, assunto, mensagem, telefone_contato, status, created_at,
                    alunos ( nome )
                `)
                .eq('escola_id', escolaId)
                .order('created_at', { ascending: false });

            if (error) throw error;
            
            // Filtro local: esconder solicitações concluídas há mais de 24h caso o cron ainda não tenha rodado
            const now = new Date();
            const filteredData = (data as Solicitacao[]).filter(ticket => {
                if (ticket.status.toLowerCase() === 'concluído' || ticket.status.toLowerCase() === 'fechado') {
                    const ticketDate = new Date(ticket.created_at);
                    const diffHours = (now.getTime() - ticketDate.getTime()) / (1000 * 60 * 60);
                    if (diffHours > 24) return false;
                }
                return true;
            });

            setTickets(filteredData);
        } catch (error: any) {
            console.error('Error fetching tickets:', error);
            toast({ title: 'Erro ao carregar solicitações', description: error.message, variant: 'destructive' });
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadTickets();
    }, [escolaId]);

    const handleAtender = async (ticket: Solicitacao) => {
        const tel = ticket.telefone_contato?.replace(/\D/g, '') || '';
        if (!tel) {
            toast({ title: 'Erro', description: 'O aluno não informou um número de telefone válido.', variant: 'destructive' });
            return;
        }

        // Marcar como "Em andamento"
        if (ticket.status === 'aberto' || ticket.status === 'pendente') {
            await (supabase as any)
                .from('solicitacoes_aluno')
                .update({ status: 'em andamento' })
                .eq('id', ticket.id);
            setTickets(curr => curr.map(t => t.id === ticket.id ? { ...t, status: 'em andamento' } : t));
        }

        // Montar mensagem preenchida
        const msg = encodeURIComponent(`Olá ${ticket.alunos?.nome || 'Aluno(a)'}! Estou entrando em contato referente à sua solicitação no Portal do Aluno: *${ticket.assunto}*.\n\nComo posso ajudar?`);
        window.open(`https://wa.me/55${tel}?text=${msg}`, '_blank');
    };

    const handleConcluir = async (id: string) => {
        try {
            const { error } = await (supabase as any)
                .from('solicitacoes_aluno')
                .update({ status: 'concluído' })
                .eq('id', id);
            
            if (error) throw error;
            
            toast({ title: 'Ticket Fechado', description: 'Solicitação marcada como concluída.' });
            setTickets(curr => curr.map(t => t.id === id ? { ...t, status: 'concluído' } : t));
        } catch (err: any) {
            toast({ title: 'Erro', description: err.message, variant: 'destructive' });
        }
    };

    const getStatusStyle = (status: string) => {
        const s = status.toLowerCase();
        if (s === 'aberto' || s === 'pendente') return 'bg-yellow-100 text-yellow-800 border-yellow-200';
        if (s === 'em andamento') return 'bg-blue-100 text-blue-800 border-blue-200';
        if (s === 'concluído' || s === 'fechado' || s === 'resolvido') return 'bg-green-100 text-green-800 border-green-200';
        return 'bg-gray-100 text-gray-800 border-gray-200';
    };

    const getStatusIcon = (status: string) => {
        const s = status.toLowerCase();
        if (s === 'aberto' || s === 'pendente') return <AlertCircle className="w-3.5 h-3.5" />;
        if (s === 'em andamento') return <Clock className="w-3.5 h-3.5" />;
        if (s === 'concluído' || s === 'fechado' || s === 'resolvido') return <CheckCircle2 className="w-3.5 h-3.5" />;
        return null;
    };

    return (
        <div className="bg-white rounded-2xl border shadow-sm h-[calc(100vh-280px)] min-h-[500px] flex flex-col overflow-hidden">
            <div className="p-6 border-b flex justify-between items-center bg-gray-50/50">
                <div>
                    <h2 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
                        <MessageSquare className="w-5 h-5 text-indigo-500" />
                        Solicitações do Portal Aluno
                    </h2>
                    <p className="text-sm text-slate-500 mt-1">Gerencie os tickets de suporte abertos pelos alunos.</p>
                </div>
                <Button variant="outline" onClick={loadTickets} disabled={loading} size="sm">
                    Atualizar
                </Button>
            </div>

            <div className="flex-1 overflow-auto p-6 bg-slate-50/30">
                {loading ? (
                    <div className="space-y-4">
                        {[1, 2, 3].map(i => <Skeleton key={i} className="h-32 w-full rounded-xl" />)}
                    </div>
                ) : tickets.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-slate-400">
                        <MessageSquare className="w-12 h-12 mb-3 text-slate-200" />
                        <p className="text-lg font-medium text-slate-600">Nenhuma solicitação encontrada</p>
                        <p className="text-sm">Os tickets abertos pelos alunos aparecerão aqui.</p>
                    </div>
                ) : (
                    <div className="grid gap-4">
                        {tickets.map(ticket => {
                            const date = new Date(ticket.created_at);
                            const isClosed = ticket.status.toLowerCase() === 'concluído' || ticket.status.toLowerCase() === 'fechado';

                            return (
                                <div key={ticket.id} className={`bg-white border rounded-xl p-5 hover:shadow-md transition-shadow relative overflow-hidden ${isClosed ? 'opacity-70 grayscale-[30%]' : ''}`}>
                                    {ticket.status.toLowerCase() === 'aberto' && (
                                        <div className="absolute top-0 right-0 w-2 h-full bg-yellow-400" />
                                    )}
                                    <div className="flex flex-col sm:flex-row justify-between gap-4">
                                        <div className="flex-1">
                                            <div className="flex items-center gap-3 mb-2">
                                                <Badge variant="outline" className={`capitalize flex items-center gap-1.5 px-2.5 py-0.5 border ${getStatusStyle(ticket.status)}`}>
                                                    {getStatusIcon(ticket.status)}
                                                    {ticket.status}
                                                </Badge>
                                                <span className="text-xs text-slate-500">
                                                    {format(date, "dd 'de' MMMM 'às' HH:mm", { locale: ptBR })}
                                                </span>
                                            </div>
                                            
                                            <h3 className="font-semibold text-slate-800 text-lg mb-1">{ticket.assunto}</h3>
                                            
                                            <div className="flex items-center gap-2 mb-3 text-sm text-slate-600">
                                                <span className="font-medium text-slate-700">{ticket.alunos?.nome || 'Aluno Desconhecido'}</span>
                                                <span className="text-slate-300">•</span>
                                                <div className="flex items-center gap-1.5 text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-md">
                                                    <Phone className="w-3.5 h-3.5" />
                                                    {ticket.telefone_contato || 'Não informado'}
                                                </div>
                                            </div>

                                            <div className="bg-slate-50 border border-slate-100 p-3 rounded-lg text-sm text-slate-700 whitespace-pre-wrap">
                                                {ticket.mensagem}
                                            </div>
                                        </div>

                                        <div className="flex sm:flex-col gap-2 min-w-[160px]">
                                            <Button 
                                                variant="default" 
                                                className="w-full bg-[#25D366] hover:bg-[#128C7E] text-white border-0 shadow-sm transition-all"
                                                onClick={() => handleAtender(ticket)}
                                            >
                                                <MessageSquare className="w-4 h-4 mr-2" />
                                                Atender WhatsApp
                                            </Button>

                                            {!isClosed && (
                                                <Button 
                                                    variant="outline" 
                                                    className="w-full border-slate-200 text-slate-600 hover:text-green-600 hover:border-green-200 hover:bg-green-50"
                                                    onClick={() => handleConcluir(ticket.id)}
                                                >
                                                    <CheckCircle2 className="w-4 h-4 mr-2" />
                                                    Marcar Concluído
                                                </Button>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
}
