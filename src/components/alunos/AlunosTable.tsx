import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { ArrowLeft, UserCircle, CalendarDays, CheckCircle2, XCircle, FileText } from 'lucide-react';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface AlunoDetails {
  id: string;
  nome: string;
  matricula: string;
  nome_responsavel?: string;
  telefone_responsavel?: string;
  turmas: {
    id: string;
    nome: string;
  };
}

interface Presenca {
  data_chamada: string;
  presente: boolean;
  falta_justificada: boolean;
}

const AlunoPage: React.FC = () => {
  const { turmaId, alunoId } = useParams<{ turmaId: string; alunoId: string }>();
  const navigate = useNavigate();
  const [aluno, setAluno] = useState<AlunoDetails | null>(null);
  const [historico, setHistorico] = useState<Presenca[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchAlunoData = async () => {
      if (!alunoId) return;
      setLoading(true);
      try {
        // Busca os detalhes do aluno
        const { data: alunoData, error: alunoError } = await supabase
          .from('alunos')
          .select('id, nome, matricula, nome_responsavel, telefone_responsavel, turmas(id, nome)')
          .eq('id', alunoId)
          .single();
        if (alunoError) throw alunoError;
        setAluno(alunoData as AlunoDetails);

        // Busca o histórico de presença
        const { data: historicoData, error: historicoError } = await supabase
          .from('presencas')
          .select('data_chamada, presente, falta_justificada')
          .eq('aluno_id', alunoId)
          .order('data_chamada', { ascending: false }); // Ordena do mais recente para o mais antigo
        if (historicoError) throw historicoError;
        setHistorico(historicoData);

      } catch (error) {
        console.error("Erro ao buscar dados do aluno:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchAlunoData();
  }, [alunoId]);

  const stats = React.useMemo(() => {
    const total = historico.length;
    const presentes = historico.filter(h => h.presente).length;
    const faltasJustificadas = historico.filter(h => !h.presente && h.falta_justificada).length;
    const faltas = total - presentes - faltasJustificadas;
    return { total, presentes, faltas, faltasJustificadas };
  }, [historico]);

  if (loading) {
    return (
        <div className="container mx-auto p-4 md:p-6 space-y-4">
            <Skeleton className="h-10 w-48" />
            <Skeleton className="h-40 w-full" />
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <Skeleton className="h-24 w-full" />
                <Skeleton className="h-24 w-full" />
                <Skeleton className="h-24 w-full" />
                <Skeleton className="h-24 w-full" />
            </div>
            <Skeleton className="h-64 w-full" />
        </div>
    );
  }

  if (!aluno) {
    return <div className="text-center py-10">Aluno não encontrado.</div>;
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-6">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Cabeçalho */}
        <header className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate(`/gerenciar-alunos/${turmaId}`)}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-gray-800">Histórico do Aluno</h1>
            <p className="text-muted-foreground">{aluno.nome}</p>
          </div>
        </header>

        {/* Card de Informações do Aluno */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><UserCircle className="h-5 w-5 text-primary" /> Informações Pessoais</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
            <div><strong>Nome:</strong> {aluno.nome}</div>
            <div><strong>Matrícula:</strong> {aluno.matricula}</div>
            <div><strong>Turma:</strong> {aluno.turmas.nome}</div>
            <Separator className="sm:hidden" />
            <div><strong>Responsável:</strong> {aluno.nome_responsavel || 'Não informado'}</div>
            <div><strong>Telefone do Responsável:</strong> {aluno.telefone_responsavel || 'Não informado'}</div>
          </CardContent>
        </Card>

        {/* Cards de Estatísticas */}
        <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
            <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"><CardTitle className="text-sm font-medium">Aulas Registradas</CardTitle><CalendarDays className="h-4 w-4 text-muted-foreground" /></CardHeader>
                <CardContent><div className="text-2xl font-bold">{stats.total}</div></CardContent>
            </Card>
            <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"><CardTitle className="text-sm font-medium">Presenças</CardTitle><CheckCircle2 className="h-4 w-4 text-green-500" /></CardHeader>
                <CardContent><div className="text-2xl font-bold">{stats.presentes}</div></CardContent>
            </Card>
            <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"><CardTitle className="text-sm font-medium">Faltas</CardTitle><XCircle className="h-4 w-4 text-red-500" /></CardHeader>
                <CardContent><div className="text-2xl font-bold">{stats.faltas}</div></CardContent>
            </Card>
             <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"><CardTitle className="text-sm font-medium">Faltas Justificadas</CardTitle><FileText className="h-4 w-4 text-blue-500" /></CardHeader>
                <CardContent><div className="text-2xl font-bold">{stats.faltasJustificadas}</div></CardContent>
            </Card>
        </div>

        {/* Lista de Histórico */}
        <Card>
          <CardHeader>
            <CardTitle>Histórico Detalhado</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {historico.length > 0 ? (
                historico.map((item, index) => (
                  <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <span className="font-medium">{format(parseISO(item.data_chamada), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}</span>
                    {item.presente ? (
                        <span className="flex items-center text-sm font-semibold text-green-600"><CheckCircle2 className="mr-2 h-4 w-4"/> Presente</span>
                    ) : item.falta_justificada ? (
                        <span className="flex items-center text-sm font-semibold text-blue-600"><FileText className="mr-2 h-4 w-4"/> Falta Justificada</span>
                    ) : (
                        <span className="flex items-center text-sm font-semibold text-red-600"><XCircle className="mr-2 h-4 w-4"/> Falta</span>
                    )}
                  </div>
                ))
              ) : (
                <p className="text-center text-muted-foreground py-4">Nenhum registro de frequência encontrado.</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default AlunoPage;