import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Loader2, Zap, AlertTriangle, CalendarDays, Save, Sparkles } from 'lucide-react';
import type { WhatsAppBotConfig } from '@/domains/whatsappBot';
import AiMessageGenerator from './AiMessageGenerator';

interface BotAutomationsProps {
  config: WhatsAppBotConfig | null;
  savingConfig: boolean;
  onSaveConfig: (cfg: Partial<WhatsAppBotConfig>) => Promise<void>;
  isConnected: boolean;
}

export default function BotAutomations({ config, savingConfig, onSaveConfig, isConnected }: BotAutomationsProps) {
  // Local state based on config
  const [autoFaltaDiaria, setAutoFaltaDiaria] = useState(config?.auto_falta_diaria ?? false);
  const [horarioFaltaDiaria, setHorarioFaltaDiaria] = useState(config?.horario_falta_diaria ?? '18:00:00');
  const [templateFaltaDiaria, setTemplateFaltaDiaria] = useState(config?.template_falta_diaria ?? '');

  const [autoConsecutiva, setAutoConsecutiva] = useState(config?.auto_consecutiva ?? false);
  const [templateConsecutiva, setTemplateConsecutiva] = useState(config?.template_consecutiva ?? '');

  const [autoMensal, setAutoMensal] = useState(config?.auto_mensal ?? false);
  const [templateMensal, setTemplateMensal] = useState(config?.template_mensal ?? '');

  const hasChanges = 
    autoFaltaDiaria !== (config?.auto_falta_diaria ?? false) ||
    horarioFaltaDiaria !== (config?.horario_falta_diaria ?? '18:00:00') ||
    templateFaltaDiaria !== (config?.template_falta_diaria ?? '') ||
    autoConsecutiva !== (config?.auto_consecutiva ?? false) ||
    templateConsecutiva !== (config?.template_consecutiva ?? '') ||
    autoMensal !== (config?.auto_mensal ?? false) ||
    templateMensal !== (config?.template_mensal ?? '');

  const handleSave = async () => {
    await onSaveConfig({
      auto_falta_diaria: autoFaltaDiaria,
      horario_falta_diaria: horarioFaltaDiaria,
      template_falta_diaria: templateFaltaDiaria,
      auto_consecutiva: autoConsecutiva,
      template_consecutiva: templateConsecutiva,
      auto_mensal: autoMensal,
      template_mensal: templateMensal,
    });
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
