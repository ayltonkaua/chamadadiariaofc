import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { whatsappBotService } from '@/domains/whatsappBot';
import type { BotStatus, WhatsAppBotConfig, WhatsAppLog, Turma, WhatsAppGroup } from '@/domains/whatsappBot';
import { toast } from '@/components/ui/use-toast';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
    MessageCircle,
    Wifi,
    WifiOff,
    QrCode,
    Send,
    AlertTriangle,
    Users,
    CalendarDays,
    Loader2,
    CheckCircle2,
    XCircle,
    RefreshCw,
    Save,
    Smartphone,
    History,
    UsersRound,
    Phone,
    Search,
    LogOut,
} from 'lucide-react';

export default function BotWhatsAppPage() {
    const { user } = useAuth();
    const escolaId = user?.escola_id || '';

    // Status
    const [status, setStatus] = useState<BotStatus | null>(null);
    const [qrCode, setQrCode] = useState<string | null>(null);
    const [loadingStatus, setLoadingStatus] = useState(false);
    const [loadingQR, setLoadingQR] = useState(false);
    const [disconnecting, setDisconnecting] = useState(false);

    // Manual send
    const [manualPhone, setManualPhone] = useState('');
    const [manualMessage, setManualMessage] = useState('');
    const [sendingManual, setSendingManual] = useState(false);

    // Templates / Config
    const [config, setConfig] = useState<WhatsAppBotConfig | null>(null);
    const [templateRisco, setTemplateRisco] = useState('');
    const [templateConsecutiva, setTemplateConsecutiva] = useState('');
    const [templateMensal, setTemplateMensal] = useState('');
    const [savingConfig, setSavingConfig] = useState(false);

    // Alert sending
    const [sendingRisk, setSendingRisk] = useState(false);
    const [sendingConsecutive, setSendingConsecutive] = useState(false);
    const [sendingMonthly, setSendingMonthly] = useState(false);

    // Logs
    const [logs, setLogs] = useState<WhatsAppLog[]>([]);
    const [loadingLogs, setLoadingLogs] = useState(false);

    // Groups — Turmas
    const [turmas, setTurmas] = useState<Turma[]>([]);
    const [loadingTurmas, setLoadingTurmas] = useState(false);
    const [selectedTurma, setSelectedTurma] = useState<Turma | null>(null);
    const [groupMessage, setGroupMessage] = useState('');
    const [sendingGroup, setSendingGroup] = useState(false);

    // Groups — WhatsApp Groups
    const [waGroups, setWaGroups] = useState<WhatsAppGroup[]>([]);
    const [loadingWaGroups, setLoadingWaGroups] = useState(false);
    const [selectedWaGroup, setSelectedWaGroup] = useState<WhatsAppGroup | null>(null);
    const [waGroupMessage, setWaGroupMessage] = useState('');
    const [sendingWaGroup, setSendingWaGroup] = useState(false);
    const [waGroupSearch, setWaGroupSearch] = useState('');

    // =====================
    // Load Status
    // =====================
    const loadStatus = useCallback(async () => {
        if (!escolaId) return;
        setLoadingStatus(true);
        try {
            const s = await whatsappBotService.getStatus(escolaId);
            setStatus(s);
        } catch {
            setStatus({ escola_id: escolaId, connected: false, phone: null, hasQR: false });
        } finally {
            setLoadingStatus(false);
        }
    }, [escolaId]);

    // =====================
    // Load Config
    // =====================
    const loadConfig = useCallback(async () => {
        if (!escolaId) return;
        try {
            const c = await whatsappBotService.getConfig(escolaId);
            if (c) {
                setConfig(c);
                setTemplateRisco(c.template_risco);
                setTemplateConsecutiva(c.template_consecutiva);
                setTemplateMensal(c.template_mensal);
            } else {
                setTemplateRisco('Olá {responsavel}, o(a) aluno(a) {nome} está em situação de risco com {faltas} faltas. Entre em contato com a escola. Data: {data}');
                setTemplateConsecutiva('Olá {responsavel}, o(a) aluno(a) {nome} possui {faltas} faltas consecutivas. Data: {data}');
                setTemplateMensal('Olá {responsavel}, resumo mensal de {nome}: {faltas} faltas no mês. Data: {data}');
            }
        } catch (err: any) {
            console.error('Error loading config:', err);
        }
    }, [escolaId]);

    // =====================
    // Load Logs
    // =====================
    const loadLogs = useCallback(async () => {
        if (!escolaId) return;
        setLoadingLogs(true);
        try {
            const l = await whatsappBotService.getLogs(escolaId, 50);
            setLogs(l);
        } catch (err: any) {
            console.error('Error loading logs:', err);
        } finally {
            setLoadingLogs(false);
        }
    }, [escolaId]);

    // =====================
    // Load Turmas
    // =====================
    const loadTurmas = useCallback(async () => {
        if (!escolaId) return;
        setLoadingTurmas(true);
        try {
            const t = await whatsappBotService.getTurmas(escolaId);
            setTurmas(t);
        } catch (err: any) {
            console.error('Error loading turmas:', err);
        } finally {
            setLoadingTurmas(false);
        }
    }, [escolaId]);

    // =====================
    // Load WhatsApp Groups
    // =====================
    const loadWaGroups = useCallback(async () => {
        if (!escolaId) return;
        setLoadingWaGroups(true);
        try {
            const g = await whatsappBotService.getWhatsAppGroups(escolaId);
            setWaGroups(g);
        } catch (err: any) {
            console.error('Error loading WhatsApp groups:', err);
            toast({ title: 'Erro ao buscar grupos', description: err.message, variant: 'destructive' });
        } finally {
            setLoadingWaGroups(false);
        }
    }, [escolaId]);

    useEffect(() => {
        loadStatus();
        loadConfig();
        loadLogs();
        loadTurmas();
    }, [loadStatus, loadConfig, loadLogs, loadTurmas]);

    // Poll status every 10s
    useEffect(() => {
        const interval = setInterval(loadStatus, 10000);
        return () => clearInterval(interval);
    }, [loadStatus]);

    // =====================
    // Generate QR
    // =====================
    const handleGenerateQR = async () => {
        setLoadingQR(true);
        setQrCode(null);
        try {
            const result = await whatsappBotService.generateQR(escolaId);
            if (result.connected) {
                toast({ title: 'WhatsApp já está conectado!', description: `Número: ${result.phone}` });
                await loadStatus();
            } else if (result.qr) {
                setQrCode(result.qr);
                toast({ title: 'QR Code gerado', description: 'Escaneie com o WhatsApp do celular da escola' });
            } else {
                toast({ title: 'Aguardando QR...', description: 'Tente novamente em alguns segundos' });
            }
        } catch (err: any) {
            toast({ title: 'Erro', description: err.message, variant: 'destructive' });
        } finally {
            setLoadingQR(false);
        }
    };

    // =====================
    // Manual Send
    // =====================
    const handleSendManual = async () => {
        if (!manualPhone.trim() || !manualMessage.trim()) {
            toast({ title: 'Preencha todos os campos', variant: 'destructive' });
            return;
        }
        setSendingManual(true);
        try {
            await whatsappBotService.sendManual(escolaId, {
                telefone: manualPhone,
                mensagem: manualMessage,
            });
            toast({ title: '✅ Mensagem enviada!', description: `Para: ${manualPhone}` });
            setManualPhone('');
            setManualMessage('');
            loadLogs();
        } catch (err: any) {
            toast({ title: 'Erro ao enviar', description: err.message, variant: 'destructive' });
        } finally {
            setSendingManual(false);
        }
    };

    // =====================
    // Save Config
    // =====================
    const handleSaveConfig = async () => {
        setSavingConfig(true);
        try {
            await whatsappBotService.saveConfig(escolaId, {
                template_risco: templateRisco,
                template_consecutiva: templateConsecutiva,
                template_mensal: templateMensal,
            });
            toast({ title: '✅ Templates salvos!' });
            loadConfig();
        } catch (err: any) {
            toast({ title: 'Erro ao salvar', description: err.message, variant: 'destructive' });
        } finally {
            setSavingConfig(false);
        }
    };

    // =====================
    // Alert Sends
    // =====================
    const handleSendRisk = async () => {
        setSendingRisk(true);
        try {
            const result = await whatsappBotService.sendRiskAlert(escolaId, { template: templateRisco });
            toast({
                title: '✅ Alertas de risco enviados',
                description: `Enviados: ${result.sent || 0} | Falhas: ${result.failed || 0}`,
            });
            loadLogs();
        } catch (err: any) {
            toast({ title: 'Erro', description: err.message, variant: 'destructive' });
        } finally {
            setSendingRisk(false);
        }
    };

    const handleSendConsecutive = async () => {
        setSendingConsecutive(true);
        try {
            const result = await whatsappBotService.sendConsecutiveAlert(escolaId, { template: templateConsecutiva });
            toast({
                title: '✅ Alertas de faltas consecutivas enviados',
                description: `Enviados: ${result.sent || 0} | Falhas: ${result.failed || 0}`,
            });
            loadLogs();
        } catch (err: any) {
            toast({ title: 'Erro', description: err.message, variant: 'destructive' });
        } finally {
            setSendingConsecutive(false);
        }
    };

    const handleSendMonthly = async () => {
        setSendingMonthly(true);
        try {
            const result = await whatsappBotService.sendMonthlySummary(escolaId, { template: templateMensal });
            toast({
                title: '✅ Resumo mensal enviado',
                description: `Enviados: ${result.sent || 0} | Falhas: ${result.failed || 0}`,
            });
            loadLogs();
        } catch (err: any) {
            toast({ title: 'Erro', description: err.message, variant: 'destructive' });
        } finally {
            setSendingMonthly(false);
        }
    };

    // =====================
    // Send to Turma Group
    // =====================
    const handleSendToGroup = async () => {
        if (!selectedTurma || !groupMessage.trim()) {
            toast({ title: 'Selecione uma turma e digite a mensagem', variant: 'destructive' });
            return;
        }
        setSendingGroup(true);
        try {
            const result = await whatsappBotService.sendToGroup(escolaId, {
                turma_id: selectedTurma.id,
                mensagem: groupMessage,
            });
            toast({
                title: `✅ Mensagem enviada para ${selectedTurma.nome}`,
                description: `Enviados: ${result.sent || 0} | Falhas: ${result.failed || 0}`,
            });
            setGroupMessage('');
            setSelectedTurma(null);
            loadLogs();
        } catch (err: any) {
            toast({ title: 'Erro ao enviar', description: err.message, variant: 'destructive' });
        } finally {
            setSendingGroup(false);
        }
    };

    // =====================
    // Send to WhatsApp Group
    // =====================
    const handleSendToWaGroup = async () => {
        if (!selectedWaGroup || !waGroupMessage.trim()) {
            toast({ title: 'Selecione um grupo e digite a mensagem', variant: 'destructive' });
            return;
        }
        setSendingWaGroup(true);
        try {
            await whatsappBotService.sendToWhatsAppGroup(escolaId, selectedWaGroup.id, waGroupMessage);
            toast({
                title: `✅ Mensagem enviada!`,
                description: `Grupo: ${selectedWaGroup.name}`,
            });
            setWaGroupMessage('');
            setSelectedWaGroup(null);
            loadLogs();
        } catch (err: any) {
            toast({ title: 'Erro ao enviar', description: err.message, variant: 'destructive' });
        } finally {
            setSendingWaGroup(false);
        }
    };

    // =====================
    // Helpers
    // =====================
    const isConnected = status?.connected === true;

    const formatDate = (dateStr: string) => {
        return new Date(dateStr).toLocaleString('pt-BR', {
            day: '2-digit', month: '2-digit', year: '2-digit',
            hour: '2-digit', minute: '2-digit',
        });
    };

    const tipoLabel: Record<string, string> = {
        manual: 'Manual',
        risco: 'Risco',
        consecutiva: 'Consecutiva',
        mensal: 'Mensal',
    };

    const filteredWaGroups = waGroups.filter((g) =>
        g.name.toLowerCase().includes(waGroupSearch.toLowerCase())
    );

    // =====================
    // Render
    // =====================
    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-green-600 flex items-center justify-center shadow-lg">
                    <MessageCircle className="h-5 w-5 text-white" />
                </div>
                <div>
                    <h1 className="text-2xl font-bold text-slate-800">Bot WhatsApp</h1>
                    <p className="text-sm text-slate-500">Alertas automáticos e comunicação com responsáveis</p>
                </div>
            </div>

            <Tabs defaultValue="status" className="space-y-4">
                <TabsList className="grid w-full grid-cols-5">
                    <TabsTrigger value="status" className="flex items-center gap-1.5 text-xs sm:text-sm">
                        <Smartphone className="h-4 w-4" />
                        <span className="hidden sm:inline">Status</span>
                    </TabsTrigger>
                    <TabsTrigger value="manual" className="flex items-center gap-1.5 text-xs sm:text-sm">
                        <Send className="h-4 w-4" />
                        <span className="hidden sm:inline">Envio</span>
                    </TabsTrigger>
                    <TabsTrigger value="groups" className="flex items-center gap-1.5 text-xs sm:text-sm">
                        <UsersRound className="h-4 w-4" />
                        <span className="hidden sm:inline">Grupos</span>
                    </TabsTrigger>
                    <TabsTrigger value="templates" className="flex items-center gap-1.5 text-xs sm:text-sm">
                        <AlertTriangle className="h-4 w-4" />
                        <span className="hidden sm:inline">Alertas</span>
                    </TabsTrigger>
                    <TabsTrigger value="logs" className="flex items-center gap-1.5 text-xs sm:text-sm">
                        <History className="h-4 w-4" />
                        <span className="hidden sm:inline">Histórico</span>
                    </TabsTrigger>
                </TabsList>

                {/* ==================== TAB 1: STATUS ==================== */}
                <TabsContent value="status">
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                {isConnected ? (
                                    <Wifi className="h-5 w-5 text-green-500" />
                                ) : (
                                    <WifiOff className="h-5 w-5 text-red-500" />
                                )}
                                Status da Conexão
                            </CardTitle>
                            <CardDescription>
                                Cada escola possui sua própria sessão e número de WhatsApp
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="flex items-center gap-4">
                                <Badge variant={isConnected ? 'default' : 'destructive'} className="text-sm px-3 py-1">
                                    {isConnected ? '🟢 Conectado' : '🔴 Desconectado'}
                                </Badge>
                                {status?.phone && (
                                    <span className="text-sm text-slate-600">📱 {status.phone}</span>
                                )}
                                <Button variant="outline" size="sm" onClick={loadStatus} disabled={loadingStatus}>
                                    <RefreshCw className={`h-4 w-4 mr-1 ${loadingStatus ? 'animate-spin' : ''}`} />
                                    Atualizar
                                </Button>
                            </div>

                            <Separator />

                            {!isConnected && (
                                <div className="space-y-4">
                                    <p className="text-sm text-slate-600">
                                        Para conectar, clique em "Gerar QR Code" e escaneie com o WhatsApp do celular da escola.
                                    </p>
                                    <Button onClick={handleGenerateQR} disabled={loadingQR} className="bg-green-600 hover:bg-green-700">
                                        {loadingQR ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <QrCode className="h-4 w-4 mr-2" />}
                                        Gerar QR Code
                                    </Button>
                                    {qrCode && (
                                        <div className="flex flex-col items-center gap-3 p-4 border rounded-lg bg-white">
                                            <p className="text-sm font-medium text-slate-700">Escaneie o QR Code abaixo:</p>
                                            <img src={qrCode} alt="QR Code WhatsApp" className="w-64 h-64 rounded-lg shadow-md" />
                                            <p className="text-xs text-slate-500">Abra o WhatsApp → Configurações → Dispositivos Conectados → Conectar Dispositivo</p>
                                        </div>
                                    )}
                                </div>
                            )}

                            {isConnected && (
                                <div className="rounded-lg bg-green-50 border border-green-200 p-4">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            <CheckCircle2 className="h-5 w-5 text-green-600" />
                                            <p className="text-sm font-medium text-green-800">
                                                WhatsApp conectado e pronto para enviar mensagens!
                                            </p>
                                        </div>
                                        <Button
                                            variant="destructive"
                                            size="sm"
                                            onClick={async () => {
                                                if (!confirm('Tem certeza que deseja desconectar o WhatsApp? Será necessário escanear o QR Code novamente.')) return;
                                                setDisconnecting(true);
                                                try {
                                                    await whatsappBotService.disconnect(escolaId);
                                                    toast({ title: '🔌 WhatsApp desconectado', description: 'Sessão encerrada com sucesso' });
                                                    setStatus({ escola_id: escolaId, connected: false, phone: null, hasQR: false });
                                                    setQrCode(null);
                                                } catch (err: any) {
                                                    toast({ title: 'Erro ao desconectar', description: err.message, variant: 'destructive' });
                                                } finally {
                                                    setDisconnecting(false);
                                                }
                                            }}
                                            disabled={disconnecting}
                                        >
                                            {disconnecting ? (
                                                <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
                                            ) : (
                                                <LogOut className="h-4 w-4 mr-1.5" />
                                            )}
                                            Desconectar
                                        </Button>
                                    </div>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* ==================== TAB 2: ENVIO MANUAL ==================== */}
                <TabsContent value="manual">
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <Send className="h-5 w-5 text-blue-500" />
                                Envio Manual
                            </CardTitle>
                            <CardDescription>Envie uma mensagem individual via WhatsApp</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            {!isConnected && (
                                <div className="rounded-lg bg-yellow-50 border border-yellow-200 p-3 flex items-center gap-2">
                                    <AlertTriangle className="h-4 w-4 text-yellow-600" />
                                    <p className="text-sm text-yellow-800">Conecte o WhatsApp primeiro na aba "Status"</p>
                                </div>
                            )}
                            <div className="space-y-3">
                                <div>
                                    <label className="text-sm font-medium text-slate-700">Número do telefone</label>
                                    <Input placeholder="5511999999999" value={manualPhone} onChange={(e) => setManualPhone(e.target.value)} disabled={!isConnected} className="mt-1" />
                                    <p className="text-xs text-slate-400 mt-1">Formato: código do país + DDD + número (ex: 5511999999999)</p>
                                </div>
                                <div>
                                    <label className="text-sm font-medium text-slate-700">Mensagem</label>
                                    <Textarea placeholder="Digite sua mensagem aqui..." value={manualMessage} onChange={(e) => setManualMessage(e.target.value)} disabled={!isConnected} rows={4} className="mt-1" />
                                </div>
                                <Button onClick={handleSendManual} disabled={!isConnected || sendingManual || !manualPhone.trim() || !manualMessage.trim()} className="w-full bg-green-600 hover:bg-green-700">
                                    {sendingManual ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Send className="h-4 w-4 mr-2" />}
                                    Enviar Mensagem
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* ==================== TAB 3: GRUPOS ==================== */}
                <TabsContent value="groups">
                    <div className="space-y-6">
                        {!isConnected && (
                            <div className="rounded-lg bg-yellow-50 border border-yellow-200 p-3 flex items-center gap-2">
                                <AlertTriangle className="h-4 w-4 text-yellow-600" />
                                <p className="text-sm text-yellow-800">Conecte o WhatsApp primeiro na aba "Status"</p>
                            </div>
                        )}

                        {/* ===== WHATSAPP GROUPS (from connected account) ===== */}
                        <Card>
                            <CardHeader>
                                <div className="flex items-center justify-between">
                                    <div>
                                        <CardTitle className="flex items-center gap-2">
                                            <MessageCircle className="h-5 w-5 text-green-500" />
                                            Grupos do WhatsApp
                                        </CardTitle>
                                        <CardDescription>
                                            Grupos da conta conectada — envie mensagens diretamente para eles
                                        </CardDescription>
                                    </div>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={loadWaGroups}
                                        disabled={loadingWaGroups || !isConnected}
                                    >
                                        <RefreshCw className={`h-4 w-4 mr-1 ${loadingWaGroups ? 'animate-spin' : ''}`} />
                                        {waGroups.length === 0 ? 'Carregar Grupos' : 'Atualizar'}
                                    </Button>
                                </div>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                {loadingWaGroups ? (
                                    <div className="flex items-center justify-center py-8">
                                        <Loader2 className="h-6 w-6 animate-spin text-green-500" />
                                        <span className="ml-2 text-sm text-slate-500">Buscando grupos do WhatsApp...</span>
                                    </div>
                                ) : waGroups.length === 0 ? (
                                    <div className="text-center py-8 text-slate-400">
                                        <MessageCircle className="h-12 w-12 mx-auto mb-2 opacity-30" />
                                        <p>Clique em "Carregar Grupos" para buscar os grupos do WhatsApp</p>
                                    </div>
                                ) : (
                                    <>
                                        {/* Search */}
                                        <div className="relative">
                                            <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                                            <Input
                                                placeholder="Buscar grupo..."
                                                value={waGroupSearch}
                                                onChange={(e) => setWaGroupSearch(e.target.value)}
                                                className="pl-9"
                                            />
                                        </div>

                                        {/* Group List */}
                                        <ScrollArea className="h-[300px]">
                                            <div className="grid gap-2 sm:grid-cols-2">
                                                {filteredWaGroups.map((group) => (
                                                    <button
                                                        key={group.id}
                                                        onClick={() => setSelectedWaGroup(selectedWaGroup?.id === group.id ? null : group)}
                                                        className={`p-3 rounded-lg border text-left transition-all hover:shadow-md ${selectedWaGroup?.id === group.id
                                                            ? 'border-green-500 bg-green-50 ring-2 ring-green-200'
                                                            : 'border-slate-200 bg-white hover:border-slate-300'
                                                            }`}
                                                    >
                                                        <div className="flex items-center gap-2">
                                                            <div className="h-8 w-8 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0">
                                                                <UsersRound className="h-4 w-4 text-green-600" />
                                                            </div>
                                                            <div className="min-w-0 flex-1">
                                                                <p className="font-medium text-sm text-slate-800 truncate">{group.name}</p>
                                                                <p className="text-xs text-slate-500">{group.participants} participantes</p>
                                                            </div>
                                                        </div>
                                                    </button>
                                                ))}
                                            </div>
                                        </ScrollArea>

                                        <p className="text-xs text-slate-400 text-center">
                                            {filteredWaGroups.length} de {waGroups.length} grupos
                                        </p>
                                    </>
                                )}

                                {/* Send to WhatsApp Group */}
                                {selectedWaGroup && (
                                    <div className="mt-4 border-t pt-4 space-y-3">
                                        <div className="flex items-center gap-2">
                                            <div className="h-8 w-8 rounded-full bg-green-500 flex items-center justify-center">
                                                <UsersRound className="h-4 w-4 text-white" />
                                            </div>
                                            <div>
                                                <p className="font-medium text-sm text-slate-800">{selectedWaGroup.name}</p>
                                                <p className="text-xs text-slate-500">{selectedWaGroup.participants} participantes</p>
                                            </div>
                                        </div>

                                        <Textarea
                                            placeholder="Digite a mensagem para o grupo..."
                                            value={waGroupMessage}
                                            onChange={(e) => setWaGroupMessage(e.target.value)}
                                            disabled={!isConnected}
                                            rows={3}
                                        />

                                        <div className="flex items-center gap-3">
                                            <Button
                                                onClick={handleSendToWaGroup}
                                                disabled={!isConnected || sendingWaGroup || !waGroupMessage.trim()}
                                                className="bg-green-600 hover:bg-green-700"
                                            >
                                                {sendingWaGroup ? (
                                                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                                ) : (
                                                    <Send className="h-4 w-4 mr-2" />
                                                )}
                                                Enviar para o Grupo
                                            </Button>
                                            <Button variant="outline" onClick={() => setSelectedWaGroup(null)}>
                                                Cancelar
                                            </Button>
                                        </div>
                                    </div>
                                )}
                            </CardContent>
                        </Card>

                        {/* ===== TURMAS (from database) ===== */}
                        <Card>
                            <CardHeader>
                                <div className="flex items-center justify-between">
                                    <div>
                                        <CardTitle className="flex items-center gap-2">
                                            <UsersRound className="h-5 w-5 text-indigo-500" />
                                            Envio por Turma
                                        </CardTitle>
                                        <CardDescription>
                                            Envie mensagens personalizadas para todos os responsáveis de uma turma
                                        </CardDescription>
                                    </div>
                                    <Button variant="outline" size="sm" onClick={loadTurmas} disabled={loadingTurmas}>
                                        <RefreshCw className={`h-4 w-4 mr-1 ${loadingTurmas ? 'animate-spin' : ''}`} />
                                        Atualizar
                                    </Button>
                                </div>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                {loadingTurmas ? (
                                    <div className="flex items-center justify-center py-6">
                                        <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
                                        <span className="ml-2 text-sm text-slate-500">Carregando turmas...</span>
                                    </div>
                                ) : turmas.length === 0 ? (
                                    <div className="text-center py-6 text-slate-400">
                                        <UsersRound className="h-10 w-10 mx-auto mb-2 opacity-30" />
                                        <p className="text-sm">Nenhuma turma encontrada</p>
                                    </div>
                                ) : (
                                    <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                                        {turmas.map((turma) => (
                                            <button
                                                key={turma.id}
                                                onClick={() => setSelectedTurma(selectedTurma?.id === turma.id ? null : turma)}
                                                className={`p-3 rounded-lg border text-left transition-all hover:shadow-md ${selectedTurma?.id === turma.id
                                                    ? 'border-indigo-500 bg-indigo-50 ring-2 ring-indigo-200'
                                                    : 'border-slate-200 bg-white hover:border-slate-300'
                                                    }`}
                                            >
                                                <div className="flex items-center justify-between">
                                                    <span className="font-medium text-sm text-slate-800">{turma.nome}</span>
                                                    {turma.turno && (
                                                        <Badge variant="outline" className="text-xs">{turma.turno}</Badge>
                                                    )}
                                                </div>
                                                <div className="flex items-center gap-3 mt-1.5">
                                                    <span className="text-xs text-slate-500 flex items-center gap-1">
                                                        <Users className="h-3 w-3" /> {turma.alunos_count} alunos
                                                    </span>
                                                    <span className={`text-xs flex items-center gap-1 ${turma.alunos_com_telefone > 0 ? 'text-green-600' : 'text-red-500'}`}>
                                                        <Phone className="h-3 w-3" /> {turma.alunos_com_telefone} com tel.
                                                    </span>
                                                </div>
                                            </button>
                                        ))}
                                    </div>
                                )}

                                {/* Send to Turma */}
                                {selectedTurma && (
                                    <div className="mt-4 border-t pt-4 space-y-3">
                                        <p className="text-sm font-medium text-indigo-700">
                                            Mensagem para {selectedTurma.nome} ({selectedTurma.alunos_com_telefone} responsáveis com telefone)
                                        </p>
                                        <p className="text-xs text-slate-500">
                                            Variáveis: <code className="bg-slate-100 px-1 py-0.5 rounded">{'{nome}'}</code>{' '}
                                            <code className="bg-slate-100 px-1 py-0.5 rounded">{'{responsavel}'}</code>{' '}
                                            <code className="bg-slate-100 px-1 py-0.5 rounded">{'{turma}'}</code>{' '}
                                            <code className="bg-slate-100 px-1 py-0.5 rounded">{'{data}'}</code>
                                        </p>
                                        <Textarea
                                            placeholder={`Olá {responsavel}, informamos que a turma {turma} terá atividade especial. Aluno(a): {nome}.`}
                                            value={groupMessage}
                                            onChange={(e) => setGroupMessage(e.target.value)}
                                            disabled={!isConnected}
                                            rows={3}
                                        />
                                        <div className="flex items-center gap-3">
                                            <Button
                                                onClick={handleSendToGroup}
                                                disabled={!isConnected || sendingGroup || !groupMessage.trim()}
                                                className="bg-indigo-600 hover:bg-indigo-700"
                                            >
                                                {sendingGroup ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Send className="h-4 w-4 mr-2" />}
                                                Enviar para {selectedTurma.alunos_com_telefone} responsáveis
                                            </Button>
                                            <Button variant="outline" onClick={() => setSelectedTurma(null)}>Cancelar</Button>
                                        </div>
                                        {sendingGroup && (
                                            <div className="rounded-lg bg-indigo-50 border border-indigo-200 p-3 flex items-center gap-2">
                                                <Loader2 className="h-4 w-4 animate-spin text-indigo-600" />
                                                <p className="text-sm text-indigo-800">Enviando... (4s entre cada envio)</p>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    </div>
                </TabsContent>

                {/* ==================== TAB 4: TEMPLATES + ALERTAS ==================== */}
                <TabsContent value="templates">
                    <div className="space-y-4">
                        <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    <AlertTriangle className="h-5 w-5 text-orange-500" />
                                    Templates de Mensagem
                                </CardTitle>
                                <CardDescription>
                                    Personalize as mensagens. Variáveis: <code className="bg-slate-100 px-1.5 py-0.5 rounded text-xs">{'{nome}'}</code>{' '}
                                    <code className="bg-slate-100 px-1.5 py-0.5 rounded text-xs">{'{faltas}'}</code>{' '}
                                    <code className="bg-slate-100 px-1.5 py-0.5 rounded text-xs">{'{responsavel}'}</code>{' '}
                                    <code className="bg-slate-100 px-1.5 py-0.5 rounded text-xs">{'{data}'}</code>
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div>
                                    <label className="text-sm font-medium text-red-700">🔴 Template — Aluno em Risco</label>
                                    <Textarea value={templateRisco} onChange={(e) => setTemplateRisco(e.target.value)} rows={3} className="mt-1" />
                                </div>
                                <div>
                                    <label className="text-sm font-medium text-orange-700">🟠 Template — Faltas Consecutivas</label>
                                    <Textarea value={templateConsecutiva} onChange={(e) => setTemplateConsecutiva(e.target.value)} rows={3} className="mt-1" />
                                </div>
                                <div>
                                    <label className="text-sm font-medium text-blue-700">🔵 Template — Resumo Mensal</label>
                                    <Textarea value={templateMensal} onChange={(e) => setTemplateMensal(e.target.value)} rows={3} className="mt-1" />
                                </div>
                                <Button onClick={handleSaveConfig} disabled={savingConfig} variant="outline">
                                    {savingConfig ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
                                    Salvar Templates
                                </Button>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    <Users className="h-5 w-5 text-purple-500" />
                                    Disparar Alertas
                                </CardTitle>
                                <CardDescription>Envie alertas em lote para os responsáveis dos alunos</CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-3">
                                {!isConnected && (
                                    <div className="rounded-lg bg-yellow-50 border border-yellow-200 p-3 flex items-center gap-2">
                                        <AlertTriangle className="h-4 w-4 text-yellow-600" />
                                        <p className="text-sm text-yellow-800">Conecte o WhatsApp primeiro na aba "Status"</p>
                                    </div>
                                )}
                                <div className="grid gap-3 sm:grid-cols-3">
                                    <Button onClick={handleSendRisk} disabled={!isConnected || sendingRisk} className="bg-red-600 hover:bg-red-700 h-auto py-3">
                                        {sendingRisk ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <AlertTriangle className="h-4 w-4 mr-2" />}
                                        <div className="text-left">
                                            <div className="font-medium">Alunos em Risco</div>
                                            <div className="text-xs opacity-80">&gt;30% faltas</div>
                                        </div>
                                    </Button>
                                    <Button onClick={handleSendConsecutive} disabled={!isConnected || sendingConsecutive} className="bg-orange-600 hover:bg-orange-700 h-auto py-3">
                                        {sendingConsecutive ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Users className="h-4 w-4 mr-2" />}
                                        <div className="text-left">
                                            <div className="font-medium">Faltas Consecutivas</div>
                                            <div className="text-xs opacity-80">2+ seguidas</div>
                                        </div>
                                    </Button>
                                    <Button onClick={handleSendMonthly} disabled={!isConnected || sendingMonthly} className="bg-blue-600 hover:bg-blue-700 h-auto py-3">
                                        {sendingMonthly ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <CalendarDays className="h-4 w-4 mr-2" />}
                                        <div className="text-left">
                                            <div className="font-medium">Resumo Mensal</div>
                                            <div className="text-xs opacity-80">Faltas do mês</div>
                                        </div>
                                    </Button>
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                </TabsContent>

                {/* ==================== TAB 5: HISTÓRICO ==================== */}
                <TabsContent value="logs">
                    <Card>
                        <CardHeader>
                            <div className="flex items-center justify-between">
                                <div>
                                    <CardTitle className="flex items-center gap-2">
                                        <History className="h-5 w-5 text-slate-500" />
                                        Histórico de Envios
                                    </CardTitle>
                                    <CardDescription>Últimas 50 mensagens enviadas</CardDescription>
                                </div>
                                <Button variant="outline" size="sm" onClick={loadLogs} disabled={loadingLogs}>
                                    <RefreshCw className={`h-4 w-4 mr-1 ${loadingLogs ? 'animate-spin' : ''}`} />
                                    Atualizar
                                </Button>
                            </div>
                        </CardHeader>
                        <CardContent>
                            {logs.length === 0 ? (
                                <div className="text-center py-8 text-slate-400">
                                    <MessageCircle className="h-12 w-12 mx-auto mb-2 opacity-30" />
                                    <p>Nenhuma mensagem enviada ainda</p>
                                </div>
                            ) : (
                                <ScrollArea className="h-[400px]">
                                    <div className="space-y-2">
                                        {logs.map((log) => (
                                            <div key={log.id} className="flex items-start gap-3 p-3 rounded-lg border bg-white hover:bg-slate-50 transition-colors">
                                                <div className="mt-0.5">
                                                    {log.status === 'enviado' ? <CheckCircle2 className="h-4 w-4 text-green-500" /> : <XCircle className="h-4 w-4 text-red-500" />}
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-center gap-2 flex-wrap">
                                                        <Badge variant="outline" className="text-xs">{tipoLabel[log.tipo] || log.tipo}</Badge>
                                                        <span className="text-xs text-slate-400">{formatDate(log.created_at)}</span>
                                                    </div>
                                                    <p className="text-sm text-slate-600 mt-1 truncate">📱 {log.telefone}</p>
                                                    <p className="text-xs text-slate-400 mt-0.5 line-clamp-2">{log.mensagem}</p>
                                                    {log.erro && <p className="text-xs text-red-500 mt-1">❌ {log.erro}</p>}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </ScrollArea>
                            )}
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>
        </div>
    );
}
