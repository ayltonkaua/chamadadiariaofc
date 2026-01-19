/**
 * Dashboard - Main Page
 * 
 * Dashboard principal com visual moderno e responsivo.
 * Mobile-first design com cards vibrantes.
 */

import React, { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useEscolaConfig } from "@/contexts/EscolaConfigContext";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { InfoCards } from "@/components/dashboard/InfoCards";
import { TurmasCards } from "@/components/TurmasCards";
import OfflineManager from "@/components/offline/OfflineManager";
import { ImportTurmasDialog } from "@/components/turmas/ImportTurmasDialog";
import { getSchoolCache } from "@/lib/offlineStorage";
import { WifiOff, Loader2, RefreshCw, Sunrise, Sun, Moon, LayoutGrid } from "lucide-react";
import { Button } from "@/components/ui/button";
import { turmaService, type TurmaComContagem } from "@/domains";

const Dashboard: React.FC = () => {
  const { user } = useAuth();
  const { config } = useEscolaConfig();
  const corPrimaria = config?.cor_primaria || "#6D28D9";
  const navigate = useNavigate();
  // Inicializa a tab como vazia, será definida após carregar turmas
  const [turnoTab, setTurnoTab] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [todasTurmas, setTodasTurmas] = useState<TurmaComContagem[]>([]);
  const [isOfflineMode, setIsOfflineMode] = useState(!navigator.onLine);

  useEffect(() => {
    const handleStatus = () => setIsOfflineMode(!navigator.onLine);
    window.addEventListener('online', handleStatus);
    window.addEventListener('offline', handleStatus);
    return () => {
      window.removeEventListener('online', handleStatus);
      window.removeEventListener('offline', handleStatus);
    };
  }, []);

  const carregarDadosOffline = async () => {
    try {
      const dadosOffline = await getSchoolCache(user?.escola_id || '');
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

  const fetchDashboardData = useCallback(async () => {
    setLoading(true);
    if (!navigator.onLine) {
      await carregarDadosOffline();
      setLoading(false);
      return;
    }
    try {
      if (!user) throw new Error("Usuário não autenticado");
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

  const grouped = turmaService.groupByTurno(todasTurmas);

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return { text: "Bom dia", icon: Sunrise, color: "text-amber-500" };
    if (hour < 18) return { text: "Boa tarde", icon: Sun, color: "text-orange-500" };
    return { text: "Boa noite", icon: Moon, color: "text-indigo-500" };
  };

  const greeting = getGreeting();
  const GIcon = greeting.icon;

  const allTurnos = [
    { value: "manha", label: "Manhã", count: grouped.manha?.length || 0 },
    { value: "tarde", label: "Tarde", count: grouped.tarde?.length || 0 },
    { value: "noite", label: "Noite", count: grouped.noite?.length || 0 },
    { value: "integral", label: "Integral", count: grouped.integral?.length || 0 },
  ];

  // Filtra apenas turnos com turmas
  const turnosAtivos = allTurnos.filter(t => t.count > 0);

  // Define tab inicial se não definida ou se a atual ficou vazia
  useEffect(() => {
    if (turnosAtivos.length > 0) {
      if (!turnoTab || !turnosAtivos.find(t => t.value === turnoTab)) {
        setTurnoTab(turnosAtivos[0].value);
      }
    }
  }, [turnosAtivos, turnoTab]);

  const turmasFiltradas = turnoTab
    ? (grouped[turnoTab as keyof typeof grouped] || [])
    : [];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full min-h-screen flex-col gap-4 bg-gray-50">
        <Loader2 className="h-10 w-10 animate-spin" style={{ color: corPrimaria }} />
        <p className="text-gray-500 font-medium">Carregando seus dados...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      <div className="p-4 sm:p-6 lg:p-8 pb-24 animate-in fade-in duration-500">
        {/* Header */}
        <div className="flex flex-col gap-4 mb-6 sm:mb-8">
          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <GIcon className={`h-5 w-5 ${greeting.color}`} />
                <span className={`text-sm font-medium ${greeting.color}`}>{greeting.text}</span>
                {isOfflineMode && (
                  <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full border border-amber-200 flex items-center gap-1">
                    <WifiOff size={12} /> Offline
                  </span>
                )}
              </div>
              <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">
                Página Inicial
              </h1>
              <p className="text-gray-500 text-sm sm:text-base mt-1">
                Realize chamadas e gerencie suas turmas
              </p>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <OfflineManager />
              <ImportTurmasDialog onSuccess={fetchDashboardData} />
            </div>
          </div>
        </div>

        {/* Info Cards */}
        <div className="mb-6 sm:mb-8">
          <InfoCards />
        </div>

        {/* Turmas Section */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          {/* Section Header */}
          <div className="p-4 sm:p-6 border-b border-gray-100">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-opacity-10" style={{ backgroundColor: `${corPrimaria}15` }}>
                  <LayoutGrid className="h-5 w-5" style={{ color: corPrimaria }} />
                </div>
                <div>
                  <h2 className="text-lg sm:text-xl font-semibold text-gray-800">Minhas Turmas</h2>
                  <p className="text-sm text-gray-500">{todasTurmas.length} turmas encontradas</p>
                </div>
              </div>

              {/* Turno Filter */}
              {/* Turno Filter */}
              <div className="flex gap-1 overflow-x-auto pb-2 sm:pb-0">
                {turnosAtivos.map((tab) => (
                  <button
                    key={tab.value}
                    onClick={() => setTurnoTab(tab.value)}
                    className={`px-3 sm:px-4 py-2 text-xs sm:text-sm font-medium rounded-lg transition-all whitespace-nowrap border ${turnoTab === tab.value
                      ? "bg-white shadow-sm border-gray-200"
                      : "text-gray-500 border-transparent hover:bg-gray-50"
                      }`}
                    style={turnoTab === tab.value ? { color: corPrimaria, borderColor: corPrimaria } : {}}
                  >
                    {tab.label} ({tab.count})
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Turmas Grid */}
          <div className="p-4 sm:p-6">
            {turmasFiltradas.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
                  <RefreshCw className="h-8 w-8 text-gray-300" />
                </div>
                <h3 className="text-lg font-semibold text-gray-700 mb-2">Nenhuma turma disponível</h3>
                <p className="text-gray-500 max-w-sm mb-4">
                  {isOfflineMode
                    ? "Você está offline e não há dados salvos. Conecte-se para baixar."
                    : "Não encontramos turmas vinculadas ao seu perfil."}
                </p>
                <Button variant="outline" onClick={fetchDashboardData}>
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Tentar Recarregar
                </Button>
              </div>
            ) : (
              <TurmasCards
                turmas={turmasFiltradas}
                loading={false}
                onRefresh={fetchDashboardData}
                turno={turnoTab === "todos" ? undefined : turnoTab}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;