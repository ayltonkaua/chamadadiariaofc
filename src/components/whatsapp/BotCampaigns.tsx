import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, UsersRound, Send, Play, FastForward, CheckCircle2, History, MessageSquare, AlertTriangle, Sparkles, RefreshCw } from 'lucide-react';
import type { Turma, SendProgress, WhatsAppLog } from '@/domains/whatsappBot';
import BulkImportTab from './BulkImportTab';
import AiMessageGenerator from './AiMessageGenerator';

interface BotCampaignsProps {
  turmas: Turma[];
  loadingTurmas: boolean;
  onRefreshTurmas: () => void;
  isConnected: boolean;
  
  // States to send
  onSendToGroup: (turmaId: string, message: string) => Promise<void>;
  sendingGroup: boolean;
  sendProgress: SendProgress | null;
  
  // Logs & History
  logs: WhatsAppLog[];
  loadingLogs: boolean;
  onRefreshLogs: () => void;
}

export default function BotCampaigns({
  turmas,
  loadingTurmas,
  onRefreshTurmas,
  isConnected,
  onSendToGroup,
  sendingGroup,
  sendProgress,
  logs,
  loadingLogs,
  onRefreshLogs
}: BotCampaignsProps) {
  const [activeTab, setActiveTab] = useState<'turmas' | 'import' | 'history'>('turmas');
  const [selectedTurmaId, setSelectedTurmaId] = useState<string>('');
  const [campaignMessage, setCampaignMessage] = useState('');

  const selectedTurma = turmas.find(t => t.id === selectedTurmaId);

  const handleStartCampaign = async () => {
    if (!selectedTurmaId || !campaignMessage.trim()) return;
    await onSendToGroup(selectedTurmaId, campaignMessage);
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
      
      {/* Sidebar / Navegação de Campanhas */}
      <div className="lg:col-span-1 space-y-2">
        <Button 
            variant={activeTab === 'turmas' ? 'default' : 'ghost'} 
            className={`w-full justify-start ${activeTab === 'turmas' ? 'bg-indigo-600 hover:bg-indigo-700' : ''}`}
            onClick={() => setActiveTab('turmas')}
        >
          <UsersRound className="mr-2 h-4 w-4" /> Disparo p/ Turmas
        </Button>
        <Button 
            variant={activeTab === 'import' ? 'default' : 'ghost'} 
            className={`w-full justify-start ${activeTab === 'import' ? 'bg-indigo-600 hover:bg-indigo-700' : ''}`}
            onClick={() => setActiveTab('import')}
        >
          <Send className="mr-2 h-4 w-4" /> Importação em Massa (Excel)
        </Button>
        <Button 
            variant={activeTab === 'history' ? 'default' : 'ghost'} 
            className={`w-full justify-start ${activeTab === 'history' ? 'bg-slate-800 hover:bg-slate-900 text-white' : ''}`}
            onClick={() => { setActiveTab('history'); onRefreshLogs(); }}
        >
          <History className="mr-2 h-4 w-4" /> Todos os Registros (Log)
        </Button>
      </div>

      {/* Conteúdo Principal da Campanha */}
      <div className="lg:col-span-3">
        
        {/* VIEW 1: DISPARO P/ TURMAS */}
        {activeTab === 'turmas' && (
          <Card className="animate-in fade-in zoom-in-95 duration-200">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FastForward className="h-5 w-5 text-indigo-500" />
                Criar Campanha para Turma
              </CardTitle>
              <CardDescription>
                Selecione uma turma para disparar mensagens em massa. O Bot adicionará um delay inteligente entre os envios.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
               {!isConnected && (
                  <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-amber-800 text-sm flex items-center gap-3">
                      <AlertTriangle className="h-5 w-5 text-amber-500" />
                      Conecte o número de Whatsapp no Painel antes de Iniciar qualquer campanha.
                  </div>
                )}
              
                <div className="space-y-4">
                  {/* Passo 1 */}
                  <div>
                      <label className="text-sm font-semibold text-slate-700 block mb-1.5 flex justify-between">
                          <span>1. Quem vai receber?</span>
                          <span className="text-xs text-indigo-600 cursor-pointer hover:underline" onClick={onRefreshTurmas}>
                             {loadingTurmas ? 'Atualizando...' : 'Atualizar Listagem'}
                          </span>
                      </label>
                      <Select value={selectedTurmaId} onValueChange={setSelectedTurmaId} disabled={loadingTurmas}>
                        <SelectTrigger className="h-11">
                          <SelectValue placeholder="Selecione a turma..." />
                        </SelectTrigger>
                        <SelectContent className="max-h-[300px]">
                          {turmas.map(t => (
                            <SelectItem key={t.id} value={t.id}>
                              {t.nome} ({t.alunos_com_telefone} celulares cadastrados)
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                  </div>

                  {/* Passo 2 */}
                  <div className={`transition-all duration-300 ${!selectedTurma ? 'opacity-30 pointer-events-none' : ''}`}>
                      <label className="text-sm font-semibold text-slate-700 flex justify-between items-center mb-1.5 mt-6">
                        <span>2. Escreva a Mensagem</span>
                        <span className="text-xs text-slate-400 font-normal">Use {"{nome}"} para personalizar</span>
                      </label>
                      <div className="relative">
                          <Textarea 
                             placeholder="Escreva algo brilhante para a turma..."
                             value={campaignMessage}
                             onChange={(e) => setCampaignMessage(e.target.value)}
                             className="h-32 text-sm bg-slate-50 border-slate-200 focus:bg-white resize-none pr-10"
                          />
                          <div className="absolute right-2 top-2">
                             <AiMessageGenerator 
                                 isModal 
                                 triggerButton={
                                     <Button type="button" size="icon" variant="ghost" className="h-6 w-6 text-indigo-500 hover:bg-indigo-100 rounded-full" title="Melhorar texto com IA">
                                         <Sparkles className="h-3.5 w-3.5" />
                                     </Button>
                                 }
                                 onSelectMessage={setCampaignMessage}
                             />
                          </div>
                      </div>
                  </div>
                </div>

                {/* Resumo & Ação */}
                {selectedTurma && !!campaignMessage.trim() && (
                  <div className="mt-6 p-4 bg-indigo-50 border border-indigo-100 rounded-xl space-y-4 animate-in slide-in-from-bottom-2">
                     <p className="text-sm text-indigo-900">
                        Você está prestes a colocar <strong>{selectedTurma.alunos_com_telefone} mensagens</strong> na fila de disparo.
                     </p>

                     {sendProgress && sendProgress.active && (
                       <ProgressMonitor progress={sendProgress} />
                     )}

                     <Button 
                       onClick={handleStartCampaign} 
                       disabled={sendingGroup || !isConnected || !campaignMessage.trim()}
                       className="w-full bg-indigo-600 hover:bg-indigo-700 h-11 text-base shadow-sm"
                     >
                        {sendingGroup ? (
                           <><Loader2 className="h-5 w-5 mr-2 animate-spin" /> Inserindo na Fila Assíncrona...</>
                        ) : (
                           <><Play className="h-5 w-5 mr-2 fill-white" /> Iniciar Disparo para a Turma</>
                        )}
                     </Button>
                  </div>
                )}
            </CardContent>
          </Card>
        )}

        {/* VIEW 2: IMPORTAÇÃO EM MASSA */}
        {activeTab === 'import' && (
          <div className="animate-in fade-in zoom-in-95 duration-200">
            <BulkImportTab escolaId="" />
          </div>
        )}

        {/* VIEW 3: HISTÓRICO DE LOGS */}
        {activeTab === 'history' && (
          <Card className="animate-in fade-in zoom-in-95 duration-200">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <div>
                <CardTitle className="text-lg">Histórico de Disparos</CardTitle>
                <CardDescription>Registro dos últimos envios concluídos pelo bot</CardDescription>
              </div>
              <Button variant="outline" size="sm" onClick={onRefreshLogs} disabled={loadingLogs}>
                <RefreshCw className={`h-4 w-4 mr-1 ${loadingLogs ? 'animate-spin' : ''}`} />
                Recarregar
              </Button>
            </CardHeader>
            <CardContent>
               {loadingLogs && logs.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12">
                     <Loader2 className="h-8 w-8 text-slate-300 animate-spin mb-3" />
                     <p className="text-sm text-slate-500">Buscando o histórico no servidor...</p>
                  </div>
               ) : logs.length === 0 ? (
                  <div className="text-center py-12 text-slate-400">
                     <MessageSquare className="h-12 w-12 mx-auto mb-3 opacity-20" />
                     <p>Nenhuma mensagem foi enviada por este bot ainda.</p>
                  </div>
               ) : (
                  <div className="space-y-4 max-h-[600px] overflow-auto pr-2">
                     {logs.map(log => (
                        <div key={log.id} className="p-3 bg-white border border-slate-100 rounded-lg hover:shadow-sm transition-all text-sm">
                           <div className="flex justify-between items-start mb-2">
                              <div className="flex items-center gap-2">
                                <Badge variant="outline" className="text-xs capitalize font-medium text-slate-600 bg-slate-50">
                                  {log.tipo.replace('_', ' ')}
                                </Badge>
                                <span className="text-slate-500 text-xs">Para: {log.telefone}</span>
                              </div>
                              <span className="text-xs text-slate-400 tabular-nums">
                                {new Date(log.created_at).toLocaleString('pt-BR')}
                              </span>
                           </div>
                           <p className="text-slate-700 whitespace-pre-wrap">{log.mensagem}</p>
                           {log.status === 'falha' && (
                              <div className="mt-2 p-2 bg-red-50 text-red-600 text-xs rounded border border-red-100 flex items-center gap-1.5">
                                 <AlertTriangle className="h-3 w-3 shrink-0" />
                                 Erro detectado. Verifique se o formato do número de celular no cadastro está correto.
                              </div>
                           )}
                           {log.status === 'enviado' && (
                               <div className="mt-2 flex items-center gap-1 text-[10px] text-green-600 font-medium">
                                   <CheckCircle2 className="h-3 w-3" /> Transmitido com Sucesso
                               </div>
                           )}
                        </div>
                     ))}
                  </div>
               )}
            </CardContent>
          </Card>
        )}

      </div>
    </div>
  );
}

// Subcomponente: Monitor de Progresso p/ Envio Massa
function ProgressMonitor({ progress }: { progress: SendProgress }) {
    if (!progress) return null;
    return (
        <div className="bg-white rounded-lg p-4 border border-indigo-100 shadow-sm mt-4">
            <div className="flex justify-between items-center mb-2">
                <span className="text-xs font-bold text-indigo-700 uppercase">Progresso (Background)</span>
                <span className="text-xs font-semibold text-slate-600">{Math.round(progress.percentComplete)}%</span>
            </div>
            <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden">
                <div 
                  className="bg-indigo-500 h-2.5 rounded-full transition-all duration-500" 
                  style={{ width: `${progress.percentComplete}%` }}
                ></div>
            </div>
            <div className="flex justify-between mt-3 text-xs text-slate-500">
                <span>Enviadas: <strong>{progress.sent}</strong> / {progress.total}</span>
                {progress.failed > 0 && <span className="text-red-500 font-medium">Falhas: {progress.failed}</span>}
                <span className="text-slate-400">Restam ~{Math.ceil(progress.estimatedRemainingMs / 1000)}s</span>
            </div>
        </div>
    );
}
