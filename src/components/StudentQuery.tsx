import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, CheckCircle2, XCircle, FileText, ArrowLeft } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useAuth } from "@/contexts/AuthContext"; // Usaremos o AuthContext para pegar o usuário logado

// Interface de resultado (permanece a mesma)
interface StudentAttendanceResult {
  name: string;
  enrollment: string;
  className: string;
  totalClasses: number;
  absences: number;
  justifiedAbsences: number;
  presenceCount: number;
  detailed: Array<{
    data: string;
    status: "Presente" | "Falta" | "Falta Justificada";
    motivo?: string;
  }>;
  percentagePresent: number;
}

const StudentQuery: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [result, setResult] = useState<StudentAttendanceResult | null>(null);
  const [error, setError] = useState("");
  const navigate = useNavigate();
  const { user, loadingUser } = useAuth(); // Pega o usuário e o status de carregamento do contexto

  useEffect(() => {
    // A função de busca agora é disparada automaticamente se o aluno estiver logado
    const fetchStudentData = async () => {
      // Espera o usuário ser carregado pelo contexto
      if (loadingUser) {
        return;
      }
      
      if (!user || user.type !== 'aluno' || !user.aluno_id) {
        setError("Nenhum perfil de aluno encontrado. Por favor, faça login como aluno.");
        setLoading(false);
        return;
      }

      setError("");
      setResult(null);
      setLoading(true);

      try {
        const { data: aluno, error: alunoError } = await supabase
          .from("alunos")
          .select("id, nome, matricula, turmas(nome)")
          .eq("id", user.aluno_id) // Usa o ID do aluno do contexto
          .single();

        if (alunoError || !aluno) {
          throw new Error("Não foi possível encontrar os detalhes do seu perfil.");
        }

        const { data: presencasData } = await supabase
          .from("presencas")
          .select("data_chamada, presente, falta_justificada")
          .eq("aluno_id", aluno.id)
          .order("data_chamada", { ascending: true });

        const totalChamadas = presencasData?.length || 0;
        let presencas = 0;
        let faltasSimples = 0;
        let faltasJustificadas = 0;
        const detalhado: StudentAttendanceResult["detailed"] = [];

        if (presencasData) {
          for (const p of presencasData) {
            if (p.presente) {
              presencas++;
              detalhado.push({ data: p.data_chamada, status: "Presente" });
            } else {
              if (p.falta_justificada) {
                faltasJustificadas++;
                detalhado.push({ data: p.data_chamada, status: "Falta Justificada", motivo: "Atestado/Justificativa" });
              } else {
                faltasSimples++;
                detalhado.push({ data: p.data_chamada, status: "Falta" });
              }
            }
          }
        }
        
        detalhado.sort((a, b) => new Date(b.data).getTime() - new Date(a.data).getTime());

        setResult({
          name: aluno.nome,
          enrollment: aluno.matricula,
          className: (aluno.turmas as { nome: string }).nome,
          totalClasses: totalChamadas,
          absences: faltasSimples,
          justifiedAbsences: faltasJustificadas,
          presenceCount: presencas,
          detailed: detalhado,
          percentagePresent: totalChamadas > 0 ? Math.round((presencas / totalChamadas) * 100) : 100
        });

      } catch (err: any) {
        console.error("Erro ao consultar dados do aluno:", err);
        setError(err.message || "Ocorreu um erro ao consultar seus dados. Tente novamente.");
      } finally {
        setLoading(false);
      }
    };

    fetchStudentData();
  }, [user, loadingUser]); // O hook agora depende do objeto 'user' e seu estado de carregamento

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-100 p-4">
      <Card className="w-full max-w-2xl shadow-lg">
        <CardHeader className="space-y-1 text-center bg-gradient-to-r from-blue-500 to-purple-500 text-white rounded-t-lg p-6">
          <CardTitle className="text-2xl font-bold">Meu Histórico de Frequência</CardTitle>
          <CardDescription className="text-gray-100">
            Acompanhe seu desempenho e histórico de presença.
          </CardDescription>
        </CardHeader>
        
        {loading && (
          <div className="flex justify-center items-center p-20">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        )}

        {error && (
            <CardContent className="pt-6">
                <div className="p-6 text-center text-red-600 bg-red-50 rounded-md">{error}</div>
            </CardContent>
        )}

        {result && !loading && (
          <>
            <CardContent className="pt-6 space-y-6">
              <div className="bg-gray-50 p-4 rounded-lg border">
                <h3 className="font-bold text-lg text-purple-700 mb-1">{result.name}</h3>
                <p className="text-sm text-gray-500">Matrícula: {result.enrollment} | Turma: {result.className}</p>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="flex flex-col items-center p-3 bg-gray-50 rounded-lg text-center">
                  <span className="text-2xl font-bold">{result.totalClasses}</span>
                  <span className="text-xs text-gray-500">Total de Aulas</span>
                </div>
                <div className="flex flex-col items-center p-3 bg-green-50 rounded-lg text-center">
                  <span className="text-2xl font-bold text-green-600">{result.presenceCount}</span>
                  <span className="text-xs text-gray-500">Presenças</span>
                </div>
                <div className="flex flex-col items-center p-3 bg-red-50 rounded-lg text-center">
                  <span className="text-2xl font-bold text-red-600">{result.absences}</span>
                  <span className="text-xs text-gray-500">Faltas</span>
                </div>
                <div className="flex flex-col items-center p-3 bg-blue-50 rounded-lg text-center">
                  <span className="text-2xl font-bold text-blue-600">{result.justifiedAbsences}</span>
                  <span className="text-xs text-gray-500">Faltas Justificadas</span>
                </div>
              </div>
              <Card>
                <CardHeader>
                  <CardTitle>Histórico Detalhado</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="overflow-auto max-h-64">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Data</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Observação</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {result.detailed.map((item, idx) => (
                          <TableRow key={`${item.data}-${idx}`}>
                            <TableCell>{format(parseISO(item.data), "dd/MM/yyyy", { locale: ptBR })}</TableCell>
                            <TableCell>
                              {item.status === "Presente" && <div className="flex items-center text-green-600"><CheckCircle2 className="w-4 h-4 mr-2" /> Presente</div>}
                              {item.status === "Falta" && <div className="flex items-center text-red-600"><XCircle className="w-4 h-4 mr-2" /> Falta</div>}
                              {item.status === "Falta Justificada" && <div className="flex items-center text-blue-600"><FileText className="w-4 h-4 mr-2" /> Justificada</div>}
                            </TableCell>
                            <TableCell>{item.motivo || "-"}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            </CardContent>
            <CardFooter>
              <Button onClick={() => navigate("/portal-aluno")} className="w-full">
                <ArrowLeft className="mr-2 h-4 w-4" /> Voltar ao Portal do Aluno
              </Button>
            </CardFooter>
          </>
        )}
      </Card>
    </div>
  );
};

export default StudentQuery;