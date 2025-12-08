import React, { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { InfoCards } from "@/components/dashboard/InfoCards";
import { TurmasCards } from "@/components/TurmasCards";
import OfflineManager from "@/components/offline/OfflineManager";
import { supabase } from "@/integrations/supabase/client";
import { ImportTurmasDialog } from "@/components/turmas/ImportTurmasDialog";
import { getDadosEscolaOffline } from "@/lib/offlineChamada";
import { WifiOff, Loader2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

// Interface de dados
interface Turma {
  id: string;
  nome: string;
  numero_sala?: string;
  turno: string;
  escola_id: string;
  _count?: {
    alunos: number;
  };
  alunos?: number; // Compatibilidade offline
}

const Dashboard: React.FC = () => {
  const { user } = useAuth(); // AuthContext pode estar vazio offline
  const navigate = useNavigate();
  const [tabValue, setTabValue] = useState("turmas");
  const [loading, setLoading] = useState(true);
  const [todasTurmas, setTodasTurmas] = useState<Turma[]>([]);
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

  // --- LÓGICA DE DADOS ROBUSTA ---
  const fetchDashboardData = useCallback(async () => {
    setLoading(true);

    // 1. ESTRATÉGIA OFFLINE-FIRST SE SEM CONEXÃO
    // Se o navegador diz que está offline, NEM TENTE conectar ao Supabase.
    if (!navigator.onLine) {
      await carregarDadosOffline();
      setLoading(false);
      return;
    }

    // 2. ESTRATÉGIA ONLINE COM FALLBACK
    try {
      // Verifica se usuário está autenticado
      if (!user) {
        throw new Error("Usuário não autenticado");
      }

      // RLS já filtra por escola e role automaticamente
      // Staff vê todas as turmas da escola, Professor vê apenas suas turmas, Aluno vê apenas sua turma
      const { data, error } = await supabase
        .from('turmas')
        .select(`id, nome, numero_sala, turno, escola_id, alunos:alunos(count)`)
        .order('nome');

      if (error) throw error;

      const turmasFormatadas: Turma[] = (data || []).map((t: any) => ({
        id: t.id,
        nome: t.nome,
        escola_id: t.escola_id,
        numero_sala: t.numero_sala,
        turno: t.turno || "Sem Turno",
        _count: { alunos: t.alunos?.[0]?.count || 0 }
      }));

      setTodasTurmas(turmasFormatadas);
      setIsOfflineMode(false);

    } catch (err) {
      console.warn("Falha ao buscar dados online. Ativando modo offline...", err);
      await carregarDadosOffline();
    } finally {
      setLoading(false);
    }
  }, [user]);

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
            _count: { alunos: qtdAlunos },
            alunos: qtdAlunos
          };
        });

        turmasOffline.sort((a: any, b: any) => a.nome.localeCompare(b.nome));
        setTodasTurmas(turmasOffline);
        setIsOfflineMode(true);
      } else {
        // Se não tem nada no cache
        setTodasTurmas([]);
      }
    } catch (err) {
      console.error("Erro crítico ao ler offline:", err);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  // Filtros de Turno
  const turmasManha = todasTurmas.filter(t => {
    const turno = t.turno?.toLowerCase() || "";
    return turno.includes("manhã") || turno.includes("manha") || turno.includes("matutino") || turno.includes("1");
  });

  const turmasTarde = todasTurmas.filter(t => {
    const turno = t.turno?.toLowerCase() || "";
    return turno.includes("tarde") || turno.includes("vespertino") || turno.includes("2");
  });

  const turmasNoite = todasTurmas.filter(t => {
    const turno = t.turno?.toLowerCase() || "";
    return turno.includes("noite") || turno.includes("noturno") || turno.includes("3");
  });

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
                    <TabsTrigger value="manha">Manhã ({turmasManha.length})</TabsTrigger>
                    <TabsTrigger value="tarde">Tarde ({turmasTarde.length})</TabsTrigger>
                    <TabsTrigger value="noite">Noite ({turmasNoite.length})</TabsTrigger>
                  </TabsList>

                  <TabsContent value="manha">
                    <TurmasCards turmas={turmasManha} loading={false} onRefresh={fetchDashboardData} turno="Manhã" />
                  </TabsContent>

                  <TabsContent value="tarde">
                    <TurmasCards turmas={turmasTarde} loading={false} onRefresh={fetchDashboardData} turno="Tarde" />
                  </TabsContent>

                  <TabsContent value="noite">
                    <TurmasCards turmas={turmasNoite} loading={false} onRefresh={fetchDashboardData} turno="Noite" />
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