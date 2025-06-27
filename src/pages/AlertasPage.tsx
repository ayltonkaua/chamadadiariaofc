import React, { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/hooks/use-toast";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Bell, Loader2, ShieldAlert } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";

// Interface para definir a estrutura de um alerta gerado dinamicamente
interface AlertaGerado {
  id: string; // Usaremos o id do aluno como chave
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
        // 1. Busca alunos e suas presenças. A RLS no Supabase já filtra pela escola do usuário.
        const { data: alunos, error } = await supabase
          .from("alunos")
          .select("id, nome, turmas(nome), presencas(presente)");

        if (error) throw error;
        
        const alertasGerados: AlertaGerado[] = [];

        // 2. Processa cada aluno para verificar a taxa de faltas
        for (const aluno of alunos) {
          const presencas = aluno.presencas;
          const totalAulas = presencas.length;

          if (totalAulas > 5) { // Gera alerta apenas se houver um número mínimo de aulas
            const totalFaltas = presencas.filter(p => !p.presente).length;
            const taxaFaltas = Math.round((totalFaltas / totalAulas) * 100);

            // 3. Gera um alerta se a taxa de faltas for >= 80%
            if (taxaFaltas >= 80) {
              alertasGerados.push({
                id: aluno.id,
                alunoNome: aluno.nome,
                turmaNome: (aluno.turmas as { nome: string })?.nome || "Não informada",
                mensagem: `O(A) aluno(a) atingiu ${taxaFaltas}% de faltas.`,
                tipo: 'Faltas Elevadas',
                dadosAdicionais: {
                  totalAulas,
                  totalFaltas,
                  taxaFaltas,
                },
              });
            }
          }
        }
        
        // Ordena os alertas pelo nome do aluno
        alertasGerados.sort((a, b) => a.alunoNome.localeCompare(b.alunoNome));
        setAlertas(alertasGerados);

      } catch (err: any) {
        console.error("Erro ao gerar alertas:", err);
        toast({
          title: "Erro ao carregar alertas",
          description: err.message,
          variant: "destructive",
        });
      } finally {
        setLoading(false);
      }
    };

    if (user?.escola_id) {
        gerarAlertasDeFaltas();
    }
  }, [user?.escola_id]);

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-purple-600" />
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-800 mb-6">Central de Alertas</h1>
      {alertas.length > 0 ? (
        <div className="space-y-4">
          {alertas.map((alerta) => (
            <Alert key={alerta.id} variant="destructive" className="flex flex-col sm:flex-row sm:items-center">
              <div className="flex-shrink-0 hidden sm:block">
                <ShieldAlert className="h-5 w-5" />
              </div>
              <div className="flex-grow sm:ml-4">
                <AlertTitle className="font-bold">{alerta.tipo}: {alerta.alunoNome}</AlertTitle>
                <AlertDescription>
                  <p className="text-sm">{alerta.mensagem}</p>
                  <p className="text-xs text-gray-600 mt-1">
                    Turma: {alerta.turmaNome} | Faltas: {alerta.dadosAdicionais.totalFaltas} de {alerta.dadosAdicionais.totalAulas} aulas.
                  </p>
                </AlertDescription>
              </div>
              <div className="mt-3 sm:mt-0 sm:ml-4 flex-shrink-0">
                {/* CORREÇÃO: Link ajustado para a rota correta e estilizado como um botão */}
                <Button asChild size="sm" variant="outline">
                  <Link to={`/alunos/${alerta.id}`}>
                    Ver Histórico
                  </Link>
                </Button>
              </div>
            </Alert>
          ))}
        </div>
      ) : (
        <div className="text-center py-10 px-4 border-2 border-dashed rounded-lg">
            <div className="mx-auto h-12 w-12 text-gray-400">
                <Bell size={48} />
            </div>
          <h3 className="mt-2 text-sm font-semibold text-gray-900">Nenhum alerta no momento</h3>
          <p className="mt-1 text-sm text-gray-500">
            Tudo parece estar em ordem. Novos alertas sobre alunos com altas taxas de falta aparecerão aqui.
          </p>
        </div>
      )}
    </div>
  );
};

export default AlertasPage;