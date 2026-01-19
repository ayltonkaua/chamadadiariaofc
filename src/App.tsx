import { useEffect, useState } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter as Router, Routes, Route, Outlet, Navigate } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { EscolaConfigProvider } from "@/contexts/EscolaConfigContext";
import EscolaThemeProvider from "@/components/EscolaThemeProvider";
import Layout from "@/components/layout/Layout";
import ProtectedRoute from "@/components/ProtectedRoute";
import { ErrorBoundary } from "@/components/error/ErrorBoundary";

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
import RelatoriosPage from "@/pages/RelatoriosPage";
import DashboardGestorPage from "@/pages/DashboardGestorPage";
import ForgotPasswordPage from "@/pages/ForgotPasswordPage";
import UpdatePasswordPage from "@/pages/UpdatePasswordPage";
import GerenciarAcessoPage from "@/pages/GerenciarAcessoPage";
import DisciplinasPage from "@/pages/DisciplinasPage";
import GerenciarProgramasPage from "@/pages/gestor/GerenciarProgramasPage";


import { triggerSync } from "@/lib/SyncManager";
import { toast } from "@/components/ui/use-toast";
import GlobalSyncStatus from "@/components/offline/GlobalSyncStatus";

// Optimized QueryClient for caching
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,    // Data stays fresh for 5 minutes
      gcTime: 30 * 60 * 1000,      // Keep unused data in cache for 30 minutes
      retry: 1,                    // Retry once on failure
      refetchOnWindowFocus: true,  // Refetch when window gets focus
      refetchOnMount: false,       // Don't refetch on mount if data is fresh
    },
  },
});

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
      <QueryClientProvider client={queryClient}>
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
                    <Route path="/" element={<Layout showSidebar={false}><Index /></Layout>} />
                    <Route path="/login" element={<Layout showSidebar={false}><LoginPage /></Layout>} />
                    <Route path="/register" element={<Layout showSidebar={false}><RegisterPage /></Layout>} />
                    <Route path="/forgot-password" element={<Layout showSidebar={false}><ForgotPasswordPage /></Layout>} />
                    <Route path="/update-password" element={<Layout showSidebar={false}><UpdatePasswordPage /></Layout>} />
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
                        <Route path="/gestor/dashboard" element={<DashboardGestorPage />} />
                        <Route path="/relatorios" element={<RelatoriosPage />} />
                        <Route path="/gestao-acesso" element={<GerenciarAcessoPage />} />
                        <Route path="/notificacoes" element={<NotificacoesPage />} />
                      </Route>
                    </Route>

                    {/* Gestão de Programas Sociais (Novo) */}
                    <Route element={<ProtectedRoute allowedTypes={['admin', 'diretor']} />}>
                      <Route element={<Layout><Outlet /></Layout>}>
                        <Route path="/gestor/programas" element={<GerenciarProgramasPage />} />
                      </Route>
                    </Route>



                    <Route path="*" element={<Layout showSidebar={false}><NotFound /></Layout>} />
                  </Routes>
                </Router>
              </TooltipProvider>
            </EscolaThemeProvider>
          </EscolaConfigProvider>
        </AuthProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
};

export default App;