import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { whatsappBotService } from '@/domains/whatsappBot';
import type { WhatsAppAtendimento, AtendimentoSetor } from '@/domains/whatsappBot';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { 
    Headphones, Phone, Send, CheckCircle2, Clock, AlertCircle, 
    MessageSquare, CreditCard, FileText, GraduationCap, Coins,
    Loader2, ArrowLeft, Trash2, User
} from 'lucide-react';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

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

function formatPhone(phone: string): string {
    const cleaned = phone.replace(/\D/g, '');
    if (cleaned.length === 13 && cleaned.startsWith('55')) {
        return `(${cleaned.substring(2,4)}) ${cleaned[4]} ${cleaned.substring(5,9)}-${cleaned.substring(9)}`;
    }
    if (cleaned.length === 12 && cleaned.startsWith('55')) {
        return `(${cleaned.substring(2,4)}) ${cleaned.substring(4,8)}-${cleaned.substring(8)}`;
    }
    return phone;
}

export default function BotSecretariaSuport() {
    const { user } = useAuth();
    const escolaId = user?.escola_id || '';
    const userName = (user as any)?.user_metadata?.nome || (user as any)?.email?.split('@')[0] || 'Atendente';

    const [tickets, setTickets] = useState<WhatsAppAtendimento[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null);
    const [replyText, setReplyText] = useState('');
    const [sending, setSending] = useState(false);

    // Confirm dialogs
    const [confirmClose, setConfirmClose] = useState(false);
    const [confirmDelete, setConfirmDelete] = useState(false);
    const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);
    const [closingOrDeleting, setClosingOrDeleting] = useState(false);

    // Attendant name modal
    const [attendantName, setAttendantName] = useState(() => {
        return sessionStorage.getItem('bot_attendant_name') || '';
    });
    const [nameModalOpen, setNameModalOpen] = useState(false);
    const [tempName, setTempName] = useState('');

    const chatEndRef = useRef<HTMLDivElement>(null);

    const loadTickets = async () => {
        if (!escolaId) return;
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

    // Carregamento inicial + real-time subscription
    useEffect(() => {
        loadTickets();

        // Fallback: Atualização silenciosa a cada 5 segundos
        const intervalId = setInterval(() => {
            loadTickets();
        }, 5000);

        const channel = supabase
            .channel('atendimentos-realtime')
            .on('postgres_changes', {
                event: '*',
                schema: 'public',
                table: 'whatsapp_atendimentos',
                filter: `escola_id=eq.${escolaId}`
            }, (payload) => {
                // Real-time: atualizar tickets ao vivo
                if (payload.eventType === 'INSERT') {
                    setTickets(prev => [payload.new as WhatsAppAtendimento, ...prev]);
                } else if (payload.eventType === 'UPDATE') {
                    setTickets(prev => prev.map(t => 
                        t.id === (payload.new as any).id ? { ...t, ...(payload.new as WhatsAppAtendimento) } : t
                    ));
                } else if (payload.eventType === 'DELETE') {
                    setTickets(prev => prev.filter(t => t.id !== (payload.old as any).id));
                    if (selectedTicketId === (payload.old as any).id) {
                        setSelectedTicketId(null);
                    }
                }
            })
            .subscribe();

        return () => { 
            clearInterval(intervalId);
            supabase.removeChannel(channel); 
        };
    }, [escolaId]);

    // Auto-scroll
    useEffect(() => {
        if (chatEndRef.current) {
            chatEndRef.current.scrollIntoView({ behavior: 'smooth' });
        }
    }, [tickets, selectedTicketId]);

    const selectedTicket = tickets.find(t => t.id === selectedTicketId);

    // ═══ ENVIAR RESPOSTA ═══
    const handleReply = async () => {
        if (!replyText.trim() || sending || !selectedTicket) return;
        
        const nameToUse = attendantName.trim() || userName;
        executeReply(nameToUse);
    };

    const executeReply = async (nameToUse: string) => {
        setSending(true);
        try {
            const mensagemFinal = `*${nameToUse}:* ${replyText.trim()}`;
            
            // Atualização Otimista (Aparece na hora)
            const novaResposta = {
                remetente: 'secretaria' as 'secretaria',
                mensagem: mensagemFinal,
                atendente: nameToUse,
                timestamp: new Date().toISOString()
            };
            setTickets(prev => prev.map(t => {
                if (t.id === selectedTicket!.id) {
                    return { ...t, respostas: [...(t.respostas || []), novaResposta] };
                }
                return t;
            }));

            await whatsappBotService.replyAtendimento(
                escolaId, selectedTicket!.id, selectedTicket!.telefone_origem, mensagemFinal, nameToUse
            );

            setReplyText('');
        } catch (err: any) {
            toast.error('Erro ao enviar: ' + err.message);
        } finally {
            setSending(false);
        }
    };

    const handleSaveName = () => {
        if (!tempName.trim()) {
            toast.error('Por favor, informe seu nome.');
            return;
        }
        setAttendantName(tempName.trim());
        sessionStorage.setItem('bot_attendant_name', tempName.trim());
        setNameModalOpen(false);
        executeReply(tempName.trim());
    };

    // ═══ FINALIZAR ATENDIMENTO ═══
    const handleConfirmClose = async () => {
        if (!selectedTicket) return;
        setClosingOrDeleting(true);
        try {
            const nameToUse = attendantName.trim() || userName || 'Secretaria';
            await whatsappBotService.replyAtendimento(
                escolaId, selectedTicket.id, selectedTicket.telefone_origem, 
                `*${nameToUse}:* Atendimento finalizado pela escola. Agradecemos o contato!`, 
                nameToUse
            );
            await whatsappBotService.closeAtendimento(selectedTicket.id);

            // Atualização Otimista
            setTickets(prev => prev.map(t => t.id === selectedTicket.id ? { ...t, status: 'FINALIZADO' } : t));
            
            toast.success('Atendimento finalizado!');
            setConfirmClose(false);
        } catch (err: any) {
            toast.error('Erro ao finalizar: ' + err.message);
        } finally {
            setClosingOrDeleting(false);
        }
    };

    // ═══ EXCLUIR CONVERSA ═══
    const handleConfirmDelete = async () => {
        if (!deleteTargetId) return;
        setClosingOrDeleting(true);
        try {
            // @ts-ignore
            const { error } = await supabase
                .from('whatsapp_atendimentos')
                .delete()
                .eq('id', deleteTargetId);

            if (error) throw error;

            setTickets(prev => prev.filter(t => t.id !== deleteTargetId));
            if (selectedTicketId === deleteTargetId) setSelectedTicketId(null);
            toast.success('Conversa excluída.');
            setConfirmDelete(false);
            setDeleteTargetId(null);
        } catch (err: any) {
            toast.error('Erro ao excluir: ' + err.message);
        } finally {
            setClosingOrDeleting(false);
        }
    };

    const openTickets = tickets.filter(t => t.status !== 'FINALIZADO');
    const closedTickets = tickets.filter(t => t.status === 'FINALIZADO');
    const sortedTickets = [...openTickets, ...closedTickets];

    return (
        <>
        <div className="bg-white rounded-2xl border shadow-sm overflow-hidden flex flex-col" style={{ height: 'calc(100vh - 260px)', minHeight: 500 }}>
            {/* Header */}
            <div className="p-4 border-b flex justify-between items-center bg-gradient-to-r from-violet-50 to-indigo-50 shrink-0">
                <div className="flex items-center gap-3">
                    <Headphones className="w-5 h-5 text-violet-500" />
                    <div>
                        <h2 className="text-base font-semibold text-slate-800">Central de Atendimento</h2>
                        <p className="text-xs text-slate-500">Conversas ao vivo com responsáveis via WhatsApp</p>
                    </div>
                    {openTickets.length > 0 && (
                        <Badge className="bg-violet-100 text-violet-700 hover:bg-violet-100 text-xs">
                            {openTickets.length} aberto{openTickets.length !== 1 ? 's' : ''}
                        </Badge>
                    )}
                </div>
                <Button variant="outline" onClick={loadTickets} disabled={loading} size="sm">Atualizar</Button>
            </div>

            {/* Body */}
            <div className="flex flex-1 overflow-hidden">
                {/* ═══ LISTA LATERAL ═══ */}
                <div className={`w-full md:w-[360px] border-r flex flex-col bg-slate-50/50 shrink-0 ${selectedTicketId ? 'hidden md:flex' : 'flex'}`}>
                    {loading && tickets.length === 0 ? (
                        <div className="p-4 space-y-3">
                            {[1,2,3].map(i => <Skeleton key={i} className="h-20 w-full rounded-lg" />)}
                        </div>
                    ) : tickets.length === 0 ? (
                        <div className="flex-1 flex flex-col items-center justify-center text-slate-400 p-6">
                            <Headphones className="w-10 h-10 mb-2 opacity-20" />
                            <p className="text-sm font-medium">Nenhuma solicitação</p>
                            <p className="text-xs mt-1 text-center">Pedidos via WhatsApp aparecerão aqui.</p>
                        </div>
                    ) : (
                        <div className="overflow-y-auto flex-1">
                            {sortedTickets.map(ticket => {
                                const setorCfg = SETOR_CONFIG[ticket.setor] || SETOR_CONFIG.carteirinha;
                                const isClosed = ticket.status === 'FINALIZADO';
                                const isSelected = selectedTicketId === ticket.id;
                                const lastMsg = ticket.respostas?.length > 0 
                                    ? ticket.respostas[ticket.respostas.length - 1] : null;
                                const unread = ticket.status === 'ABERTO';

                                return (
                                    <div key={ticket.id} className={`relative group ${isSelected ? 'bg-indigo-50/80 border-l-2 border-l-indigo-500' : ''} ${isClosed ? 'opacity-50' : ''}`}>
                                        <button
                                            onClick={() => setSelectedTicketId(ticket.id)}
                                            className="w-full text-left p-3.5 border-b border-slate-100 transition-all hover:bg-white"
                                        >
                                            <div className="flex items-start justify-between mb-1">
                                                <div className="flex items-center gap-2 min-w-0">
                                                    {unread && <span className="w-2 h-2 bg-violet-500 rounded-full shrink-0" />}
                                                    <span className="font-semibold text-sm text-slate-800 truncate">
                                                        {ticket.nome_contato || formatPhone(ticket.telefone_origem)}
                                                    </span>
                                                </div>
                                                <span className="text-[10px] text-slate-400 whitespace-nowrap ml-2">
                                                    {format(new Date(ticket.updated_at || ticket.created_at), 'HH:mm')}
                                                </span>
                                            </div>
                                            <div className="flex items-center gap-1.5 mb-1">
                                                <Badge variant="outline" className={`text-[9px] px-1.5 py-0 border ${setorCfg.color}`}>
                                                    {setorCfg.label}
                                                </Badge>
                                            </div>
                                            <p className="text-xs text-slate-500 truncate">
                                                {lastMsg 
                                                    ? `${lastMsg.remetente === 'secretaria' ? '🏫' : '👤'} ${lastMsg.mensagem}`
                                                    : ticket.mensagem_inicial || 'Nova solicitação'
                                                }
                                            </p>
                                        </button>
                                        {/* Botão excluir (aparece no hover) */}
                                        <button
                                            onClick={(e) => { e.stopPropagation(); setDeleteTargetId(ticket.id); setConfirmDelete(true); }}
                                            className="absolute top-3 right-10 opacity-0 group-hover:opacity-100 transition-opacity text-slate-400 hover:text-rose-500 p-1 rounded"
                                            title="Excluir conversa"
                                        >
                                            <Trash2 className="w-3.5 h-3.5" />
                                        </button>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>

                {/* ═══ CHAT ═══ */}
                <div className={`flex-1 flex flex-col ${!selectedTicketId ? 'hidden md:flex' : 'flex'}`}>
                    {!selectedTicket ? (
                        <div className="flex-1 flex flex-col items-center justify-center text-slate-300 bg-[#f0f2f5]">
                            <MessageSquare className="w-16 h-16 mb-4 opacity-30" />
                            <p className="text-lg font-medium text-slate-400">Selecione um atendimento</p>
                            <p className="text-sm text-slate-400 mt-1">Escolha uma conversa na lista ao lado</p>
                        </div>
                    ) : (
                        <>
                            {/* Chat Header */}
                            <div className="px-4 py-3 bg-white border-b flex items-center justify-between shrink-0">
                                <div className="flex items-center gap-3">
                                    <button onClick={() => setSelectedTicketId(null)} className="md:hidden text-slate-500 hover:text-slate-700">
                                        <ArrowLeft className="w-5 h-5" />
                                    </button>
                                    <div className="w-9 h-9 rounded-full bg-gradient-to-br from-indigo-400 to-violet-500 flex items-center justify-center text-white font-bold text-sm">
                                        {(selectedTicket.nome_contato || '?')[0].toUpperCase()}
                                    </div>
                                    <div>
                                        <h3 className="font-semibold text-sm text-slate-800">
                                            {selectedTicket.nome_contato || formatPhone(selectedTicket.telefone_origem)}
                                        </h3>
                                        <div className="flex items-center gap-2">
                                            <span className="text-[11px] text-slate-500 flex items-center gap-1">
                                                <Phone className="w-3 h-3" />{formatPhone(selectedTicket.telefone_origem)}
                                            </span>
                                            <Badge variant="outline" className={`text-[9px] px-1.5 py-0 border ${STATUS_CONFIG[selectedTicket.status]?.color}`}>
                                                {STATUS_CONFIG[selectedTicket.status]?.label}
                                            </Badge>
                                        </div>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2">
                                    <Button variant="ghost" size="sm" className="text-slate-400 hover:text-rose-500 h-8 w-8 p-0"
                                        onClick={() => { setDeleteTargetId(selectedTicket.id); setConfirmDelete(true); }}>
                                        <Trash2 className="w-4 h-4" />
                                    </Button>
                                    {selectedTicket.status !== 'FINALIZADO' && (
                                        <Button variant="outline" size="sm"
                                            className="border-green-200 text-green-700 hover:bg-green-50"
                                            onClick={() => setConfirmClose(true)}>
                                            <CheckCircle2 className="w-4 h-4 mr-1" /> Finalizar
                                        </Button>
                                    )}
                                </div>
                            </div>

                            {/* Chat Messages */}
                            <div className="flex-1 overflow-y-auto p-4 space-y-3" style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg width=\'60\' height=\'60\' viewBox=\'0 0 60 60\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cg fill=\'none\' fill-rule=\'evenodd\'%3E%3Cg fill=\'%23e2e8f0\' fill-opacity=\'0.3\'%3E%3Cpath d=\'M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z\'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")', backgroundColor: '#f0f2f5' }}>
                                
                                <div className="flex justify-center">
                                    <Badge variant="outline" className={`text-xs px-3 py-1 border ${SETOR_CONFIG[selectedTicket.setor]?.color}`}>
                                        {SETOR_CONFIG[selectedTicket.setor]?.icon}
                                        <span className="ml-1.5">{SETOR_CONFIG[selectedTicket.setor]?.label}</span>
                                    </Badge>
                                </div>

                                <div className="flex justify-center">
                                    <span className="text-[10px] text-slate-400 bg-white/80 px-3 py-1 rounded-full shadow-sm">
                                        {format(new Date(selectedTicket.created_at), "dd 'de' MMMM 'às' HH:mm", { locale: ptBR })}
                                    </span>
                                </div>

                                {/* Mensagem inicial */}
                                {selectedTicket.mensagem_inicial && (
                                    <div className="flex justify-start">
                                        <div className="bg-white rounded-lg rounded-tl-sm shadow-sm p-3 max-w-[75%] border border-slate-100">
                                            <p className="text-[10px] font-semibold text-indigo-600 mb-1">👤 {selectedTicket.nome_contato || 'Responsável'}</p>
                                            <p className="text-sm text-slate-700 whitespace-pre-wrap">{selectedTicket.mensagem_inicial}</p>
                                            <p className="text-[10px] text-slate-400 text-right mt-1">{format(new Date(selectedTicket.created_at), 'HH:mm')}</p>
                                        </div>
                                    </div>
                                )}

                                {/* Thread */}
                                {selectedTicket.respostas?.map((r: any, i: number) => {
                                    const isSecretaria = r.remetente === 'secretaria';
                                    return (
                                        <div key={i} className={`flex ${isSecretaria ? 'justify-end' : 'justify-start'}`}>
                                            <div className={`rounded-lg shadow-sm p-3 max-w-[75%] ${
                                                isSecretaria 
                                                    ? 'bg-[#d9fdd3] rounded-tr-sm border border-green-100' 
                                                    : 'bg-white rounded-tl-sm border border-slate-100'
                                            }`}>
                                                <p className={`text-[10px] font-semibold mb-1 ${isSecretaria ? 'text-green-700' : 'text-indigo-600'}`}>
                                                    {isSecretaria 
                                                        ? `🏫 ${r.atendente || 'Secretaria'}` 
                                                        : `👤 ${selectedTicket.nome_contato || 'Responsável'}`
                                                    }
                                                </p>
                                                <p className="text-sm text-slate-700 whitespace-pre-wrap">{r.mensagem}</p>
                                                <p className="text-[10px] text-slate-400 text-right mt-1">
                                                    {r.timestamp ? format(new Date(r.timestamp), 'HH:mm') : ''}
                                                </p>
                                            </div>
                                        </div>
                                    );
                                })}
                                <div ref={chatEndRef} />
                            </div>

                            {/* Input */}
                            {selectedTicket.status !== 'FINALIZADO' ? (
                                <div className="px-4 py-3 bg-white border-t flex flex-col gap-2 shrink-0">
                                    <div className="flex gap-2">
                                        <div className="text-xs font-semibold text-slate-500 self-center">Assinar como:</div>
                                        <input
                                            type="text"
                                            value={attendantName}
                                            onChange={(e) => { 
                                                setAttendantName(e.target.value); 
                                                sessionStorage.setItem('bot_attendant_name', e.target.value);
                                            }}
                                            placeholder="Seu nome"
                                            className="border rounded-md px-2 py-1 text-xs w-32 focus:outline-none focus:border-indigo-300 bg-slate-50"
                                        />
                                    </div>
                                    <div className="flex items-end gap-2">
                                        <textarea
                                            placeholder="Digite sua resposta..."
                                            value={replyText}
                                            onChange={(e) => setReplyText(e.target.value)}
                                            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleReply(); } }}
                                            className="flex-1 resize-none rounded-xl border border-slate-200 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-200 focus:border-indigo-300 min-h-[44px] max-h-[120px]"
                                            rows={1}
                                            disabled={sending}
                                        />
                                        <Button
                                            onClick={handleReply}
                                            disabled={!replyText.trim() || sending}
                                            className="bg-[#25D366] hover:bg-[#128C7E] text-white rounded-full h-11 w-11 p-0 shrink-0"
                                        >
                                            {sending ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
                                        </Button>
                                    </div>
                                </div>
                            ) : (
                                <div className="px-4 py-3 bg-slate-50 border-t text-center shrink-0">
                                    <p className="text-xs text-slate-400">✅ Atendimento finalizado</p>
                                </div>
                            )}
                        </>
                    )}
                </div>
            </div>
        </div>

        {/* Dialogs */}
        <ConfirmDialog
            open={confirmClose}
            onOpenChange={setConfirmClose}
            title="Finalizar Atendimento"
            description="Deseja finalizar este atendimento? O responsável não poderá mais enviar mensagens nesta conversa."
            confirmLabel="Finalizar"
            variant="default"
            onConfirm={handleConfirmClose}
            loading={closingOrDeleting}
        />
        <ConfirmDialog
            open={confirmDelete}
            onOpenChange={(open) => { setConfirmDelete(open); if (!open) setDeleteTargetId(null); }}
            title="Excluir Conversa"
            description="Tem certeza que deseja excluir esta conversa? Todas as mensagens serão removidas permanentemente. Esta ação não pode ser desfeita."
            confirmLabel="Excluir"
            variant="destructive"
            onConfirm={handleConfirmDelete}
            loading={closingOrDeleting}
        />

        <Dialog open={nameModalOpen} onOpenChange={setNameModalOpen}>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <User className="w-5 h-5 text-indigo-500" />
                        Identificação do Atendente
                    </DialogTitle>
                    <DialogDescription>
                        Por favor, informe seu nome. Ele aparecerá nas mensagens enviadas aos responsáveis.
                    </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                    <div className="grid gap-2">
                        <Label htmlFor="name">Seu nome</Label>
                        <Input
                            id="name"
                            value={tempName}
                            onChange={(e) => setTempName(e.target.value)}
                            placeholder="Ex: Maria"
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                    e.preventDefault();
                                    handleSaveName();
                                }
                            }}
                        />
                    </div>
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={() => setNameModalOpen(false)}>Cancelar</Button>
                    <Button onClick={handleSaveName} className="bg-indigo-600 hover:bg-indigo-700">Começar a Atender</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
        </>
    );
}
