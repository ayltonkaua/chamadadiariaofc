import React, { useEffect, useState } from "react";
import TurmasCards from "@/components/TurmasCards";
import { useAuth } from "@/contexts/AuthContext";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { InfoCards } from "@/components/dashboard/InfoCards";
import { useNavigate } from "react-router-dom";

const Dashboard: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [tabValue, setTabValue] = useState("turmas");
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
        setError("Erro ao carregar a página inicial");
        setLoading(false);
      }
    };

    initializeDashboard();
  }, [user, navigate]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <p className="text-gray-600">Carregando dados da página inicial...</p>
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
      {/* Header da página (INTACTO) */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Página Inicial</h1>
        <p className="text-gray-600">Bem-vindo ao sistema de chamadas</p>
      </div>

      {/* Cards Informativos (INTACTO) */}
      <div className="mb-8">
        <InfoCards />
      </div>

      <div className="mb-8">
        <Tabs defaultValue="turmas" value={tabValue} onValueChange={setTabValue}>
          <TabsList className="mb-4">
            <TabsTrigger value="turmas">Turmas</TabsTrigger>
          </TabsList>

          {/* --- CONTEÚDO DA ABA "TURMAS" MODIFICADO --- */}
          <TabsContent value="turmas">
            <div className="bg-white p-6 rounded-lg shadow-sm border">
              {/* Novas abas de turno adicionadas aqui */}
              <Tabs defaultValue="manha" className="w-full">
                <TabsList className="grid w-full grid-cols-3">
                  <TabsTrigger value="manha">Manhã</TabsTrigger>
                  <TabsTrigger value="tarde">Tarde</TabsTrigger>
                  <TabsTrigger value="noite">Noite</TabsTrigger>
                </TabsList>

                {/* Conteúdo para cada turno, chamando o seu componente TurmasCards com um filtro */}
                <TabsContent value="manha">
                  <TurmasCards turno="Manhã" />
                </TabsContent>
                <TabsContent value="tarde">
                  <TurmasCards turno="Tarde" />
                </TabsContent>
                <TabsContent value="noite">
                  <TurmasCards turno="Noite" />
                </TabsContent>
              </Tabs>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default Dashboard;