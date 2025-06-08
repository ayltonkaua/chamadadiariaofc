import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowLeft, AlertTriangle, Check, X } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { format, startOfMonth, endOfMonth, parseISO, isWithinInterval } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface AlunoFaltoso {
  aluno_id: string;
  aluno_nome: string;
  matricula: string;
  turma_nome: string;
  total_faltas: number;
  primeira_falta: string;
  ultima_falta: string;
  tem_atestado: boolean;
  atestado_periodo?: string;
}

interface PresencaFalta {
  aluno_id: string;
  data_chamada: string;
  alunos: {
    nome: string;
    matricula: string;
  };
  turmas: {
    nome: string;
  };
}

interface Atestado {
  aluno_id: string;
  data_inicio: string;
  data_fim: string;
  status: string;
}

const AlertasPage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [alunosFaltosos, setAlunosFaltosos] = useState<AlunoFaltoso[]>([]);
  const [mesSelecionado, setMesSelecionado] = useState<string>(
    format(new Date(), "yyyy-MM")
  );

  const meses = Array.from({ length: 12 }, (_, i) => {
    const date = new Date();
    date.setMonth(i);
    return {
      value: format(date, "yyyy-MM"),
      label: format(date, "MMMM 'de' yyyy", { locale: ptBR }),
    };
  });

  useEffect(() => {
    const carregarAlunosFaltosos = async () => {
      if (!user) return;

      try {
        setLoading(true);

        // Converter o mês selecionado para o formato de data
        const dataInicio = startOfMonth(parseISO(mesSelecionado + "-01"));
        const dataFim = endOfMonth(parseISO(mesSelecionado + "-01"));

        // Primeiro, buscar todas as chamadas do mês
        const { data: chamadasDoMes, error: chamadasError } = await supabase
          .from("presencas")
          .select("data_chamada")
          .gte("data_chamada", dataInicio.toISOString())
          .lte("data_chamada", dataFim.toISOString())
          .order("data_chamada", { ascending: false });

        if (chamadasError) throw chamadasError;

        if (!chamadasDoMes || chamadasDoMes.length === 0) {
          setAlunosFaltosos([]);
          setLoading(false);
          return;
        }

        // Agrupar as datas de chamada por dia
        const datasUnicas = Array.from(new Set(chamadasDoMes.map(c => c.data_chamada.split('T')[0])))
          .sort()
          .reverse()
          .slice(0, 3);

        // Buscar alunos que faltaram nas últimas 3 chamadas do mês
        const { data: faltosos, error: faltososError } = await supabase
          .from("presencas")
          .select(`
            aluno_id,
            data_chamada,
            presente,
            alunos!inner(nome, matricula),
            turmas!inner(nome)
          `)
          .in("data_chamada", datasUnicas.map(d => `${d}T00:00:00`))
          .eq("presente", false)
          .order("data_chamada", { ascending: false });

        if (faltososError) throw faltososError;

        // Buscar atestados aprovados do mês selecionado
        const { data: atestados, error: atestadosError } = await supabase
          .from("atestados")
          .select("aluno_id, data_inicio, data_fim, status")
          .eq("status", "aprovado")
          .lte("data_inicio", dataFim.toISOString())
          .gte("data_fim", dataInicio.toISOString());

        if (atestadosError) throw atestadosError;

        // Processar os dados para exibição
        const alunosProcessados = (faltosos as PresencaFalta[]).reduce((acc: AlunoFaltoso[], faltoso) => {
          const alunoExistente = acc.find(a => a.aluno_id === faltoso.aluno_id);
          
          if (alunoExistente) {
            alunoExistente.total_faltas += 1;
            // Atualizar primeira falta se a data for mais antiga
            if (new Date(faltoso.data_chamada) < new Date(alunoExistente.primeira_falta)) {
              alunoExistente.primeira_falta = faltoso.data_chamada;
            }
            // Atualizar última falta se a data for mais recente
            if (new Date(faltoso.data_chamada) > new Date(alunoExistente.ultima_falta)) {
              alunoExistente.ultima_falta = faltoso.data_chamada;
            }
          } else {
            // Verificar se o aluno tem atestado aprovado para o mês
            const atestadoAluno = (atestados as Atestado[]).find(atestado => 
              atestado.aluno_id === faltoso.aluno_id
            );

            acc.push({
              aluno_id: faltoso.aluno_id,
              aluno_nome: faltoso.alunos.nome,
              matricula: faltoso.alunos.matricula,
              turma_nome: faltoso.turmas.nome,
              total_faltas: 1,
              primeira_falta: faltoso.data_chamada,
              ultima_falta: faltoso.data_chamada,
              tem_atestado: !!atestadoAluno,
              atestado_periodo: atestadoAluno 
                ? `${format(new Date(atestadoAluno.data_inicio), "dd/MM/yyyy", { locale: ptBR })} - ${format(new Date(atestadoAluno.data_fim), "dd/MM/yyyy", { locale: ptBR })}`
                : undefined
            });
          }
          
          return acc;
        }, []);

        // Filtrar apenas alunos com 3 ou mais faltas
        const alunosCom3Faltas = alunosProcessados.filter(aluno => aluno.total_faltas >= 3);
        
        setAlunosFaltosos(alunosCom3Faltas);
      } catch (error) {
        console.error("Erro ao carregar alunos faltosos:", error);
        toast({
          title: "Erro",
          description: "Não foi possível carregar os alertas",
          variant: "destructive",
        });
      } finally {
        setLoading(false);
      }
    };

    carregarAlunosFaltosos();
  }, [user, toast, mesSelecionado]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 py-6">
        <div className="max-w-6xl mx-auto px-4">
          <div className="text-center">
            <p className="text-gray-600">Carregando alertas...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-6">
      <div className="max-w-6xl mx-auto px-4">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center">
            <Button variant="ghost" className="mr-2" onClick={() => navigate("/dashboard")}>
              <ArrowLeft size={18} />
            </Button>
            <h1 className="text-2xl font-bold text-gray-800">Alertas de Faltas</h1>
          </div>
          <div className="flex items-center gap-4">
            <Select
              value={mesSelecionado}
              onValueChange={setMesSelecionado}
            >
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Selecione o mês" />
              </SelectTrigger>
              <SelectContent>
                {meses.map((mes) => (
                  <SelectItem key={mes.value} value={mes.value}>
                    {mes.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-yellow-500" />
              Alunos com 3 ou mais faltas consecutivas em {format(parseISO(mesSelecionado + "-01"), "MMMM 'de' yyyy", { locale: ptBR })}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Aluno</TableHead>
                  <TableHead>Matrícula</TableHead>
                  <TableHead>Turma</TableHead>
                  <TableHead>Total de Faltas</TableHead>
                  <TableHead>Primeira Falta</TableHead>
                  <TableHead>Última Falta</TableHead>
                  <TableHead>Atestado</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {alunosFaltosos.map((aluno) => (
                  <TableRow key={aluno.aluno_id}>
                    <TableCell>{aluno.aluno_nome}</TableCell>
                    <TableCell>{aluno.matricula}</TableCell>
                    <TableCell>{aluno.turma_nome}</TableCell>
                    <TableCell>
                      <span className="px-2 py-1 rounded-full bg-red-100 text-red-800 text-sm font-medium">
                        {aluno.total_faltas} faltas
                      </span>
                    </TableCell>
                    <TableCell>
                      {format(new Date(aluno.primeira_falta), "dd/MM/yyyy", {
                        locale: ptBR,
                      })}
                    </TableCell>
                    <TableCell>
                      {format(new Date(aluno.ultima_falta), "dd/MM/yyyy", {
                        locale: ptBR,
                      })}
                    </TableCell>
                    <TableCell>
                      {aluno.tem_atestado ? (
                        <div className="flex flex-col items-center">
                          <Check className="h-5 w-5 text-green-500" />
                          <span className="text-xs text-gray-500 mt-1">
                            {aluno.atestado_periodo}
                          </span>
                        </div>
                      ) : (
                        <X className="h-5 w-5 text-red-500" />
                      )}
                    </TableCell>
                  </TableRow>
                ))}
                {alunosFaltosos.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-4">
                      Nenhum aluno com 3 ou mais faltas consecutivas encontrado neste mês
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default AlertasPage; 