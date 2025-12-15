import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';

// Services
import { perfilAlunoService, type PerfilCompletoAluno, type HistoricoPresenca, type NotasPorDisciplina, type ObservacaoAluno, type ContatoBuscaAtiva, type TransferenciaAluno } from '@/domains';

// UI Components
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { toast } from '@/hooks/use-toast';

// Icons
import {
    ArrowLeft, User, Phone, MapPin, Calendar, CheckCircle2, XCircle,
    FileText, GraduationCap, AlertTriangle, TrendingDown, TrendingUp,
    RefreshCw, MessageSquare, PhoneCall, Plus, BookOpen
} from 'lucide-react';

// Helper para formatar datas
const formatDate = (dateStr: string) => {
    try {
        return format(parseISO(dateStr), "dd/MM/yyyy", { locale: ptBR });
    } catch {
        return dateStr;
    }
};

const formatDateFull = (dateStr: string) => {
    try {
        return format(parseISO(dateStr), "dd 'de' MMMM 'de' yyyy", { locale: ptBR });
    } catch {
        return dateStr;
    }
};

// Componente de Ring para frequência
const FrequencyRing = ({ percentage }: { percentage: number }) => {
    const radius = 45;
    const circumference = 2 * Math.PI * radius;
    const strokeDashoffset = circumference - (percentage / 100) * circumference;
    const color = percentage >= 75 ? "text-green-500" : percentage >= 60 ? "text-yellow-500" : "text-red-500";

    return (
        <div className="relative flex items-center justify-center w-32 h-32">
            <svg className="transform -rotate-90 w-full h-full">
                <circle
                    className="text-gray-200"
                    strokeWidth="8"
                    stroke="currentColor"
                    fill="transparent"
                    r={radius}
                    cx="64"
                    cy="64"
                />
                <circle
                    className={`${color} transition-all duration-1000 ease-out`}
                    strokeWidth="8"
                    strokeDasharray={circumference}
                    strokeDashoffset={strokeDashoffset}
                    strokeLinecap="round"
                    stroke="currentColor"
                    fill="transparent"
                    r={radius}
                    cx="64"
                    cy="64"
                />
            </svg>
            <div className="absolute flex flex-col items-center">
                <span className={`text-2xl font-bold ${color}`}>{percentage}%</span>
                <span className="text-xs text-gray-400 uppercase">Frequência</span>
            </div>
        </div>
    );
};

