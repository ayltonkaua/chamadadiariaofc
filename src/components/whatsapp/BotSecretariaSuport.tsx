import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { whatsappBotService } from '@/domains/whatsappBot';
import type { WhatsAppAtendimento, AtendimentoSetor } from '@/domains/whatsappBot';
import { toast } from 'sonner';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { 
    Headphones, Phone, Send, CheckCircle2, Clock, AlertCircle, 
    MessageSquare, CreditCard, FileText, GraduationCap, Coins,
    Loader2, X
} from 'lucide-react';

const SETOR_CONFIG: Record<AtendimentoSetor, { label: string; icon: React.ReactNode; color: string }> = {
    carteirinha: { label: 'Carteira de Estudante', icon: <CreditCard className="w-4 h-4" />, color: 'bg-blue-100 text-blue-700 border-blue-200' },
    boletim: { label: 'Histórico / Boletim', icon: <GraduationCap className="w-4 h-4" />, color: 'bg-purple-100 text-purple-700 border-purple-200' },
    declaracao: { label: 'Declaração de Escolaridade', icon: <FileText className="w-4 h-4" />, color: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
    pe_de_meia: { label: 'Pé-de-Meia', icon: <Coins className="w-4 h-4" />, color: 'bg-amber-100 text-amber-700 border-amber-200' },
};

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
    ABERTO: { label: 'Aberto', color: 'bg-yellow-100 text-yellow-800 border-yellow-200', icon: <AlertCircle className="w-3.5 h-3.5" /> },
    EM_ATENDIMENTO: { label: 'Em Atendimento', color: 'bg-blue-100 text-blue-800 border-blue-200', icon: <Clock className="w-3.5 h-3.5" /> },
    FINALIZADO: { label: 'Finalizado', color: 'bg-green-100 text-green-800 border-green-200', icon: <CheckCircle2 className="w-3.5 h-3.5" /> },
};

