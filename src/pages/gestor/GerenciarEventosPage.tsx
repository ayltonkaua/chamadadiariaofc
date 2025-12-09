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
import { CalendarIcon, Loader2, Plus, Printer, Trash2, UserPlus, PartyPopper, ArrowLeft, Search, X, Download } from "lucide-react";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import QRCode from "react-qr-code";

export default function GerenciarEventosPage() {
    const { user } = useAuth();
    const { toast } = useToast();
    const navigate = useNavigate();
    const ticketRef = useRef<HTMLDivElement>(null);

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

    // Estados - Impressão
    const [printSearch, setPrintSearch] = useState('');
    const [printResults, setPrintResults] = useState<any[]>([]);
    const [selectedAluno, setSelectedAluno] = useState<any>(null);
    const [loadingPrint, setLoadingPrint] = useState(false);

    // Carregar Eventos ao abrir
    useEffect(() => {
        loadEventos();
    }, [user?.escola_id]);

    // Carregar staff quando evento ativo mudar
    useEffect(() => {
        if (eventoAtivo) {
            loadStaff();
        }
    }, [eventoAtivo]);

    const loadEventos = async () => {
        if (!user?.escola_id) return;
        const { data } = await (supabase as any)
            .from('eventos')
            .select('*')
            .eq('escola_id', user.escola_id)
            .order('data_evento', { ascending: false });

        const eventosData = data || [];
        setEventos(eventosData);

        // Define evento ativo automaticamente
        const ativo = eventosData.find((e: any) => e.ativo);
        if (ativo) setEventoAtivo(ativo);
    };

    const loadStaff = async () => {
        if (!eventoAtivo) return;

        const { data } = await (supabase as any)
            .from('eventos_staff')
            .select('*, alunos(id, nome)')
            .eq('evento_id', eventoAtivo.id);

        setStaffList(data || []);
    };

    // ========== CRIAR EVENTO ==========
    const handleCriarEvento = async () => {
        if (!nomeEvento || !date || !user?.escola_id) {
            toast({ title: "Preencha todos os campos", variant: "destructive" });
            return;
        }
        setLoading(true);
        try {
            // Desativa anteriores
            await (supabase as any).from('eventos').update({ ativo: false }).eq('escola_id', user.escola_id);

            // CORREÇÃO TIMEZONE: Usar formato YYYY-MM-DD (data local)
            const dataLocal = format(date, 'yyyy-MM-dd');
            console.log("[Evento] Data selecionada:", date, "-> Salvando como:", dataLocal);

            const { error } = await (supabase as any).from('eventos').insert({
                nome: nomeEvento,
                data_evento: dataLocal, // <-- String simples, sem timezone
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
        const confirm = window.confirm("Tem certeza? Isso apagará todos os registros deste evento.");
        if (!confirm) return;

        await (supabase as any).from('eventos').delete().eq('id', id);
        toast({ title: "Evento excluído" });
        loadEventos();
    };

    // ========== STAFF / MONITORES ==========
    const buscarStaff = async () => {
        if (!staffSearch || staffSearch.length < 2) return;
        setLoadingStaff(true);

        // Busca alunos da escola para serem monitores
        const { data } = await supabase
            .from('alunos')
            .select('id, nome, turmas!inner(nome, escola_id)')
            .ilike('nome', `%${staffSearch}%`)
            .limit(5);

        // Filtra pela escola
        const filtrados = (data || []).filter((a: any) => {
            const turma = a.turmas;
            if (Array.isArray(turma)) return turma.some((t: any) => t.escola_id === user?.escola_id);
            return turma?.escola_id === user?.escola_id;
        });

        setStaffResults(filtrados);
        setLoadingStaff(false);
    };

    const adicionarMonitor = async (aluno: any) => {
        if (!eventoAtivo) {
            toast({ title: "Selecione um evento ativo primeiro", variant: "destructive" });
            return;
        }

        // Verifica se já existe
        const jaExiste = staffList.some((s: any) => s.aluno_id === aluno.id);
        if (jaExiste) {
            toast({ title: "Este aluno já é monitor deste evento", variant: "destructive" });
            return;
        }

        const { error } = await (supabase as any).from('eventos_staff').insert({
            evento_id: eventoAtivo.id,
            aluno_id: aluno.id
        });

        if (error) {
            toast({ title: "Erro ao adicionar", description: error.message, variant: "destructive" });
        } else {
            toast({ title: "Monitor adicionado!" });
            setStaffSearch('');
            setStaffResults([]);
            loadStaff();
        }
    };

    const removerMonitor = async (staffId: string) => {
        await (supabase as any).from('eventos_staff').delete().eq('id', staffId);
        toast({ title: "Monitor removido" });
        loadStaff();
    };

    // ========== IMPRESSÃO INDIVIDUAL ==========
    const buscarAlunoPrint = async () => {
        if (!printSearch || printSearch.length < 2) return;
        setLoadingPrint(true);

        const { data } = await supabase
            .from('alunos')
            .select('id, nome, turmas!inner(nome, escola_id)')
            .ilike('nome', `%${printSearch}%`)
            .limit(5);

        const filtrados = (data || []).filter((a: any) => {
            const turma = a.turmas;
            if (Array.isArray(turma)) return turma.some((t: any) => t.escola_id === user?.escola_id);
            return turma?.escola_id === user?.escola_id;
        });

        setPrintResults(filtrados);
        setLoadingPrint(false);
    };

    const selecionarAlunoPrint = (aluno: any) => {
        setSelectedAluno(aluno);
        setPrintResults([]);
        setPrintSearch('');
    };

    const handlePrint = () => {
        window.print();
    };

    // Formatar data para exibição (corrigir timezone)
    const formatarData = (dataStr: string) => {
        try {
            // Se for string YYYY-MM-DD, adiciona T12:00:00 para evitar problemas de timezone
            const dateObj = dataStr.includes('T') ? parseISO(dataStr) : new Date(dataStr + 'T12:00:00');
            return format(dateObj, "dd 'de' MMMM, yyyy", { locale: ptBR });
        } catch {
            return dataStr;
        }
    };

    // Proteção de carregamento
    if (!user) {
        return (
            <div className="p-10 text-center text-gray-500">
                Carregando dados do usuário...
            </div>
        );
    }

    // QR Code data para impressão
    const qrData = selectedAluno && eventoAtivo
        ? JSON.stringify({ e: eventoAtivo.id, a: selectedAluno.id })
        : '';

    return (
        <>
            {/* CSS para impressão */}
            <style>{`
                @media print {
                    body * {
                        visibility: hidden;
                    }
                    #print-ticket, #print-ticket * {
                        visibility: visible;
                    }
                    #print-ticket {
                        position: absolute;
                        left: 50%;
                        top: 50%;
                        transform: translate(-50%, -50%);
                        width: 300px !important;
                    }
                }
            `}</style>

            <div className="container mx-auto p-4 max-w-5xl space-y-8 animate-in fade-in print:hidden">
                {/* Header com botão voltar */}
                <div className="flex items-center gap-4">
                    <Button variant="ghost" size="icon" onClick={() => navigate('/dashboard')}>
                        <ArrowLeft className="h-5 w-5" />
                    </Button>
                    <div className="p-3 bg-purple-100 rounded-xl">
                        <PartyPopper className="w-8 h-8 text-purple-600" />
                    </div>
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight text-gray-900">Gestão de Eventos</h1>
                        <p className="text-muted-foreground">Controle festas e acessos da escola.</p>
                    </div>
                </div>

                {/* Evento Ativo Badge */}
                {eventoAtivo && (
                    <div className="bg-green-50 border border-green-200 rounded-lg p-3 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <Badge className="bg-green-600">Evento Ativo</Badge>
                            <span className="font-medium">{eventoAtivo.nome}</span>
                            <span className="text-sm text-gray-500">({formatarData(eventoAtivo.data_evento)})</span>
                        </div>
                    </div>
                )}

                <Tabs defaultValue="lista" className="w-full">
                    <TabsList className="grid w-full grid-cols-4 mb-8">
                        <TabsTrigger value="lista">Meus Eventos</TabsTrigger>
                        <TabsTrigger value="novo">Novo Evento</TabsTrigger>
                        <TabsTrigger value="staff">Equipe</TabsTrigger>
                        <TabsTrigger value="impressao">Impressão</TabsTrigger>
                    </TabsList>

                    {/* === ABA LISTA DE EVENTOS === */}
                    <TabsContent value="lista">
                        <Card>
                            <CardHeader>
                                <CardTitle>Eventos Criados</CardTitle>
                                <CardDescription>Gerencie os eventos ativos e passados.</CardDescription>
                            </CardHeader>
                            <CardContent>
                                {eventos.length === 0 ? (
                                    <div className="text-center py-10 text-gray-500">Nenhum evento criado ainda.</div>
                                ) : (
                                    <div className="space-y-4">
                                        {eventos.map(evento => (
                                            <div key={evento.id} className="flex items-center justify-between p-4 border rounded-lg hover:bg-slate-50 transition-colors">
                                                <div>
                                                    <div className="flex items-center gap-2">
                                                        <h3 className="font-bold text-lg">{evento.nome}</h3>
                                                        {evento.ativo && <Badge className="bg-green-600">Ativo</Badge>}
                                                    </div>
                                                    <p className="text-sm text-gray-500 flex items-center mt-1">
                                                        <CalendarIcon className="w-3 h-3 mr-1" />
                                                        {formatarData(evento.data_evento)}
                                                    </p>
                                                </div>
                                                <Button variant="ghost" size="icon" className="text-red-500 hover:text-red-700 hover:bg-red-50" onClick={() => handleExcluirEvento(evento.id)}>
                                                    <Trash2 className="w-4 h-4" />
                                                </Button>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    </TabsContent>

                    {/* === ABA NOVO EVENTO === */}
                    <TabsContent value="novo">
                        <Card>
                            <CardHeader><CardTitle>Criar Novo Evento</CardTitle></CardHeader>
                            <CardContent className="space-y-4">
                                <div className="space-y-1">
                                    <Label>Nome do Evento</Label>
                                    <Input placeholder="Ex: Festa Junina" value={nomeEvento} onChange={e => setNomeEvento(e.target.value)} />
                                </div>
                                <div className="space-y-1">
                                    <Label>Data</Label>
                                    <Popover>
                                        <PopoverTrigger asChild>
                                            <Button variant={"outline"} className={cn("w-full justify-start text-left font-normal", !date && "text-muted-foreground")}>
                                                <CalendarIcon className="mr-2 h-4 w-4" />
                                                {date ? format(date, "PPP", { locale: ptBR }) : <span>Selecione uma data</span>}
                                            </Button>
                                        </PopoverTrigger>
                                        <PopoverContent className="w-auto p-0" align="start">
                                            <Calendar mode="single" selected={date} onSelect={setDate} initialFocus locale={ptBR} />
                                        </PopoverContent>
                                    </Popover>
                                </div>
                                <Button onClick={handleCriarEvento} className="w-full bg-purple-600 hover:bg-purple-700" disabled={loading}>
                                    {loading ? <Loader2 className="animate-spin mr-2" /> : <Plus className="mr-2" />} Criar Evento
                                </Button>
                            </CardContent>
                        </Card>
                    </TabsContent>

                    {/* === ABA EQUIPE / STAFF === */}
                    <TabsContent value="staff">
                        <Card>
                            <CardHeader>
                                <CardTitle>Monitores do Evento</CardTitle>
                                <CardDescription>
                                    {eventoAtivo
                                        ? `Adicionando monitores para: ${eventoAtivo.nome}`
                                        : "Crie ou selecione um evento ativo primeiro"}
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-6">
                                {!eventoAtivo ? (
                                    <div className="text-center py-8 text-gray-500">
                                        <p>Nenhum evento ativo.</p>
                                        <p className="text-sm">Vá na aba "Novo Evento" para criar um.</p>
                                    </div>
                                ) : (
                                    <>
                                        {/* Busca de alunos */}
                                        <div className="space-y-2">
                                            <Label>Buscar aluno para ser monitor</Label>
                                            <div className="flex gap-2">
                                                <Input
                                                    placeholder="Digite o nome do aluno..."
                                                    value={staffSearch}
                                                    onChange={e => setStaffSearch(e.target.value)}
                                                    onKeyDown={e => e.key === 'Enter' && buscarStaff()}
                                                />
                                                <Button onClick={buscarStaff} disabled={loadingStaff}>
                                                    {loadingStaff ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                                                </Button>
                                            </div>
                                        </div>

                                        {/* Resultados da busca */}
                                        {staffResults.length > 0 && (
                                            <div className="border rounded-lg divide-y">
                                                {staffResults.map((aluno: any) => {
                                                    const turmaInfo = Array.isArray(aluno.turmas) ? aluno.turmas[0]?.nome : aluno.turmas?.nome;
                                                    return (
                                                        <div key={aluno.id} className="flex items-center justify-between p-3 hover:bg-slate-50">
                                                            <div>
                                                                <p className="font-medium">{aluno.nome}</p>
                                                                <p className="text-sm text-gray-500">{turmaInfo}</p>
                                                            </div>
                                                            <Button size="sm" onClick={() => adicionarMonitor(aluno)}>
                                                                <UserPlus className="h-4 w-4 mr-1" /> Adicionar
                                                            </Button>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        )}

                                        {/* Lista de monitores atuais */}
                                        <div className="space-y-2">
                                            <Label>Monitores adicionados ({staffList.length})</Label>
                                            {staffList.length === 0 ? (
                                                <p className="text-sm text-gray-500 py-4 text-center">Nenhum monitor adicionado ainda.</p>
                                            ) : (
                                                <div className="border rounded-lg divide-y">
                                                    {staffList.map((staff: any) => (
                                                        <div key={staff.id} className="flex items-center justify-between p-3">
                                                            <p className="font-medium">{staff.alunos?.nome || 'Aluno'}</p>
                                                            <Button size="sm" variant="ghost" className="text-red-500 hover:text-red-700" onClick={() => removerMonitor(staff.id)}>
                                                                <X className="h-4 w-4" />
                                                            </Button>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    </>
                                )}
                            </CardContent>
                        </Card>
                    </TabsContent>

                    {/* === ABA IMPRESSÃO === */}
                    <TabsContent value="impressao">
                        <Card>
                            <CardHeader>
                                <CardTitle>Imprimir Ingresso Individual</CardTitle>
                                <CardDescription>Para alunos que não têm celular.</CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-6">
                                {!eventoAtivo ? (
                                    <div className="text-center py-8 text-gray-500">
                                        <p>Nenhum evento ativo para imprimir ingressos.</p>
                                    </div>
                                ) : (
                                    <>
                                        {/* Busca de aluno */}
                                        <div className="space-y-2">
                                            <Label>Buscar aluno</Label>
                                            <div className="flex gap-2">
                                                <Input
                                                    placeholder="Digite o nome do aluno..."
                                                    value={printSearch}
                                                    onChange={e => setPrintSearch(e.target.value)}
                                                    onKeyDown={e => e.key === 'Enter' && buscarAlunoPrint()}
                                                />
                                                <Button onClick={buscarAlunoPrint} disabled={loadingPrint}>
                                                    {loadingPrint ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                                                </Button>
                                            </div>
                                        </div>

                                        {/* Resultados da busca */}
                                        {printResults.length > 0 && (
                                            <div className="border rounded-lg divide-y">
                                                {printResults.map((aluno: any) => {
                                                    const turmaInfo = Array.isArray(aluno.turmas) ? aluno.turmas[0]?.nome : aluno.turmas?.nome;
                                                    return (
                                                        <button
                                                            key={aluno.id}
                                                            className="w-full flex items-center justify-between p-3 hover:bg-slate-50 text-left"
                                                            onClick={() => selecionarAlunoPrint(aluno)}
                                                        >
                                                            <div>
                                                                <p className="font-medium">{aluno.nome}</p>
                                                                <p className="text-sm text-gray-500">{turmaInfo}</p>
                                                            </div>
                                                            <Printer className="h-4 w-4 text-gray-400" />
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                        )}

                                        {/* Preview do Ingresso */}
                                        {selectedAluno && (
                                            <div className="space-y-4">
                                                <div className="flex items-center justify-between">
                                                    <Label>Preview do Ingresso</Label>
                                                    <Button variant="ghost" size="sm" onClick={() => setSelectedAluno(null)}>
                                                        <X className="h-4 w-4 mr-1" /> Limpar
                                                    </Button>
                                                </div>

                                                {/* Card do Ingresso */}
                                                <div className="flex justify-center">
                                                    <div
                                                        id="print-ticket"
                                                        ref={ticketRef}
                                                        className="bg-white w-72 rounded-2xl overflow-hidden shadow-xl border"
                                                    >
                                                        <div className="bg-purple-700 p-4 text-center">
                                                            <h2 className="text-white text-lg font-bold uppercase">{eventoAtivo.nome}</h2>
                                                            <p className="text-purple-200 text-xs">{formatarData(eventoAtivo.data_evento)}</p>
                                                        </div>

                                                        <div className="flex flex-col items-center p-4">
                                                            <div className="bg-white p-2 rounded-lg shadow">
                                                                <QRCode value={qrData} size={120} />
                                                            </div>
                                                            <h3 className="mt-3 font-bold text-gray-800">{selectedAluno.nome}</h3>
                                                            <p className="text-xs text-gray-500">
                                                                {Array.isArray(selectedAluno.turmas) ? selectedAluno.turmas[0]?.nome : selectedAluno.turmas?.nome}
                                                            </p>
                                                        </div>

                                                        <div className="bg-gray-100 p-2 text-center text-xs text-gray-500 border-t">
                                                            Apresente na portaria
                                                        </div>
                                                    </div>
                                                </div>

                                                {/* Botão de Impressão */}
                                                <Button onClick={handlePrint} className="w-full bg-green-600 hover:bg-green-700">
                                                    <Printer className="mr-2 h-4 w-4" /> Imprimir Este Ingresso
                                                </Button>
                                            </div>
                                        )}
                                    </>
                                )}
                            </CardContent>
                        </Card>
                    </TabsContent>
                </Tabs>
            </div>

            {/* Área de impressão (visível apenas no print) */}
            {selectedAluno && eventoAtivo && (
                <div id="print-ticket" className="hidden print:block">
                    <div className="bg-white w-72 rounded-2xl overflow-hidden border">
                        <div className="bg-purple-700 p-4 text-center">
                            <h2 className="text-white text-lg font-bold uppercase">{eventoAtivo.nome}</h2>
                            <p className="text-purple-200 text-xs">{formatarData(eventoAtivo.data_evento)}</p>
                        </div>
                        <div className="flex flex-col items-center p-4">
                            <div className="bg-white p-2 rounded-lg">
                                <QRCode value={qrData} size={120} />
                            </div>
                            <h3 className="mt-3 font-bold text-gray-800">{selectedAluno.nome}</h3>
                            <p className="text-xs text-gray-500">
                                {Array.isArray(selectedAluno.turmas) ? selectedAluno.turmas[0]?.nome : selectedAluno.turmas?.nome}
                            </p>
                        </div>
                        <div className="bg-gray-100 p-2 text-center text-xs text-gray-500 border-t">
                            Apresente na portaria
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}