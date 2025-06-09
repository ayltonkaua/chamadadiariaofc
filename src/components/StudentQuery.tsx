import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";

interface StudentAttendanceResult {
  name: string;
  enrollment: string;
  className: string;
  totalClasses: number;
  absences: number;
  justifiedAbsences: number;
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

      // Buscar faltas justificadas do aluno
      const { count: totalFaltasJustificadas } = await supabase
        .from("justificativa_faltas")
        .select("id", { count: "exact", head: true })
        .eq("aluno_id", aluno.id);
      const faltasJustificadas = totalFaltasJustificadas || 0;

      setResult({
        name: aluno.nome,
        enrollment: aluno.matricula,
        className: (aluno.turmas as { nome: string }).nome,
        totalClasses: total,
        absences: faltas,
        justifiedAbsences: faltasJustificadas,
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
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-gray-500">Matrícula:</span>
                    <span className="font-medium">{result.enrollment}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Turma:</span>
                    <span className="font-medium">{result.className}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Total de chamadas:</span>
                    <span className="font-medium">{result.totalClasses}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Faltas:</span>
                    <span className="font-medium text-red-600">{result.absences}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Faltas Justificadas:</span>
                    <span className="font-medium text-blue-600">{result.justifiedAbsences}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Frequência:</span>
                    <span className="font-medium text-green-600">
                      {result.percentagePresent}%
                    </span>
                  </div>
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
