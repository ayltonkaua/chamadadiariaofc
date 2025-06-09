import React, { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { AlertCircle, CheckCircle2, XCircle, FileText } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useNavigate } from "react-router-dom";

interface HistoricoAlunoProps {
  alunoId: string;
  turmaId: string;
}

interface Presenca {
  data_chamada: string;
  presente: boolean;
  justificativa?: string;
  atestado_url?: string;
}

interface ResumoFrequencia {
  total: number;
  presentes: number;
  faltas: number;
  atestados: number;
}

const HistoricoAluno = ({ alunoId, turmaId }: HistoricoAlunoProps) => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [presencas, setPresencas] = useState<Presenca[]>([]);
  const [resumo, setResumo] = useState<ResumoFrequencia>({
    total: 0,
    presentes: 0,
    faltas: 0,
    atestados: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchHistorico = async () => {
      if (!user) {
        setError("Usuário não autenticado");
        setLoading(false);
        return;
      }

      try {
        const { data, error: presencasError } = await supabase
          .from("presencas")
          .select("*")
          .eq("aluno_id", alunoId)
          .eq("turma_id", turmaId)
          .order("data_chamada", { ascending: false });

        if (presencasError) throw presencasError;

        setPresencas(data || []);

        // Calcular resumo
        const resumo = data.reduce(
          (acc: ResumoFrequencia, presenca: Presenca) => {
            acc.total += 1;
            if (presenca.presente) {
              acc.presentes += 1;
            } else {
              acc.faltas += 1;
              if (presenca.atestado_url) {
                acc.atestados += 1;
              }
            }
            return acc;
          },
          { total: 0, presentes: 0, faltas: 0, atestados: 0 }
        );

        setResumo(resumo);
      } catch (error) {
        setError(error instanceof Error ? error.message : "Erro ao carregar histórico");
      } finally {
        setLoading(false);
      }
    };

    fetchHistorico();
  }, [user, alunoId, turmaId]);

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Histórico do Aluno</CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-center h-[200px]">
          <div className="flex flex-col items-center gap-2">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-500" />
            <p className="text-gray-500">Carregando histórico...</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Histórico do Aluno</CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-center h-[200px]">
          <div className="flex flex-col items-center gap-2 text-red-500">
            <AlertCircle size={24} />
            <p>{error}</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end mb-2">
        <button
          className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded"
          onClick={() => navigate("/dashboard")}
        >
          Voltar ao Dashboard
        </button>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Resumo de Frequência</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-4 gap-4">
            <div className="flex flex-col items-center p-4 bg-gray-50 rounded-lg">
              <span className="text-2xl font-bold">{resumo.total}</span>
              <span className="text-sm text-gray-500">Total de Aulas</span>
            </div>
            <div className="flex flex-col items-center p-4 bg-green-50 rounded-lg">
              <span className="text-2xl font-bold text-green-600">{resumo.presentes}</span>
              <span className="text-sm text-gray-500">Presenças</span>
            </div>
            <div className="flex flex-col items-center p-4 bg-red-50 rounded-lg">
              <span className="text-2xl font-bold text-red-600">{resumo.faltas}</span>
              <span className="text-sm text-gray-500">Faltas</span>
            </div>
            <div className="flex flex-col items-center p-4 bg-blue-50 rounded-lg">
              <span className="text-2xl font-bold text-blue-600">{resumo.atestados}</span>
              <span className="text-sm text-gray-500">Atestados</span>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Histórico Detalhado</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Data</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Justificativa</TableHead>
                <TableHead>Atestado</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {presencas.map((presenca) => (
                <TableRow key={presenca.data_chamada}>
                  <TableCell>
                    {format(new Date(presenca.data_chamada), "dd/MM/yyyy", {
                      locale: ptBR,
                    })}
                  </TableCell>
                  <TableCell>
                    {presenca.presente ? (
                      <div className="flex items-center text-green-600">
                        <CheckCircle2 className="w-4 h-4 mr-2" />
                        Presente
                      </div>
                    ) : (
                      <div className="flex items-center text-red-600">
                        <XCircle className="w-4 h-4 mr-2" />
                        Ausente
                      </div>
                    )}
                  </TableCell>
                  <TableCell>{presenca.justificativa || "-"}</TableCell>
                  <TableCell>
                    {presenca.atestado_url ? (
                      <a
                        href={presenca.atestado_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center text-blue-600 hover:underline"
                      >
                        <FileText className="w-4 h-4 mr-2" />
                        Ver atestado
                      </a>
                    ) : (
                      "-"
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
};

export default HistoricoAluno; 