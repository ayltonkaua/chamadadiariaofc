import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Loader2, Zap, AlertTriangle, CalendarDays, Save, Sparkles, Users, Search, Send, RefreshCw, Shield } from 'lucide-react';
import { Input } from '@/components/ui/input';
import type { WhatsAppBotConfig, WhatsAppGroup } from '@/domains/whatsappBot';
import { whatsappBotService } from '@/domains/whatsappBot';
import AiMessageGenerator from './AiMessageGenerator';
import { toast } from 'sonner';

interface BotAutomationsProps {
  config: WhatsAppBotConfig | null;
  savingConfig: boolean;
  onSaveConfig: (cfg: Partial<WhatsAppBotConfig>) => Promise<void>;
  isConnected: boolean;
  escolaId: string;
}

export default function BotAutomations({ config, savingConfig, onSaveConfig, isConnected, escolaId }: BotAutomationsProps) {
  // Local state based on config
  const [autoFaltaDiaria, setAutoFaltaDiaria] = useState(config?.auto_falta_diaria ?? false);
  const [horarioFaltaDiaria, setHorarioFaltaDiaria] = useState(config?.horario_falta_diaria ?? '18:00:00');
  const [templateFaltaDiaria, setTemplateFaltaDiaria] = useState(config?.template_falta_diaria ?? '');

  const [autoConsecutiva, setAutoConsecutiva] = useState(config?.auto_consecutiva ?? false);
  const [templateConsecutiva, setTemplateConsecutiva] = useState(config?.template_consecutiva ?? '');

  const [autoMensal, setAutoMensal] = useState(config?.auto_mensal ?? false);
  const [templateMensal, setTemplateMensal] = useState(config?.template_mensal ?? '');

  // Busca Ativa state
  const [grupoBuscaAtivaId, setGrupoBuscaAtivaId] = useState(config?.grupo_busca_ativa_id ?? '');
  const [templateEscalacao, setTemplateEscalacao] = useState(config?.template_escalacao ?? '');
  const [whatsappGroups, setWhatsappGroups] = useState<WhatsAppGroup[]>([]);
  const [loadingGroups, setLoadingGroups] = useState(false);
  const [sendingBuscaAtiva, setSendingBuscaAtiva] = useState(false);

  // Calendário / Aulas state
  const [temAulaHoje, setTemAulaHoje] = useState(config?.tem_aula_hoje ?? true);
  const [motivoSemAula, setMotivoSemAula] = useState(config?.motivo_sem_aula ?? '');

  // Sync local state when config loads/changes
  useEffect(() => {
    if (config) {
      setAutoFaltaDiaria(config.auto_falta_diaria ?? false);
      setHorarioFaltaDiaria(config.horario_falta_diaria ?? '18:00:00');
      setTemplateFaltaDiaria(config.template_falta_diaria ?? '');
      setAutoConsecutiva(config.auto_consecutiva ?? false);
      setTemplateConsecutiva(config.template_consecutiva ?? '');
      setAutoMensal(config.auto_mensal ?? false);
      setTemplateMensal(config.template_mensal ?? '');
      setGrupoBuscaAtivaId(config.grupo_busca_ativa_id ?? '');
      setTemplateEscalacao(config.template_escalacao ?? '');
      setTemAulaHoje(config.tem_aula_hoje ?? true);
      setMotivoSemAula(config.motivo_sem_aula ?? '');
    }
  }, [config]);

  // Load WhatsApp groups
  const loadGroups = useCallback(async () => {
    if (!escolaId || !isConnected) return;
    setLoadingGroups(true);
    try {
      const groups = await whatsappBotService.getWhatsAppGroups(escolaId);
      setWhatsappGroups(groups);
    } catch (err: any) {
      console.error('Error loading groups:', err);
    } finally {
      setLoadingGroups(false);
    }
  }, [escolaId, isConnected]);

  useEffect(() => {
    if (isConnected) loadGroups();
  }, [isConnected, loadGroups]);

  const selectedGroupName = whatsappGroups.find(g => g.id === grupoBuscaAtivaId)?.name 
    || config?.grupos_favoritos?.find(g => g.id === grupoBuscaAtivaId)?.name
    || '';

  const hasChanges = 
    autoFaltaDiaria !== (config?.auto_falta_diaria ?? false) ||
    horarioFaltaDiaria !== (config?.horario_falta_diaria ?? '18:00:00') ||
    templateFaltaDiaria !== (config?.template_falta_diaria ?? '') ||
    autoConsecutiva !== (config?.auto_consecutiva ?? false) ||
    templateConsecutiva !== (config?.template_consecutiva ?? '') ||
    autoMensal !== (config?.auto_mensal ?? false) ||
    templateMensal !== (config?.template_mensal ?? '') ||
    grupoBuscaAtivaId !== (config?.grupo_busca_ativa_id ?? '') ||
    templateEscalacao !== (config?.template_escalacao ?? '') ||
    temAulaHoje !== (config?.tem_aula_hoje ?? true) ||
    motivoSemAula !== (config?.motivo_sem_aula ?? '');

  const handleSave = async () => {
    await onSaveConfig({
      auto_falta_diaria: autoFaltaDiaria,
      horario_falta_diaria: horarioFaltaDiaria,
      template_falta_diaria: templateFaltaDiaria,
      auto_consecutiva: autoConsecutiva,
      template_consecutiva: templateConsecutiva,
      auto_mensal: autoMensal,
      template_mensal: templateMensal,
      grupo_busca_ativa_id: grupoBuscaAtivaId || null,
      template_escalacao: templateEscalacao,
      tem_aula_hoje: temAulaHoje,
      motivo_sem_aula: motivoSemAula,
    } as any);
  };

  // Manual dispatch: send alerts to group NOW
  const handleSendBuscaAtivaNow = async () => {
    const targetGroup = grupoBuscaAtivaId || config?.grupo_busca_ativa_id;
    if (!targetGroup) {
      toast.error('Selecione e salve o grupo da Busca Ativa antes de disparar.');
      return;
    }
    setSendingBuscaAtiva(true);
    try {
      const result = await whatsappBotService.sendDailyAbsencesToGroup(escolaId, targetGroup);
      if (result.totalFaltosos === 0) {
        toast.info('Nenhum aluno faltou hoje — nenhuma mensagem enviada.');
      } else {
        toast.success(`Alerta enviado! ${result.totalFaltosos} faltosos, ${result.criticos} críticos.`);
      }
    } catch (err: any) {
      toast.error('Erro ao enviar alerta: ' + err.message);
    } finally {
      setSendingBuscaAtiva(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center bg-slate-50 p-4 rounded-xl border">
        <div>
          <h2 className="text-lg font-bold text-slate-800">Regras de Automação</h2>
          <p className="text-sm text-slate-500">O bot vai trabalhar de forma autônoma nestes horários no backend.</p>
        </div>
        <Button onClick={handleSave} disabled={!hasChanges || savingConfig} className="bg-slate-800 hover:bg-slate-900">
          {savingConfig ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
          Salvar Modificações
        </Button>
      </div>

      {/* Card 0: Status de Aula */}
      <Card className={`border-l-4 transition-all ${temAulaHoje ? 'border-l-blue-500 bg-white' : 'border-l-orange-500 bg-orange-50/50'}`}>
        <CardHeader className="pb-3">
          <div className="flex justify-between items-center mb-1">
            <Badge variant={temAulaHoje ? 'default' : 'destructive'} className={temAulaHoje ? 'bg-blue-100 text-blue-700' : 'bg-orange-100 text-orange-700'}>
              {temAulaHoje ? '📚 SIM, TEM AULA' : '❌ NÃO TEM AULA'}
            </Badge>
            <Switch checked={temAulaHoje} onCheckedChange={setTemAulaHoje} />
          </div>
          <CardTitle className="text-lg flex items-center gap-2">
            Status de Aula Hoje
          </CardTitle>
          <CardDescription>
            Como o bot deve responder quando os pais perguntarem "Hoje tem aula?".
          </CardDescription>
        </CardHeader>
        {!temAulaHoje && (
          <CardContent>
            <label className="text-xs font-semibold text-slate-600 block mb-1">Motivo (ex: Recesso Escolar, Chuva Forte, Reunião)</label>
            <Input 
              value={motivoSemAula} 
              onChange={(e) => setMotivoSemAula(e.target.value)}
              placeholder="Ex: Ponto Facultativo..."
            />
          </CardContent>
        )}
      </Card>

      {!isConnected && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-amber-800 text-sm flex items-center gap-3">
            <AlertTriangle className="h-5 w-5 text-amber-500" />
            As automações só serão disparadas de fato se o status do dispositivo estiver <strong>Conectado</strong> no Painel Principal.
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Card 1: Falta Diária */}
        <Card className={`border-l-4 transition-all ${autoFaltaDiaria ? 'border-l-violet-500 ring-1 ring-violet-100 shadow-md bg-white' : 'border-l-slate-200 bg-slate-50/50'}`}>
          <CardHeader className="pb-3">
            <div className="flex justify-between items-center mb-1">
              <Badge variant={autoFaltaDiaria ? 'default' : 'secondary'} className={autoFaltaDiaria ? 'bg-violet-100 text-violet-700 hover:bg-violet-200' : ''}>
                {autoFaltaDiaria ? '🟢 ATIVA' : '⚪ INATIVA'}
              </Badge>
              <Switch checked={autoFaltaDiaria} onCheckedChange={setAutoFaltaDiaria} />
            </div>
            <CardTitle className="text-lg flex items-center gap-2">
              <Zap className={`h-5 w-5 ${autoFaltaDiaria ? 'text-violet-500' : 'text-slate-400'}`} />
              Alerta de Falta Diária
            </CardTitle>
            <CardDescription>
              Avisa automaticamente os pais quando o aluno faltar no dia de hoje.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className={`transition-all ${!autoFaltaDiaria ? 'opacity-50 pointer-events-none' : ''}`}>
              <div className="flex flex-col sm:flex-row gap-4 mb-4">
                <div className="flex-1">
                  <label className="text-xs font-semibold text-slate-600 block mb-1">Horário Execução</label>
                  <Select value={horarioFaltaDiaria} onValueChange={setHorarioFaltaDiaria}>
                    <SelectTrigger className="h-9">
                      <SelectValue placeholder="Escolha a hora" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="12:30:00">12:30 (Trás Pós-Aula Manhã)</SelectItem>
                      <SelectItem value="18:00:00">18:00 (Trás Pós-Aula Tarde)</SelectItem>
                      <SelectItem value="22:30:00">22:30 (Trás Pós-Aula Noite)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-600 flex justify-between items-center mb-1">
                  Mensagem Automática
                  <AjudaVariaveis vars={['nome', 'data']} />
                </label>
                <div className="relative">
                  <Textarea 
                    value={templateFaltaDiaria}
                    onChange={(e) => setTemplateFaltaDiaria(e.target.value)}
                    className="min-h-[100px] text-sm pr-10 resize-none bg-white"
                    placeholder="Olá! Sentimos a falta do {nome} hoje ({data}). Esperamos que esteja tudo bem."
                  />
                  <div className="absolute right-2 top-2">
                     <AssistenteIABtn 
                        currentText={templateFaltaDiaria} 
                        onApply={(text) => setTemplateFaltaDiaria(text)} 
                     />
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Card 2: Faltas Consecutivas */}
        <Card className={`border-l-4 transition-all ${autoConsecutiva ? 'border-l-red-500 ring-1 ring-red-100 shadow-md bg-white' : 'border-l-slate-200 bg-slate-50/50'}`}>
          <CardHeader className="pb-3">
             <div className="flex justify-between items-center mb-1">
              <Badge variant={autoConsecutiva ? 'destructive' : 'secondary'} className={autoConsecutiva ? 'bg-red-100 text-red-700 hover:bg-red-200' : ''}>
                {autoConsecutiva ? '🔴 ATIVA URGENTE' : '⚪ INATIVA'}
              </Badge>
              <Switch checked={autoConsecutiva} onCheckedChange={setAutoConsecutiva} />
            </div>
            <CardTitle className="text-lg flex items-center gap-2">
              <AlertTriangle className={`h-5 w-5 ${autoConsecutiva ? 'text-red-500' : 'text-slate-400'}`} />
              Alerta de Risco (Consecutivas)
            </CardTitle>
            <CardDescription>
              Escalação automática após 3+ faltas seguidas do aluno sem justificativa.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className={`transition-all ${!autoConsecutiva ? 'opacity-50 pointer-events-none' : ''}`}>
              <div className="bg-red-50 border-red-100 border rounded-md p-3 mb-4 flex gap-2">
                  <CalendarDays className="h-4 w-4 text-red-500 mt-0.5 shrink-0" />
                 <p className="text-xs text-red-700">O sistema avaliará diariamente as constâncias e mandará esta mensagem se o teto de 3 for atingido, apenas 1 vez por período de crise.</p>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-600 flex justify-between items-center mb-1">
                  Mensagem Automática
                  <AjudaVariaveis vars={['responsavel', 'nome', 'faltas', 'data']} />
                </label>
                <div className="relative">
                  <Textarea 
                    value={templateConsecutiva}
                    onChange={(e) => setTemplateConsecutiva(e.target.value)}
                    className="min-h-[100px] text-sm pr-10 resize-none bg-white"
                    placeholder="Olá {responsavel}, o aluno {nome} chegou a {faltas} faltas consecutivas. Isto é um evento de risco."
                  />
                  <div className="absolute right-2 top-2">
                     <AssistenteIABtn 
                        currentText={templateConsecutiva} 
                        onApply={(text) => setTemplateConsecutiva(text)} 
                     />
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

      </div>

      {/* =============================================== */}
      {/* Card 3: BUSCA ATIVA — Full width */}
      {/* =============================================== */}
      <Card className="border-l-4 border-l-emerald-500 ring-1 ring-emerald-100 shadow-md bg-white">
        <CardHeader className="pb-3">
          <div className="flex justify-between items-center mb-1">
            <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-200">
              {grupoBuscaAtivaId ? '🟢 GRUPO CONFIGURADO' : '⚪ SEM GRUPO'}
            </Badge>
            <div className="flex items-center gap-2">
              <Button 
                variant="outline" 
                size="sm" 
                onClick={loadGroups} 
                disabled={loadingGroups || !isConnected}
                className="h-8 text-xs"
              >
                <RefreshCw className={`h-3 w-3 mr-1 ${loadingGroups ? 'animate-spin' : ''}`} />
                Atualizar Grupos
              </Button>
            </div>
          </div>
          <CardTitle className="text-lg flex items-center gap-2">
            <Search className="h-5 w-5 text-emerald-600" />
            Busca Ativa — Alerta em Grupo
          </CardTitle>
          <CardDescription>
            Configure o grupo do WhatsApp onde os alertas de Busca Ativa serão enviados (equipe pedagógica, coordenação, etc). O cron das 21:00 e o botão manual usam este grupo.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Left: Group selector */}
            <div className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-slate-600 block mb-1.5">
                  Grupo do WhatsApp para Busca Ativa
                </label>
                {!isConnected ? (
                  <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-amber-700 text-xs flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 shrink-0" />
                    Conecte o WhatsApp para carregar os grupos.
                  </div>
                ) : (
                  <Select value={grupoBuscaAtivaId} onValueChange={setGrupoBuscaAtivaId}>
                    <SelectTrigger className="h-11">
                      <SelectValue placeholder="Selecione o grupo da Busca Ativa...">
                        {selectedGroupName ? (
                          <span className="flex items-center gap-2">
                            <Users className="h-4 w-4 text-emerald-500" />
                            {selectedGroupName}
                          </span>
                        ) : 'Selecione o grupo da Busca Ativa...'}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent className="max-h-[300px]">
                      {loadingGroups ? (
                        <div className="flex items-center justify-center py-4 text-sm text-slate-400">
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Carregando grupos...
                        </div>
                      ) : whatsappGroups.length === 0 ? (
                        <div className="py-4 px-3 text-center text-sm text-slate-400">
                          Nenhum grupo encontrado.
                        </div>
                      ) : (
                        whatsappGroups.map(g => (
                          <SelectItem key={g.id} value={g.id}>
                            <span className="flex items-center gap-2">
                              <Users className="h-3 w-3 text-slate-400" />
                              {g.name}
                              <span className="text-[10px] text-slate-400 ml-1">({g.participants} membros)</span>
                            </span>
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                )}
              </div>

              {/* Manual dispatch button */}
              <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 space-y-3">
                <div className="flex items-center gap-2 mb-1">
                  <Shield className="h-4 w-4 text-emerald-600" />
                  <span className="text-sm font-bold text-emerald-800">Disparo Manual</span>
                </div>
                <p className="text-xs text-emerald-700">
                  Envie agora mesmo o resumo de faltas do dia no grupo da Busca Ativa. O relatório inclui todos os faltosos agrupados por turma, com destaque aos alunos com 3+ faltas consecutivas.
                </p>
                <Button
                  onClick={handleSendBuscaAtivaNow}
                  disabled={sendingBuscaAtiva || !isConnected || (!grupoBuscaAtivaId && !config?.grupo_busca_ativa_id)}
                  className="w-full bg-emerald-600 hover:bg-emerald-700 text-white h-11 shadow-sm"
                >
                  {sendingBuscaAtiva ? (
                    <><Loader2 className="h-5 w-5 mr-2 animate-spin" /> Enviando Alerta...</>
                  ) : (
                    <><Send className="h-5 w-5 mr-2" /> Enviar Alerta no Grupo Agora</>
                  )}
                </Button>
              </div>
            </div>

            {/* Right: Escalation template */}
            <div>
              <label className="text-xs font-semibold text-slate-600 flex justify-between items-center mb-1.5">
                Mensagem de Escalação Individual (Responsáveis)
                <AjudaVariaveis vars={['responsavel', 'nome', 'faltas', 'data']} />
              </label>
              <div className="relative">
                <Textarea 
                  value={templateEscalacao}
                  onChange={(e) => setTemplateEscalacao(e.target.value)}
                  className="min-h-[140px] text-sm pr-10 resize-none bg-white"
                  placeholder="Prezado(a) {responsavel}, o(a) aluno(a) {nome} acumula {faltas} faltas consecutivas sem justificativa. É fundamental que nos informe o motivo para que possamos acionar a Busca Ativa."
                />
                <div className="absolute right-2 top-2">
                  <AssistenteIABtn 
                    currentText={templateEscalacao} 
                    onApply={(text) => setTemplateEscalacao(text)} 
                  />
                </div>
              </div>
              <div className="bg-slate-50 border rounded-md p-3 mt-3 flex gap-2">
                <CalendarDays className="h-4 w-4 text-slate-500 mt-0.5 shrink-0" />
                <p className="text-xs text-slate-600">
                  O cron das <strong>21:00</strong> enviará esta mensagem diretamente aos responsáveis de alunos com 3+ faltas consecutivas quando não houver contato recente da Busca Ativa.
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ---------------------------
// Helpers para as Caixas de Texto
// ---------------------------
function AjudaVariaveis({ vars }: { vars: string[] }) {
    return (
        <span className="text-[10px] text-slate-400">
            Pode usar: {vars.map(v => `{${v}}`).join(', ')}
        </span>
    )
}

function AssistenteIABtn({ currentText, onApply }: { currentText: string, onApply: (t: string) => void }) {
    return (
        <AiMessageGenerator 
            isModal={true}
            triggerButton={
                <Button size="icon" variant="ghost" className="h-6 w-6 text-violet-500 hover:bg-violet-100 rounded-full" title="Melhorar texto com IA">
                    <Sparkles className="h-3.5 w-3.5" />
                </Button>
            }
            onSelectMessage={onApply}
        />
    )
}
