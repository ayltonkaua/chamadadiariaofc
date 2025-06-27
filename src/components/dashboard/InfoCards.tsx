import React, { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Users, UserX, List } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useEscolaTheme } from "@/hooks/useEscolaTheme";

interface DashboardStats {
  totalAlunos: number;
  alunosFaltosos: number;
  totalTurmas: number;
}

export const InfoCards: React.FC = () => {
  const { primaryColor, secondaryColor } = useEscolaTheme();
  const [stats, setStats] = useState<DashboardStats>({
    totalAlunos: 0,
    alunosFaltosos: 0,
    totalTurmas: 0
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const carregarDados = async () => {
      try {
        // Carregar total de alunos
        const { count: totalAlunos } = await supabase
          .from("alunos")
          .select("id", { count: "exact", head: true });

        // Carregar alunos faltosos hoje
        const hoje = new Date().toISOString().split('T')[0];
        const { count: alunosFaltosos } = await supabase
          .from("presencas")
          .select("id", { count: "exact", head: true })
          .eq("data_chamada", hoje)
          .eq("presente", false);

        // Carregar total de turmas
        const { count: totalTurmas } = await supabase
          .from("turmas")
          .select("id", { count: "exact", head: true });

        setStats({
          totalAlunos: totalAlunos || 0,
          alunosFaltosos: alunosFaltosos || 0,
          totalTurmas: totalTurmas || 0
        });
      } catch (error) {
        console.error("Erro ao carregar dados do dashboard:", error);
      } finally {
        setLoading(false);
      }
    };

    carregarDados();

    // Atualizar dados a cada 5 minutos
    const interval = setInterval(carregarDados, 5 * 60 * 1000);

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {/* Card de Alunos Matriculados */}
      <Card className="relative overflow-hidden card-escola">
        <div 
          className="absolute left-0 top-0 bottom-0 w-1"
          style={{ backgroundColor: primaryColor }}
        ></div>
        <CardContent className="p-6">
          <div className="flex items-center gap-4">
            <div 
              className="p-3 rounded-full"
              style={{ backgroundColor: `${primaryColor}20` }}
            >
              <Users 
                className="h-6 w-6" 
                style={{ color: primaryColor }}
              />
            </div>
            <div>
              <h3 className="text-sm font-medium text-gray-500">Alunos Matriculados</h3>
              <p className="text-2xl font-bold text-gray-900">
                {loading ? "..." : stats.totalAlunos}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Card de Alunos Faltosos Hoje */}
      <Card className="relative overflow-hidden card-escola">
        <div className="absolute left-0 top-0 bottom-0 w-1 bg-red-500"></div>
        <CardContent className="p-6">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-red-100 rounded-full">
              <UserX className="h-6 w-6 text-red-500" />
            </div>
            <div>
              <h3 className="text-sm font-medium text-gray-500">Alunos Faltosos Hoje</h3>
              <p className="text-2xl font-bold text-gray-900">
                {loading ? "..." : stats.alunosFaltosos}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Card de Turmas Cadastradas */}
      <Card className="relative overflow-hidden card-escola">
        <div 
          className="absolute left-0 top-0 bottom-0 w-1"
          style={{ backgroundColor: primaryColor }}
        ></div>
        <CardContent className="p-6">
          <div className="flex items-center gap-4">
            <div 
              className="p-3 rounded-full"
              style={{ backgroundColor: `${primaryColor}20` }}
            >
              <List 
                className="h-6 w-6" 
                style={{ color: primaryColor }}
              />
            </div>
            <div>
              <h3 className="text-sm font-medium text-gray-500">Turmas Cadastradas</h3>
              <p className="text-2xl font-bold text-gray-900">
                {loading ? "..." : stats.totalTurmas}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}; 