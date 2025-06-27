import { useEffect } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { AttendanceProvider } from "@/contexts/AttendanceContext";
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

import { getChamadasPendentes, limparChamadasPendentes } from "@/lib/offlineChamada";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/components/ui/use-toast";

const queryClient = new QueryClient();

const App = () => {
  useEffect(() => {
    // ... seu código do OneSignal
  }, []);

  useEffect(() => {
    // ... sua lógica de sincronização offline
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      {!navigator.onLine && (
        <div className="bg-yellow-400 text-center py-2 text-sm font-bold z-50">
          Você está offline. As chamadas serão salvas localmente.
        </div>
      )}
      <AuthProvider>
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
                <Route path="/responder-pesquisa" element={<Layout showSidebar={false}><PesquisaPublicaPage /></Layout>} />
                
                {/* Páginas autenticadas (com sidebar) */}
                <Route path="/dashboard" element={<Layout><Dashboard /></Layout>} />
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
                
                {/* Rotas do módulo de pesquisa */}
                <Route path="/pesquisas" element={<Layout><PesquisasListPage /></Layout>} />
                <Route path="/pesquisas/nova" element={<Layout><PesquisaCreatePage /></Layout>} />
                <Route path="/pesquisas/:pesquisaId/resultados" element={<Layout><PesquisaResultadosPage /></Layout>} />

                <Route path="/perfil-escola" element={<Layout><PerfilEscolaPage /></Layout>} />

                <Route path="*" element={<Layout showSidebar={false}><NotFound /></Layout>} />
              </Routes>
            </Router>
          </TooltipProvider>
        </AttendanceProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
};

export default App;