import { useEffect, useState } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { BrowserRouter as Router, Routes, Route, Outlet } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { EscolaConfigProvider } from "@/contexts/EscolaConfigContext";
import EscolaThemeProvider from "@/components/EscolaThemeProvider";
import Layout from "@/components/layout/Layout";
import ProtectedRoute from "@/components/ProtectedRoute";
import { ErrorBoundary } from "@/components/error/ErrorBoundary";
import { QueryProvider } from "@/providers/QueryProvider";
import { queryClient } from "@/providers/query-client";

// Importações de Páginas
import LoginPage from "@/pages/LoginPage";
import Dashboard from "@/pages/Dashboard";
import StudentQueryPage from "@/pages/StudentQueryPage";
import NotFound from "@/pages/NotFound";
import Index from "@/pages/Index";
import RegisterPage from "@/pages/RegisterPage";
import ChamadaPage from "@/pages/ChamadaPage";
import GerenciarAlunosPage from "@/pages/GerenciarAlunosPage";
import HistoricoChamadaPage from "@/pages/HistoricoChamadaPage";
import AtestadosPage from "@/pages/AtestadosPage";
import RegistroAtrasosPage from "@/pages/RegistroAtrasosPage";
import NotificacoesPage from "@/pages/NotificacoesPage";
import ConsultarFaltasPage from "@/pages/ConsultarFaltasPage";
import AlunoPage from "@/pages/AlunoPage";
import PerfilEscolaPage from "@/pages/PerfilEscolaPage";
import ForgotPasswordPage from "@/pages/ForgotPasswordPage";
import UpdatePasswordPage from "@/pages/UpdatePasswordPage";
import DisciplinasPage from "@/pages/DisciplinasPage";
import AnoLetivoPage from "@/pages/AnoLetivoPage";
import MigrarTurmasPage from "@/pages/MigrarTurmasPage";
import ArquivosAnoPage from "@/pages/ArquivosAnoPage";
import ArquivosListPage from "@/pages/ArquivosListPage";
import ForcePasswordChangePage from "@/pages/ForcePasswordChangePage";
import MapaAlunosPage from "@/pages/MapaAlunosPage";
import {
  EvasaoPage,
  RelatoriosPage as LazyRelatoriosPage,
  DashboardGestorPage as LazyDashboardGestorPage,
  GerenciarAcessoPage as LazyGerenciarAcessoPage,
  GerenciarProgramasPage as LazyGerenciarProgramasPage,
} from "@/app/routes.lazy";
import BotWhatsAppPage from "@/pages/BotWhatsAppPage";
import { FEATURE_FLAGS } from "@/config/featureFlags";


import { triggerSync } from "@/lib/SyncManager";
import { toast } from "@/components/ui/use-toast";
import GlobalSyncStatus from "@/components/offline/GlobalSyncStatus";
import { ExternalLink, Rocket } from "lucide-react";

const RedirectPortalAluno = () => {
  console.log("Montando RedirectPortalAluno na rota portal-aluno!");
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4">
      <div className="bg-white max-w-md w-full rounded-2xl p-8 shadow-xl text-center border border-purple-100">
        <div className="w-16 h-16 bg-purple-100 text-purple-600 rounded-full flex items-center justify-center mx-auto mb-6 shadow-inner">
          <Rocket className="w-8 h-8" />
        </div>
        <h1 className="text-2xl font-bold text-gray-900 mb-2">O Portal de cara nova!</h1>
        <p className="text-gray-600 mb-8">
          Nosso Portal do Aluno agora tem um endereço próprio e exclusivo. Mais rápido, seguro e fácil de acessar.
        </p>
        <a
          href="https://portal.chamadadiaria.com.br"
          className="inline-flex w-full items-center justify-center gap-2 bg-purple-600 hover:bg-purple-700 text-white font-semibold py-3 px-6 rounded-xl transition-all hover:-translate-y-1 hover:shadow-lg"
        >
          Acessar Novo Portal
          <ExternalLink className="w-5 h-5" />
        </a>
      </div>
    </div>
  );
};

const OfflineBanner = () => {
  const [isOffline, setIsOffline] = useState(!navigator.onLine);

  useEffect(() => {
    const handleStatusChange = () => setIsOffline(!navigator.onLine);
    window.addEventListener("online", handleStatusChange);
    window.addEventListener("offline", handleStatusChange);
    return () => {
      window.removeEventListener("online", handleStatusChange);
      window.removeEventListener("offline", handleStatusChange);
    };
  }, []);

  if (!isOffline) return null;

  return (
    <div className="bg-yellow-500 text-white text-center py-2 text-sm font-bold fixed top-0 left-0 right-0 z-[100] animate-in slide-in-from-top">
      Você está offline. As chamadas serão salvas localmente.
    </div>
  );
};

