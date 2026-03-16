import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Wifi, WifiOff, RefreshCw, QrCode, LogOut, CheckCircle2, Loader2, Send } from 'lucide-react';
import type { BotStatus } from '@/domains/whatsappBot';

interface BotDashboardProps {
  status: BotStatus | null;
  isConnected: boolean;
  qrCode: string | null;
  loadingStatus: boolean;
  loadingQR: boolean;
  disconnecting: boolean;
  onRefreshStatus: () => void;
  onGenerateQR: () => void;
  onDisconnect: () => void;
  
  // Painel de Envio Rápido
  manualPhone: string;
  setManualPhone: (val: string) => void;
  manualMessage: string;
  setManualMessage: (val: string) => void;
  sendingManual: boolean;
  onSendManual: () => void;
}

export default function BotDashboard({
  status,
  isConnected,
  qrCode,
  loadingStatus,
  loadingQR,
  disconnecting,
  onRefreshStatus,
  onGenerateQR,
  onDisconnect,
  manualPhone,
  setManualPhone,
  manualMessage,
  setManualMessage,
  sendingManual,
  onSendManual
}: BotDashboardProps) {
  
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      {/* Esquerda: Status da Conexão */}
      <Card className="h-fit">
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
            Conecte o número de WhatsApp responsável pelos disparos da escola.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-4">
            <Badge variant={isConnected ? 'default' : 'destructive'} className="text-sm px-3 py-1">
              {isConnected ? '🟢 Conectado' : '🔴 Desconectado'}
            </Badge>
            {status?.phone && (
              <span className="text-sm text-slate-600 font-medium">📱 +{status.phone}</span>
            )}
            <Button variant="outline" size="sm" onClick={onRefreshStatus} disabled={loadingStatus}>
              <RefreshCw className={`h-4 w-4 mr-1 ${loadingStatus ? 'animate-spin' : ''}`} />
              Atualizar
            </Button>
          </div>

          <Separator />

          {!isConnected && (
            <div className="space-y-4 pt-2">
              <p className="text-sm text-slate-600">
                Para ativar as automações, clique em "Gerar QR Code" e escaneie com o celular da escola.
              </p>
              <Button onClick={onGenerateQR} disabled={loadingQR} className="bg-green-600 hover:bg-green-700 w-full sm:w-auto">
                {loadingQR ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <QrCode className="h-4 w-4 mr-2" />}
                Gerar QR Code de Acesso
              </Button>
              {qrCode && (
                <div className="flex flex-col items-center gap-3 p-6 border rounded-xl bg-slate-50 mt-4 animate-in fade-in zoom-in duration-300">
                  <p className="font-semibold text-slate-700">QR Code pronto para leitura!</p>
                  <div className="p-3 bg-white rounded-xl shadow-sm border">
                    <img src={qrCode} alt="QR Code WhatsApp" className="w-64 h-64" />
                  </div>
                  <p className="text-xs text-slate-500 text-center max-w-[280px]">
                    Abra o WhatsApp no celular → Configurações → Dispositivos Conectados → Conectar Dispositivo
                  </p>
                </div>
              )}
            </div>
          )}

          {isConnected && (
            <div className="rounded-xl bg-green-50 border border-green-200 p-5 mt-2">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-start sm:items-center gap-2">
                  <CheckCircle2 className="h-5 w-5 text-green-600 mt-0.5 sm:mt-0" />
                  <p className="text-sm font-medium text-green-800">
                    Sessão ativa e operando em segundo plano.
                  </p>
                </div>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={onDisconnect}
                  disabled={disconnecting}
                  className="w-full sm:w-auto"
                >
                  {disconnecting ? (
                    <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
                  ) : (
                    <LogOut className="h-4 w-4 mr-1.5" />
                  )}
                  Desconectar Dispositivo
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Direita: Disparo Rápido Manual */}
      <Card className={`h-fit transition-opacity ${!isConnected ? 'opacity-50 pointer-events-none' : ''}`}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Send className="h-5 w-5 text-blue-500" />
            Disparo Rápido
          </CardTitle>
          <CardDescription>
            Envie uma mensagem imedia,ta para um único número
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="text-sm font-medium text-slate-700">Telefone Destino</label>
            <Input 
              placeholder="Ex: 5511999999999" 
              value={manualPhone} 
              onChange={(e) => setManualPhone(e.target.value.replace(/\D/g, ''))} 
              className="mt-1.5 font-mono" 
              maxLength={15}
            />
          </div>
          <div>
            <label className="text-sm font-medium text-slate-700">Mensagem</label>
            <Textarea 
              placeholder="Escreva sua mensagem rápida..." 
              value={manualMessage} 
              onChange={(e) => setManualMessage(e.target.value)} 
              rows={5} 
              className="mt-1.5 resize-none" 
            />
          </div>
          <Button 
            onClick={onSendManual} 
            disabled={sendingManual || !manualPhone.trim() || !manualMessage.trim()} 
            className="w-full bg-blue-600 hover:bg-blue-700"
          >
            {sendingManual ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Send className="h-4 w-4 mr-2" />}
            Enviar Mensagem
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
