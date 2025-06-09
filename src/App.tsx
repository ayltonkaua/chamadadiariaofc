import { useEffect } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { AttendanceProvider } from "@/contexts/AttendanceContext";
import LoginPage from "@/pages/LoginPage";
import Dashboard from "@/pages/Dashboard";
import StudentQueryPage from "@/pages/StudentQueryPage";
import NotFound from "@/pages/NotFound";
import Index from "@/pages/Index";
import RegisterPage from "@/pages/RegisterPage";
import ChamadaPage from "@/pages/ChamadaPage";
import GerenciarAlunosPage from "@/pages/GerenciarAlunosPage";
import HistoricoChamadaPage from "@/pages/HistoricoChamadaPage";
import ConfiguracoesPage from "@/pages/ConfiguracoesPage";
import AtestadosPage from "@/pages/AtestadosPage";
import AlertasPage from "@/pages/AlertasPage";
import RegistroAtrasosPage from "@/pages/RegistroAtrasosPage";
import NotificacoesPage from "@/pages/NotificacoesPage";
import ConsultarFaltasPage from "@/pages/ConsultarFaltasPage";
import AlunoPage from "@/pages/AlunoPage";
import { getChamadasPendentes, limparChamadasPendentes } from "@/lib/offlineChamada";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/components/ui/use-toast";

const queryClient = new QueryClient();

// Adiciona declaração para evitar erro de linter
declare global {
  interface Window {
    OneSignalDeferred?: any[];
  }
}

const App = () => {
  useEffect(() => {
    window.OneSignalDeferred = window.OneSignalDeferred || [];
    window.OneSignalDeferred.push(async function (OneSignal: any) {
      await OneSignal.init({
        appId: "a2c919d8-ec01-4dd8-a533-fc13fb138321",
        notifyButton: {
          enable: true,
        },
        allowLocalhostAsSecureOrigin: false,
      });
    });
  }, []);

  useEffect(() => {
    const syncChamadas = async () => {
      if (navigator.onLine) {
        const pendentes = await getChamadasPendentes();
        for (const chamadas of pendentes) {
          try {
            await supabase.from('presencas').insert(chamadas.presencas);
          } catch (e) {
            return; // Se falhar, pare a sincronização
          }
        }
        await limparChamadasPendentes();
        if (pendentes.length > 0) {
          toast({ title: "Chamadas sincronizadas", description: "Chamadas offline foram enviadas com sucesso." });
        }
      }
    };
    window.addEventListener('online', syncChamadas);
    syncChamadas();
    return () => window.removeEventListener('online', syncChamadas);
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
                <Route path="/" element={<Index />} />
                <Route path="/login" element={<LoginPage />} />
                <Route path="/register" element={<RegisterPage />} />
                <Route path="/dashboard" element={<Dashboard />} />
                <Route path="/chamadas/:turmaId" element={<ChamadaPage />} />
                <Route path="/gerenciar-alunos/:turmaId" element={<GerenciarAlunosPage />} />
                <Route path="/historico-chamada/:turmaId" element={<HistoricoChamadaPage />} />
                <Route path="/configuracoes" element={<ConfiguracoesPage />} />
                <Route path="/atestados" element={<AtestadosPage />} />
                <Route path="/alertas" element={<AlertasPage />} />
                <Route path="/student-query" element={<StudentQueryPage />} />
                <Route path="/registro-atrasos" element={<RegistroAtrasosPage />} />
                <Route path="/notificacoes" element={<NotificacoesPage />} />
                <Route path="/turmas/:turmaId/alunos" element={<GerenciarAlunosPage />} />
                <Route path="/turmas/:turmaId/alunos/:alunoId" element={<AlunoPage />} />
                <Route path="/turmas/:turmaId/chamada" element={<ChamadaPage />} />
                <Route path="/consultar-faltas" element={<ConsultarFaltasPage />} />
                <Route path="*" element={<NotFound />} />
              </Routes>
            </Router>
          </TooltipProvider>
        </AttendanceProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
};

export default App;