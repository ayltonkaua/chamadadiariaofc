/**
 * Aluno Page - Perfil Completo
 * 
 * Página de perfil do aluno com todas as funcionalidades:
 * - Informações pessoais (nome, turma, nascimento, idade, contato)
 * - Frequência e estatísticas
 * - Atestados
 * - Observações pedagógicas (CRUD)
 * - Contatos de busca ativa (CRUD)
 */

import React, { useEffect, useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { ArrowLeft, CheckCircle2, XCircle, FileText, Phone, BookOpen, Edit, ArrowRightLeft, User, MapPin, Calendar, GraduationCap, Briefcase, HandCoins, Home, Bus, Ticket, Mail, Smartphone } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { format, parseISO, differenceInYears } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { atestadosService, perfilAlunoService, type Aluno } from '@/domains';
import { ObservacoesTab, BuscaAtivaTab } from '@/components/perfil';
import { useAuth } from '@/contexts/AuthContext';
import { useEscolaConfig } from '@/contexts/EscolaConfigContext';
import AddEditStudentDialog from '@/components/alunos/AddEditStudentDialog';
import { TransferStudentDialog } from '@/components/turmas/TransferStudentDialog';

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
  const { user } = useAuth();
  const { config } = useEscolaConfig();
  const corPrimaria = config?.cor_primaria || "#6D28D9";

  const [aluno, setAluno] = useState<AlunoDetails | null>(null);
  const [historicoCompleto, setHistoricoCompleto] = useState<Presenca[]>([]);
  const [atestados, setAtestados] = useState<AtestadoItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [mesSelecionado, setMesSelecionado] = useState<string>('todos');

  // Estados para modais
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showTransferDialog, setShowTransferDialog] = useState(false);

  useEffect(() => {
    const fetchAlunoData = async () => {
      if (!alunoId || !turmaId) return;
      setLoading(true);
      setError(null);
      try {
        // Buscar aluno com dados da turma
        const { supabase } = await import('@/integrations/supabase/client');
        const { data: alunoData, error: alunoError } = await supabase
          .from('alunos')
          .select(`
            *,
            turmas:turma_id (id, nome)
          `)
          .eq('id', alunoId)
          .single();

        if (alunoError) throw alunoError;
        if (!alunoData) throw new Error('Aluno não encontrado');

        const [historicoData, atestadosData] = await Promise.all([
          perfilAlunoService.getHistoricoPresenca(alunoId),
          atestadosService.findPaginated({ searchTerm: undefined }, 1, 100)
        ]);

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
    if (!dateString) return new Date();
    
    // Se a data já estiver no formato brasileiro DD/MM/YYYY
    if (dateString.includes('/')) {
        const [day, month, year] = dateString.split('/').map(Number);
        return new Date(year, month - 1, day, 12, 0, 0);
    }
    
    // Formato padrão ISO YYYY-MM-DD
    const parts = dateString.split('-');
    if (parts.length === 3) {
        if (parts[0].length === 4) {
            // YYYY-MM-DD
            const [year, month, day] = parts.map(Number);
            return new Date(year, month - 1, day, 12, 0, 0);
        } else if (parts[2].length === 4) {
            // DD-MM-YYYY
            const [day, month, year] = parts.map(Number);
            return new Date(year, month - 1, day, 12, 0, 0);
        }
    }
    
    // Fallback padrão se não conseguir deduzir
    return new Date(dateString); 
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

  // Verificar permissão para editar/transferir
  const userRole = (user?.role || '').toLowerCase();
  const canManage = ['admin', 'diretor', 'coordenador', 'secretario', 'super_admin'].includes(userRole);

  // Função para calcular idade
  const calcularIdade = (dataNascimento: string | null | undefined): { anos: number; texto: string } | null => {
    if (!dataNascimento) return null;
    try {
      const nascimento = parseDateAsLocal(dataNascimento);
      const anos = differenceInYears(new Date(), nascimento);
      return { anos, texto: `${anos} anos` };
    } catch {
      return null;
    }
  };

  const idade = calcularIdade(aluno.data_nascimento);

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-6">
      <div className="max-w-5xl mx-auto space-y-6">
        {/* Header com botão voltar */}
        <header className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate(`/gerenciar-alunos/${turmaId}`)}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-gray-800">Perfil do Aluno</h1>
            <p className="text-muted-foreground">Informações completas e histórico</p>
          </div>
        </header>

        {/* Card de Informações do Aluno */}
        <Card className="border-l-4" style={{ borderLeftColor: corPrimaria }}>
          <CardHeader className="pb-2">
            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
              <div className="flex items-start gap-4">
                <div
                  className="h-16 w-16 rounded-full flex items-center justify-center shrink-0"
                  style={{ backgroundColor: `${corPrimaria}20` }}
                >
                  <User className="h-8 w-8" style={{ color: corPrimaria }} />
                </div>
                <div>
                  <CardTitle className="text-xl sm:text-2xl">{aluno.nome}</CardTitle>
                  <CardDescription className="flex items-center gap-2 mt-1">
                    <GraduationCap className="h-4 w-4" />
                    <span>{aluno.turmas?.nome || 'Turma não definida'}</span>
                    {aluno.matricula && (
                      <Badge
                        variant="outline"
                        className="ml-2"
                        style={{ borderColor: corPrimaria, color: corPrimaria }}
                      >
                        Matrícula: {aluno.matricula}
                      </Badge>
                    )}
                  </CardDescription>
                </div>
              </div>

              {/* Botões Editar e Transferir */}
              {canManage && (
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-2"
                    onClick={() => setShowEditDialog(true)}
                  >
                    <Edit className="h-4 w-4" />
                    Editar
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-2"
                    onClick={() => setShowTransferDialog(true)}
                  >
                    <ArrowRightLeft className="h-4 w-4" />
                    Transferir
                  </Button>
                </div>
              )}
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 mt-4">
              {/* Data de Nascimento + Idade */}
              <div className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
                <Calendar className="h-5 w-5 text-gray-500 mt-0.5" />
                <div>
                  <p className="text-sm text-gray-500">Data de Nascimento</p>
                  <p className="font-medium">
                    {aluno.data_nascimento
                      ? format(parseDateAsLocal(aluno.data_nascimento), "dd/MM/yyyy")
                      : 'Não informado'}
                  </p>
                  {idade && (
                    <p className="text-sm font-semibold" style={{ color: corPrimaria }}>({idade.texto})</p>
                  )}
                </div>
              </div>

              {/* Nome do Responsável */}
              <div className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
                <User className="h-5 w-5 text-gray-500 mt-0.5" />
                <div>
                  <p className="text-sm text-gray-500">Nome do Responsável</p>
                  <p className="font-medium">
                    {aluno.nome_responsavel || 'Não informado'}
                  </p>
                </div>
              </div>

              {/* Telefone do Responsável */}
              <div className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
                <Phone className="h-5 w-5 text-gray-500 mt-0.5" />
                <div>
                  <p className="text-sm text-gray-500">Telefone do Responsável</p>
                  <p className="font-medium" style={{ color: aluno.telefone_responsavel ? corPrimaria : undefined }}>
                    {aluno.telefone_responsavel || 'Não informado'}
                  </p>
                  {(aluno as any).telefone_responsavel_2 && (
                    <p className="font-medium mt-1" style={{ color: corPrimaria }}>
                      {(aluno as any).telefone_responsavel_2}
                      <span className="text-xs text-gray-400 ml-1">(2º)</span>
                    </p>
                  )}
                </div>
              </div>

              {/* Endereço */}
              <div className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg lg:col-span-2">
                <MapPin className="h-5 w-5 text-gray-500 mt-0.5" />
                <div>
                  <p className="text-sm text-gray-500">Endereço</p>
                  <p className="font-medium">
                    {aluno.endereco || 'Não informado'}
                  </p>
                </div>
              </div>
            </div>

            {/* Situação do Aluno */}
            {aluno.situacao && aluno.situacao !== 'ativo' && (
              <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                <Badge variant="outline" className="bg-amber-100 text-amber-800 border-amber-300">
                  Situação: {aluno.situacao.charAt(0).toUpperCase() + aluno.situacao.slice(1)}
                </Badge>
              </div>
            )}
          </CardContent>
        </Card>

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
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="frequencia" className="text-xs sm:text-sm">
              <CheckCircle2 className="h-4 w-4 mr-1 hidden sm:inline" />
              Frequência
            </TabsTrigger>
            <TabsTrigger value="dados-sociais" className="text-xs sm:text-sm">
              <Briefcase className="h-4 w-4 mr-1 hidden sm:inline" />
              Dados Sociais
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

          {/* Tab: Dados Sociais */}
          <TabsContent value="dados-sociais">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Contato do Aluno */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Smartphone className="h-4 w-4 text-violet-600" /> Contato do Aluno
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="flex items-center justify-between py-1.5 border-b">
                    <span className="text-sm text-gray-600 flex items-center gap-1.5"><Phone className="h-3.5 w-3.5" /> Telefone</span>
                    <span className="text-sm font-medium" style={{ color: (aluno as any).telefone_aluno ? corPrimaria : undefined }}>
                      {(aluno as any).telefone_aluno || 'Não informado'}
                    </span>
                  </div>
                </CardContent>
              </Card>

              {/* Perfil Social */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center gap-2">
                    <User className="h-4 w-4 text-violet-600" /> Perfil Social
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="flex items-center justify-between py-1.5 border-b">
                    <span className="text-sm text-gray-600 flex items-center gap-1.5"><Briefcase className="h-3.5 w-3.5" /> Trabalha</span>
                    <Badge variant={(aluno as any).trabalha ? "default" : "outline"} className={(aluno as any).trabalha ? "bg-amber-100 text-amber-700" : ""}>
                      {(aluno as any).trabalha ? "Sim" : "Não"}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between py-1.5 border-b">
                    <span className="text-sm text-gray-600 flex items-center gap-1.5"><HandCoins className="h-3.5 w-3.5" /> Pé-de-Meia</span>
                    <Badge variant={(aluno as any).recebe_pe_de_meia ? "default" : "outline"} className={(aluno as any).recebe_pe_de_meia ? "bg-green-100 text-green-700" : ""}>
                      {(aluno as any).recebe_pe_de_meia ? "Recebe" : "Não recebe"}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between py-1.5 border-b">
                    <span className="text-sm text-gray-600 flex items-center gap-1.5"><HandCoins className="h-3.5 w-3.5" /> Bolsa Família</span>
                    <Badge variant={(aluno as any).recebe_bolsa_familia ? "default" : "outline"} className={(aluno as any).recebe_bolsa_familia ? "bg-green-100 text-green-700" : ""}>
                      {(aluno as any).recebe_bolsa_familia ? "Recebe" : "Não recebe"}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between py-1.5">
                    <span className="text-sm text-gray-600 flex items-center gap-1.5"><Home className="h-3.5 w-3.5" /> Mora com a família</span>
                    <Badge variant={(aluno as any).mora_com_familia !== false ? "default" : "outline"} className={(aluno as any).mora_com_familia !== false ? "bg-blue-100 text-blue-700" : "bg-red-50 text-red-600"}>
                      {(aluno as any).mora_com_familia !== false ? "Sim" : "Não"}
                    </Badge>
                  </div>
                </CardContent>
              </Card>

              {/* Transporte */}
              <Card className="md:col-span-2">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Bus className="h-4 w-4 text-violet-600" /> Transporte e Localização
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="flex items-center justify-between py-1.5">
                      <span className="text-sm text-gray-600 flex items-center gap-1.5"><Bus className="h-3.5 w-3.5" /> Transporte Escolar</span>
                      <Badge variant={(aluno as any).usa_transporte ? "default" : "outline"} className={(aluno as any).usa_transporte ? "bg-blue-100 text-blue-700" : ""}>
                        {(aluno as any).usa_transporte ? "Utiliza" : "Não utiliza"}
                      </Badge>
                    </div>
                    <div className="flex items-center justify-between py-1.5">
                      <span className="text-sm text-gray-600 flex items-center gap-1.5"><Ticket className="h-3.5 w-3.5" /> Passe Livre</span>
                      <Badge variant={(aluno as any).tem_passe_livre ? "default" : "outline"} className={(aluno as any).tem_passe_livre ? "bg-green-100 text-green-700" : ""}>
                        {(aluno as any).tem_passe_livre ? "Possui" : "Não possui"}
                      </Badge>
                    </div>
                    <div className="flex items-center justify-between py-1.5">
                      <span className="text-sm text-gray-600 flex items-center gap-1.5"><MapPin className="h-3.5 w-3.5" /> Localização</span>
                      <Badge variant="outline" className={(aluno as any).latitude ? "bg-purple-50 text-purple-700" : ""}>
                        {(aluno as any).latitude ? "Cadastrada" : "Não cadastrada"}
                      </Badge>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
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

      {/* Modal Editar Aluno */}
      {
        showEditDialog && aluno && (
          <AddEditStudentDialog
            open={showEditDialog}
            onClose={() => setShowEditDialog(false)}
            onStudentAdded={async () => {
              setShowEditDialog(false);
              // Recarregar dados do aluno
              const { supabase } = await import('@/integrations/supabase/client');
              const { data } = await supabase
                .from('alunos')
                .select(`*, turmas:turma_id (id, nome)`)
                .eq('id', alunoId)
                .single();
              if (data) setAluno(data as AlunoDetails);
            }}
            turmaId={turmaId || ''}
            student={{
              id: aluno.id,
              nome: aluno.nome,
              matricula: aluno.matricula,
              turma_id: aluno.turma_id,
              nome_responsavel: aluno.nome_responsavel || undefined,
              telefone_responsavel: aluno.telefone_responsavel || undefined,
              telefone_responsavel_2: (aluno as any).telefone_responsavel_2 || undefined,
              data_nascimento: aluno.data_nascimento || undefined,
              endereco: aluno.endereco || undefined,
              trabalha: (aluno as any).trabalha,
              recebe_pe_de_meia: (aluno as any).recebe_pe_de_meia,
              mora_com_familia: (aluno as any).mora_com_familia,
              usa_transporte: (aluno as any).usa_transporte,
              tem_passe_livre: (aluno as any).tem_passe_livre,
              recebe_bolsa_familia: (aluno as any).recebe_bolsa_familia,
              latitude: (aluno as any).latitude,
              longitude: (aluno as any).longitude,
              telefone_aluno: (aluno as any).telefone_aluno,
            }}
            isEditing={true}
          />
        )
      }

      {/* Modal Transferir Aluno */}
      {
        showTransferDialog && aluno && (
          <TransferStudentDialog
            aluno={{
              id: aluno.id,
              nome: aluno.nome,
              turma_id: aluno.turma_id,
            }}
            onClose={() => setShowTransferDialog(false)}
            onSuccess={() => {
              setShowTransferDialog(false);
              // Redirecionar para lista de alunos após transferência
              navigate(`/gerenciar-alunos/${turmaId}`);
            }}
          />
        )
      }
    </div >
  );
}