import { useEffect, useState } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter as Router, Routes, Route, Outlet } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { AttendanceProvider } from "@/contexts/AttendanceContext";
import { EscolaConfigProvider } from "@/contexts/EscolaConfigContext";
import EscolaThemeProvider from "@/components/EscolaThemeProvider";
import Layout from "@/components/layout/Layout";

// --- REFINE IMPORTS ---
import { Refine } from "@refinedev/core";
import routerBindings, { UnsavedChangesNotifier, DocumentTitleHandler } from "@refinedev/react-router-v6";
import { databaseProvider } from "@/providers/data-provider";
import { supabase } from "@/integrations/supabase/client"; // Usado para auth no Refine

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
  useEffect(() => {
    const syncOfflineData = async () => {
      if (navigator.onLine) {
        try {
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
    window.addEventListener('online', syncOfflineData);
    syncOfflineData();
    return () => window.removeEventListener('online', syncOfflineData);
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <OfflineBanner />
      <AuthProvider>
        <EscolaConfigProvider>
          <EscolaThemeProvider>
            <AttendanceProvider>
              <TooltipProvider>
                <Toaster />
                <Sonner />

                <Router>
                  {/* O Refine deve ficar DENTRO do Router mas FORA das Routes */}
                  <Refine
                    dataProvider={databaseProvider}
                    routerProvider={routerBindings}
                    authProvider={{
                      // Auth Provider Simples do Refine conectado ao Supabase
                      login: async ({ email, password }) => {
                        const { data, error } = await supabase.auth.signInWithPassword({ email, password });
                        if (error) return { success: false, error };
                        return { success: true, redirectTo: "/dashboard" };
                      },
                      logout: async () => {
                        await supabase.auth.signOut();
                        return { success: true, redirectTo: "/login" };
                      },
                      onError: async (error) => { console.error(error); return { error }; },
                      check: async () => {
                        const { data } = await supabase.auth.getSession();
                        return { authenticated: !!data.session };
                      },
                      getPermissions: async () => null,
                    }}
                    resources={[
                      // Aqui definimos as "Tabelas" que o Refine vai gerenciar
                      // O "name" deve bater com o nome da tabela no Supabase (ou RxDB futuro)
                      {
                        name: "turmas",
                        list: "/dashboard", // Quando pedir para listar turmas, ele sabe que é no dashboard (exemplo)
                        show: "/turmas/:turmaId/alunos",
                      },
                      {
                        name: "alunos",
                        list: "/gerenciar-alunos/:turmaId",
                        show: "/turmas/:turmaId/alunos/:alunoId",
                      },
                      {
                        name: "chamadas",
                        list: "/historico-chamada/:turmaId",
                        create: "/chamadas/:turmaId"
                      }
                    ]}
                    options={{
                      syncWithLocation: true,
                      warnWhenUnsavedChanges: true,
                    }}
                  >
                    <Routes>
                      {/* --- Rotas Públicas --- */}
                      <Route path="/" element={<Layout showSidebar={false}><Index /></Layout>} />
                      <Route path="/login" element={<Layout showSidebar={false}><LoginPage /></Layout>} />
                      <Route path="/register" element={<Layout showSidebar={false}><RegisterPage /></Layout>} />
                      <Route path="/forgot-password" element={<Layout showSidebar={false}><ForgotPasswordPage /></Layout>} />
                      <Route path="/update-password" element={<Layout showSidebar={false}><UpdatePasswordPage /></Layout>} />
                      <Route path="/responder-pesquisa" element={<Layout showSidebar={false}><PesquisaPublicaPage /></Layout>} />

                      {/* --- Rotas Autenticadas --- */}
                      {/* Usamos o Outlet do Refine para injetar funcionalidades extras se necessário, mas mantemos seu Layout */}
                      <Route
                        element={
                          <Layout>
                            <Outlet /> {/* O conteúdo das páginas renderiza aqui */}
                          </Layout>
                        }
                      >
                        <Route path="/dashboard" element={<Dashboard />} />
                        <Route path="/portal-aluno" element={<PortalAlunoPage />} />

                        <Route path="/chamadas/:turmaId" element={<ChamadaPage />} />
                        <Route path="/turmas/:turmaId/chamada" element={<ChamadaPage />} />
                        <Route path="/turmas/:turmaId/alunos" element={<GerenciarAlunosPage />} />
                        <Route path="/turmas/:turmaId/alunos/:alunoId" element={<AlunoPage />} />
                        <Route path="/gerenciar-alunos/:turmaId" element={<GerenciarAlunosPage />} />

                        <Route path="/historico-chamada/:turmaId" element={<HistoricoChamadaPage />} />
                        <Route path="/consultar-faltas" element={<ConsultarFaltasPage />} />
                        <Route path="/atestados" element={<AtestadosPage />} />
                        <Route path="/relatorios" element={<RelatoriosPage />} />
                        <Route path="/disciplinas" element={<DisciplinasPage />} />
                        <Route path="/alertas" element={<AlertasPage />} />
                        <Route path="/student-query" element={<StudentQueryPage />} />
                        <Route path="/registro-atrasos" element={<RegistroAtrasosPage />} />
                        <Route path="/notificacoes" element={<NotificacoesPage />} />

                        {/* Pesquisas */}
                        <Route path="/pesquisas" element={<PesquisasListPage />} />
                        <Route path="/pesquisas/nova" element={<PesquisaCreatePage />} />
                        <Route path="/pesquisas/:pesquisaId/resultados" element={<PesquisaResultadosPage />} />

                        {/* Gestão */}
                        <Route path="/gestor/dashboard" element={<DashboardGestorPage />} />
                        <Route path="/perfil-escola" element={<PerfilEscolaPage />} />
                        <Route path="/gestao-acesso" element={<GerenciarAcessoPage />} />
                      </Route>

                      <Route path="*" element={<Layout showSidebar={false}><NotFound /></Layout>} />
                    </Routes>

                    <UnsavedChangesNotifier />
                    <DocumentTitleHandler
                      handler={({ resource, action, params }) => {
                        // Se estivermos em uma página específica (ex: Turmas), mostra "Turmas | Chamada Diária"
                        if (resource?.label || resource?.name) {
                          // Capitaliza a primeira letra do recurso
                          const pageName = (resource.label ?? resource.name ?? "").charAt(0).toUpperCase() + (resource.label ?? resource.name ?? "").slice(1);
                          return `${pageName} | Chamada Diária`;
                        }
                        // Se for a home ou indefinido, mostra apenas o nome do app
                        return "Chamada Diária";
                      }}
                    />
                  </Refine>
                </Router>
              </TooltipProvider>
            </AttendanceProvider>
          </EscolaThemeProvider>
        </EscolaConfigProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
};

export default App;