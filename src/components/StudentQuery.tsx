import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, CheckCircle2, XCircle, FileText } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useEscolasCadastradas } from '@/hooks/useEscolasCadastradas';

// Interface de resultado atualizada para incluir status detalhado
interface StudentAttendanceResult {
  name: string;
  enrollment: string;
  className: string;
  totalClasses: number;
  absences: number; // Faltas não justificadas
  justifiedAbsences: number; // Faltas justificadas
  presenceCount: number; // Total de presenças
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
  const { escolas, loading: escolasLoading } = useEscolasCadastradas();
  const [escolaSelecionada, setEscolaSelecionada] = useState<string>("");

  useEffect(() => {
    if (escolas.length > 0 && !escolaSelecionada) {
      setEscolaSelecionada(escolas[0].id);
    }
  }, [escolas]);

  const normalizeText = (text: string): string => {
    return text
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setResult(null);
    setLoading(true);

    if (!escolaSelecionada) {
      setError("Por favor, selecione uma escola.");
      setLoading(false);
      return;
    }

    const trimmedName = name.trim();
    const trimmedEnrollment = enrollment.trim();

    if (!trimmedName || !trimmedEnrollment) {
      setError("Por favor, preencha todos os campos.");
      setLoading(false);
      return;
    }

    const normalizedName = normalizeText(trimmedName);

    try {
      const { data: turmasData, error: turmasError } = await supabase
        .from("turmas")
        .select("id")
        .eq("escola_id", escolaSelecionada);

      if (turmasError) throw turmasError;
      const turmaIds = turmasData?.map(t => t.id) || [];
      if (turmaIds.length === 0) {
        setError("Nenhuma turma encontrada para esta escola.");
        setLoading(false);
        return;
      }

      const { data: aluno, error: alunoError } = await supabase
        .from("alunos")
        .select("id, nome, matricula, turma_id, turmas(nome)")
        .ilike("nome", `%${normalizedName}%`)
        .eq("matricula", trimmedEnrollment)
        .in("turma_id", turmaIds)
        .single();

      if (alunoError || !aluno) {
        setError("Aluno não encontrado. Verifique o nome, matrícula e escola.");
        setLoading(false);
        return;
      }

      // CORREÇÃO: Buscar também o campo 'falta_justificada'
      const { data: presencasData } = await supabase
        .from("presencas")
        .select("data_chamada, presente, falta_justificada")
        .eq("aluno_id", aluno.id)
        .order("data_chamada", { ascending: true });

      // CORREÇÃO: Lógica de contagem
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

      // CORREÇÃO: Atualizar o estado com os valores corretos
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
      
    } catch (err) {
      console.error("Erro ao consultar dados do aluno:", err);
      setError("Ocorreu um erro ao consultar os dados. Tente novamente.");
    } finally {
      setLoading(false);
    }
  };

  const handleBack = () => {
    setResult(null);
    setError("");
    setName("");
    setEnrollment("");
    navigate("/");
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-100 p-4">
      <Card className="w-full max-w-2xl shadow-lg">
        <CardHeader className="space-y-1 text-center bg-gradient-to-r from-blue-500 to-purple-500 text-white rounded-t-lg p-6">
          <CardTitle className="text-2xl font-bold">Consulta de Faltas do Aluno</CardTitle>
          <CardDescription className="text-gray-100">
            Verifique a frequência e o histórico de presença.
          </CardDescription>
        </CardHeader>
        
        {!result ? (
          <form onSubmit={handleSubmit}>
            <CardContent className="space-y-4 pt-6">
              <div className="space-y-2">
                <Label htmlFor="escola-select">Escola</Label>
                <select
                  id="escola-select"
                  className="border rounded px-2 py-2 w-full"
                  value={escolaSelecionada}
                  onChange={e => setEscolaSelecionada(e.target.value)}
                  disabled={escolasLoading}
                  required
                >
                  <option value="" disabled>Selecione uma escola</option>
                  {escolas.map(escola => (
                    <option key={escola.id} value={escola.id}>{escola.nome}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="name">Nome Completo do Aluno</Label>
                <Input
                  id="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Digite o nome completo do aluno"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="enrollment">Matrícula</Label>
                <Input
                  id="enrollment"
                  value={enrollment}
                  onChange={(e) => setEnrollment(e.target.value)}
                  placeholder="Digite o número de matrícula"
                  required
                />
              </div>
              {error && (
                <div className="text-sm font-medium text-red-500 bg-red-50 p-3 rounded-md">
                  {error}
                </div>
              )}
            </CardContent>
            <CardFooter className="flex justify-between">
              <Button type="button" variant="outline" onClick={() => navigate("/")}>
                Voltar ao Início
              </Button>
              <Button
                type="submit"
                disabled={loading || !escolaSelecionada}
                className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700"
              >
                {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                {loading ? "Consultando..." : "Consultar"}
              </Button>
            </CardFooter>
          </form>
        ) : (
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
              <Button onClick={handleBack} className="w-full">
                Fazer Nova Consulta
              </Button>
            </CardFooter>
          </>
        )}
      </Card>
    </div>
  );
};

export default StudentQuery;