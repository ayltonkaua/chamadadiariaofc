import React, { useEffect, useState } from "react";
import TurmasCards from "@/components/TurmasCards";
import { useAuth } from "@/contexts/AuthContext";
import { LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import FrequenciaGeralChart from "@/components/dashboard/FrequenciaGeralChart";
import ComparativoTurmasChart from "@/components/dashboard/ComparativoTurmasChart";
import EvolucaoAlunoChart from "@/components/dashboard/EvolucaoAlunoChart";
import { InfoCards } from "@/components/dashboard/InfoCards";
import { DashboardMenu } from "@/components/dashboard/DashboardMenu";
import { useNavigate } from "react-router-dom";

const Dashboard: React.FC = () => {
  const { logout, user } = useAuth();
  const navigate = useNavigate();
  const [tabValue, setTabValue] = useState("graficos");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const initializeDashboard = async () => {
      try {
        if (!user) {
          navigate("/");
          return;
        }
        
        // Aguarda um momento para garantir que os componentes estejam prontos
        await new Promise(resolve => setTimeout(resolve, 100));
        setLoading(false);
      } catch (err) {
        setError("Erro ao carregar o dashboard");
        setLoading(false);
      }
    };

    initializeDashboard();
  }, [user, navigate]);

  const handleLogout = async () => {
    await logout();
    navigate("/");
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-600">Carregando dados do dashboard...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-600">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100">
      <header className="bg-gradient-to-r from-purple-500 to-blue-500 shadow-md">
        <div className="max-w-7xl mx-auto p-2 sm:p-4 flex flex-col sm:flex-row justify-between items-center gap-2 sm:gap-0">
          <h1 className="text-white text-lg sm:text-xl font-bold text-center w-full sm:w-auto">
            Chamada Diária
          </h1>
          <div className="flex flex-col sm:flex-row items-center gap-2 sm:gap-4 w-full sm:w-auto">
            <DashboardMenu />
            <Button
              onClick={handleLogout}
              variant="ghost"
              className="flex items-center gap-2 text-white hover:bg-white/10 py-2 px-4 rounded-lg transition-colors w-full sm:w-auto"
              title="Sair"
            >
              <LogOut size={22} /> <span className="hidden sm:inline">Sair</span>
            </Button>
          </div>
        </div>
      </header>
      
      <main className="max-w-7xl mx-auto p-4 mt-6">
        {/* Cards Informativos */}
        <div className="mb-8">
          <InfoCards />
        </div>

        <div className="mb-8">
          <Tabs defaultValue="graficos" value={tabValue} onValueChange={setTabValue}>
            <TabsList className="mb-4">
              <TabsTrigger value="graficos">Gráficos</TabsTrigger>
              <TabsTrigger value="turmas">Turmas</TabsTrigger>
            </TabsList>
            <TabsContent value="graficos">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
                <div className="bg-white p-6 rounded-lg shadow-sm">
                  <FrequenciaGeralChart />
                </div>
                <div className="bg-white p-6 rounded-lg shadow-sm">
                  <ComparativoTurmasChart />
                </div>
              </div>
              <div className="bg-white p-6 rounded-lg shadow-sm">
                <EvolucaoAlunoChart />
              </div>
            </TabsContent>
            <TabsContent value="turmas">
              <div className="bg-white p-6 rounded-lg shadow-sm">
                <TurmasCards />
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </main>
    </div>
  );
};

export default Dashboard;
