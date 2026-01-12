/**
 * Aluno Page - Perfil Completo
 * 
 * Página de perfil do aluno com todas as funcionalidades:
 * - Frequência e estatísticas
 * - Atestados
 * - Observações pedagógicas (CRUD)
 * - Contatos de busca ativa (CRUD)
 */

import React, { useEffect, useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowLeft, CheckCircle2, XCircle, FileText, Phone, BookOpen } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { alunoService, atestadosService, perfilAlunoService, type Aluno } from '@/domains';
import { ObservacoesTab, BuscaAtivaTab } from '@/components/perfil';

// --- Interfaces ---
interface AlunoDetails extends Aluno {
  turmas?: { id: string; nome: string; };
}
interface Presenca {
  data: string;
  presente: boolean;
  faltaJustificada: boolean;
}
interface AtestadoItem {
  id: string;
  data_inicio: string;
  data_fim: string;
  descricao: string;
  status: string;
}

export default function AlunoPage() {
  const { turmaId, alunoId } = useParams();
  const navigate = useNavigate();
  const [aluno, setAluno] = useState<AlunoDetails | null>(null);
  const [historicoCompleto, setHistoricoCompleto] = useState<Presenca[]>([]);
  const [atestados, setAtestados] = useState<AtestadoItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [mesSelecionado, setMesSelecionado] = useState<string>('todos');

  useEffect(() => {
    const fetchAlunoData = async () => {
      if (!alunoId || !turmaId) return;
      setLoading(true);
      setError(null);
      try {
        const [alunoData, historicoData, atestadosData] = await Promise.all([
          alunoService.findById(alunoId),
          perfilAlunoService.getHistoricoPresenca(alunoId),
          atestadosService.findPaginated({ searchTerm: undefined }, 1, 100)
        ]);

        if (!alunoData) throw new Error('Aluno não encontrado');

        setAluno(alunoData as AlunoDetails);
        setHistoricoCompleto(historicoData);
        const alunoAtestados = atestadosData.data.filter(a => a.aluno_id === alunoId);
        setAtestados(alunoAtestados as unknown as AtestadoItem[]);
      } catch (err: any) {
        setError("Erro ao carregar dados do aluno.");
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchAlunoData();
  }, [alunoId, turmaId]);

  const parseDateAsLocal = (dateString: string) => {
    const [year, month, day] = dateString.split('-').map(Number);
    return new Date(year, month - 1, day);
  };

  const mesesDisponiveis = useMemo(() => {
    const meses = new Set<string>();
    historicoCompleto.forEach(item => {
      const d = parseDateAsLocal(item.data);
      const mesAno = format(d, 'yyyy-MM');
      meses.add(mesAno);
    });
    return Array.from(meses).map(mesAno => ({
      value: mesAno,
      label: format(parseISO(`${mesAno}-01T12:00:00Z`), "MMMM 'de' yyyy", { locale: ptBR })
    }));
  }, [historicoCompleto]);

  const historicoFiltrado = useMemo(() => {
    if (mesSelecionado === 'todos') return historicoCompleto;
    return historicoCompleto.filter(item => format(parseDateAsLocal(item.data), 'yyyy-MM') === mesSelecionado);
  }, [historicoCompleto, mesSelecionado]);

  const stats = useMemo(() => {
    const total = historicoFiltrado.length;
    const presentes = historicoFiltrado.filter(h => h.presente).length;
    const faltasJustificadas = historicoFiltrado.filter(h => !h.presente && h.faltaJustificada).length;
    const faltas = total - presentes - faltasJustificadas;
    const porcentagem = total > 0 ? Math.round(((presentes + faltasJustificadas) / total) * 100) : 100;
    return { total, presentes, faltas, faltasJustificadas, porcentagem };
  }, [historicoFiltrado]);

  if (loading) {
    return (
      <div className="container mx-auto p-4 md:p-6 space-y-4">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (error || !aluno) {
    return <div className="text-center py-10 text-red-500">{error || "Aluno não encontrado"}</div>;
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-6">
      <div className="max-w-5xl mx-auto space-y-6">
        {/* Header */}
        <header className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate(`/gerenciar-alunos/${turmaId}`)}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-gray-800">{aluno.nome}</h1>
            <p className="text-muted-foreground">Perfil Completo do Aluno</p>
          </div>
        </header>

        {/* Stats Card */}
        <Card>
          <CardHeader>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <CardTitle>Resumo da Frequência</CardTitle>
              <Select value={mesSelecionado} onValueChange={setMesSelecionado}>
                <SelectTrigger className="w-full sm:w-[220px]">
                  <SelectValue placeholder="Filtrar por mês" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Ver Histórico Geral</SelectItem>
                  {mesesDisponiveis.map(mes => (
                    <SelectItem key={mes.value} value={mes.value}>{mes.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardHeader>
          <CardContent className="grid gap-4 grid-cols-2 md:grid-cols-5 pt-4">
            <div className="flex flex-col items-center p-3 bg-gray-50 rounded-lg text-center">
              <span className="text-2xl font-bold">{stats.total}</span>
              <span className="text-xs text-gray-500">Chamadas</span>
            </div>
            <div className="flex flex-col items-center p-3 bg-green-50 rounded-lg text-center">
              <span className="text-2xl font-bold text-green-600">{stats.presentes}</span>
              <span className="text-xs text-gray-500">Presenças</span>
            </div>
            <div className="flex flex-col items-center p-3 bg-red-50 rounded-lg text-center">
              <span className="text-2xl font-bold text-red-600">{stats.faltas}</span>
              <span className="text-xs text-gray-500">Faltas</span>
            </div>
            <div className="flex flex-col items-center p-3 bg-blue-50 rounded-lg text-center">
              <span className="text-2xl font-bold text-blue-600">{stats.faltasJustificadas}</span>
              <span className="text-xs text-gray-500">Justificadas</span>
            </div>
            <div className="flex flex-col items-center p-3 bg-purple-50 rounded-lg text-center">
              <span className={`text-2xl font-bold ${stats.porcentagem >= 75 ? 'text-green-600' : 'text-red-600'}`}>
                {stats.porcentagem}%
              </span>
              <span className="text-xs text-gray-500">Frequência</span>
            </div>
          </CardContent>
        </Card>

        {/* Tabs */}
        <Tabs defaultValue="frequencia" className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="frequencia" className="text-xs sm:text-sm">
              <CheckCircle2 className="h-4 w-4 mr-1 hidden sm:inline" />
              Frequência
            </TabsTrigger>
            <TabsTrigger value="atestados" className="text-xs sm:text-sm">
              <FileText className="h-4 w-4 mr-1 hidden sm:inline" />
              Atestados
            </TabsTrigger>
            <TabsTrigger value="observacoes" className="text-xs sm:text-sm">
              <BookOpen className="h-4 w-4 mr-1 hidden sm:inline" />
              Observações
            </TabsTrigger>
            <TabsTrigger value="busca-ativa" className="text-xs sm:text-sm">
              <Phone className="h-4 w-4 mr-1 hidden sm:inline" />
              Busca Ativa
            </TabsTrigger>
          </TabsList>

          {/* Tab: Frequência */}
          <TabsContent value="frequencia">
            <Card>
              <CardContent className="pt-6">
                <div className="space-y-4">
                  {historicoFiltrado.length > 0 ? (
                    historicoFiltrado.map((item, index) => (
                      <div key={index} className="flex flex-col sm:flex-row sm:items-center sm:justify-between p-3 bg-gray-50 rounded-lg">
                        <span className="font-medium mb-2 sm:mb-0">
                          {format(parseDateAsLocal(item.data), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
                        </span>
                        {item.presente ? (
                          <span className="flex items-center text-sm font-semibold text-green-600">
                            <CheckCircle2 className="mr-2 h-4 w-4" /> Presente
                          </span>
                        ) : item.faltaJustificada ? (
                          <span className="flex items-center text-sm font-semibold text-blue-600">
                            <FileText className="mr-2 h-4 w-4" /> Falta Justificada
                          </span>
                        ) : (
                          <span className="flex items-center text-sm font-semibold text-red-600">
                            <XCircle className="mr-2 h-4 w-4" /> Falta
                          </span>
                        )}
                      </div>
                    ))
                  ) : (
                    <p className="text-center text-muted-foreground py-4">
                      Nenhum registro de frequência para o período selecionado.
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Tab: Atestados */}
          <TabsContent value="atestados">
            <Card>
              <CardContent className="pt-6">
                <div className="space-y-4">
                  {atestados.length > 0 ? (
                    atestados.map(atestado => (
                      <div key={atestado.id} className="p-4 border rounded-lg bg-gray-50">
                        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center mb-2 gap-2">
                          <p className="font-semibold">
                            Período: {format(parseDateAsLocal(atestado.data_inicio), 'dd/MM/yy')} a {format(parseDateAsLocal(atestado.data_fim), 'dd/MM/yy')}
                          </p>
                          <Badge className={`${atestado.status === 'aprovado' ? 'bg-green-100 text-green-800' : atestado.status === 'pendente' ? 'bg-yellow-100 text-yellow-800' : 'bg-red-100 text-red-800'}`}>
                            {atestado.status}
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground">{atestado.descricao}</p>
                      </div>
                    ))
                  ) : (
                    <p className="text-center text-muted-foreground py-4">
                      Nenhum atestado enviado por este aluno.
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Tab: Observações */}
          <TabsContent value="observacoes">
            <ObservacoesTab alunoId={alunoId!} turmaId={turmaId} />
          </TabsContent>

          {/* Tab: Busca Ativa */}
          <TabsContent value="busca-ativa">
            <BuscaAtivaTab alunoId={alunoId!} />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}