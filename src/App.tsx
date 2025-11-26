import { useEffect } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { AttendanceProvider } from "@/contexts/AttendanceContext";
import { EscolaConfigProvider } from "@/contexts/EscolaConfigContext";
import EscolaThemeProvider from "@/components/EscolaThemeProvider";
import Layout from "@/components/layout/Layout";
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
import { getChamadasPendentes, limparChamadasPendentes, sincronizarChamadasOffline } from "@/lib/offlineChamada";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/components/ui/use-toast";

const queryClient = new QueryClient();

const App = () => {
  useEffect(() => {
    // ... seu código do OneSignal
  }, []);

  useEffect(() => {
    const syncOfflineData = async () => {
      if (navigator.onLine) {
        const { success, count, error } = await sincronizarChamadasOffline();
        if (success && count && count > 0) {
          toast({
            title: "Sincronização Concluída",
            description: `${count} chamadas offline foram enviadas com sucesso.`,
          });
        } else if (!success) {
          console.error("Erro na sincronização automática:", error);
        }
      }
    };

    window.addEventListener('online', syncOfflineData);
    syncOfflineData(); // Tenta sincronizar ao carregar se estiver online

    return () => {
      window.removeEventListener('online', syncOfflineData);
    };
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      {!navigator.onLine && (
        <div className="bg-yellow-400 text-center py-2 text-sm font-bold z-50">
          Você está offline. As chamadas serão salvas localmente.
        </div>
      )}
      <AuthProvider>
        <EscolaConfigProvider>
          <EscolaThemeProvider>
            <AttendanceProvider>
              <TooltipProvider>
                <Toaster />
                <Sonner />
                <Router>
                  <Routes>
                    {/* Páginas públicas (sem sidebar) */}
                    <Route path="/" element={<Layout showSidebar={false}><Index /></Layout>} />
                    <Route path="/login" element={<Layout showSidebar={false}><LoginPage /></Layout>} />
                    <Route path="/register" element={<Layout showSidebar={false}><RegisterPage /></Layout>} />
                    <Route path="/forgot-password" element={<Layout showSidebar={false}><ForgotPasswordPage /></Layout>} />
                    <Route path="/update-password" element={<Layout showSidebar={false}><UpdatePasswordPage /></Layout>} />
                    <Route path="/responder-pesquisa" element={<Layout showSidebar={false}><PesquisaPublicaPage /></Layout>} />

                    {/* Páginas autenticadas (com sidebar) */}
                    <Route path="/dashboard" element={<Layout><Dashboard /></Layout>} />
                    <Route path="/portal-aluno" element={<Layout><PortalAlunoPage /></Layout>} />
                    <Route path="/chamadas/:turmaId" element={<Layout><ChamadaPage /></Layout>} />
                    <Route path="/gerenciar-alunos/:turmaId" element={<Layout><GerenciarAlunosPage /></Layout>} />
                    <Route path="/historico-chamada/:turmaId" element={<Layout><HistoricoChamadaPage /></Layout>} />
                    <Route path="/atestados" element={<Layout><AtestadosPage /></Layout>} />
                    <Route path="/alertas" element={<Layout><AlertasPage /></Layout>} />
                    <Route path="/student-query" element={<Layout><StudentQueryPage /></Layout>} />
                    <Route path="/registro-atrasos" element={<Layout><RegistroAtrasosPage /></Layout>} />
                    <Route path="/notificacoes" element={<Layout><NotificacoesPage /></Layout>} />
                    <Route path="/turmas/:turmaId/alunos" element={<Layout><GerenciarAlunosPage /></Layout>} />
                    <Route path="/turmas/:turmaId/alunos/:alunoId" element={<Layout><AlunoPage /></Layout>} />
                    <Route path="/turmas/:turmaId/chamada" element={<Layout><ChamadaPage /></Layout>} />
                    <Route path="/consultar-faltas" element={<Layout><ConsultarFaltasPage /></Layout>} />
                    <Route path="/gestor/dashboard" element={<DashboardGestorPage />} />

                    {/* Rotas do módulo de pesquisa */}
                    <Route path="/pesquisas" element={<Layout><PesquisasListPage /></Layout>} />
                    <Route path="/pesquisas/nova" element={<Layout><PesquisaCreatePage /></Layout>} />
                    <Route path="/pesquisas/:pesquisaId/resultados" element={<Layout><PesquisaResultadosPage /></Layout>} />

                    <Route path="/relatorios" element={<Layout><RelatoriosPage /></Layout>} />

                    <Route path="/perfil-escola" element={<Layout><PerfilEscolaPage /></Layout>} />

                    {/* Rotas de Gestão */}
                    <Route path="/gestao-acesso" element={<Layout><GerenciarAcessoPage /></Layout>} />

                    <Route path="*" element={<Layout showSidebar={false}><NotFound /></Layout>} />
                  </Routes>
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