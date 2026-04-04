import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { whatsappBotService } from '@/domains/whatsappBot';
import type { BotStatus, WhatsAppBotConfig, WhatsAppLog, Turma, SendProgress } from '@/domains/whatsappBot';
import { toast } from '@/components/ui/use-toast';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Bot, Zap, Rocket, MessageCircle, FileCheck2, Headphones, UserPlus } from 'lucide-react';
import ConfirmDialog from '@/components/ui/ConfirmDialog';

import BotDashboard from '@/components/whatsapp/BotDashboard';
import BotAutomations from '@/components/whatsapp/BotAutomations';
import BotCampaigns from '@/components/whatsapp/BotCampaigns';
import KanbanJustificativas from '@/components/whatsapp/KanbanJustificativas';
import BotPortalTickets from '@/components/whatsapp/BotPortalTickets';
import BotSecretariaSuport from '@/components/whatsapp/BotSecretariaSuport';
import BotCadastroResponsavel from '@/components/whatsapp/BotCadastroResponsavel';

export default function BotWhatsAppPage() {
    const { user } = useAuth();
    const escolaId = user?.escola_id || '';

    // ==========================================
    // ESTADOS GERAIS DO BOT (STATUS E CONEXÃO)
    // ==========================================
    const [status, setStatus] = useState<BotStatus | null>(null);
    const [qrCode, setQrCode] = useState<string | null>(null);
    const [loadingStatus, setLoadingStatus] = useState(false);
    const [loadingQR, setLoadingQR] = useState(false);
    const [disconnecting, setDisconnecting] = useState(false);

    // ==========================================
    // ESTADOS DE PAINEL RÁPIDO (DASHBOARD)
    // ==========================================
    const [manualPhone, setManualPhone] = useState('');
    const [manualMessage, setManualMessage] = useState('');
    const [sendingManual, setSendingManual] = useState(false);

    // ==========================================
    // ESTADOS DE AUTOMAÇÃO E CONFIGURAÇÃO
    // ==========================================
    const [config, setConfig] = useState<WhatsAppBotConfig | null>(null);
    const [savingConfig, setSavingConfig] = useState(false);

    // ==========================================
    // ESTADOS DE CAMPANHAS (TURMAS/HISTÓRICO)
    // ==========================================
    const [turmas, setTurmas] = useState<Turma[]>([]);
    const [loadingTurmas, setLoadingTurmas] = useState(false);
    const [logs, setLogs] = useState<WhatsAppLog[]>([]);
    const [loadingLogs, setLoadingLogs] = useState(false);
    
    // Controle de Disparo de Campanha (Turmas)
    const [sendingGroup, setSendingGroup] = useState(false);
    const [sendProgress, setSendProgress] = useState<SendProgress | null>(null);

    // =====================
    // LOADERS (Data Fetching)
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

    const loadConfig = useCallback(async () => {
        if (!escolaId) return;
        try {
            const c = await whatsappBotService.getConfig(escolaId);
            setConfig(c);
        } catch (err: any) {
            console.error('Error loading config:', err);
        }
    }, [escolaId]);

    const loadLogs = useCallback(async () => {
        if (!escolaId) return;
        setLoadingLogs(true);
        try {
            const l = await whatsappBotService.getLogs(escolaId, 100);
            setLogs(l);
        } catch (err: any) {
            console.error('Error loading logs:', err);
        } finally {
            setLoadingLogs(false);
        }
    }, [escolaId]);

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

    // Inicialização da Página
    useEffect(() => {
        loadStatus();
        loadConfig();
        loadLogs();
        loadTurmas();
    }, [loadStatus, loadConfig, loadLogs, loadTurmas]);

    // Polling contínuo de status da conexão apenas
    useEffect(() => {
        const interval = setInterval(loadStatus, 15000);
        return () => clearInterval(interval);
    }, [loadStatus]);

    // =====================
    // HANDLERS DASHBOARD
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
                toast({ title: 'QR Code gerado', description: 'Escaneie com o WhatsApp da escola' });
            }
        } catch (err: any) {
            toast({ title: 'Erro', description: err.message, variant: 'destructive' });
        } finally {
            setLoadingQR(false);
        }
    };

    const [confirmDisconnect, setConfirmDisconnect] = useState(false);

    const handleDisconnect = async () => {
        setConfirmDisconnect(false);
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
    };

    const handleSendManual = async () => {
        setSendingManual(true);
        try {
            await whatsappBotService.sendManual(escolaId, { telefone: manualPhone, mensagem: manualMessage });
            toast({ title: '✅ Mensagem rápida enviada!' });
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
    // HANDLERS AUTOMAÇÃO
    // =====================
    const handleSaveConfig = async (newConfig: Partial<WhatsAppBotConfig>) => {
        setSavingConfig(true);
        try {
            await whatsappBotService.saveConfig(escolaId, newConfig);
            toast({ title: '✅ Automações salvas com sucesso!' });
            loadConfig();
        } catch (err: any) {
           toast({ title: 'Erro ao salvar', description: err.message, variant: 'destructive' });
        } finally {
           setSavingConfig(false);
        }
    }

    // =====================
    // HANDLERS CAMPANHA
    // =====================

    const handleSendToGroup = async (turmaId: string, mensagem: string) => {
        setSendingGroup(true);
        setSendProgress(null);
        try {
            const result = await whatsappBotService.sendToGroup(escolaId, { turma_id: turmaId, mensagem });
            toast({
                title: `✅ Campanha Iniciada`,
                description: `Enviados: ${result.sent || 0} | Falhas: ${result.failed || 0}`,
            });
            loadLogs();
        } catch (err: any) {
            toast({ title: 'Erro ao iniciar campanha', description: err.message, variant: 'destructive' });
        } finally {
            setSendingGroup(false);
            setSendProgress(null);
        }
    };

    // Poll progresso da campanha em andamento
    useEffect(() => {
        if (!sendingGroup || !escolaId) return;
        const interval = setInterval(async () => {
            try {
                const progress = await whatsappBotService.getSendProgress(escolaId);
                setSendProgress(progress);
            } catch (e) { /* silent */ }
        }, 3000);
        return () => clearInterval(interval);
    }, [sendingGroup, escolaId]);

    const isConnected = status?.connected === true;

    // =====================
    // RENDER PRINCIPAL
    // =====================

    return (
        <div className="space-y-6 max-w-7xl mx-auto pb-12">
            {/* Header Moderno */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl border shadow-sm">
                <div className="flex items-center gap-4">
                    <div className="h-14 w-14 rounded-2xl bg-gradient-to-br from-indigo-500 to-indigo-600 flex items-center justify-center shadow-md">
                        <MessageCircle className="h-7 w-7 text-white" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold tracking-tight text-slate-800">Bot WhatsApp</h1>
                        <p className="text-sm text-slate-500 mt-0.5">Gestão de Disparos, Turmas e Automações Inteligentes</p>
                    </div>
                </div>
            </div>

            {/* Navegação via Tabs Centralizadas */}
            <Tabs defaultValue="dashboard" className="w-full">
                <TabsList className="grid w-full grid-cols-2 md:grid-cols-7 h-auto md:h-14 bg-white border shadow-sm p-1 rounded-xl mb-6">
                    <TabsTrigger value="dashboard" className="rounded-lg font-medium text-sm data-[state=active]:bg-indigo-50 data-[state=active]:text-indigo-700 data-[state=active]:shadow-none transition-all">
                        <Bot className="w-4 h-4 mr-2" />
                        Painel de Controle
                    </TabsTrigger>
                    <TabsTrigger value="portal-tickets" className="rounded-lg font-medium text-sm data-[state=active]:bg-indigo-50 data-[state=active]:text-indigo-700 data-[state=active]:shadow-none transition-all relative">
                        <MessageCircle className="w-4 h-4 mr-2" />
                        Solicitações do Portal
                    </TabsTrigger>
                    <TabsTrigger value="justificativas" className="rounded-lg font-medium text-sm data-[state=active]:bg-indigo-50 data-[state=active]:text-indigo-700 data-[state=active]:shadow-none transition-all">
                        <FileCheck2 className="w-4 h-4 mr-2" />
                        Triagem de Faltas
                    </TabsTrigger>
                    <TabsTrigger value="suporte" className="rounded-lg font-medium text-sm data-[state=active]:bg-violet-50 data-[state=active]:text-violet-700 data-[state=active]:shadow-none transition-all">
                        <Headphones className="w-4 h-4 mr-2" />
                        Suporte / Secretaria
                    </TabsTrigger>
                    <TabsTrigger value="cadastro-responsavel" className="rounded-lg font-medium text-sm data-[state=active]:bg-violet-50 data-[state=active]:text-violet-700 data-[state=active]:shadow-none transition-all">
                        <UserPlus className="w-4 h-4 mr-2" />
                        Cadastro Responsável
                    </TabsTrigger>
                    <TabsTrigger value="automations" className="rounded-lg font-medium text-sm data-[state=active]:bg-indigo-50 data-[state=active]:text-indigo-700 data-[state=active]:shadow-none transition-all">
                        <Zap className="w-4 h-4 mr-2" />
                        Automações
                    </TabsTrigger>
                    <TabsTrigger value="campaigns" className="rounded-lg font-medium text-sm data-[state=active]:bg-indigo-50 data-[state=active]:text-indigo-700 data-[state=active]:shadow-none transition-all">
                        <Rocket className="w-4 h-4 mr-2" />
                        Campanhas
                    </TabsTrigger>
                </TabsList>

                {/* VIEW 1: DASHBOARD */}
                <TabsContent value="dashboard" className="border-none p-0 outline-none">
                     <BotDashboard 
                        status={status}
                        isConnected={isConnected}
                        qrCode={qrCode}
                        loadingStatus={loadingStatus}
                        loadingQR={loadingQR}
                        disconnecting={disconnecting}
                        onRefreshStatus={loadStatus}
                        onGenerateQR={handleGenerateQR}
                        onDisconnect={() => setConfirmDisconnect(true)}
                        manualPhone={manualPhone}
                        setManualPhone={setManualPhone}
                        manualMessage={manualMessage}
                        setManualMessage={setManualMessage}
                        sendingManual={sendingManual}
                        onSendManual={handleSendManual}
                     />
                </TabsContent>

                {/* VIEW: PORTAL TICKETS */}
                <TabsContent value="portal-tickets" className="border-none p-0 outline-none">
                     <BotPortalTickets />
                </TabsContent>

                {/* VIEW 2: TRIAGEM DE FALTAS (KANBAN) */}
                <TabsContent value="justificativas" className="border-none p-0 outline-none">
                     <KanbanJustificativas />
                </TabsContent>

                {/* VIEW: SUPORTE / SECRETARIA (URA) */}
                <TabsContent value="suporte" className="border-none p-0 outline-none">
                     <BotSecretariaSuport />
                </TabsContent>

                {/* VIEW: CADASTRO RESPONSÁVEL */}
                <TabsContent value="cadastro-responsavel" className="border-none p-0 outline-none">
                     <BotCadastroResponsavel />
                </TabsContent>

                {/* VIEW 3: AUTOMAÇÕES */}
                <TabsContent value="automations" className="border-none p-0 outline-none">
                     <BotAutomations 
                        config={config}
                        savingConfig={savingConfig}
                        onSaveConfig={handleSaveConfig}
                        isConnected={isConnected}
                        escolaId={escolaId}
                     />
                </TabsContent>

                {/* VIEW 3: CAMPANHAS P/ TURMAS E HISTORICO */}
                <TabsContent value="campaigns" className="border-none p-0 outline-none">
                     <BotCampaigns 
                         turmas={turmas}
                         loadingTurmas={loadingTurmas}
                         onRefreshTurmas={loadTurmas}
                         isConnected={isConnected}
                         escolaId={escolaId}
                         config={config}
                         savingConfig={savingConfig}
                         onSaveConfig={handleSaveConfig}
                         onSendToGroup={handleSendToGroup}
                         sendingGroup={sendingGroup}
                         sendProgress={sendProgress}
                         logs={logs}
                         loadingLogs={loadingLogs}
                         onRefreshLogs={loadLogs}
                     />
                </TabsContent>

            </Tabs>

            <ConfirmDialog
                open={confirmDisconnect}
                onOpenChange={setConfirmDisconnect}
                title="Desconectar WhatsApp"
                description="Deseja realmente desconectar o WhatsApp desta escola? O bot parará de funcionar até que você reconecte."
                confirmLabel="Desconectar"
                variant="destructive"
                onConfirm={handleDisconnect}
                loading={disconnecting}
            />
        </div>
    );
}
