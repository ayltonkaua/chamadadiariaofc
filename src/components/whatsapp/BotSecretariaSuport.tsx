import { useState, useEffect, useRef, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { whatsappBotService } from '@/domains/whatsappBot';
import type { WhatsAppAtendimento, AtendimentoSetor, ContactInfo } from '@/domains/whatsappBot';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import { format, formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { 
    Headphones, Phone, Send, CheckCircle2, Clock, AlertCircle, 
    MessageSquare, CreditCard, FileText, GraduationCap, Coins,
    Loader2, ArrowLeft, Trash2, User, Search, X, Info,
    ChevronRight, Zap, TicketCheck, Hash, Calendar, PhoneCall
} from 'lucide-react';
import { Input } from "@/components/ui/input";

// ═══════════════════════════════════════════════════
// CONFIG MAPS
// ═══════════════════════════════════════════════════

const SETOR_CONFIG: Record<AtendimentoSetor, { label: string; icon: React.ReactNode; color: string; bg: string }> = {
    carteirinha: { label: 'Carteirinha', icon: <CreditCard className="w-3.5 h-3.5" />, color: 'text-sky-700', bg: 'bg-sky-50 border-sky-200' },
    boletim: { label: 'Boletim', icon: <GraduationCap className="w-3.5 h-3.5" />, color: 'text-violet-700', bg: 'bg-violet-50 border-violet-200' },
    declaracao: { label: 'Declaração', icon: <FileText className="w-3.5 h-3.5" />, color: 'text-emerald-700', bg: 'bg-emerald-50 border-emerald-200' },
    pe_de_meia: { label: 'Pé-de-Meia', icon: <Coins className="w-3.5 h-3.5" />, color: 'text-amber-700', bg: 'bg-amber-50 border-amber-200' },
};

const STATUS_CONFIG: Record<string, { label: string; dotColor: string; bgColor: string; textColor: string }> = {
    ABERTO: { label: 'Novo', dotColor: 'bg-orange-400', bgColor: 'bg-orange-50', textColor: 'text-orange-700' },
    EM_ATENDIMENTO: { label: 'Em Atendimento', dotColor: 'bg-blue-400', bgColor: 'bg-blue-50', textColor: 'text-blue-700' },
    FINALIZADO: { label: 'Finalizado', dotColor: 'bg-green-400', bgColor: 'bg-green-50', textColor: 'text-green-700' },
};

const QUICK_REPLIES = [
    '✅ Seu documento está pronto para retirada!',
    '📋 Estamos verificando, retornamos em breve.',
    '📞 Por favor, entre em contato presencialmente.',
    '📎 Envie uma foto do documento necessário.',
];

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

function getInitials(name: string | null): string {
    if (!name) return '?';
    return name.split(' ').map(w => w[0]).filter(Boolean).slice(0, 2).join('').toUpperCase();
}

function getAvatarColor(phone: string): string {
    const colors = [
        'from-violet-500 to-purple-600',
        'from-blue-500 to-indigo-600',
        'from-emerald-500 to-teal-600',
        'from-rose-500 to-pink-600',
        'from-amber-500 to-orange-600',
        'from-cyan-500 to-sky-600',
    ];
    const hash = phone.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);
    return colors[hash % colors.length];
}

// ═══════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════

export default function BotSecretariaSuport() {
    const { user } = useAuth();
    const escolaId = user?.escola_id || '';
    const userName = (user as any)?.user_metadata?.nome || (user as any)?.email?.split('@')[0] || 'Atendente';

    // ── State ──
    const [tickets, setTickets] = useState<WhatsAppAtendimento[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null);
    const [replyText, setReplyText] = useState('');
    const [sending, setSending] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [statusFilter, setStatusFilter] = useState<'all' | 'ABERTO' | 'EM_ATENDIMENTO' | 'FINALIZADO'>('all');
    const [showInfoPanel, setShowInfoPanel] = useState(true);
    const [contactInfo, setContactInfo] = useState<ContactInfo | null>(null);
    const [loadingContact, setLoadingContact] = useState(false);

    // Confirm dialogs
    const [confirmClose, setConfirmClose] = useState(false);
    const [confirmDelete, setConfirmDelete] = useState(false);
    const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);
    const [closingOrDeleting, setClosingOrDeleting] = useState(false);

    // Attendant name
    const [attendantName, setAttendantName] = useState(() => {
        return sessionStorage.getItem('bot_attendant_name') || '';
    });

    const chatEndRef = useRef<HTMLDivElement>(null);
    const prevTicketCountRef = useRef(0);

    // ── Load Tickets ──
    const loadTickets = async () => {
        if (!escolaId) return;
        try {
            const data = await whatsappBotService.getAtendimentos(escolaId);
            
            // Notification sound for new tickets
            if (prevTicketCountRef.current > 0 && data.length > prevTicketCountRef.current) {
                try {
                    const audio = new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbsGcxJE+Uy9u4diY1TY7L2754MitRkc3byHsmMU6OytjCfiYxUI/M2cN+KTBQj8vYwX0mMFCPzNjBfSYwUI/M2MF9JjBQj8zYwX0mME+PzNjBfSYwUI/M2cJ+');
                    audio.volume = 0.3;
                    audio.play().catch(() => {});
                } catch {}
            }
            prevTicketCountRef.current = data.length;
            
            setTickets(data);
        } catch {
            toast.error('Erro ao carregar atendimentos.');
        } finally {
            setLoading(false);
        }
    };

    // ── Real-time ──
    useEffect(() => {
        loadTickets();
        const intervalId = setInterval(loadTickets, 5000);

        const channel = supabase
            .channel('atendimentos-crm')
            .on('postgres_changes', {
                event: '*',
                schema: 'public',
                table: 'whatsapp_atendimentos',
                filter: `escola_id=eq.${escolaId}`
            }, (payload) => {
                if (payload.eventType === 'INSERT') {
                    setTickets(prev => [payload.new as WhatsAppAtendimento, ...prev]);
                } else if (payload.eventType === 'UPDATE') {
                    setTickets(prev => prev.map(t => 
                        t.id === (payload.new as any).id ? { ...t, ...(payload.new as WhatsAppAtendimento) } : t
                    ));
                } else if (payload.eventType === 'DELETE') {
                    setTickets(prev => prev.filter(t => t.id !== (payload.old as any).id));
                    if (selectedTicketId === (payload.old as any).id) setSelectedTicketId(null);
                }
            })
            .subscribe();

        return () => { 
            clearInterval(intervalId);
            supabase.removeChannel(channel); 
        };
    }, [escolaId]);

    // ── Auto-scroll ──
    useEffect(() => {
        if (chatEndRef.current) {
            chatEndRef.current.scrollIntoView({ behavior: 'smooth' });
        }
    }, [tickets, selectedTicketId]);

    // ── Load contact info when ticket is selected ──
    useEffect(() => {
        if (!selectedTicketId || !escolaId) {
            setContactInfo(null);
            return;
        }
        const ticket = tickets.find(t => t.id === selectedTicketId);
        if (!ticket) return;

        setLoadingContact(true);
        whatsappBotService.getContactInfo(escolaId, ticket.telefone_origem)
            .then(info => setContactInfo(info))
            .catch(() => setContactInfo(null))
            .finally(() => setLoadingContact(false));
    }, [selectedTicketId, escolaId]);

    // ── Filtered & sorted tickets ──
    const filteredTickets = useMemo(() => {
        let result = tickets;

        // Status filter
        if (statusFilter !== 'all') {
            result = result.filter(t => t.status === statusFilter);
        }

        // Search filter
        if (searchQuery.trim()) {
            const q = searchQuery.toLowerCase();
            result = result.filter(t => 
                (t.nome_contato || '').toLowerCase().includes(q) ||
                t.telefone_origem.includes(q) ||
                (t.mensagem_inicial || '').toLowerCase().includes(q) ||
                (SETOR_CONFIG[t.setor]?.label || '').toLowerCase().includes(q)
            );
        }

        // Sort: open first, then by updated_at desc
        return result.sort((a, b) => {
            const statusOrder: Record<string, number> = { ABERTO: 0, EM_ATENDIMENTO: 1, FINALIZADO: 2 };
            const orderDiff = (statusOrder[a.status] ?? 2) - (statusOrder[b.status] ?? 2);
            if (orderDiff !== 0) return orderDiff;
            return new Date(b.updated_at || b.created_at).getTime() - new Date(a.updated_at || a.created_at).getTime();
        });
    }, [tickets, statusFilter, searchQuery]);

    const selectedTicket = tickets.find(t => t.id === selectedTicketId);

    // ── Counters ──
    const counts = useMemo(() => ({
        aberto: tickets.filter(t => t.status === 'ABERTO').length,
        emAtendimento: tickets.filter(t => t.status === 'EM_ATENDIMENTO').length,
        finalizado: tickets.filter(t => t.status === 'FINALIZADO').length,
        total: tickets.length,
    }), [tickets]);

    // ═══ HANDLERS ═══

    const handleReply = async () => {
        if (!replyText.trim() || sending || !selectedTicket) return;
        const nameToUse = attendantName.trim() || userName;
        setSending(true);
        try {
            const mensagemFinal = `*${nameToUse}:* ${replyText.trim()}`;
            
            // Optimistic update
            const novaResposta = {
                remetente: 'secretaria' as const,
                mensagem: mensagemFinal,
                atendente: nameToUse,
                timestamp: new Date().toISOString()
            };
            setTickets(prev => prev.map(t => {
                if (t.id === selectedTicket.id) {
                    return { ...t, respostas: [...(t.respostas || []), novaResposta] };
                }
                return t;
            }));

            await whatsappBotService.replyAtendimento(
                escolaId, selectedTicket.id, selectedTicket.telefone_origem, mensagemFinal, nameToUse
            );
            setReplyText('');
        } catch (err: any) {
            toast.error('Erro ao enviar: ' + err.message);
        } finally {
            setSending(false);
        }
    };

    const handleConfirmClose = async () => {
        if (!selectedTicket) return;
        setClosingOrDeleting(true);
        try {
            const nameToUse = attendantName.trim() || userName || 'Secretaria';
            await whatsappBotService.replyAtendimento(
                escolaId, selectedTicket.id, selectedTicket.telefone_origem, 
                `*${nameToUse}:* Atendimento finalizado pela escola. Agradecemos o contato!`, nameToUse
            );
            await whatsappBotService.closeAtendimento(selectedTicket.id);
            setTickets(prev => prev.map(t => t.id === selectedTicket.id ? { ...t, status: 'FINALIZADO' } : t));
            toast.success('Atendimento finalizado!');
            setConfirmClose(false);
        } catch (err: any) {
            toast.error('Erro ao finalizar: ' + err.message);
        } finally {
            setClosingOrDeleting(false);
        }
    };

    const handleConfirmDelete = async () => {
        if (!deleteTargetId) return;
        setClosingOrDeleting(true);
        try {
            // @ts-ignore
            const { error } = await supabase.from('whatsapp_atendimentos').delete().eq('id', deleteTargetId);
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

    const handleQuickReply = (text: string) => {
        setReplyText(text);
    };

    // ═══════════════════════════════════════════════════
    // RENDER
    // ═══════════════════════════════════════════════════

    return (
        <>
        <div className="bg-white rounded-2xl border shadow-sm overflow-hidden flex flex-col" style={{ height: 'calc(100vh - 260px)', minHeight: 560 }}>

            {/* ═══ MAIN GRID ═══ */}
            <div className="flex flex-1 overflow-hidden">

                {/* ═══════════════════════════════ */}
                {/* COLUNA 1: LISTA DE CONVERSAS   */}
                {/* ═══════════════════════════════ */}
                <div className={`w-full md:w-[340px] lg:w-[360px] border-r flex flex-col bg-slate-50/80 shrink-0 ${selectedTicketId ? 'hidden md:flex' : 'flex'}`}>

                    {/* Header */}
                    <div className="p-3 border-b bg-white shrink-0">
                        <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-2">
                                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center">
                                    <Headphones className="w-4 h-4 text-white" />
                                </div>
                                <div>
                                    <h2 className="text-sm font-bold text-slate-800">Atendimentos</h2>
                                    <p className="text-[10px] text-slate-400">{counts.total} conversas</p>
                                </div>
                            </div>
                            <Button variant="ghost" size="sm" onClick={loadTickets} disabled={loading} className="h-7 w-7 p-0">
                                <Loader2 className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
                            </Button>
                        </div>

                        {/* Search */}
                        <div className="relative">
                            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                            <input
                                type="text"
                                placeholder="Buscar por nome, telefone..."
                                value={searchQuery}
                                onChange={e => setSearchQuery(e.target.value)}
                                className="w-full pl-8 pr-8 py-1.5 text-xs border rounded-lg bg-slate-50 focus:outline-none focus:ring-2 focus:ring-violet-200 focus:border-violet-300"
                            />
                            {searchQuery && (
                                <button onClick={() => setSearchQuery('')} className="absolute right-2 top-1/2 -translate-y-1/2">
                                    <X className="w-3.5 h-3.5 text-slate-400 hover:text-slate-600" />
                                </button>
                            )}
                        </div>
                    </div>

                    {/* Filter Tabs */}
                    <div className="flex border-b bg-white shrink-0">
                        {[
                            { key: 'all' as const, label: 'Todos', count: counts.total },
                            { key: 'ABERTO' as const, label: 'Novos', count: counts.aberto },
                            { key: 'EM_ATENDIMENTO' as const, label: 'Ativos', count: counts.emAtendimento },
                            { key: 'FINALIZADO' as const, label: 'Fechados', count: counts.finalizado },
                        ].map(tab => (
                            <button
                                key={tab.key}
                                onClick={() => setStatusFilter(tab.key)}
                                className={`flex-1 py-2 text-[10px] font-semibold transition-colors border-b-2 ${
                                    statusFilter === tab.key
                                        ? 'border-violet-500 text-violet-700'
                                        : 'border-transparent text-slate-400 hover:text-slate-600'
                                }`}
                            >
                                {tab.label}
                                {tab.count > 0 && (
                                    <span className={`ml-1 px-1.5 py-0.5 rounded-full text-[9px] ${
                                        statusFilter === tab.key 
                                            ? 'bg-violet-100 text-violet-700' 
                                            : 'bg-slate-100 text-slate-500'
                                    }`}>
                                        {tab.count}
                                    </span>
                                )}
                            </button>
                        ))}
                    </div>

                    {/* Ticket List */}
                    {loading && tickets.length === 0 ? (
                        <div className="p-3 space-y-2">
                            {[1,2,3,4].map(i => <Skeleton key={i} className="h-16 w-full rounded-lg" />)}
                        </div>
                    ) : filteredTickets.length === 0 ? (
                        <div className="flex-1 flex flex-col items-center justify-center text-slate-400 p-6">
                            <MessageSquare className="w-8 h-8 mb-2 opacity-20" />
                            <p className="text-xs font-medium">
                                {searchQuery ? 'Nenhum resultado' : 'Nenhuma conversa'}
                            </p>
                        </div>
                    ) : (
                        <div className="overflow-y-auto flex-1">
                            {filteredTickets.map(ticket => {
                                const setorCfg = SETOR_CONFIG[ticket.setor] || SETOR_CONFIG.carteirinha;
                                const statusCfg = STATUS_CONFIG[ticket.status] || STATUS_CONFIG.ABERTO;
                                const isSelected = selectedTicketId === ticket.id;
                                const isClosed = ticket.status === 'FINALIZADO';
                                const lastMsg = ticket.respostas?.length > 0 
                                    ? ticket.respostas[ticket.respostas.length - 1] : null;
                                const lastMsgFromParent = lastMsg?.remetente === 'pai';
                                const isNew = ticket.status === 'ABERTO';

                                return (
                                    <div 
                                        key={ticket.id} 
                                        className={`relative group transition-all ${
                                            isSelected 
                                                ? 'bg-violet-50/80 border-l-[3px] border-l-violet-500' 
                                                : 'border-l-[3px] border-l-transparent hover:bg-white'
                                        } ${isClosed ? 'opacity-60' : ''}`}
                                    >
                                        <button
                                            onClick={() => setSelectedTicketId(ticket.id)}
                                            className="w-full text-left px-3 py-3 border-b border-slate-100/80"
                                        >
                                            <div className="flex items-start gap-2.5">
                                                {/* Avatar */}
                                                <div className="relative shrink-0">
                                                    <div className={`w-10 h-10 rounded-full bg-gradient-to-br ${getAvatarColor(ticket.telefone_origem)} flex items-center justify-center text-white font-bold text-xs shadow-sm`}>
                                                        {getInitials(ticket.nome_contato)}
                                                    </div>
                                                    <span className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-white ${statusCfg.dotColor}`} />
                                                </div>

                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-center justify-between">
                                                        <span className={`font-semibold text-sm truncate ${isNew ? 'text-slate-900' : 'text-slate-700'}`}>
                                                            {ticket.nome_contato || formatPhone(ticket.telefone_origem)}
                                                        </span>
                                                        <span className="text-[10px] text-slate-400 whitespace-nowrap ml-2 shrink-0">
                                                            {format(new Date(ticket.updated_at || ticket.created_at), 'HH:mm')}
                                                        </span>
                                                    </div>

                                                    <div className="flex items-center gap-1.5 mt-0.5">
                                                        <Badge variant="outline" className={`text-[9px] px-1.5 py-0 h-4 border ${setorCfg.bg} ${setorCfg.color} font-medium`}>
                                                            {setorCfg.label}
                                                        </Badge>
                                                        {isNew && (
                                                            <Badge className="text-[9px] px-1.5 py-0 h-4 bg-orange-100 text-orange-700 hover:bg-orange-100 font-medium border-0">
                                                                Novo
                                                            </Badge>
                                                        )}
                                                    </div>

                                                    <p className={`text-[11px] mt-1 truncate ${lastMsgFromParent ? 'text-slate-700 font-medium' : 'text-slate-400'}`}>
                                                        {lastMsg 
                                                            ? `${lastMsg.remetente === 'secretaria' ? '🏫 ' : ''}${lastMsg.mensagem}`
                                                            : ticket.mensagem_inicial || 'Nova solicitação'
                                                        }
                                                    </p>
                                                </div>

                                                {/* Unread indicator */}
                                                {lastMsgFromParent && !isClosed && (
                                                    <div className="shrink-0 self-center">
                                                        <span className="w-2.5 h-2.5 bg-violet-500 rounded-full block" />
                                                    </div>
                                                )}
                                            </div>
                                        </button>

                                        {/* Delete on hover */}
                                        <button
                                            onClick={(e) => { e.stopPropagation(); setDeleteTargetId(ticket.id); setConfirmDelete(true); }}
                                            className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity text-slate-400 hover:text-rose-500 p-1 rounded"
                                        >
                                            <Trash2 className="w-3 h-3" />
                                        </button>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>

                {/* ═══════════════════════════════ */}
                {/* COLUNA 2: CHAT                 */}
                {/* ═══════════════════════════════ */}
                <div className={`flex-1 flex flex-col min-w-0 ${!selectedTicketId ? 'hidden md:flex' : 'flex'}`}>
                    {!selectedTicket ? (
                        <div className="flex-1 flex flex-col items-center justify-center bg-[#f0f2f5]">
                            <div className="w-20 h-20 rounded-full bg-slate-200/60 flex items-center justify-center mb-4">
                                <MessageSquare className="w-10 h-10 text-slate-300" />
                            </div>
                            <p className="text-lg font-semibold text-slate-400">Central de Atendimento</p>
                            <p className="text-sm text-slate-400 mt-1">Selecione uma conversa para começar</p>
                        </div>
                    ) : (
                        <>
                            {/* Chat Header */}
                            <div className="px-4 py-2.5 bg-white border-b flex items-center justify-between shrink-0 shadow-sm">
                                <div className="flex items-center gap-3">
                                    <button onClick={() => setSelectedTicketId(null)} className="md:hidden text-slate-500 hover:text-slate-700">
                                        <ArrowLeft className="w-5 h-5" />
                                    </button>
                                    <div className={`w-9 h-9 rounded-full bg-gradient-to-br ${getAvatarColor(selectedTicket.telefone_origem)} flex items-center justify-center text-white font-bold text-sm shadow-sm`}>
                                        {getInitials(selectedTicket.nome_contato)}
                                    </div>
                                    <div>
                                        <h3 className="font-semibold text-sm text-slate-800">
                                            {selectedTicket.nome_contato || formatPhone(selectedTicket.telefone_origem)}
                                        </h3>
                                        <div className="flex items-center gap-2 flex-wrap">
                                            <Badge variant="outline" className={`text-[9px] px-1.5 py-0 h-4 border ${SETOR_CONFIG[selectedTicket.setor]?.bg} ${SETOR_CONFIG[selectedTicket.setor]?.color}`}>
                                                {SETOR_CONFIG[selectedTicket.setor]?.icon}
                                                <span className="ml-1">{SETOR_CONFIG[selectedTicket.setor]?.label}</span>
                                            </Badge>
                                            <span className={`inline-flex items-center gap-1 text-[9px] font-medium px-1.5 py-0 h-4 rounded-full ${STATUS_CONFIG[selectedTicket.status]?.bgColor} ${STATUS_CONFIG[selectedTicket.status]?.textColor}`}>
                                                <span className={`w-1.5 h-1.5 rounded-full ${STATUS_CONFIG[selectedTicket.status]?.dotColor}`} />
                                                {STATUS_CONFIG[selectedTicket.status]?.label}
                                            </span>
                                            <span className="text-[10px] text-slate-400">
                                                {formatDistanceToNow(new Date(selectedTicket.created_at), { locale: ptBR, addSuffix: true })}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                                <div className="flex items-center gap-1">
                                    <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-slate-400 hover:text-slate-600 hidden lg:flex"
                                        onClick={() => setShowInfoPanel(!showInfoPanel)}>
                                        <Info className="w-4 h-4" />
                                    </Button>
                                    <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-slate-400 hover:text-rose-500"
                                        onClick={() => { setDeleteTargetId(selectedTicket.id); setConfirmDelete(true); }}>
                                        <Trash2 className="w-4 h-4" />
                                    </Button>
                                    {selectedTicket.status !== 'FINALIZADO' && (
                                        <Button variant="outline" size="sm"
                                            className="border-green-200 text-green-700 hover:bg-green-50 h-8 text-xs"
                                            onClick={() => setConfirmClose(true)}>
                                            <CheckCircle2 className="w-3.5 h-3.5 mr-1" /> Finalizar
                                        </Button>
                                    )}
                                </div>
                            </div>

                            {/* Chat Messages */}
                            <div className="flex-1 overflow-y-auto p-4 space-y-2.5" style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg width=\'60\' height=\'60\' viewBox=\'0 0 60 60\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cg fill=\'none\' fill-rule=\'evenodd\'%3E%3Cg fill=\'%23e2e8f0\' fill-opacity=\'0.25\'%3E%3Cpath d=\'M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z\'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")', backgroundColor: '#f0f2f5' }}>
                                
                                {/* Date pill */}
                                <div className="flex justify-center">
                                    <span className="text-[10px] text-slate-500 bg-white/90 px-3 py-1 rounded-full shadow-sm font-medium">
                                        {format(new Date(selectedTicket.created_at), "dd 'de' MMMM 'às' HH:mm", { locale: ptBR })}
                                    </span>
                                </div>

                                {/* Initial message */}
                                {selectedTicket.mensagem_inicial && (
                                    <div className="flex justify-start">
                                        <div className="bg-white rounded-lg rounded-tl-sm shadow-sm p-3 max-w-[70%] border border-slate-100">
                                            <p className="text-[10px] font-semibold text-violet-600 mb-0.5">
                                                👤 {selectedTicket.nome_contato || 'Responsável'}
                                            </p>
                                            <p className="text-[13px] text-slate-700 whitespace-pre-wrap leading-relaxed">{selectedTicket.mensagem_inicial}</p>
                                            <p className="text-[10px] text-slate-400 text-right mt-1">{format(new Date(selectedTicket.created_at), 'HH:mm')}</p>
                                        </div>
                                    </div>
                                )}

                                {/* Thread */}
                                {selectedTicket.respostas?.map((r: any, i: number) => {
                                    const isSecretaria = r.remetente === 'secretaria';
                                    return (
                                        <div key={i} className={`flex ${isSecretaria ? 'justify-end' : 'justify-start'}`}>
                                            <div className={`rounded-lg shadow-sm p-3 max-w-[70%] ${
                                                isSecretaria 
                                                    ? 'bg-[#d9fdd3] rounded-tr-sm border border-green-100' 
                                                    : 'bg-white rounded-tl-sm border border-slate-100'
                                            }`}>
                                                <p className={`text-[10px] font-semibold mb-0.5 ${isSecretaria ? 'text-green-700' : 'text-violet-600'}`}>
                                                    {isSecretaria 
                                                        ? `🏫 ${r.atendente || 'Secretaria'}` 
                                                        : `👤 ${selectedTicket.nome_contato || 'Responsável'}`
                                                    }
                                                </p>
                                                <p className="text-[13px] text-slate-700 whitespace-pre-wrap leading-relaxed">{r.mensagem}</p>
                                                <p className="text-[10px] text-slate-400 text-right mt-1">
                                                    {r.timestamp ? format(new Date(r.timestamp), 'HH:mm') : ''}
                                                </p>
                                            </div>
                                        </div>
                                    );
                                })}
                                <div ref={chatEndRef} />
                            </div>

                            {/* Input Area */}
                            {selectedTicket.status !== 'FINALIZADO' ? (
                                <div className="bg-white border-t shrink-0">
                                    {/* Quick Replies */}
                                    <div className="px-3 pt-2 flex gap-1.5 overflow-x-auto scrollbar-none">
                                        {QUICK_REPLIES.map((qr, i) => (
                                            <button key={i} onClick={() => handleQuickReply(qr)}
                                                className="shrink-0 text-[10px] px-2.5 py-1 rounded-full border border-slate-200 text-slate-500 hover:bg-violet-50 hover:border-violet-200 hover:text-violet-700 transition-colors">
                                                {qr.substring(0, 35)}{qr.length > 35 ? '...' : ''}
                                            </button>
                                        ))}
                                    </div>

                                    <div className="p-3 flex items-end gap-2">
                                        <div className="flex-1 flex flex-col gap-1.5">
                                            <div className="flex items-center gap-1.5">
                                                <span className="text-[10px] text-slate-400 font-medium">Assinar como:</span>
                                                <input
                                                    type="text"
                                                    value={attendantName}
                                                    onChange={(e) => { 
                                                        setAttendantName(e.target.value); 
                                                        sessionStorage.setItem('bot_attendant_name', e.target.value);
                                                    }}
                                                    placeholder="Seu nome"
                                                    className="border rounded px-2 py-0.5 text-[11px] w-28 focus:outline-none focus:border-violet-300 bg-slate-50"
                                                />
                                            </div>
                                            <textarea
                                                placeholder="Digite sua resposta..."
                                                value={replyText}
                                                onChange={(e) => setReplyText(e.target.value)}
                                                onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleReply(); } }}
                                                className="resize-none rounded-xl border border-slate-200 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-200 focus:border-violet-300 min-h-[42px] max-h-[100px]"
                                                rows={1}
                                                disabled={sending}
                                            />
                                        </div>
                                        <Button
                                            onClick={handleReply}
                                            disabled={!replyText.trim() || sending}
                                            className="bg-[#25D366] hover:bg-[#128C7E] text-white rounded-full h-10 w-10 p-0 shrink-0 shadow-md"
                                        >
                                            {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                                        </Button>
                                    </div>
                                </div>
                            ) : (
                                <div className="px-4 py-3 bg-green-50/50 border-t text-center shrink-0">
                                    <p className="text-xs text-green-600 font-medium flex items-center justify-center gap-1.5">
                                        <CheckCircle2 className="w-3.5 h-3.5" /> Atendimento finalizado
                                    </p>
                                </div>
                            )}
                        </>
                    )}
                </div>

                {/* ═══════════════════════════════ */}
                {/* COLUNA 3: PAINEL DE CONTEXTO   */}
                {/* ═══════════════════════════════ */}
                {selectedTicket && showInfoPanel && (
                    <div className="hidden lg:flex w-[300px] border-l flex-col bg-slate-50/50 shrink-0 overflow-y-auto">

                        {/* Contact Card */}
                        <div className="p-4 border-b bg-white">
                            <div className="flex flex-col items-center text-center">
                                <div className={`w-16 h-16 rounded-full bg-gradient-to-br ${getAvatarColor(selectedTicket.telefone_origem)} flex items-center justify-center text-white font-bold text-xl shadow-md mb-3`}>
                                    {getInitials(selectedTicket.nome_contato)}
                                </div>
                                <h3 className="font-bold text-sm text-slate-800">
                                    {selectedTicket.nome_contato || 'Responsável'}
                                </h3>
                                <div className="flex items-center gap-1.5 mt-1 text-slate-500">
                                    <Phone className="w-3 h-3" />
                                    <span className="text-xs">{formatPhone(selectedTicket.telefone_origem)}</span>
                                </div>
                                <Badge variant="outline" className={`mt-2 ${SETOR_CONFIG[selectedTicket.setor]?.bg} ${SETOR_CONFIG[selectedTicket.setor]?.color} text-[10px]`}>
                                    {SETOR_CONFIG[selectedTicket.setor]?.icon}
                                    <span className="ml-1">{SETOR_CONFIG[selectedTicket.setor]?.label}</span>
                                </Badge>
                            </div>
                        </div>

                        {/* Student Info */}
                        <div className="p-4 border-b">
                            <h4 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                                <GraduationCap className="w-3.5 h-3.5" /> Aluno(s) Vinculado(s)
                            </h4>
                            {loadingContact ? (
                                <div className="space-y-2">
                                    <Skeleton className="h-12 w-full rounded-lg" />
                                    <Skeleton className="h-12 w-full rounded-lg" />
                                </div>
                            ) : contactInfo?.alunos && contactInfo.alunos.length > 0 ? (
                                <div className="space-y-2">
                                    {contactInfo.alunos.map((aluno, i) => (
                                        <div key={i} className="bg-white rounded-lg p-3 border border-slate-100 shadow-sm">
                                            <p className="text-sm font-semibold text-slate-800">{aluno.nome}</p>
                                            <div className="flex items-center gap-3 mt-1.5">
                                                {aluno.turma_nome && (
                                                    <span className="text-[10px] text-slate-500 flex items-center gap-1">
                                                        <GraduationCap className="w-3 h-3" /> {aluno.turma_nome}
                                                    </span>
                                                )}
                                                <span className="text-[10px] text-slate-500 flex items-center gap-1">
                                                    <Hash className="w-3 h-3" /> {aluno.matricula}
                                                </span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <p className="text-xs text-slate-400 italic">Nenhum aluno vinculado a este telefone.</p>
                            )}
                        </div>

                        {/* Stats */}
                        <div className="p-4 border-b">
                            <h4 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                                <TicketCheck className="w-3.5 h-3.5" /> Informações
                            </h4>
                            <div className="grid grid-cols-2 gap-2">
                                <div className="bg-white rounded-lg p-3 border border-slate-100 text-center">
                                    <p className="text-lg font-bold text-violet-600">{contactInfo?.tickets_anteriores || 1}</p>
                                    <p className="text-[10px] text-slate-400">Tickets Total</p>
                                </div>
                                <div className="bg-white rounded-lg p-3 border border-slate-100 text-center">
                                    <p className="text-lg font-bold text-emerald-600">{selectedTicket.respostas?.length || 0}</p>
                                    <p className="text-[10px] text-slate-400">Mensagens</p>
                                </div>
                            </div>
                            {contactInfo?.primeiro_contato && (
                                <div className="mt-2 bg-white rounded-lg p-3 border border-slate-100">
                                    <div className="flex items-center gap-2">
                                        <Calendar className="w-3.5 h-3.5 text-slate-400" />
                                        <div>
                                            <p className="text-[10px] text-slate-400">Primeiro contato</p>
                                            <p className="text-xs font-medium text-slate-700">
                                                {format(new Date(contactInfo.primeiro_contato), "dd/MM/yyyy", { locale: ptBR })}
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Ticket Details */}
                        <div className="p-4">
                            <h4 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                                <FileText className="w-3.5 h-3.5" /> Detalhes do Ticket
                            </h4>
                            <div className="space-y-2.5">
                                <div className="flex items-start gap-2">
                                    <Hash className="w-3.5 h-3.5 text-slate-400 mt-0.5 shrink-0" />
                                    <div>
                                        <p className="text-[10px] text-slate-400">ID</p>
                                        <p className="text-xs font-mono text-slate-600">{selectedTicket.id.substring(0, 8)}</p>
                                    </div>
                                </div>
                                <div className="flex items-start gap-2">
                                    <Calendar className="w-3.5 h-3.5 text-slate-400 mt-0.5 shrink-0" />
                                    <div>
                                        <p className="text-[10px] text-slate-400">Criado em</p>
                                        <p className="text-xs text-slate-600">
                                            {format(new Date(selectedTicket.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                                        </p>
                                    </div>
                                </div>
                                <div className="flex items-start gap-2">
                                    <Clock className="w-3.5 h-3.5 text-slate-400 mt-0.5 shrink-0" />
                                    <div>
                                        <p className="text-[10px] text-slate-400">Última atualização</p>
                                        <p className="text-xs text-slate-600">
                                            {formatDistanceToNow(new Date(selectedTicket.updated_at || selectedTicket.created_at), { locale: ptBR, addSuffix: true })}
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </div>

                    </div>
                )}

            </div>
        </div>

        {/* Dialogs */}
        <ConfirmDialog
            open={confirmClose}
            onOpenChange={setConfirmClose}
            title="Finalizar Atendimento"
            description="Deseja finalizar este atendimento? Uma mensagem de encerramento será enviada ao responsável."
            confirmLabel="Finalizar"
            variant="default"
            onConfirm={handleConfirmClose}
            loading={closingOrDeleting}
        />
        <ConfirmDialog
            open={confirmDelete}
            onOpenChange={(open) => { setConfirmDelete(open); if (!open) setDeleteTargetId(null); }}
            title="Excluir Conversa"
            description="Tem certeza que deseja excluir esta conversa? Todas as mensagens serão removidas permanentemente."
            confirmLabel="Excluir"
            variant="destructive"
            onConfirm={handleConfirmDelete}
            loading={closingOrDeleting}
        />
        </>
    );
}
