import React, { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/hooks/use-toast";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Bell, Loader2, ShieldAlert } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";

interface AlertaGerado {
  id: string;
  alunoNome: string;
  turmaNome: string;
  mensagem: string;
  tipo: 'Faltas Elevadas' | 'Outro';
  dadosAdicionais: {
    totalAulas: number;
    totalFaltas: number;
    taxaFaltas: number;
  };
}

const AlertasPage: React.FC = () => {
  const [alertas, setAlertas] = useState<AlertaGerado[]>([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();

  useEffect(() => {
    const gerarAlertasDeFaltas = async () => {
      if (!user?.escola_id) {
        setLoading(false);
        return;
      }

      setLoading(true);
      try {
        // Chama a função segura (RPC) que filtra por professor automaticamente
        const { data: stats, error } = await supabase
          .rpc('get_alertas_frequencia', { _escola_id: user.escola_id });

        if (error) throw error;

        const alertasGerados: AlertaGerado[] = [];
        const LIMITE_FALTAS_PCT = 25; // Define o limite crítico (25%)

        if (stats) {
          stats.forEach((stat: any) => {
            const taxa = Number(stat.percentual_faltas);

            if (taxa >= LIMITE_FALTAS_PCT) {
              alertasGerados.push({
                id: stat.aluno_id,
                alunoNome: stat.nome,
                turmaNome: stat.turma_nome || "Turma",
                mensagem: `O(A) aluno(a) atingiu ${taxa}% de faltas.`,
                tipo: 'Faltas Elevadas',
                dadosAdicionais: {
                  totalAulas: Number(stat.total_aulas),
                  totalFaltas: Number(stat.total_faltas),
                  taxaFaltas: taxa,
                },
              });
            }
          });
        }

        setAlertas(alertasGerados.sort((a, b) => a.alunoNome.localeCompare(b.alunoNome)));

      } catch (err: any) {
        console.error("Erro alertas:", err);
        toast({
          title: "Erro ao carregar",
          description: "Não foi possível carregar os alertas de frequência.",
          variant: "destructive",
        });
      } finally {
        setLoading(false);
      }
    };

    gerarAlertasDeFaltas();
  }, [user?.escola_id]);

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-purple-600" />
      </div>
    );
  }

  // Verifica se é professor para mostrar aviso visual
  const isProfessor = user?.type === 'professor' || user?.role === 'professor';

  return (
    <div className="p-4 sm:p-6 max-w-4xl mx-auto animate-in fade-in">
      <h1 className="text-2xl font-bold text-gray-800 mb-6">Central de Alertas</h1>

      {isProfessor && (
        <div className="bg-blue-50 text-blue-700 px-4 py-3 rounded-lg mb-6 text-sm border border-blue-200 flex items-center gap-2">
          <ShieldAlert className="h-4 w-4" />
          <span>Mostrando apenas alunos vinculados às suas turmas.</span>
        </div>
      )}

      {alertas.length > 0 ? (
        <div className="space-y-4">
          {alertas.map((alerta) => (
            <Alert key={alerta.id} variant="destructive" className="flex flex-col sm:flex-row sm:items-center bg-white border-l-4 border-l-red-500 border-y border-r shadow-sm">
              <div className="flex-shrink-0 hidden sm:block p-2">
                <ShieldAlert className="h-6 w-6 text-red-600" />
              </div>
              <div className="flex-grow sm:ml-4 py-2">
                <AlertTitle className="font-bold text-gray-800 flex items-center gap-2">
                  {alerta.alunoNome}
                  <span className="text-xs font-normal px-2 py-0.5 rounded-full bg-red-100 text-red-700">
                    {alerta.dadosAdicionais.taxaFaltas}% Faltas
                  </span>
                </AlertTitle>
                <AlertDescription className="text-gray-600 mt-1">
                  <p className="text-sm">
                    Turma: <strong>{alerta.turmaNome}</strong> • {alerta.dadosAdicionais.totalFaltas} faltas em {alerta.dadosAdicionais.totalAulas} aulas registradas.
                  </p>
                </AlertDescription>
              </div>
              <div className="mt-3 sm:mt-0 sm:ml-4 flex-shrink-0">
                <Button asChild size="sm" variant="outline" className="w-full sm:w-auto border-red-200 text-red-700 hover:bg-red-50">
                  <Link to={`/turmas/${alerta.id}/alunos`}>Ver Aluno</Link>
                </Button>
              </div>
            </Alert>
          ))}
        </div>
      ) : (
        <div className="text-center py-16 px-4 border-2 border-dashed border-gray-200 rounded-xl bg-gray-50/30">
          <div className="mx-auto h-12 w-12 text-gray-300 mb-3 bg-gray-100 rounded-full flex items-center justify-center">
            <Bell size={24} />
          </div>
          <h3 className="text-lg font-medium text-gray-900">Tudo tranquilo por aqui</h3>
          <p className="text-gray-500 max-w-sm mx-auto mt-2">
            Nenhum aluno atingiu o limite crítico de faltas (25%) recentemente.
          </p>
        </div>
      )}
    </div>
  );
};

export default AlertasPage;