export default function PerfilAlunoPage() {
    const { alunoId } = useParams<{ alunoId: string }>();
    const navigate = useNavigate();

    // Estados
    const [loading, setLoading] = useState(true);
    const [perfil, setPerfil] = useState<PerfilCompletoAluno | null>(null);
    const [historico, setHistorico] = useState<HistoricoPresenca[]>([]);
    const [mesSelecionado, setMesSelecionado] = useState<string>('todos');
    const [mesesDisponiveis, setMesesDisponiveis] = useState<{ value: string; label: string }[]>([]);
    const [boletim, setBoletim] = useState<NotasPorDisciplina[]>([]);
    const [observacoes, setObservacoes] = useState<ObservacaoAluno[]>([]);
    const [contatosBuscaAtiva, setContatosBuscaAtiva] = useState<ContatoBuscaAtiva[]>([]);
    const [transferencias, setTransferencias] = useState<TransferenciaAluno[]>([]);
    const [activeTab, setActiveTab] = useState('dados');

    // Dialog states
    const [showObservacaoDialog, setShowObservacaoDialog] = useState(false);
    const [novaObservacaoTitulo, setNovaObservacaoTitulo] = useState('');
    const [novaObservacaoDescricao, setNovaObservacaoDescricao] = useState('');
    const [salvandoObservacao, setSalvandoObservacao] = useState(false);

    // Carregar dados iniciais
    useEffect(() => {
        if (!alunoId) return;

        const loadData = async () => {
            setLoading(true);
            try {
                const [perfilData, meses] = await Promise.all([
                    perfilAlunoService.getPerfilCompleto(alunoId),
                    perfilAlunoService.getMesesDisponiveis(alunoId)
                ]);
                setPerfil(perfilData);
                setMesesDisponiveis(meses);
            } catch (error) {
                console.error('Erro ao carregar perfil:', error);
                toast({ title: 'Erro', description: 'Não foi possível carregar o perfil do aluno.', variant: 'destructive' });
            } finally {
                setLoading(false);
            }
        };

        loadData();
    }, [alunoId]);

    // Carregar histórico quando mês muda
    useEffect(() => {
        if (!alunoId) return;

        const loadHistorico = async () => {
            try {
                const mes = mesSelecionado === 'todos' ? undefined : mesSelecionado;
                const data = await perfilAlunoService.getHistoricoPresenca(alunoId, mes);
                setHistorico(data);
            } catch (error) {
                console.error('Erro ao carregar histórico:', error);
            }
        };

        loadHistorico();
    }, [alunoId, mesSelecionado]);

    // Carregar dados da aba ativa
    useEffect(() => {
        if (!alunoId) return;

        const loadTabData = async () => {
            try {
                switch (activeTab) {
                    case 'boletim':
                        const notasData = await perfilAlunoService.getBoletim(alunoId);
                        setBoletim(notasData);
                        break;
                    case 'observacoes':
                        const obsData = await perfilAlunoService.getObservacoes(alunoId);
                        setObservacoes(obsData);
                        break;
                    case 'buscaativa':
                        const contatosData = await perfilAlunoService.getContatosBuscaAtiva(alunoId);
                        setContatosBuscaAtiva(contatosData);
                        break;
                    case 'transferencias':
                        const transData = await perfilAlunoService.getTransferencias(alunoId);
                        setTransferencias(transData);
                        break;
                }
            } catch (error) {
                console.error('Erro ao carregar dados da aba:', error);
            }
        };

        loadTabData();
    }, [alunoId, activeTab]);

    // Salvar nova observação
    const handleSalvarObservacao = async () => {
        if (!alunoId || !perfil || !novaObservacaoTitulo.trim() || !novaObservacaoDescricao.trim()) {
            toast({ title: 'Erro', description: 'Preencha todos os campos.', variant: 'destructive' });
            return;
        }

        setSalvandoObservacao(true);
        try {
            await perfilAlunoService.addObservacao(
                alunoId,
                novaObservacaoTitulo,
                novaObservacaoDescricao,
                perfil.dadosPessoais.escolaId,
                perfil.dadosPessoais.turmaId
            );
            toast({ title: 'Sucesso', description: 'Observação salva com sucesso!' });
            setShowObservacaoDialog(false);
            setNovaObservacaoTitulo('');
            setNovaObservacaoDescricao('');
            // Recarregar observações
            const obsData = await perfilAlunoService.getObservacoes(alunoId);
            setObservacoes(obsData);
        } catch (error) {
            toast({ title: 'Erro', description: 'Não foi possível salvar a observação.', variant: 'destructive' });
        } finally {
            setSalvandoObservacao(false);
        }
    };

    // Loading state
    if (loading) {
        return (
            <div className="min-h-screen bg-gray-50 p-4 md:p-6 space-y-4">
                <div className="flex items-center gap-4 mb-6">
                    <Skeleton className="h-10 w-10 rounded-full" />
                    <div className="space-y-2">
                        <Skeleton className="h-6 w-48" />
                        <Skeleton className="h-4 w-32" />
                    </div>
                </div>
                <Skeleton className="h-48 w-full rounded-xl" />
                <Skeleton className="h-64 w-full rounded-xl" />
            </div>
        );
    }

    if (!perfil) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center">
                <Card className="max-w-md">
                    <CardContent className="p-6 text-center">
                        <AlertTriangle className="h-12 w-12 text-yellow-500 mx-auto mb-4" />
                        <h2 className="text-xl font-bold mb-2">Aluno não encontrado</h2>
                        <p className="text-gray-500 mb-4">Não foi possível carregar os dados do aluno.</p>
                        <Button onClick={() => navigate(-1)}>Voltar</Button>
                    </CardContent>
                </Card>
            </div>
        );
    }

    const { dadosPessoais, indicadores } = perfil;

    return (
        <div className="min-h-screen bg-gray-50">
            {/* Header */}
            <header className="bg-white border-b sticky top-0 z-10">
                <div className="max-w-6xl mx-auto px-4 py-4">
                    <div className="flex items-center gap-4">
                        <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
                            <ArrowLeft className="h-5 w-5" />
                        </Button>
                        <div className="flex-1">
                            <h1 className="text-xl font-bold text-gray-900">{dadosPessoais.nome}</h1>
                            <p className="text-sm text-gray-500">
                                {dadosPessoais.turmaNome} • Matrícula: {dadosPessoais.matricula}
                            </p>
                        </div>
                        <Badge
                            variant="outline"
                            className={`text-sm ${indicadores.situacao === 'Regular' ? 'border-green-500 text-green-700 bg-green-50' :
                                    indicadores.situacao === 'Risco' ? 'border-yellow-500 text-yellow-700 bg-yellow-50' :
                                        'border-red-500 text-red-700 bg-red-50'
                                }`}
                        >
                            {indicadores.situacao === 'Evasao' ? 'Em Evasão' : indicadores.situacao}
                        </Badge>
                    </div>
                </div>
            </header>

            {/* Content */}
            <main className="max-w-6xl mx-auto px-4 py-6 space-y-6">
                {/* Cards de Resumo */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {/* Frequência Ring */}
                    <Card className="bg-white border-0 shadow-sm">
                        <CardContent className="p-6 flex items-center justify-center">
                            <FrequencyRing percentage={indicadores.percentualPresenca} />
                        </CardContent>
                    </Card>

                    {/* Estatísticas */}
                    <Card className="bg-white border-0 shadow-sm">
                        <CardContent className="p-6 space-y-4">
                            <div className="flex items-center justify-between">
                                <span className="text-sm text-gray-500">Total de Chamadas</span>
                                <span className="text-lg font-bold">{indicadores.totalChamadas}</span>
                            </div>
                            <div className="flex items-center justify-between">
                                <span className="text-sm text-gray-500">Faltas (não justificadas)</span>
                                <span className="text-lg font-bold text-red-600">{indicadores.totalFaltas}</span>
                            </div>
                            <div className="flex items-center justify-between">
                                <span className="text-sm text-gray-500">Faltas Justificadas</span>
                                <span className="text-lg font-bold text-blue-600">{indicadores.faltasJustificadas}</span>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Alerta de Risco */}
                    <Card className={`border-0 shadow-sm ${indicadores.situacao === 'Evasao' ? 'bg-red-50' :
                            indicadores.situacao === 'Risco' ? 'bg-yellow-50' : 'bg-green-50'
                        }`}>
                        <CardContent className="p-6">
                            <div className="flex items-center gap-3 mb-3">
                                {indicadores.situacao === 'Evasao' ? (
                                    <TrendingDown className="h-6 w-6 text-red-600" />
                                ) : indicadores.situacao === 'Risco' ? (
                                    <AlertTriangle className="h-6 w-6 text-yellow-600" />
                                ) : (
                                    <TrendingUp className="h-6 w-6 text-green-600" />
                                )}
                                <span className="font-semibold">
                                    {indicadores.situacao === 'Evasao' ? 'Atenção Urgente!' :
                                        indicadores.situacao === 'Risco' ? 'Atenção Necessária' : 'Situação Regular'}
                                </span>
                            </div>
                            <p className="text-sm text-gray-600">
                                {indicadores.faltasConsecutivas > 0 ? (
                                    <>Faltas consecutivas: <strong>{indicadores.faltasConsecutivas}</strong></>
                                ) : (
                                    'Nenhuma falta consecutiva recente.'
                                )}
                            </p>
                        </CardContent>
                    </Card>
                </div>

                {/* Tabs */}
                <Tabs value={activeTab} onValueChange={setActiveTab}>
                    <TabsList className="grid w-full grid-cols-3 md:grid-cols-6 h-auto">
                        <TabsTrigger value="dados" className="py-2 text-xs md:text-sm">
                            <User className="h-4 w-4 mr-1 hidden md:inline" />
                            Dados
                        </TabsTrigger>
                        <TabsTrigger value="frequencia" className="py-2 text-xs md:text-sm">
                            <Calendar className="h-4 w-4 mr-1 hidden md:inline" />
                            Frequência
                        </TabsTrigger>
                        <TabsTrigger value="boletim" className="py-2 text-xs md:text-sm">
                            <GraduationCap className="h-4 w-4 mr-1 hidden md:inline" />
                            Boletim
                        </TabsTrigger>
                        <TabsTrigger value="observacoes" className="py-2 text-xs md:text-sm">
                            <MessageSquare className="h-4 w-4 mr-1 hidden md:inline" />
                            Observações
                        </TabsTrigger>
                        <TabsTrigger value="buscaativa" className="py-2 text-xs md:text-sm">
                            <PhoneCall className="h-4 w-4 mr-1 hidden md:inline" />
                            Busca Ativa
                        </TabsTrigger>
                        <TabsTrigger value="transferencias" className="py-2 text-xs md:text-sm">
                            <RefreshCw className="h-4 w-4 mr-1 hidden md:inline" />
                            Transf.
                        </TabsTrigger>
                    </TabsList>

                    {/* Tab: Dados Pessoais */}
                    <TabsContent value="dados">
                        <Card className="border-0 shadow-sm">
                            <CardHeader>
                                <CardTitle>Dados Pessoais</CardTitle>
                                <CardDescription>Informações cadastrais do aluno</CardDescription>
                            </CardHeader>
                            <CardContent className="grid gap-4 md:grid-cols-2">
                                <div className="space-y-1">
                                    <p className="text-xs text-gray-500 uppercase font-medium">Nome Completo</p>
                                    <p className="font-medium">{dadosPessoais.nome}</p>
                                </div>
                                <div className="space-y-1">
                                    <p className="text-xs text-gray-500 uppercase font-medium">Matrícula</p>
                                    <p className="font-mono">{dadosPessoais.matricula}</p>
                                </div>
                                <div className="space-y-1">
                                    <p className="text-xs text-gray-500 uppercase font-medium">Turma</p>
                                    <p>{dadosPessoais.turmaNome}</p>
                                </div>
                                <div className="space-y-1">
                                    <p className="text-xs text-gray-500 uppercase font-medium">Escola</p>
                                    <p>{dadosPessoais.escolaNome}</p>
                                </div>
                                <div className="space-y-1">
                                    <p className="text-xs text-gray-500 uppercase font-medium flex items-center gap-1">
                                        <User className="h-3 w-3" /> Responsável
                                    </p>
                                    <p>{dadosPessoais.nomeResponsavel || <span className="text-gray-400 italic">Não informado</span>}</p>
                                </div>
                                <div className="space-y-1">
                                    <p className="text-xs text-gray-500 uppercase font-medium flex items-center gap-1">
                                        <Phone className="h-3 w-3" /> Telefone
                                    </p>
                                    <p>{dadosPessoais.telefoneResponsavel || <span className="text-gray-400 italic">Não informado</span>}</p>
                                </div>
                                <div className="space-y-1 md:col-span-2">
                                    <p className="text-xs text-gray-500 uppercase font-medium flex items-center gap-1">
                                        <MapPin className="h-3 w-3" /> Endereço
                                    </p>
                                    <p>{dadosPessoais.endereco || <span className="text-gray-400 italic">Não informado</span>}</p>
                                </div>
                                {dadosPessoais.dadosAtualizadosEm && (
                                    <div className="md:col-span-2 text-xs text-gray-400">
                                        Última atualização: {formatDate(dadosPessoais.dadosAtualizadosEm)}
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    </TabsContent>

                    {/* Tab: Frequência */}
                    <TabsContent value="frequencia">
                        <Card className="border-0 shadow-sm">
                            <CardHeader>
                                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                                    <div>
                                        <CardTitle>Histórico de Frequência</CardTitle>
                                        <CardDescription>Registro de presenças e faltas</CardDescription>
                                    </div>
                                    <Select value={mesSelecionado} onValueChange={setMesSelecionado}>
                                        <SelectTrigger className="w-full md:w-[200px]">
                                            <SelectValue placeholder="Filtrar por mês" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="todos">Todos os meses</SelectItem>
                                            {mesesDisponiveis.map(mes => (
                                                <SelectItem key={mes.value} value={mes.value}>{mes.label}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                            </CardHeader>
                            <CardContent>
                                <ScrollArea className="h-[400px]">
                                    <div className="space-y-2">
                                        {historico.length > 0 ? (
                                            historico.map((item, index) => (
                                                <div
                                                    key={index}
                                                    className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                                                >
                                                    <span className="text-sm font-medium">{formatDateFull(item.data)}</span>
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
                                            <p className="text-center text-gray-500 py-8">
                                                Nenhum registro de frequência para o período selecionado.
                                            </p>
                                        )}
                                    </div>
                                </ScrollArea>
                            </CardContent>
                        </Card>
                    </TabsContent>

                    {/* Tab: Boletim */}
                    <TabsContent value="boletim">
                        <Card className="border-0 shadow-sm">
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    <BookOpen className="h-5 w-5" />
                                    Boletim Escolar
                                </CardTitle>
                                <CardDescription>Notas por disciplina e semestre</CardDescription>
                            </CardHeader>
                            <CardContent>
                                {boletim.length > 0 ? (
                                    <div className="space-y-4">
                                        {boletim.map(disciplina => (
                                            <div
                                                key={disciplina.disciplinaId}
                                                className="border rounded-lg overflow-hidden"
                                            >
                                                <div
                                                    className="p-3 flex items-center justify-between"
                                                    style={{ backgroundColor: disciplina.disciplinaCor + '20' }}
                                                >
                                                    <span className="font-semibold">{disciplina.disciplinaNome}</span>
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-lg font-bold">
                                                            Média: {disciplina.media.toFixed(1)}
                                                        </span>
                                                        <Badge className={`${disciplina.situacao === 'Aprovado' ? 'bg-green-100 text-green-800' :
                                                                disciplina.situacao === 'Reprovado' ? 'bg-red-100 text-red-800' :
                                                                    'bg-gray-100 text-gray-800'
                                                            }`}>
                                                            {disciplina.situacao}
                                                        </Badge>
                                                    </div>
                                                </div>
                                                <div className="p-3 grid grid-cols-3 gap-2 bg-white">
                                                    {disciplina.notas.map((nota, idx) => (
                                                        <div key={idx} className="text-center p-2 bg-gray-50 rounded">
                                                            <p className="text-xs text-gray-500">{nota.semestre}º Semestre</p>
                                                            <p className="text-lg font-bold">{nota.valor.toFixed(1)}</p>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <p className="text-center text-gray-500 py-8">
                                        Nenhuma nota registrada para este aluno.
                                    </p>
                                )}
                            </CardContent>
                        </Card>
                    </TabsContent>

                    {/* Tab: Observações */}
                    <TabsContent value="observacoes">
                        <Card className="border-0 shadow-sm">
                            <CardHeader>
                                <div className="flex items-center justify-between">
                                    <div>
                                        <CardTitle>Observações Pedagógicas</CardTitle>
                                        <CardDescription>Registros sobre o aluno</CardDescription>
                                    </div>
                                    <Dialog open={showObservacaoDialog} onOpenChange={setShowObservacaoDialog}>
                                        <DialogTrigger asChild>
                                            <Button size="sm">
                                                <Plus className="h-4 w-4 mr-1" /> Nova
                                            </Button>
                                        </DialogTrigger>
                                        <DialogContent>
                                            <DialogHeader>
                                                <DialogTitle>Nova Observação</DialogTitle>
                                                <DialogDescription>Adicione uma observação sobre o aluno.</DialogDescription>
                                            </DialogHeader>
                                            <div className="space-y-4 py-4">
                                                <div className="space-y-2">
                                                    <Label>Título</Label>
                                                    <Input
                                                        value={novaObservacaoTitulo}
                                                        onChange={e => setNovaObservacaoTitulo(e.target.value)}
                                                        placeholder="Ex: Reunião com responsável"
                                                    />
                                                </div>
                                                <div className="space-y-2">
                                                    <Label>Descrição</Label>
                                                    <Textarea
                                                        value={novaObservacaoDescricao}
                                                        onChange={e => setNovaObservacaoDescricao(e.target.value)}
                                                        placeholder="Descreva a observação..."
                                                        rows={4}
                                                    />
                                                </div>
                                            </div>
                                            <DialogFooter>
                                                <Button variant="outline" onClick={() => setShowObservacaoDialog(false)}>
                                                    Cancelar
                                                </Button>
                                                <Button onClick={handleSalvarObservacao} disabled={salvandoObservacao}>
                                                    {salvandoObservacao ? 'Salvando...' : 'Salvar'}
                                                </Button>
                                            </DialogFooter>
                                        </DialogContent>
                                    </Dialog>
                                </div>
                            </CardHeader>
                            <CardContent>
                                {observacoes.length > 0 ? (
                                    <div className="space-y-3">
                                        {observacoes.map(obs => (
                                            <div key={obs.id} className="p-4 bg-gray-50 rounded-lg">
                                                <div className="flex items-start justify-between mb-2">
                                                    <h4 className="font-semibold">{obs.titulo}</h4>
                                                    <span className="text-xs text-gray-500">{formatDate(obs.dataObservacao)}</span>
                                                </div>
                                                <p className="text-sm text-gray-600">{obs.descricao}</p>
                                                {obs.turmaNome && (
                                                    <p className="text-xs text-gray-400 mt-2">Turma: {obs.turmaNome}</p>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <p className="text-center text-gray-500 py-8">
                                        Nenhuma observação registrada para este aluno.
                                    </p>
                                )}
                            </CardContent>
                        </Card>
                    </TabsContent>

                    {/* Tab: Busca Ativa */}
                    <TabsContent value="buscaativa">
                        <Card className="border-0 shadow-sm">
                            <CardHeader>
                                <CardTitle>Contatos - Busca Ativa</CardTitle>
                                <CardDescription>Histórico de tentativas de contato com o responsável</CardDescription>
                            </CardHeader>
                            <CardContent>
                                {contatosBuscaAtiva.length > 0 ? (
                                    <div className="space-y-3">
                                        {contatosBuscaAtiva.map(contato => (
                                            <div key={contato.id} className="p-4 bg-gray-50 rounded-lg">
                                                <div className="flex items-start justify-between mb-2">
                                                    <div className="flex items-center gap-2">
                                                        <Badge variant="outline">{contato.formaContato}</Badge>
                                                        <span className="text-sm font-medium">{formatDate(contato.dataContato)}</span>
                                                    </div>
                                                </div>
                                                <p className="text-sm text-gray-600 mb-2">{contato.justificativaFaltas}</p>
                                                <p className="text-xs text-gray-500">Monitor: {contato.monitorResponsavel}</p>
                                                {contato.linkArquivo && (
                                                    <a
                                                        href={contato.linkArquivo}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="text-xs text-blue-600 hover:underline mt-1 inline-block"
                                                    >
                                                        Ver arquivo anexo
                                                    </a>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <p className="text-center text-gray-500 py-8">
                                        Nenhum contato de busca ativa registrado.
                                    </p>
                                )}
                            </CardContent>
                        </Card>
                    </TabsContent>

                    {/* Tab: Transferências */}
                    <TabsContent value="transferencias">
                        <Card className="border-0 shadow-sm">
                            <CardHeader>
                                <CardTitle>Histórico de Transferências</CardTitle>
                                <CardDescription>Movimentações entre turmas</CardDescription>
                            </CardHeader>
                            <CardContent>
                                {transferencias.length > 0 ? (
                                    <div className="space-y-3">
                                        {transferencias.map(trans => (
                                            <div key={trans.id} className="p-4 bg-gray-50 rounded-lg">
                                                <div className="flex items-center gap-2 mb-2">
                                                    <RefreshCw className="h-4 w-4 text-gray-500" />
                                                    <span className="text-sm font-medium">{formatDate(trans.dataTransferencia)}</span>
                                                </div>
                                                <div className="flex items-center gap-2 text-sm">
                                                    <span className="text-gray-500">De:</span>
                                                    <Badge variant="outline">{trans.turmaOrigemNome}</Badge>
                                                    <span className="text-gray-400">→</span>
                                                    <span className="text-gray-500">Para:</span>
                                                    <Badge variant="outline">{trans.turmaDestinoNome}</Badge>
                                                </div>
                                                {trans.motivo && (
                                                    <p className="text-xs text-gray-500 mt-2">Motivo: {trans.motivo}</p>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <p className="text-center text-gray-500 py-8">
                                        Nenhuma transferência registrada para este aluno.
                                    </p>
                                )}
                            </CardContent>
                        </Card>
                    </TabsContent>
                </Tabs>
            </main>
        </div>
    );
}
