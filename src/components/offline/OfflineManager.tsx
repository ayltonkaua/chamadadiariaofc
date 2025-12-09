import React, { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Download, Upload, Wifi, Loader2 } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import {
  baixarDadosEscola,
  sincronizarChamadasOffline,
  getChamadasPendentes
} from '@/lib/offlineChamada';
import { useAuth } from '@/contexts/AuthContext';
import { Badge } from "@/components/ui/badge";

const OfflineManager: React.FC = () => {
  const { user } = useAuth();
  const [pendencias, setPendencias] = useState(0);
  const [loading, setLoading] = useState(false);
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  useEffect(() => {
    const checkPendencias = async () => {
      const p = await getChamadasPendentes();
      setPendencias(p.length);
    };

    const handleStatusChange = () => {
      setIsOnline(navigator.onLine);
      checkPendencias(); // Checa ao mudar rede
    };

    // Listener extra para quando salvar chamada em outra tela
    const handleNovaChamada = () => checkPendencias();

    window.addEventListener('online', handleStatusChange);
    window.addEventListener('offline', handleStatusChange);
    window.addEventListener('chamada-salva', handleNovaChamada); // Disparar isso no ChamadaPage

    checkPendencias(); // Check inicial

    return () => {
      window.removeEventListener('online', handleStatusChange);
      window.removeEventListener('offline', handleStatusChange);
      window.removeEventListener('chamada-salva', handleNovaChamada);
    };
  }, []);

  const handleBaixarDados = async () => {
    if (!user?.escola_id) {
      toast({ title: "Erro", description: "Escola não identificada.", variant: "destructive" });
      return;
    }

    setLoading(true);
    try {
      const result = await baixarDadosEscola(user.escola_id);
      if (result.success) {
        toast({
          title: "Dados Baixados!",
          description: `${result.turmasCount} turmas e ${result.alunosCount} alunos prontos para uso offline.`,
          className: "bg-green-100 border-green-500 text-green-800"
        });
      } else {
        throw new Error("Falha no download");
      }
    } catch (error) {
      toast({ title: "Erro", description: "Não foi possível baixar os dados.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  // Função disparada EXCLUSIVAMENTE pelo clique do botão
  const [syncProgress, setSyncProgress] = useState<{ current: number; total: number } | null>(null);

  const handleSincronizar = async () => {
    if (!isOnline) {
      toast({ description: "Você precisa estar online para sincronizar." });
      return;
    }

    setLoading(true);
    setSyncProgress({ current: 0, total: pendencias }); // Inicia

    try {
      const result = await sincronizarChamadasOffline((current, total) => {
        setSyncProgress({ current, total });
      });

      if (result.success && result.count > 0) {
        toast({
          title: "Sucesso!",
          description: "Sincronização realizada com sucesso.",
          className: "bg-green-100 border-green-500 text-green-800"
        });
        setPendencias(0);
      } else if (result.success && result.count === 0) {
        toast({ description: "Não há chamadas pendentes." });
      } else {
        throw new Error("Erro na sincronização");
      }
    } catch (error) {
      toast({ title: "Erro de Sincronização", description: "Tente novamente.", variant: "destructive" });
    } finally {
      setLoading(false);
      setSyncProgress(null);
    }
  };

  return (
    <div className="flex items-center gap-2">
      {/* Botão de Download: Sempre visível se online */}
      {isOnline && (
        <Button
          variant="outline"
          size="sm"
          onClick={handleBaixarDados}
          disabled={loading}
          className="gap-2 border-purple-200 hover:bg-purple-50 text-purple-700"
          title="Baixar turmas para usar offline"
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
          <span className="hidden sm:inline">Baixar Dados</span>
        </Button>
      )}

      {/* Botão de Sincronizar: Só aparece se tiver pendências E estiver online */}
      {pendencias > 0 && isOnline && (
        <Button
          variant="default"
          size="sm"
          onClick={handleSincronizar}
          disabled={loading}
          className="gap-2 bg-amber-500 hover:bg-amber-600 shadow-md"
        >
          {loading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              {syncProgress ? `Enviando ${syncProgress.current} de ${syncProgress.total}...` : "Sincronizando..."}
            </>
          ) : (
            <>
              <Upload className="h-4 w-4" />
              <span>Sincronizar ({pendencias})</span>
            </>
          )}
        </Button>
      )}

      {/* Indicador Offline */}
      {!isOnline && (
        <Badge variant="outline" className="bg-yellow-100 text-yellow-800 gap-1 border-yellow-300">
          <Wifi className="h-3 w-3" />
          <span className="hidden sm:inline">Modo Offline</span>
        </Badge>
      )}
    </div>
  );
};

export default OfflineManager; 