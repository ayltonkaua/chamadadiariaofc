import { useEffect, useState } from "react";
import { clear } from 'idb-keyval'; // Importe isso no topo
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
import AlertasPage from "@/pages/AlertasPage";
import RegistroAtrasosPage from "@/pages/RegistroAtrasosPage";
import NotificacoesPage from "@/pages/NotificacoesPage";
import ConsultarFaltasPage from "@/pages/ConsultarFaltasPage";
import AlunoPage from "@/pages/AlunoPage";
import PesquisasListPage from "@/pages/PesquisasListPage";
import PesquisaCreatePage from "@/pages/PesquisaCreatePage";
import PesquisaResultadosPage from "@/pages/PesquisaResultadosPage";
import PesquisaPublicaPage from "@/pages/PesquisaPublicaPage";
import PerfilEscolaPage from "@/pages/PerfilEscolaPage";
import RelatoriosPage from "@/pages/RelatoriosPage";
import PortalAlunoPage from "@/pages/PortalAlunoPage";
import DashboardGestorPage from "@/pages/DashboardGestorPage";
import ForgotPasswordPage from "@/pages/ForgotPasswordPage";
import UpdatePasswordPage from "@/pages/UpdatePasswordPage";
import GerenciarAcessoPage from "@/pages/GerenciarAcessoPage";
import DisciplinasPage from "@/pages/DisciplinasPage";
import MeuIngressoPage from "@/pages/aluno/MeuIngressoPage";
import ScannerPage from "@/pages/evento/ScannerPage";
import GerenciarEventosPage from "@/pages/gestor/GerenciarEventosPage";

import { sincronizarChamadasOffline } from "@/lib/offlineChamada";
import { toast } from "@/components/ui/use-toast";

const queryClient = new QueryClient();

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
  // NOVO: Limpeza de Cache de Segurança
  useEffect(() => {
    const checkSecurityVersion = async () => {
      const CURRENT_VERSION = 'v2_secure_rls'; // Mudamos a versão
      const storedVersion = localStorage.getItem('app_version');

      if (storedVersion !== CURRENT_VERSION) {
        console.warn("Versão de segurança antiga detectada. Limpando cache local...");

        // 1. Limpa o IndexedDB (onde as turmas antigas estão escondidas)
        await clear();

        // 2. Limpa LocalStorage
        localStorage.clear();

        // 3. Define nova versão
        localStorage.setItem('app_version', CURRENT_VERSION);

        // 4. Recarrega a página para garantir estado limpo
        window.location.reload();
      }
    };

    checkSecurityVersion();
  }, []);
  useEffect(() => {
    const syncOfflineData = async () => {
      if (navigator.onLine) {
        try {
          // Invalida todas as queries para forçar recarregamento dos dados
          queryClient.invalidateQueries();

          const { success, count, error } = await sincronizarChamadasOffline();
          if (success && count && count > 0) {
            toast({
              title: "Sincronização Concluída",
              description: `${count} chamadas offline foram enviadas com sucesso.`,
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
    <QueryClientProvider client={queryClient}>
      <OfflineBanner />
      <AuthProvider>
        <EscolaConfigProvider>
          <EscolaThemeProvider>
            <TooltipProvider>
              <Toaster />
              <Sonner />

              <Router>
                <Routes>
                  {/* --- Rotas Públicas --- */}
                  <Route path="/" element={<Layout showSidebar={false}><Index /></Layout>} />
                  <Route path="/login" element={<Layout showSidebar={false}><LoginPage /></Layout>} />
                  <Route path="/register" element={<Layout showSidebar={false}><RegisterPage /></Layout>} />
                  <Route path="/forgot-password" element={<Layout showSidebar={false}><ForgotPasswordPage /></Layout>} />
                  <Route path="/update-password" element={<Layout showSidebar={false}><UpdatePasswordPage /></Layout>} />
                  <Route path="/responder-pesquisa" element={<Layout showSidebar={false}><PesquisaPublicaPage /></Layout>} />
                  <Route path="/student-query" element={<StudentQueryPage />} />

                  {/* --- Rotas Autenticadas (Todas/Comum) --- */}
                  <Route element={<ProtectedRoute />}>
                    <Route element={<Layout><Outlet /></Layout>}>
                      <Route path="/dashboard" element={<Dashboard />} />

                      {/* Funcionalidades Comuns */}
                      <Route path="/chamadas/:turmaId" element={<ChamadaPage />} />
                      <Route path="/turmas/:turmaId/chamada" element={<ChamadaPage />} />
                      <Route path="/turmas/:turmaId/alunos" element={<GerenciarAlunosPage />} />
                      <Route path="/turmas/:turmaId/alunos/:alunoId" element={<AlunoPage />} />
                      <Route path="/gerenciar-alunos/:turmaId" element={<GerenciarAlunosPage />} />

                      <Route path="/historico-chamada/:turmaId" element={<HistoricoChamadaPage />} />
                      <Route path="/consultar-faltas" element={<ConsultarFaltasPage />} />
                      <Route path="/atestados" element={<AtestadosPage />} />
                      <Route path="/alertas" element={<AlertasPage />} />
                      <Route path="/disciplinas" element={<DisciplinasPage />} />
                      <Route path="/registro-atrasos" element={<RegistroAtrasosPage />} />

                      {/* Pesquisas */}
                      <Route path="/pesquisas" element={<PesquisasListPage />} />
                      <Route path="/pesquisas/nova" element={<PesquisaCreatePage />} />
                      <Route path="/pesquisas/:pesquisaId/resultados" element={<PesquisaResultadosPage />} />

                      {/* Perfil */}
                      <Route path="/perfil-escola" element={<PerfilEscolaPage />} />

                      {/* Portal Aluno - Protected but specific redirect logic if wrong? Portal Aluno page accessible if auth as Aluno */}
                      <Route path="/portal-aluno" element={<PortalAlunoPage />} />
                    </Route>
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

                  {/* --- Rotas de Eventos (SEM Layout para evitar tela branca) --- */}
                  <Route element={<ProtectedRoute allowedRoles={['admin', 'diretor']} />}>
                    <Route path="/gestor/eventos" element={<GerenciarEventosPage />} />
                  </Route>

                  <Route element={<ProtectedRoute allowedRoles={['admin', 'diretor', 'professor', 'aluno', 'monitor']} />}>
                    <Route path="/evento/scanner" element={<ScannerPage />} />
                  </Route>

                  <Route element={<ProtectedRoute allowedRoles={['aluno']} />}>
                    <Route path="/aluno/ingresso" element={<MeuIngressoPage />} />
                  </Route>

                  <Route path="*" element={<Layout showSidebar={false}><NotFound /></Layout>} />
                </Routes>
              </Router>
            </TooltipProvider>
          </EscolaThemeProvider>
        </EscolaConfigProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
};

export default App;