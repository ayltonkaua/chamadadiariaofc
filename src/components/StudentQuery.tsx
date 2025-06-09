import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CheckCircle2, XCircle } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface StudentAttendanceResult {
  name: string;
  enrollment: string;
  className: string;
  totalClasses: number;
  absences: number;
  justifiedAbsences: number;
  justifiedReasons: string[];
  justifiedDates: string[];
  absenceDates: string[];
  presenceDates: string[];
  detailed: Array<{
    data: string;
    status: "Presente" | "Falta" | "Falta Justificada";
    motivo?: string;
  }>;
  percentagePresent: number;
}

const StudentQuery: React.FC = () => {
  const [name, setName] = useState("");
  const [enrollment, setEnrollment] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<StudentAttendanceResult | null>(null);
  const [error, setError] = useState("");
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setResult(null);
    setLoading(true);

    // Validação básica
    if (!name.trim() || !enrollment.trim()) {
      setError("Por favor, preencha todos os campos.");
      setLoading(false);
      return;
    }

    try {
      // Buscar o aluno pelo nome e matrícula
      const { data: aluno, error: alunoError } = await supabase
        .from("alunos")
        .select("id, nome, matricula, turma_id, turmas(nome)")
        .ilike("nome", `%${name}%`)
        .eq("matricula", enrollment)
        .single();

      if (alunoError || !aluno) {
        setError("Aluno não encontrado. Verifique o nome e matrícula.");
        setLoading(false);
        return;
      }

      // Buscar todas as datas de chamada para a turma do aluno
      const { data: datasChamada } = await supabase
        .from("presencas")
        .select("data_chamada")
        .eq("turma_id", aluno.turma_id);
        
      // Obter datas únicas de chamada
      const datasUnicas = new Set(datasChamada?.map(p => p.data_chamada) || []);
      const totalChamadas = datasUnicas.size;

      // Buscar faltas do aluno
      const { count: totalFaltas } = await supabase
        .from("presencas")
        .select("id", { count: "exact", head: true })
        .eq("aluno_id", aluno.id)
        .eq("presente", false);

      const faltas = totalFaltas || 0;
      const total = totalChamadas || 0;
      const frequencia = total > 0 ? Math.round(((total - faltas) / total) * 100) : 100;

      // Buscar todas as presenças do aluno
      const { data: presencasData } = await supabase
        .from("presencas")
        .select("data_chamada, presente")
        .eq("aluno_id", aluno.id)
        .order("data_chamada", { ascending: true });
      const presenceDates = presencasData?.filter(p => p.presente).map(p => p.data_chamada) || [];
      const absenceDates = presencasData?.filter(p => !p.presente).map(p => p.data_chamada) || [];

      // Buscar faltas justificadas (datas e motivos)
      const { data: justificadas, count: totalFaltasJustificadas } = await supabase
        .from("justificativa_faltas")
        .select("motivo, data", { count: "exact" })
        .eq("aluno_id", aluno.id);
      const faltasJustificadas = totalFaltasJustificadas || 0;
      const motivos = justificadas?.map(j => j.motivo) || [];
      const datasFaltasJustificadas = justificadas?.map(j => j.data) || [];

      // Montar lista detalhada (presenças, faltas, faltas justificadas)
      const detalhado: StudentAttendanceResult["detailed"] = [];
      if (presencasData) {
        for (const p of presencasData) {
          const isJustificada = datasFaltasJustificadas.includes(p.data_chamada);
          detalhado.push({
            data: p.data_chamada,
            status: p.presente
              ? "Presente"
              : isJustificada
              ? "Falta Justificada"
              : "Falta",
            motivo: isJustificada
              ? (justificadas?.find(j => j.data === p.data_chamada)?.motivo || "-")
              : undefined,
          });
        }
      }
      // Adicionar faltas justificadas que não estão em presenças (caso existam)
      if (justificadas) {
        for (const j of justificadas) {
          if (!presencasData?.some(p => p.data_chamada === j.data)) {
            detalhado.push({
              data: j.data,
              status: "Falta Justificada",
              motivo: j.motivo,
            });
          }
        }
      }
      detalhado.sort((a, b) => new Date(b.data).getTime() - new Date(a.data).getTime());

      setResult({
        name: aluno.nome,
        enrollment: aluno.matricula,
        className: (aluno.turmas as { nome: string }).nome,
        totalClasses: total,
        absences: faltas,
        justifiedAbsences: faltasJustificadas,
        justifiedReasons: motivos,
        justifiedDates: datasFaltasJustificadas,
        absenceDates: absenceDates,
        presenceDates: presenceDates,
        detailed: detalhado,
        percentagePresent: frequencia
      });
      
    } catch (err) {
      console.error("Erro ao consultar dados do aluno:", err);
      setError("Ocorreu um erro ao consultar os dados. Tente novamente.");
    } finally {
      setLoading(false);
    }
  };

  const handleBack = () => {
    setResult(null);
    navigate("/");
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-100">
      <Card className="w-full max-w-md shadow-lg">
        <CardHeader className="space-y-1 text-center bg-gradient-to-r from-blue-500 to-purple-500 text-white rounded-t-lg">
          <CardTitle className="text-2xl font-bold">Consulta de Faltas</CardTitle>
          <CardDescription className="text-gray-100">
            Para alunos verificarem sua situação
          </CardDescription>
        </CardHeader>
        
        {!result ? (
          <form onSubmit={handleSubmit}>
            <CardContent className="space-y-4 pt-6">
              <div className="space-y-2">
                <Label htmlFor="name">Nome Completo</Label>
                <Input
                  id="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Digite seu nome completo"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="enrollment">Matrícula</Label>
                <Input
                  id="enrollment"
                  value={enrollment}
                  onChange={(e) => setEnrollment(e.target.value)}
                  placeholder="Digite seu número de matrícula"
                  required
                />
              </div>
              {error && (
                <div className="text-sm font-medium text-red-500">
                  {error}
                </div>
              )}
            </CardContent>
            <CardFooter className="flex justify-between">
              <Button
                type="button"
                variant="outline"
                onClick={handleBack}
              >
                Voltar
              </Button>
              <Button
                type="submit"
                disabled={loading}
                className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700"
              >
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Consultando...
                  </>
                ) : (
                  "Consultar"
                )}
              </Button>
            </CardFooter>
          </form>
        ) : (
          <>
            <CardContent className="pt-6">
              <div className="bg-gray-50 p-4 rounded-lg">
                <h3 className="font-bold text-lg text-purple-700 mb-2">{result.name}</h3>
                <div className="grid grid-cols-4 gap-4 mb-6">
                  <div className="flex flex-col items-center p-4 bg-gray-50 rounded-lg">
                    <span className="text-2xl font-bold">{result.totalClasses}</span>
                    <span className="text-sm text-gray-500">Total de Aulas</span>
                  </div>
                  <div className="flex flex-col items-center p-4 bg-green-50 rounded-lg">
                    <span className="text-2xl font-bold text-green-600">{result.presenceDates.length}</span>
                    <span className="text-sm text-gray-500">Presenças</span>
                  </div>
                  <div className="flex flex-col items-center p-4 bg-red-50 rounded-lg">
                    <span className="text-2xl font-bold text-red-600">{result.absenceDates.length}</span>
                    <span className="text-sm text-gray-500">Faltas</span>
                  </div>
                  <div className="flex flex-col items-center p-4 bg-blue-50 rounded-lg">
                    <span className="text-2xl font-bold text-blue-600">{result.justifiedAbsences}</span>
                    <span className="text-sm text-gray-500">Faltas Justificadas</span>
                  </div>
                </div>
                <div className="mt-6">
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
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {result.detailed.map((item, idx) => (
                            <TableRow key={item.data + idx}>
                              <TableCell>{format(new Date(item.data), "dd/MM/yyyy", { locale: ptBR })}</TableCell>
                              <TableCell>
                                {item.status === "Presente" ? (
                                  <div className="flex items-center text-green-600">
                                    <CheckCircle2 className="w-4 h-4 mr-2" /> Presente
                                  </div>
                                ) : item.status === "Falta Justificada" ? (
                                  <div className="flex items-center text-blue-600">
                                    <CheckCircle2 className="w-4 h-4 mr-2" /> Justificada
                                  </div>
                                ) : (
                                  <div className="flex items-center text-red-600">
                                    <XCircle className="w-4 h-4 mr-2" /> Ausente
                                  </div>
                                )}
                              </TableCell>
                              <TableCell>{item.motivo || "-"}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </CardContent>
                  </Card>
                </div>
              </div>
            </CardContent>
            <CardFooter>
              <Button
                onClick={handleBack}
                className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700"
              >
                Voltar para Início
              </Button>
            </CardFooter>
          </>
        )}
      </Card>
    </div>
  );
};

export default StudentQuery;