export default function BotSecretariaSuport() {
    const { user } = useAuth();
    const escolaId = user?.escola_id || '';
    const [tickets, setTickets] = useState<WhatsAppAtendimento[]>([]);
    const [loading, setLoading] = useState(true);
    const [replyingId, setReplyingId] = useState<string | null>(null);
    const [replyText, setReplyText] = useState('');
    const [sending, setSending] = useState(false);
    const [closing, setClosing] = useState<string | null>(null);

    const loadTickets = async () => {
        if (!escolaId) return;
        setLoading(true);
        try {
            const data = await whatsappBotService.getAtendimentos(escolaId);
            setTickets(data);
        } catch (err: any) {
            console.error('Error loading atendimentos:', err);
            toast.error('Erro ao carregar atendimentos.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadTickets();

        // Subscribe to real-time changes
        const channel = supabase
            .channel('public:whatsapp_atendimentos')
            .on('postgres_changes', {
                event: '*',
                schema: 'public',
                table: 'whatsapp_atendimentos',
                filter: `escola_id=eq.${escolaId}`
            }, () => {
                loadTickets();
            })
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [escolaId]);

    const handleReply = async (ticket: WhatsAppAtendimento) => {
        if (!replyText.trim() || sending) return;
        setSending(true);
        try {
            await whatsappBotService.replyAtendimento(escolaId, ticket.id, ticket.telefone_origem, replyText.trim());
            toast.success('Mensagem enviada ao responsável!');
            setReplyText('');
            setReplyingId(null);
            loadTickets();
        } catch (err: any) {
            toast.error('Erro ao enviar mensagem: ' + err.message);
        } finally {
            setSending(false);
        }
    };

    const handleClose = async (ticketId: string) => {
        setClosing(ticketId);
        try {
            await whatsappBotService.closeAtendimento(ticketId);
            toast.success('Atendimento finalizado!');
            setTickets(prev => prev.map(t => t.id === ticketId ? { ...t, status: 'FINALIZADO' as any } : t));
        } catch (err: any) {
            toast.error('Erro ao finalizar: ' + err.message);
        } finally {
            setClosing(null);
        }
    };

    const openTickets = tickets.filter(t => t.status !== 'FINALIZADO');
    const closedTickets = tickets.filter(t => t.status === 'FINALIZADO');

    return (
        <div className="bg-white rounded-2xl border shadow-sm min-h-[500px] flex flex-col overflow-hidden">
            {/* Header */}
            <div className="p-6 border-b flex justify-between items-center bg-gradient-to-r from-violet-50 to-indigo-50">
                <div>
                    <h2 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
                        <Headphones className="w-5 h-5 text-violet-500" />
                        Central de Atendimento — Secretaria
                    </h2>
                    <p className="text-sm text-slate-500 mt-1">
                        Gerencie solicitações dos responsáveis recebidas via WhatsApp.
                    </p>
                </div>
                <div className="flex items-center gap-3">
                    {openTickets.length > 0 && (
                        <Badge className="bg-violet-100 text-violet-700 hover:bg-violet-100 text-xs">
                            {openTickets.length} aberto{openTickets.length !== 1 ? 's' : ''}
                        </Badge>
                    )}
                    <Button variant="outline" onClick={loadTickets} disabled={loading} size="sm">
                        Atualizar
                    </Button>
                </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-auto p-6 bg-slate-50/30">
                {loading && tickets.length === 0 ? (
                    <div className="space-y-4">
                        {[1, 2, 3].map(i => <Skeleton key={i} className="h-36 w-full rounded-xl" />)}
                    </div>
                ) : tickets.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-slate-400 py-16">
                        <Headphones className="w-12 h-12 mb-3 text-slate-200" />
                        <p className="text-lg font-medium text-slate-600">Nenhuma solicitação</p>
                        <p className="text-sm mt-1">Quando responsáveis enviarem pedidos via menu do WhatsApp, eles aparecerão aqui.</p>
                    </div>
                ) : (
                    <div className="space-y-4">
                        {/* Tickets abertos primeiro */}
                        {openTickets.map(ticket => (
                            <TicketCard
                                key={ticket.id}
                                ticket={ticket}
                                isReplying={replyingId === ticket.id}
                                replyText={replyText}
                                sending={sending}
                                closing={closing === ticket.id}
                                onToggleReply={() => {
                                    setReplyingId(replyingId === ticket.id ? null : ticket.id);
                                    setReplyText('');
                                }}
                                onReplyTextChange={setReplyText}
                                onSendReply={() => handleReply(ticket)}
                                onClose={() => handleClose(ticket.id)}
                            />
                        ))}

                        {/* Divider */}
                        {closedTickets.length > 0 && openTickets.length > 0 && (
                            <div className="flex items-center gap-3 py-2">
                                <div className="flex-1 h-px bg-slate-200" />
                                <span className="text-xs text-slate-400 font-medium">Finalizados</span>
                                <div className="flex-1 h-px bg-slate-200" />
                            </div>
                        )}

                        {/* Tickets finalizados */}
                        {closedTickets.map(ticket => (
                            <TicketCard
                                key={ticket.id}
                                ticket={ticket}
                                isReplying={false}
                                replyText=""
                                sending={false}
                                closing={false}
                                onToggleReply={() => {}}
                                onReplyTextChange={() => {}}
                                onSendReply={() => {}}
                                onClose={() => {}}
                            />
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}

// ─────────────────────────────────────────────
// Ticket Card Component
// ─────────────────────────────────────────────
function TicketCard({
    ticket,
    isReplying,
    replyText,
    sending,
    closing,
    onToggleReply,
    onReplyTextChange,
    onSendReply,
    onClose,
}: {
    ticket: WhatsAppAtendimento;
    isReplying: boolean;
    replyText: string;
    sending: boolean;
    closing: boolean;
    onToggleReply: () => void;
    onReplyTextChange: (text: string) => void;
    onSendReply: () => void;
    onClose: () => void;
}) {
    const setorCfg = SETOR_CONFIG[ticket.setor] || SETOR_CONFIG.carteirinha;
    const statusCfg = STATUS_CONFIG[ticket.status] || STATUS_CONFIG.ABERTO;
    const isClosed = ticket.status === 'FINALIZADO';
    const date = new Date(ticket.created_at);

    return (
        <Card className={`p-5 hover:shadow-md transition-shadow relative overflow-hidden ${isClosed ? 'opacity-60 grayscale-[20%]' : ''}`}>
            {ticket.status === 'ABERTO' && (
                <div className="absolute top-0 left-0 w-1 h-full bg-yellow-400" />
            )}
            {ticket.status === 'EM_ATENDIMENTO' && (
                <div className="absolute top-0 left-0 w-1 h-full bg-blue-400" />
            )}

            <div className="flex flex-col gap-3">
                {/* Header: Setor + Status + Time */}
                <div className="flex items-center gap-2 flex-wrap">
                    <Badge variant="outline" className={`flex items-center gap-1.5 px-2.5 py-0.5 border ${setorCfg.color}`}>
                        {setorCfg.icon}
                        {setorCfg.label}
                    </Badge>
                    <Badge variant="outline" className={`flex items-center gap-1.5 px-2.5 py-0.5 border ${statusCfg.color}`}>
                        {statusCfg.icon}
                        {statusCfg.label}
                    </Badge>
                    <span className="text-xs text-slate-400 ml-auto">
                        {format(date, "dd 'de' MMMM 'às' HH:mm", { locale: ptBR })}
                    </span>
                </div>

                {/* Contact Info */}
                <div className="flex items-center gap-2 text-sm text-slate-600">
                    <div className="flex items-center gap-1.5 text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-md">
                        <Phone className="w-3.5 h-3.5" />
                        {ticket.telefone_origem}
                    </div>
                    {ticket.nome_contato && (
                        <>
                            <span className="text-slate-300">•</span>
                            <span className="font-medium text-slate-700">{ticket.nome_contato}</span>
                        </>
                    )}
                </div>

                {/* Message */}
                {ticket.mensagem_inicial && (
                    <div className="bg-slate-50 border border-slate-100 p-3 rounded-lg text-sm text-slate-700 whitespace-pre-wrap">
                        {ticket.mensagem_inicial}
                    </div>
                )}

                {/* Respostas (thread) */}
                {ticket.respostas && ticket.respostas.length > 0 && (
                    <div className="space-y-2 pl-3 border-l-2 border-indigo-200">
                        {ticket.respostas.map((r: any, i: number) => (
                            <div key={i} className={`text-sm p-2 rounded-lg ${
                                r.remetente === 'secretaria' 
                                    ? 'bg-indigo-50 text-indigo-800 border border-indigo-100' 
                                    : 'bg-slate-50 text-slate-700 border border-slate-100'
                            }`}>
                                <div className="flex justify-between items-center mb-1">
                                    <span className="text-[10px] font-semibold uppercase">
                                        {r.remetente === 'secretaria' ? '🏫 Secretaria' : '👤 Responsável'}
                                    </span>
                                    <span className="text-[10px] text-slate-400">
                                        {r.timestamp ? format(new Date(r.timestamp), 'HH:mm', { locale: ptBR }) : ''}
                                    </span>
                                </div>
                                <p className="whitespace-pre-wrap">{r.mensagem}</p>
                            </div>
                        ))}
                    </div>
                )}

                {/* Actions */}
                {!isClosed && (
                    <div className="flex gap-2 pt-2 border-t border-slate-100">
                        <Button
                            variant="default"
                            className="bg-[#25D366] hover:bg-[#128C7E] text-white border-0 shadow-sm"
                            size="sm"
                            onClick={onToggleReply}
                        >
                            <MessageSquare className="w-4 h-4 mr-1.5" />
                            {isReplying ? 'Cancelar' : 'Responder'}
                        </Button>
                        <Button
                            variant="outline"
                            className="border-slate-200 text-slate-600 hover:text-green-600 hover:border-green-200 hover:bg-green-50"
                            size="sm"
                            onClick={onClose}
                            disabled={closing}
                        >
                            {closing ? (
                                <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />
                            ) : (
                                <CheckCircle2 className="w-4 h-4 mr-1.5" />
                            )}
                            Finalizar
                        </Button>
                    </div>
                )}

                {/* Reply Area */}
                {isReplying && (
                    <div className="flex gap-2 animate-in slide-in-from-top-2 duration-200">
                        <Textarea
                            placeholder="Digite sua resposta ao responsável..."
                            value={replyText}
                            onChange={(e) => onReplyTextChange(e.target.value)}
                            className="min-h-[80px] text-sm resize-none flex-1"
                            disabled={sending}
                        />
                        <Button
                            onClick={onSendReply}
                            disabled={!replyText.trim() || sending}
                            className="bg-indigo-600 hover:bg-indigo-700 text-white self-end"
                            size="sm"
                        >
                            {sending ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                                <Send className="w-4 h-4" />
                            )}
                        </Button>
                    </div>
                )}
            </div>
        </Card>
    );
}