const App = () => {
  // Sync offline data when app loads or comes online
  useEffect(() => {
    const syncOfflineData = async () => {
      if (navigator.onLine) {
        try {
          // Invalida todas as queries para forçar recarregamento dos dados
          queryClient.invalidateQueries();

          // Use new SyncManager instead of legacy sync
          const results = await triggerSync();
          const successCount = results.filter(r => r.success).length;
          if (successCount > 0) {
            toast({
              title: "Sincronização Concluída",
              description: `${successCount} chamadas offline foram enviadas com sucesso.`,
            });
          }
        } catch (e) {
          console.error("Sync error", e);
        }
      }
    };

    const handleOnline = () => {
      // Quando a conexão volta, invalida queries e sincroniza
      queryClient.invalidateQueries();
      syncOfflineData();
    };

    window.addEventListener('online', handleOnline);
    syncOfflineData();
    return () => window.removeEventListener('online', handleOnline);
  }, []);

  return (
    <ErrorBoundary>
      <QueryProvider>
        <OfflineBanner />
        <AuthProvider>
          <EscolaConfigProvider>
            <EscolaThemeProvider>
              <TooltipProvider>
                <Toaster />
                <Sonner />

                {/* Global sync status indicator (Phase 1 UX) */}
                <GlobalSyncStatus />

                <Router>
                  <Routes>
                    {/* --- Rotas Públicas --- */}
                    <Route path="/portal-aluno" element={<RedirectPortalAluno />} />
                    <Route path="/portal-aluno/*" element={<RedirectPortalAluno />} />
                    <Route path="/" element={<Layout showSidebar={false}><Index /></Layout>} />
                    <Route path="/login" element={<Layout showSidebar={false}><LoginPage /></Layout>} />
                    <Route path="/register" element={<Layout showSidebar={false}><RegisterPage /></Layout>} />
                    <Route path="/forgot-password" element={<Layout showSidebar={false}><ForgotPasswordPage /></Layout>} />
                    <Route path="/update-password" element={<Layout showSidebar={false}><UpdatePasswordPage /></Layout>} />
                    <Route path="/trocar-senha" element={<ForcePasswordChangePage />} />
                    <Route path="/student-query" element={<StudentQueryPage />} />

                    {/* --- Rotas Autenticadas (Todas/Comum) --- */}
                    <Route element={<ProtectedRoute />}>
                      <Route element={<Layout><Outlet /></Layout>}>
                        <Route path="/dashboard" element={<Dashboard />} />

                        {/* Funcionalidades Comuns */}
                        <Route path="/turmas/:turmaId/alunos" element={<GerenciarAlunosPage />} />
                        <Route path="/turmas/:turmaId/alunos/:alunoId" element={<AlunoPage />} />
                        <Route path="/gerenciar-alunos/:turmaId" element={<GerenciarAlunosPage />} />


                        <Route path="/historico-chamada/:turmaId" element={<HistoricoChamadaPage />} />
                        <Route path="/consultar-faltas" element={<ConsultarFaltasPage />} />
                        <Route path="/atestados" element={<AtestadosPage />} />
                        <Route path="/disciplinas" element={<DisciplinasPage />} />
                        <Route path="/registro-atrasos" element={<RegistroAtrasosPage />} />

                        {/* Perfil */}
                        <Route path="/perfil-escola" element={<PerfilEscolaPage />} />


                      </Route>

                      {/* Chamada - Layout limpo sem sidebar para foco total */}
                      <Route path="/chamadas/:turmaId" element={<Layout showSidebar={false}><ChamadaPage /></Layout>} />
                      <Route path="/turmas/:turmaId/chamada" element={<Layout showSidebar={false}><ChamadaPage /></Layout>} />
                    </Route>

                    {/* --- Rotas Gestor (Admin/Diretor/Coordenador/Secretario) --- */}
                    <Route element={<ProtectedRoute allowedRoles={['admin', 'diretor', 'coordenador', 'secretario', 'super_admin']} />}>
                      <Route element={<Layout><Outlet /></Layout>}>
                        <Route path="/gestor/dashboard" element={<LazyDashboardGestorPage />} />
                        <Route path="/relatorios" element={<LazyRelatoriosPage />} />
                        <Route path="/gestao-acesso" element={<LazyGerenciarAcessoPage />} />
                        <Route path="/notificacoes" element={<NotificacoesPage />} />
                        <Route path="/ano-letivo" element={<AnoLetivoPage />} />
                        <Route path="/migrar-turmas" element={<MigrarTurmasPage />} />
                        <Route path="/arquivos" element={<ArquivosListPage />} />
                        <Route path="/arquivos/:anoLetivoId" element={<ArquivosAnoPage />} />
                        {FEATURE_FLAGS.MAPA_ALUNOS && <Route path="/mapa" element={<MapaAlunosPage />} />}
                        {FEATURE_FLAGS.EVASAO_AI && <Route path="/evasao" element={<EvasaoPage />} />}
                        {FEATURE_FLAGS.WHATSAPP_BOT && <Route path="/gestor/whatsapp-bot" element={<BotWhatsAppPage />} />}
                      </Route>
                    </Route>

                    {/* Gestão de Programas Sociais (Novo) */}
                    <Route element={<ProtectedRoute allowedTypes={['admin', 'diretor']} />}>
                      <Route element={<Layout><Outlet /></Layout>}>
                        <Route path="/gestor/programas" element={<LazyGerenciarProgramasPage />} />
                      </Route>
                    </Route>



                    <Route path="*" element={<Layout showSidebar={false}><NotFound /></Layout>} />
                  </Routes>
                </Router>
              </TooltipProvider>
            </EscolaThemeProvider>
          </EscolaConfigProvider>
        </AuthProvider>
      </QueryProvider>
    </ErrorBoundary>
  );
};

export default App;
