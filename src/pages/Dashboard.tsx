import React, { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { InfoCards } from "@/components/dashboard/InfoCards";
import { TurmasCards } from "@/components/TurmasCards";
import OfflineManager from "@/components/offline/OfflineManager";
import { ImportTurmasDialog } from "@/components/turmas/ImportTurmasDialog";
import { getDadosEscolaOffline } from "@/lib/offlineChamada";
import { WifiOff, Loader2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { turmaService, type TurmaComContagem } from "@/domains";

const Dashboard: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [tabValue, setTabValue] = useState("turmas");
  const [loading, setLoading] = useState(true);
  const [todasTurmas, setTodasTurmas] = useState<TurmaComContagem[]>([]);
  const [isOfflineMode, setIsOfflineMode] = useState(!navigator.onLine);

  // Monitora conexão em tempo real
  useEffect(() => {
    const handleStatus = () => setIsOfflineMode(!navigator.onLine);
    window.addEventListener('online', handleStatus);
    window.addEventListener('offline', handleStatus);
    return () => {
      window.removeEventListener('online', handleStatus);
      window.removeEventListener('offline', handleStatus);
    };
  }, []);

  // Função auxiliar para ler do IndexedDB
  const carregarDadosOffline = async () => {
    try {
      console.log("Lendo IndexedDB...");
      const dadosOffline = await getDadosEscolaOffline(user?.id);

      if (dadosOffline && dadosOffline.turmas && dadosOffline.turmas.length > 0) {
        const turmasOffline = dadosOffline.turmas.map((t: any) => {
          const qtdAlunos = dadosOffline.alunos.filter((a: any) => a.turma_id === t.id).length;
          return {
            id: t.id,
            nome: t.nome,
            escola_id: t.escola_id || "offline-id",
            numero_sala: t.numero_sala,
            turno: t.turno || "Sem Turno",
            user_id: t.user_id || null,
            created_at: t.created_at || null,
            _count: { alunos: qtdAlunos },
            alunos: qtdAlunos
          };
        });

        turmasOffline.sort((a: any, b: any) => a.nome.localeCompare(b.nome));
        setTodasTurmas(turmasOffline);
        setIsOfflineMode(true);
      } else {
        setTodasTurmas([]);
      }
    } catch (err) {
      console.error("Erro crítico ao ler offline:", err);
    }
  };

  // --- LÓGICA DE DADOS USANDO turmaService ---
  const fetchDashboardData = useCallback(async () => {
    setLoading(true);

    // ESTRATÉGIA OFFLINE-FIRST
    if (!navigator.onLine) {
      await carregarDadosOffline();
      setLoading(false);
      return;
    }

    // ESTRATÉGIA ONLINE COM FALLBACK
    try {
      if (!user) {
        throw new Error("Usuário não autenticado");
      }

      // Usa turmaService em vez de supabase direto
      const turmasComContagem = await turmaService.findWithCount(user.escola_id);

      setTodasTurmas(turmasComContagem);
      setIsOfflineMode(false);

    } catch (err) {
      console.warn("Falha ao buscar dados online. Ativando modo offline...", err);
      await carregarDadosOffline();
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  // Usa turmaService.groupByTurno para filtrar
  const grouped = turmaService.groupByTurno(todasTurmas);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full min-h-screen flex-col gap-4">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
        <p className="text-gray-500">Carregando seus dados...</p>
      </div>
    );
  }

  return (
    <div className="p-6 animate-in fade-in pb-20">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2 flex items-center gap-3">
            Página Inicial
            {isOfflineMode && (
              <span className="text-sm bg-yellow-100 text-yellow-800 px-3 py-1 rounded-full border border-yellow-200 font-medium flex items-center gap-2">
                <WifiOff size={16} /> Offline
              </span>
            )}
          </h1>
          <p className="text-gray-600">Bem-vindo ao sistema de chamadas</p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <OfflineManager />
          <ImportTurmasDialog onSuccess={fetchDashboardData} />
        </div>
      </div>

      {/* InfoCards */}
      <div className="mb-8">
        <InfoCards />
      </div>

      {/* Área Principal (Turmas) */}
      <div className="mb-8">
        {todasTurmas.length === 0 ? (
          <div className="bg-white p-8 rounded-lg shadow-sm border flex flex-col items-center justify-center text-center">
            <RefreshCw className="h-10 w-10 text-gray-300 mb-3" />
            <h3 className="text-lg font-semibold text-gray-700">Nenhuma turma disponível</h3>
            <p className="text-gray-500 max-w-md mt-2">
              {isOfflineMode
                ? "Você está offline e não há dados salvos. Conecte-se para baixar."
                : "Não encontramos turmas vinculadas."}
            </p>
            <Button variant="outline" onClick={fetchDashboardData} className="mt-4">
              Tentar Recarregar
            </Button>
          </div>
        ) : (
          <Tabs defaultValue="turmas" value={tabValue} onValueChange={setTabValue}>
            <TabsList className="mb-4">
              <TabsTrigger value="turmas">Turmas</TabsTrigger>
            </TabsList>

            <TabsContent value="turmas">
              <div className="bg-white p-6 rounded-lg shadow-sm border">
                <Tabs defaultValue="manha" className="w-full">
                  <TabsList className="grid w-full grid-cols-3 mb-6">
                    <TabsTrigger value="manha">Manhã ({grouped.manha.length})</TabsTrigger>
                    <TabsTrigger value="tarde">Tarde ({grouped.tarde.length})</TabsTrigger>
                    <TabsTrigger value="noite">Noite ({grouped.noite.length})</TabsTrigger>
                  </TabsList>

                  <TabsContent value="manha">
                    <TurmasCards turmas={grouped.manha} loading={false} onRefresh={fetchDashboardData} turno="Manhã" />
                  </TabsContent>

                  <TabsContent value="tarde">
                    <TurmasCards turmas={grouped.tarde} loading={false} onRefresh={fetchDashboardData} turno="Tarde" />
                  </TabsContent>

                  <TabsContent value="noite">
                    <TurmasCards turmas={grouped.noite} loading={false} onRefresh={fetchDashboardData} turno="Noite" />
                  </TabsContent>
                </Tabs>
              </div>
            </TabsContent>
          </Tabs>
        )}
      </div>
    </div>
  );
};

export default Dashboard;