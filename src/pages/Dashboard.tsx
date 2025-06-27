import React, { useEffect, useState } from "react";
import TurmasCards from "@/components/TurmasCards";
import { useAuth } from "@/contexts/AuthContext";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import FrequenciaGeralChart from "@/components/dashboard/FrequenciaGeralChart";
import ComparativoTurmasChart from "@/components/dashboard/ComparativoTurmasChart";
import EvolucaoAlunoChart from "@/components/dashboard/EvolucaoAlunoChart";
import { InfoCards } from "@/components/dashboard/InfoCards";
import { DashboardMenu } from "@/components/dashboard/DashboardMenu";
import { useNavigate } from "react-router-dom";

const Dashboard: React.FC = () => {
  const { user } = useAuth();
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

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <p className="text-gray-600">Carregando dados do dashboard...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <p className="text-red-600">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      {/* Header da página */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Dashboard</h1>
        <p className="text-gray-600">Visão geral do sistema de chamadas</p>
      </div>

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
              <div className="bg-white p-6 rounded-lg shadow-sm border">
                <FrequenciaGeralChart />
              </div>
              <div className="bg-white p-6 rounded-lg shadow-sm border">
                <ComparativoTurmasChart />
              </div>
            </div>
            <div className="bg-white p-6 rounded-lg shadow-sm border">
              <EvolucaoAlunoChart />
            </div>
          </TabsContent>
          <TabsContent value="turmas">
            <div className="bg-white p-6 rounded-lg shadow-sm border">
              <TurmasCards />
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default Dashboard;
