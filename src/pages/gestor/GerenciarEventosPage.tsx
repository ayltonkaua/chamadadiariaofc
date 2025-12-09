import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from "@/hooks/use-toast";
import { CalendarIcon, Loader2, Plus, Printer, Trash2, UserPlus, PartyPopper, ArrowLeft, Search, X, Users, ListPlus, UserRound, Ticket, Download } from "lucide-react";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import QRCode from "react-qr-code";
import * as htmlToImage from 'html-to-image';
import download from 'downloadjs';

export default function GerenciarEventosPage() {
    const { user } = useAuth();
    const { toast } = useToast();
    const navigate = useNavigate();
    const ticketRef = useRef<HTMLDivElement>(null);
    const guestTicketRef = useRef<HTMLDivElement>(null);

    // Estados gerais
    const [loading, setLoading] = useState(false);
    const [eventos, setEventos] = useState<any[]>([]);
    const [eventoAtivo, setEventoAtivo] = useState<any>(null);

    // Estados - Novo Evento
    const [date, setDate] = useState<Date | undefined>(undefined);
    const [nomeEvento, setNomeEvento] = useState('');

    // Estados - Staff
    const [staffSearch, setStaffSearch] = useState('');
    const [staffResults, setStaffResults] = useState<any[]>([]);
    const [staffList, setStaffList] = useState<any[]>([]);
    const [loadingStaff, setLoadingStaff] = useState(false);

    // Estados - Convidados (NOVO)
    const [guestName, setGuestName] = useState('');
    const [guestType, setGuestType] = useState('Convidado');
    const [guestList, setGuestList] = useState<any[]>([]);
    const [selectedGuest, setSelectedGuest] = useState<any>(null); // Para o modal de ingresso

    // Estados - Impressão
    const [printSearch, setPrintSearch] = useState('');
    const [printResults, setPrintResults] = useState<any[]>([]);
    const [filaImpressao, setFilaImpressao] = useState<any[]>([]);
    const [loadingPrint, setLoadingPrint] = useState(false);

    // Carregar Eventos ao abrir
    useEffect(() => {
        loadEventos();
    }, [user?.escola_id]);

    // Carregar staff e convidados quando evento ativo mudar
    useEffect(() => {
        if (eventoAtivo) {
            loadStaff();
            loadGuests();
        }
    }, [eventoAtivo]);

    const loadEventos = async () => {
        if (!user?.escola_id) return;

        const { data, error } = await (supabase as any)
            .from('eventos')
            .select('*, eventos_checkins(count)')
            .eq('escola_id', user.escola_id)
            .order('data_evento', { ascending: false });

        if (error) {
            // Fallback se a relação count falhar
            const { data: dataFallback } = await (supabase as any)
                .from('eventos')
                .select('*')
                .eq('escola_id', user.escola_id)
                .order('data_evento', { ascending: false });
            setEventos(dataFallback || []);
            return;
        }

        const eventosData = data || [];
        setEventos(eventosData);

        const ativo = eventosData.find((e: any) => e.ativo);
        if (ativo) setEventoAtivo(ativo);
    };

    const loadStaff = async () => {
        if (!eventoAtivo) return;
        const { data } = await (supabase as any).from('eventos_staff').select('*, alunos(id, nome)').eq('evento_id', eventoAtivo.id);
        setStaffList(data || []);
    };

    const loadGuests = async () => {
        if (!eventoAtivo) return;
        const { data } = await (supabase as any).from('eventos_convidados').select('*').eq('evento_id', eventoAtivo.id).order('created_at', { ascending: false });
        setGuestList(data || []);
    };

    // ========== CRIAR EVENTO ==========
    const handleCriarEvento = async () => {
        if (!nomeEvento || !date || !user?.escola_id) {
            toast({ title: "Preencha todos os campos", variant: "destructive" });
            return;
        }
        setLoading(true);
        try {
            await (supabase as any).from('eventos').update({ ativo: false }).eq('escola_id', user.escola_id);
            const dataLocal = format(date, 'yyyy-MM-dd');

            const { error } = await (supabase as any).from('eventos').insert({
                nome: nomeEvento,
                data_evento: dataLocal,
                escola_id: user.escola_id,
                ativo: true
            });

            if (error) throw error;

            toast({ title: "Evento Criado!", description: "O evento está ativo." });
            setNomeEvento('');
            setDate(undefined);
            loadEventos();
        } catch (error: any) {
            toast({ title: "Erro", description: error.message, variant: "destructive" });
        } finally {
            setLoading(false);
        }
    };

    const handleExcluirEvento = async (id: string) => {
        const confirm = window.confirm("Tem certeza? Isso apagará todos os registros e convidados deste evento.");
        if (!confirm) return;
        await (supabase as any).from('eventos').delete().eq('id', id);
        toast({ title: "Evento excluído" });
        loadEventos();
    };

    // ========== STAFF / MONITORES ==========
    const buscarStaff = async () => {
        if (!staffSearch || staffSearch.length < 2) return;
        setLoadingStaff(true);
        const { data } = await supabase.from('alunos').select('id, nome, turmas!inner(nome, escola_id)').ilike('nome', `%${staffSearch}%`).limit(5);

        const filtrados = (data || []).filter((a: any) => {
            const turma = a.turmas;
            if (Array.isArray(turma)) return turma.some((t: any) => t.escola_id === user?.escola_id);
            return turma?.escola_id === user?.escola_id;
        });

        setStaffResults(filtrados);
        setLoadingStaff(false);
    };

    const adicionarMonitor = async (aluno: any) => {
        if (!eventoAtivo) return;
        const jaExiste = staffList.some((s: any) => s.aluno_id === aluno.id);
        if (jaExiste) { toast({ title: "Já adicionado", variant: "destructive" }); return; }

        await (supabase as any).from('eventos_staff').insert({ evento_id: eventoAtivo.id, aluno_id: aluno.id });
        toast({ title: "Monitor adicionado!" });
        setStaffSearch('');
        setStaffResults([]);
        loadStaff();
    };

    const removerMonitor = async (staffId: string) => {
        await (supabase as any).from('eventos_staff').delete().eq('id', staffId);
        loadStaff();
    };

    // ========== CONVIDADOS (NOVO) ==========
    const handleAddGuest = async () => {
        if (!eventoAtivo || !guestName) {
            toast({ title: "Digite o nome do convidado", variant: "destructive" });
            return;
        }

        const { error } = await (supabase as any).from('eventos_convidados').insert({
            evento_id: eventoAtivo.id,
            nome: guestName,
            tipo: guestType
        });

        if (error) {
            toast({ title: "Erro ao adicionar", description: error.message, variant: "destructive" });
        } else {
            toast({ title: "Convidado Adicionado!" });
            setGuestName('');
            loadGuests();
        }
    };

    const handleRemoveGuest = async (id: string) => {
        if (!window.confirm("Remover este convidado?")) return;
        await (supabase as any).from('eventos_convidados').delete().eq('id', id);
        loadGuests();
    };

    const downloadGuestTicket = () => {
        if (guestTicketRef.current && selectedGuest) {
            htmlToImage.toPng(guestTicketRef.current).then((dataUrl) => {
                download(dataUrl, `convite-${selectedGuest.nome}.png`);
            });
        }
    };

    // ========== IMPRESSÃO EM LOTE ==========
    const buscarAlunoPrint = async () => {
        if (!printSearch || printSearch.length < 2) return;
        setLoadingPrint(true);
        const { data } = await supabase.from('alunos').select('id, nome, turmas!inner(nome, escola_id)').ilike('nome', `%${printSearch}%`).limit(5);
        const filtrados = (data || []).filter((a: any) => {
            const turma = a.turmas;
            if (Array.isArray(turma)) return turma.some((t: any) => t.escola_id === user?.escola_id);
            return turma?.escola_id === user?.escola_id;
        });
        setPrintResults(filtrados);
        setLoadingPrint(false);
    };

    const adicionarAFila = (aluno: any) => {
        if (filaImpressao.some(a => a.id === aluno.id)) { toast({ title: "Aluno já está na fila" }); return; }
        setFilaImpressao(prev => [...prev, aluno]);
        setPrintSearch('');
        setPrintResults([]);
        toast({ title: "Adicionado à fila" });
    };

    const removerDaFila = (id: string) => {
        setFilaImpressao(prev => prev.filter(p => p.id !== id));
    };

    const handlePrintQueue = () => { window.print(); };

    const formatarData = (dataStr: string) => {
        try {
            const dateObj = dataStr.includes('T') ? parseISO(dataStr) : new Date(dataStr + 'T12:00:00');
            return format(dateObj, "dd 'de' MMMM, yyyy", { locale: ptBR });
        } catch { return dataStr; }
    };

    if (!user) return <div className="p-10">Carregando...</div>;

    return (
        <>
            <style>{`
                @media print {
                    @page { size: A4; margin: 10mm; }
                    body * { visibility: hidden; }
                    #print-queue-container, #print-queue-container * { visibility: visible; }
                    #print-queue-container {
                        position: absolute; top: 0; left: 0; width: 100%;
                        display: grid; grid-template-columns: 1fr 1fr; gap: 15px; padding: 10px;
                    }
                    .ticket-item {
                        border: 1px dashed #999; page-break-inside: avoid;
                        border-radius: 12px; overflow: hidden;
                    }
                }
            `}</style>

            <div className="container mx-auto p-4 max-w-5xl space-y-8 animate-in fade-in print:hidden">
                {/* Header */}
                <div className="flex items-center gap-4">
                    <Button variant="ghost" size="icon" onClick={() => navigate('/dashboard')}>
                        <ArrowLeft className="h-5 w-5" />
                    </Button>
                    <div className="p-3 bg-purple-100 rounded-xl">
                        <PartyPopper className="w-8 h-8 text-purple-600" />
                    </div>
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight text-gray-900">Gestão de Eventos</h1>
                        <p className="text-muted-foreground">Controle festas, convidados e acessos.</p>
                    </div>
                </div>

                {eventoAtivo && (
                    <div className="bg-green-50 border border-green-200 rounded-lg p-3 flex items-center justify-between shadow-sm">
                        <div className="flex items-center gap-2">
                            <Badge className="bg-green-600 hover:bg-green-700">Evento Ativo</Badge>
                            <span className="font-bold text-green-900">{eventoAtivo.nome}</span>
                        </div>
                    </div>
                )}

                <Tabs defaultValue="lista" className="w-full">
                    <TabsList className="grid w-full grid-cols-5 mb-8">
                        <TabsTrigger value="lista">Meus Eventos</TabsTrigger>
                        <TabsTrigger value="novo">Novo Evento</TabsTrigger>
                        <TabsTrigger value="staff">Staff/Monitores</TabsTrigger>
                        <TabsTrigger value="convidados">Convidados</TabsTrigger>
                        <TabsTrigger value="impressao">Impressão Alunos</TabsTrigger>
                    </TabsList>

                    <TabsContent value="lista">
                        <Card>
                            <CardHeader>
                                <CardTitle>Eventos Criados</CardTitle>
                            </CardHeader>
                            <CardContent>
                                {eventos.map(evento => {
                                    const checkinCount = evento.eventos_checkins ? evento.eventos_checkins[0]?.count : 0;
                                    return (
                                        <div key={evento.id} className="flex items-center justify-between p-4 border rounded-lg mb-2 hover:shadow-md transition-shadow">
                                            <div>
                                                <div className="flex items-center gap-2">
                                                    <h3 className="font-bold text-lg">{evento.nome}</h3>
                                                    {evento.ativo && <Badge className="bg-green-600">Ativo</Badge>}
                                                    <Badge variant="secondary" className="ml-2 flex gap-1 items-center">
                                                        <Users className="w-3 h-3" /> {checkinCount || 0} Presentes
                                                    </Badge>
                                                </div>
                                                <p className="text-sm text-gray-500 mt-1">{formatarData(evento.data_evento)}</p>
                                            </div>
                                            <Button size="icon" variant="ghost" className="text-red-500 hover:bg-red-50" onClick={() => handleExcluirEvento(evento.id)}>
                                                <Trash2 className="h-4 w-4" />
                                            </Button>
                                        </div>
                                    );
                                })}
                            </CardContent>
                        </Card>
                    </TabsContent>

                    <TabsContent value="novo">
                        <Card>
                            <CardHeader><CardTitle>Criar Novo Evento</CardTitle></CardHeader>
                            <CardContent className="space-y-4">
                                <div className="space-y-1">
                                    <Label>Nome</Label>
                                    <Input placeholder="Ex: Feira de Ciências 2025" value={nomeEvento} onChange={e => setNomeEvento(e.target.value)} />
                                </div>
                                <div className="space-y-1">
                                    <Label>Data</Label>
                                    <Popover>
                                        <PopoverTrigger asChild>
                                            <Button variant={"outline"} className={cn("w-full justify-start text-left font-normal", !date && "text-muted-foreground")}>
                                                <CalendarIcon className="mr-2 h-4 w-4" />
                                                {date ? format(date, "PPP", { locale: ptBR }) : <span>Selecione data</span>}
                                            </Button>
                                        </PopoverTrigger>
                                        <PopoverContent className="w-auto p-0"><Calendar mode="single" selected={date} onSelect={setDate} initialFocus /></PopoverContent>
                                    </Popover>
                                </div>
                                <Button onClick={handleCriarEvento} className="w-full bg-purple-600" disabled={loading}>
                                    {loading ? <Loader2 className="animate-spin" /> : <Plus />} Criar
                                </Button>
                            </CardContent>
                        </Card>
                    </TabsContent>

                    <TabsContent value="staff">
                        <Card>
                            <CardHeader><CardTitle>Monitores (Alunos)</CardTitle></CardHeader>
                            <CardContent className="space-y-4">
                                <div className="flex gap-2">
                                    <Input placeholder="Buscar aluno..." value={staffSearch} onChange={e => setStaffSearch(e.target.value)} />
                                    <Button onClick={buscarStaff}><Search className="h-4 w-4" /></Button>
                                </div>
                                {staffResults.map((a: any) => (
                                    <div key={a.id} className="flex justify-between p-2 border rounded bg-slate-50">
                                        <span>{a.nome}</span>
                                        <Button size="sm" onClick={() => adicionarMonitor(a)}>Add</Button>
                                    </div>
                                ))}
                                <div className="mt-4 border-t pt-4">
                                    <p className="font-bold mb-2">Monitores Atuais:</p>
                                    {staffList.map((s: any) => (
                                        <div key={s.id} className="flex justify-between items-center p-2 border-b last:border-0">
                                            <span>{s.alunos?.nome}</span>
                                            <Button size="icon" variant="ghost" className="text-red-500 hover:bg-red-50" onClick={() => removerMonitor(s.id)}>
                                                <X className="h-4 w-4" />
                                            </Button>
                                        </div>
                                    ))}
                                </div>
                            </CardContent>
                        </Card>
                    </TabsContent>

                    {/* === ABA CONVIDADOS === */}
                    <TabsContent value="convidados">
                        <Card>
                            <CardHeader>
                                <CardTitle>Convidados Externos</CardTitle>
                                <CardDescription>Pais, autoridades e pessoas sem cadastro no sistema.</CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-6">
                                <div className="flex flex-col md:flex-row gap-3 items-end">
                                    <div className="flex-1 space-y-1 w-full">
                                        <Label>Nome do Convidado</Label>
                                        <Input placeholder="Ex: Maria Silva" value={guestName} onChange={e => setGuestName(e.target.value)} />
                                    </div>
                                    <div className="w-full md:w-48 space-y-1">
                                        <Label>Tipo</Label>
                                        <select
                                            className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                                            value={guestType}
                                            onChange={e => setGuestType(e.target.value)}
                                        >
                                            <option value="Convidado">Convidado</option>
                                            <option value="Pai/Mãe">Pai/Mãe</option>
                                            <option value="Ex-Aluno">Ex-Aluno</option>
                                            <option value="Autoridade">Autoridade</option>
                                        </select>
                                    </div>
                                    <Button onClick={handleAddGuest} className="w-full md:w-auto bg-blue-600 hover:bg-blue-700">
                                        <UserPlus className="mr-2 h-4 w-4" /> Adicionar
                                    </Button>
                                </div>

                                <div className="border rounded-lg divide-y">
                                    {guestList.length === 0 ? (
                                        <div className="p-8 text-center text-gray-400">Nenhum convidado adicionado.</div>
                                    ) : (
                                        guestList.map(guest => (
                                            <div key={guest.id} className="flex items-center justify-between p-3 hover:bg-slate-50">
                                                <div className="flex items-center gap-3">
                                                    <div className="bg-blue-100 p-2 rounded-full">
                                                        <UserRound className="w-4 h-4 text-blue-600" />
                                                    </div>
                                                    <div>
                                                        <p className="font-bold">{guest.nome}</p>
                                                        <Badge variant="outline" className="text-xs">{guest.tipo}</Badge>
                                                    </div>
                                                </div>
                                                <div className="flex gap-2">
                                                    <Button size="sm" variant="outline" onClick={() => setSelectedGuest(guest)}>
                                                        <Ticket className="w-4 h-4 mr-1" /> Ingresso
                                                    </Button>
                                                    <Button size="icon" variant="ghost" className="text-red-500 hover:bg-red-50" onClick={() => handleRemoveGuest(guest.id)}>
                                                        <Trash2 className="w-4 h-4" />
                                                    </Button>
                                                </div>
                                            </div>
                                        ))
                                    )}
                                </div>
                            </CardContent>
                        </Card>
                    </TabsContent>

                    <TabsContent value="impressao">
                        <Card>
                            <CardHeader>
                                <CardTitle>Fila de Impressão (Alunos)</CardTitle>
                                <CardDescription>Selecione alunos para imprimir em lote.</CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-6">
                                <div className="flex gap-2">
                                    <Input
                                        placeholder="Buscar aluno..."
                                        value={printSearch}
                                        onChange={e => setPrintSearch(e.target.value)}
                                        onKeyDown={e => e.key === 'Enter' && buscarAlunoPrint()}
                                    />
                                    <Button onClick={buscarAlunoPrint} disabled={loadingPrint}><Search className="h-4 w-4" /></Button>
                                </div>

                                {printResults.length > 0 && (
                                    <div className="border rounded-lg divide-y">
                                        {printResults.map((aluno: any) => {
                                            const turmaInfo = Array.isArray(aluno.turmas) ? aluno.turmas[0]?.nome : aluno.turmas?.nome;
                                            return (
                                                <div key={aluno.id} className="flex items-center justify-between p-3 hover:bg-slate-50">
                                                    <div>
                                                        <p className="font-medium">{aluno.nome}</p>
                                                        <p className="text-sm text-gray-500">{turmaInfo}</p>
                                                    </div>
                                                    <Button size="sm" onClick={() => adicionarAFila(aluno)}>
                                                        <ListPlus className="h-4 w-4 mr-1" /> Adicionar
                                                    </Button>
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}

                                <div className="bg-slate-50 p-4 rounded-xl border-2 border-dashed border-slate-200">
                                    <div className="flex justify-between items-center mb-4">
                                        <h3 className="font-bold text-lg flex items-center gap-2">
                                            <Printer className="w-5 h-5 text-purple-600" /> Fila ({filaImpressao.length})
                                        </h3>
                                        {filaImpressao.length > 0 && (
                                            <Button variant="outline" size="sm" className="text-red-500" onClick={() => setFilaImpressao([])}>Limpar</Button>
                                        )}
                                    </div>

                                    <div className="space-y-2">
                                        {filaImpressao.map((aluno, index) => (
                                            <div key={aluno.id} className="flex justify-between items-center bg-white p-2 rounded shadow-sm">
                                                <div className="flex items-center gap-3">
                                                    <Badge variant="outline">#{index + 1}</Badge>
                                                    <span className="font-medium">{aluno.nome}</span>
                                                </div>
                                                <Button size="icon" variant="ghost" className="h-8 w-8 text-red-500" onClick={() => removerDaFila(aluno.id)}>
                                                    <X className="h-4 w-4" />
                                                </Button>
                                            </div>
                                        ))}
                                    </div>
                                    {filaImpressao.length > 0 && (
                                        <Button className="w-full mt-6 bg-purple-700 hover:bg-purple-800" onClick={handlePrintQueue}>
                                            <Printer className="mr-2 h-4 w-4" /> Imprimir
                                        </Button>
                                    )}
                                </div>
                            </CardContent>
                        </Card>
                    </TabsContent>
                </Tabs>
            </div>

            {/* MODAL INGRESSO CONVIDADO */}
            <Dialog open={!!selectedGuest} onOpenChange={(open) => !open && setSelectedGuest(null)}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>Ingresso de Convidado</DialogTitle>
                        <DialogDescription>Use este QR Code para entrada.</DialogDescription>
                    </DialogHeader>
                    {selectedGuest && eventoAtivo && (
                        <div className="flex flex-col items-center justify-center p-4">
                            <div ref={guestTicketRef} className="bg-white p-6 rounded-xl border shadow-lg w-full max-w-[300px] flex flex-col items-center">
                                <div className="mb-4 text-center">
                                    <h2 className="text-lg font-bold text-blue-900">{eventoAtivo.nome}</h2>
                                    <Badge className="bg-blue-600 mt-1">Convidado VIP</Badge>
                                </div>
                                <QRCode
                                    value={JSON.stringify({ e: eventoAtivo.id, c: selectedGuest.id })}
                                    size={180}
                                />
                                <div className="mt-4 text-center">
                                    <p className="font-bold text-gray-800 text-lg">{selectedGuest.nome}</p>
                                    <p className="text-sm text-gray-500">{selectedGuest.tipo}</p>
                                </div>
                            </div>
                            <Button onClick={downloadGuestTicket} className="w-full mt-6 bg-green-600 hover:bg-green-700">
                                <Download className="mr-2 h-4 w-4" /> Baixar Imagem
                            </Button>
                        </div>
                    )}
                </DialogContent>
            </Dialog>

            {/* ÁREA DE IMPRESSÃO (GRID) */}
            {eventoAtivo && filaImpressao.length > 0 && (
                <div id="print-queue-container" className="hidden print:grid">
                    {filaImpressao.map(aluno => {
                        const qrData = JSON.stringify({ e: eventoAtivo.id, a: aluno.id });
                        const turma = Array.isArray(aluno.turmas) ? aluno.turmas[0]?.nome : aluno.turmas?.nome;
                        return (
                            <div key={aluno.id} className="ticket-item bg-white border border-black p-0 w-full mb-4">
                                <div className="bg-black text-white p-3 text-center">
                                    <h2 className="text-sm font-bold uppercase truncate">{eventoAtivo.nome}</h2>
                                </div>
                                <div className="flex flex-row items-center p-4 gap-4">
                                    <QRCode value={qrData} size={100} />
                                    <div className="flex-1 overflow-hidden">
                                        <h3 className="font-bold text-lg leading-tight mb-1">{aluno.nome}</h3>
                                        <p className="text-sm text-gray-600">{turma}</p>
                                        <p className="text-xs text-gray-400 mt-2">ID: {aluno.id.slice(0, 6)}</p>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </>
    );
}