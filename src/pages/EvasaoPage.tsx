/**
 * EvasãoPage — Análise de Risco de Evasão Escolar
 * 
 * Dashboard com score de risco local + análise por IA (Groq/Gemini).
 * Features:
 * - Cards resumo (total em risco, distribuição por nível)
 * - Lista de alunos ordenada por score de risco
 * - Filtros por turma e nível
 * - Painel de análise por IA com recomendações
 * - Controle de limite diário de análises
 */

import React, { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useEscolaConfig } from '@/contexts/EscolaConfigContext';
import { calcularDistanciaKm } from '@/lib/geocoding.service';
import {
    calcularScoreRisco,
    analisarComIA,
    verificarLimiteDiario,
    buscarUltimaAnalise,
    DadosAluno,
    ResultadoAnalise,
    FatorRisco,
    RegistroBuscaAtiva,
} from '@/lib/ai.service';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Progress } from '@/components/ui/progress';
import { ControlledPagination } from '@/components/ui/controlled-pagination';
import {
    ShieldAlert,
    Users,
    AlertTriangle,
    TrendingUp,
    TrendingDown,
    Sparkles,
    Loader2,
    X,
    ChevronRight,
    Briefcase,
    Home,
    HandCoins,
    MapPin,
    Bus,
    XCircle,
    Search,
    Zap,
    Brain,
    BarChart3,
    RefreshCw,
    Clock,
    CheckCircle2,
    Phone,
    MessageSquare,
    Mail,
    Video,
    ClipboardList,
} from 'lucide-react';

// ============================================
// TYPES
// ============================================

interface AlunoComScore extends DadosAluno {
    resultado: ResultadoAnalise;
    ultimaAnalise?: {
        recomendacao_ia: string;
        modelo_utilizado: string;
        created_at: string;
    } | null;
}

interface TurmaOption {
    id: string;
    nome: string;
}

interface EvasaoRpcItem {
    id: string;
    nome: string;
    turma_id: string | null;
    turma_nome: string | null;
    data_nascimento: string | null;
    endereco: string | null;
    latitude: number | null;
    longitude: number | null;
    trabalha: boolean;
    recebe_pe_de_meia: boolean;
    recebe_bolsa_familia: boolean;
    mora_com_familia: boolean;
    usa_transporte: boolean;
    tem_passe_livre: boolean;
    total_chamadas: number;
    total_presencas: number;
    faltas: number;
    frequencia: number;
    distancia_km: number | null;
    score: number;
    nivel: 'verde' | 'amarelo' | 'vermelho';
}

interface EvasaoRpcResponse {
    items: EvasaoRpcItem[];
    pagination: {
        page: number;
        page_size: number;
        total: number;
        total_pages: number;
    };
    summary: {
        total: number;
        verdes: number;
        amarelos: number;
        vermelhos: number;
        score_media: number;
    };
}

// ============================================
// ICON MAP for FatorRisco
// ============================================
const ICON_MAP: Record<string, React.ReactNode> = {
    AlertTriangle: <AlertTriangle className="h-3.5 w-3.5" />,
    XCircle: <XCircle className="h-3.5 w-3.5" />,
    Briefcase: <Briefcase className="h-3.5 w-3.5" />,
    Home: <Home className="h-3.5 w-3.5" />,
    HandCoins: <HandCoins className="h-3.5 w-3.5" />,
    MapPin: <MapPin className="h-3.5 w-3.5" />,
    Bus: <Bus className="h-3.5 w-3.5" />,
};

const NIVEL_CONFIG = {
    verde: { label: 'Baixo Risco', color: 'bg-green-100 text-green-700', barColor: 'bg-green-500' },
    amarelo: { label: 'Atenção', color: 'bg-amber-100 text-amber-700', barColor: 'bg-amber-500' },
    vermelho: { label: 'Alto Risco', color: 'bg-red-100 text-red-700', barColor: 'bg-red-500' },
};

// ============================================
// MAIN COMPONENT
// ============================================

export default function EvasaoPage() {
    const { user } = useAuth();
    const { config } = useEscolaConfig();

    const [alunos, setAlunos] = useState<AlunoComScore[]>([]);
    const [turmas, setTurmas] = useState<TurmaOption[]>([]);
    const [loading, setLoading] = useState(true);
    const [loadingPage, setLoadingPage] = useState(false);

    const [turmaFiltro, setTurmaFiltro] = useState<string>('todas');
    const [nivelFiltro, setNivelFiltro] = useState<string>('todos');
    const [busca, setBusca] = useState('');
    const [buscaDebounced, setBuscaDebounced] = useState('');
    const [currentPage, setCurrentPage] = useState(1);
    const [pageSize] = useState(20);
    const [totalItems, setTotalItems] = useState(0);
    const [totalPages, setTotalPages] = useState(1);
    const [stats, setStats] = useState({
        total: 0,
        verdes: 0,
        amarelos: 0,
        vermelhos: 0,
        scoreMedia: 0,
    });

    // AI state
    const [limiteIA, setLimiteIA] = useState({ permitido: false, restante: 0, limite: 0 });
    const [alunoSelecionado, setAlunoSelecionado] = useState<AlunoComScore | null>(null);
    const [analisando, setAnalisando] = useState(false);
    const [resultadoIA, setResultadoIA] = useState<ResultadoAnalise | null>(null);

    // Busca Ativa state
    const [registrosBuscaAtiva, setRegistrosBuscaAtiva] = useState<RegistroBuscaAtiva[]>([]);
    const [loadingBuscaAtiva, setLoadingBuscaAtiva] = useState(false);

    const escolaLat = config?.latitude ?? null;
    const escolaLng = config?.longitude ?? null;
    // -------------------------------------------------------
    // Debounce da busca (evita query a cada tecla)
    // -------------------------------------------------------
    useEffect(() => {
        const timer = setTimeout(() => setBuscaDebounced(busca.trim()), 350);
        return () => clearTimeout(timer);
    }, [busca]);

    // -------------------------------------------------------
    // Load base data (turmas + limite de IA)
    // -------------------------------------------------------
    useEffect(() => {
        const fetchBaseData = async () => {
            if (!user?.escola_id) return;

            try {
                const { data: turmasData } = await supabase
                    .from('turmas')
                    .select('id, nome')
                    .eq('escola_id', user.escola_id)
                    .order('nome');

                setTurmas((turmasData || []) as TurmaOption[]);

                if (user?.id && user?.type) {
                    const limite = await verificarLimiteDiario(user.id, user.type);
                    setLimiteIA(limite);
                }
            } catch (err) {
                console.error('[Evasao] Erro ao carregar dados base:', err);
            }
        };

        fetchBaseData();
    }, [user?.escola_id, user?.id, user?.type]);

    // Sempre voltar para a primeira pagina ao trocar filtros/busca
    useEffect(() => {
        setCurrentPage(1);
    }, [turmaFiltro, nivelFiltro, buscaDebounced]);

    // -------------------------------------------------------
    // Load paginated data (server-side via RPC)
    // -------------------------------------------------------
    const fetchPageData = useCallback(async () => {
        if (!user?.escola_id) return;

        if (loading) setLoading(true);
        else setLoadingPage(true);

        try {
            const { data, error } = await supabase.rpc('get_evasao_paginated', {
                p_escola_id: user.escola_id,
                p_turma_id: turmaFiltro === 'todas' ? null : turmaFiltro,
                p_nivel: nivelFiltro === 'todos' ? null : nivelFiltro,
                p_busca: buscaDebounced || null,
                p_page: currentPage,
                p_page_size: pageSize,
            });

            if (error) throw error;

            const payload = data as EvasaoRpcResponse | null;
            if (!payload) {
                setAlunos([]);
                setTotalItems(0);
                setTotalPages(1);
                setStats({ total: 0, verdes: 0, amarelos: 0, vermelhos: 0, scoreMedia: 0 });
                return;
            }

            const alunosProcessados: AlunoComScore[] = (payload.items || []).map((row) => {
                const distancia = (escolaLat && escolaLng && row.latitude && row.longitude)
                    ? calcularDistanciaKm(row.latitude, row.longitude, escolaLat, escolaLng)
                    : row.distancia_km;

                const dadosAluno: DadosAluno = {
                    id: row.id,
                    nome: row.nome,
                    turma_nome: row.turma_nome || 'Sem turma',
                    frequencia: row.frequencia,
                    total_chamadas: row.total_chamadas,
                    total_presencas: row.total_presencas,
                    faltas: row.faltas,
                    trabalha: row.trabalha,
                    recebe_pe_de_meia: row.recebe_pe_de_meia,
                    recebe_bolsa_familia: row.recebe_bolsa_familia,
                    mora_com_familia: row.mora_com_familia,
                    usa_transporte: row.usa_transporte,
                    tem_passe_livre: row.tem_passe_livre,
                    distancia_km: distancia,
                    data_nascimento: row.data_nascimento,
                    endereco: row.endereco,
                };

                const resultado = calcularScoreRisco(dadosAluno);
                return { ...dadosAluno, resultado, turma_id: row.turma_id } as AlunoComScore;
            });

            setAlunos(alunosProcessados);
            setTotalItems(payload.pagination?.total || 0);
            setTotalPages(Math.max(payload.pagination?.total_pages || 1, 1));
            setStats({
                total: payload.summary?.total || 0,
                verdes: payload.summary?.verdes || 0,
                amarelos: payload.summary?.amarelos || 0,
                vermelhos: payload.summary?.vermelhos || 0,
                scoreMedia: payload.summary?.score_media || 0,
            });
        } catch (err) {
            console.error('[Evasao] Erro ao buscar pagina:', err);
            setAlunos([]);
            setTotalItems(0);
            setTotalPages(1);
        } finally {
            setLoading(false);
            setLoadingPage(false);
        }
    }, [user?.escola_id, turmaFiltro, nivelFiltro, buscaDebounced, currentPage, pageSize, escolaLat, escolaLng, loading]);

    useEffect(() => {
        fetchPageData();
    }, [fetchPageData]);

    useEffect(() => {
        if (alunoSelecionado && !alunos.some(a => a.id === alunoSelecionado.id)) {
            setAlunoSelecionado(null);
            setResultadoIA(null);
        }
    }, [alunos, alunoSelecionado]);

    // -------------------------------------------------------
    // Busca Ativa - fetch when student is selected
    // -------------------------------------------------------
    const fetchBuscaAtiva = useCallback(async (alunoId: string) => {
        setLoadingBuscaAtiva(true);
        try {
            const { data, error } = await (supabase as any)
                .from('registros_contato_busca_ativa')
                .select('data_contato, forma_contato, justificativa_faltas, monitor_responsavel')
                .eq('aluno_id', alunoId)
                .order('data_contato', { ascending: false })
                .limit(10);

            if (!error && data) {
                setRegistrosBuscaAtiva(
                    (data as any[]).map((c: any) => ({
                        dataContato: c.data_contato,
                        formaContato: c.forma_contato,
                        justificativaFaltas: c.justificativa_faltas || null,
                        monitorResponsavel: c.monitor_responsavel || null,
                    }))
                );
            } else {
                setRegistrosBuscaAtiva([]);
            }
        } catch {
            setRegistrosBuscaAtiva([]);
        } finally {
            setLoadingBuscaAtiva(false);
        }
    }, []);

    // Trigger fetch when student is selected
    useEffect(() => {
        if (alunoSelecionado) {
            fetchBuscaAtiva(alunoSelecionado.id);
        } else {
            setRegistrosBuscaAtiva([]);
        }
    }, [alunoSelecionado?.id, fetchBuscaAtiva]);

    // -------------------------------------------------------
    // AI Analysis
    // -------------------------------------------------------
    const handleAnalisar = useCallback(async (aluno: AlunoComScore) => {
        if (!user?.id || !user?.escola_id) return;
        if (!limiteIA.permitido) return;

        setAlunoSelecionado(aluno);
        setAnalisando(true);
        setResultadoIA(null);

        try {
            // Enrich with Busca Ativa data
            const alunoComBuscaAtiva: DadosAluno = {
                ...aluno,
                registrosBuscaAtiva,
            };
            const resultado = await analisarComIA(alunoComBuscaAtiva, aluno.resultado, user.id, user.escola_id);
            setResultadoIA(resultado);

            // Update limit
            const novoLimite = await verificarLimiteDiario(user.id, user.type);
            setLimiteIA(novoLimite);
        } catch (err) {
            console.error('[Evasão] AI error:', err);
            setResultadoIA({
                ...aluno.resultado,
                recomendacaoIA: 'Erro ao gerar análise. Tente novamente.',
                modeloUtilizado: 'local',
            });
        } finally {
            setAnalisando(false);
        }
    }, [user, limiteIA.permitido, registrosBuscaAtiva]);

    const handleVerAnalise = useCallback(async (aluno: AlunoComScore) => {
        setAlunoSelecionado(aluno);
        setResultadoIA(null);
        setAnalisando(true);

        try {
            const ultima = await buscarUltimaAnalise(aluno.id);
            if (ultima) {
                setResultadoIA({
                    ...aluno.resultado,
                    recomendacaoIA: ultima.recomendacao_ia,
                    modeloUtilizado: ultima.modelo_utilizado as 'groq' | 'gemini' | 'local',
                });
            }
        } catch (err) {
            console.error('[Evasão] Fetch error:', err);
        } finally {
            setAnalisando(false);
        }
    }, []);

    const fecharPainel = () => {
        setAlunoSelecionado(null);
        setResultadoIA(null);
    };

    // -------------------------------------------------------
    // RENDER
    // -------------------------------------------------------

    if (loading) {
        return (
            <div className="p-6 space-y-6">
                <Skeleton className="h-10 w-64" />
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-28" />)}
                </div>
                <Skeleton className="h-96" />
            </div>
        );
    }

    return (
        <div className="flex h-[calc(100vh-80px)]">
            {/* Main content */}
            <div className={`flex-1 overflow-auto p-6 space-y-6 transition-all ${alunoSelecionado ? 'mr-[400px]' : ''}`}>
                {/* Header */}
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="h-11 w-11 rounded-xl flex items-center justify-center bg-gradient-to-br from-red-500 to-orange-500 shadow-lg">
                            <ShieldAlert className="h-6 w-6 text-white" />
                        </div>
                        <div>
                            <h1 className="text-xl font-bold text-gray-800">Análise de Evasão</h1>
                            <p className="text-sm text-gray-500">Monitoramento de risco com inteligência artificial</p>
                        </div>
                    </div>

                    {/* AI Usage badge */}
                    {limiteIA.limite > 0 && (
                        <div className="flex items-center gap-2 bg-violet-50 border border-violet-200 rounded-lg px-3 py-2">
                            <Brain className="h-4 w-4 text-violet-600" />
                            <span className="text-sm font-medium text-violet-700">
                                {limiteIA.restante}/{limiteIA.limite} análises IA
                            </span>
                            <span className="text-xs text-violet-400">restantes hoje</span>
                        </div>
                    )}
                </div>

                {/* KPI Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    <Card className="border-l-4 border-l-gray-400">
                        <CardContent className="p-4">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-xs text-gray-500 uppercase font-medium">Total de Alunos</p>
                                    <p className="text-2xl font-bold text-gray-800 mt-1">{stats.total}</p>
                                </div>
                                <Users className="h-8 w-8 text-gray-300" />
                            </div>
                            <p className="text-xs text-gray-400 mt-2">Score médio: {stats.scoreMedia}/100</p>
                        </CardContent>
                    </Card>

                    <Card className="border-l-4 border-l-red-500">
                        <CardContent className="p-4">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-xs text-red-500 uppercase font-medium">Alto Risco</p>
                                    <p className="text-2xl font-bold text-red-600 mt-1">{stats.vermelhos}</p>
                                </div>
                                <AlertTriangle className="h-8 w-8 text-red-200" />
                            </div>
                            <p className="text-xs text-gray-400 mt-2">Score ≥ 60 — ação urgente</p>
                        </CardContent>
                    </Card>

                    <Card className="border-l-4 border-l-amber-500">
                        <CardContent className="p-4">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-xs text-amber-500 uppercase font-medium">Atenção</p>
                                    <p className="text-2xl font-bold text-amber-600 mt-1">{stats.amarelos}</p>
                                </div>
                                <TrendingDown className="h-8 w-8 text-amber-200" />
                            </div>
                            <p className="text-xs text-gray-400 mt-2">Score 30-59 — monitorar</p>
                        </CardContent>
                    </Card>

                    <Card className="border-l-4 border-l-green-500">
                        <CardContent className="p-4">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-xs text-green-500 uppercase font-medium">Baixo Risco</p>
                                    <p className="text-2xl font-bold text-green-600 mt-1">{stats.verdes}</p>
                                </div>
                                <TrendingUp className="h-8 w-8 text-green-200" />
                            </div>
                            <p className="text-xs text-gray-400 mt-2">Score &lt; 30 — estável</p>
                        </CardContent>
                    </Card>
                </div>

                {/* Filters */}
                <div className="flex flex-wrap items-center gap-3 bg-white rounded-lg border p-3 shadow-sm">
                    <div className="relative flex-1 min-w-[200px] max-w-sm">
                        <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                        <input
                            type="text"
                            placeholder="Buscar aluno..."
                            value={busca}
                            onChange={e => setBusca(e.target.value)}
                            className="w-full pl-9 pr-3 py-2 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-violet-500"
                        />
                    </div>

                    <Select value={turmaFiltro} onValueChange={setTurmaFiltro}>
                        <SelectTrigger className="w-[180px] h-9 text-sm">
                            <SelectValue placeholder="Turma" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="todas">Todas as turmas</SelectItem>
                            {turmas.map(t => (
                                <SelectItem key={t.id} value={t.id}>{t.nome}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>

                    <Select value={nivelFiltro} onValueChange={setNivelFiltro}>
                        <SelectTrigger className="w-[180px] h-9 text-sm">
                            <SelectValue placeholder="Nível de risco" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="todos">Todos os níveis</SelectItem>
                            <SelectItem value="vermelho">Alto Risco (60+)</SelectItem>
                            <SelectItem value="amarelo">Atenção (30-59)</SelectItem>
                            <SelectItem value="verde">Baixo Risco (0-29)</SelectItem>
                        </SelectContent>
                    </Select>

                    <Badge variant="outline" className="ml-auto text-xs">
                        {totalItems} aluno(s)
                    </Badge>
                </div>

                {/* Students List */}
                <div className="space-y-2">
                    {loadingPage && (
                        <Card>
                            <CardContent className="p-4 flex items-center gap-2 text-sm text-gray-500">
                                <Loader2 className="h-4 w-4 animate-spin" />
                                Atualizando lista...
                            </CardContent>
                        </Card>
                    )}

                    {alunos.length === 0 ? (
                        <Card>
                            <CardContent className="p-10 text-center">
                                <ShieldAlert className="h-12 w-12 text-gray-200 mx-auto mb-3" />
                                <h3 className="font-semibold text-gray-600">Nenhum aluno encontrado</h3>
                                <p className="text-sm text-gray-400 mt-1">Ajuste os filtros para ver os resultados.</p>
                            </CardContent>
                        </Card>
                    ) : (
                        alunos.map((aluno, index) => {
                            const nConf = NIVEL_CONFIG[aluno.resultado.nivel];
                            const isSelected = alunoSelecionado?.id === aluno.id;

                            return (
                                <Card
                                    key={aluno.id}
                                    className={`cursor-pointer transition-all hover:shadow-md ${isSelected ? 'ring-2 ring-violet-500 shadow-md' : ''}`}
                                    onClick={() => {
                                        setAlunoSelecionado(aluno);
                                        setResultadoIA(null);
                                    }}
                                >
                                    <CardContent className="p-4">
                                        <div className="flex items-center gap-4">
                                            {/* Rank number */}
                                            <div className="flex-shrink-0 w-8 text-center">
                                                <span className={`text-sm font-bold ${aluno.resultado.nivel === 'vermelho' ? 'text-red-500' : aluno.resultado.nivel === 'amarelo' ? 'text-amber-500' : 'text-gray-400'}`}>
                                                    #{((currentPage - 1) * pageSize) + index + 1}
                                                </span>
                                            </div>

                                            {/* Score circle */}
                                            <div className={`w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0 ${aluno.resultado.nivel === 'vermelho' ? 'bg-red-100' :
                                                aluno.resultado.nivel === 'amarelo' ? 'bg-amber-100' : 'bg-green-100'
                                                }`}>
                                                <span className={`text-sm font-bold ${aluno.resultado.nivel === 'vermelho' ? 'text-red-600' :
                                                    aluno.resultado.nivel === 'amarelo' ? 'text-amber-600' : 'text-green-600'
                                                    }`}>
                                                    {aluno.resultado.score}
                                                </span>
                                            </div>

                                            {/* Info */}
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-2">
                                                    <h3 className="font-semibold text-gray-800 truncate">{aluno.nome}</h3>
                                                    <Badge className={`text-[10px] ${nConf.color}`}>{nConf.label}</Badge>
                                                </div>
                                                <div className="flex items-center gap-4 mt-1 text-xs text-gray-500">
                                                    <span>{aluno.turma_nome}</span>
                                                    <span>Freq: {aluno.frequencia}%</span>
                                                    <span>{aluno.faltas} falta(s)</span>
                                                    {aluno.resultado.fatores.length > 0 && (
                                                        <span className="text-amber-600">{aluno.resultado.fatores.length} fator(es)</span>
                                                    )}
                                                </div>
                                            </div>

                                            {/* Score bar */}
                                            <div className="w-24 flex-shrink-0 hidden sm:block">
                                                <div className="w-full bg-gray-100 rounded-full h-2">
                                                    <div
                                                        className={`h-2 rounded-full transition-all ${nConf.barColor}`}
                                                        style={{ width: `${aluno.resultado.score}%` }}
                                                    />
                                                </div>
                                            </div>

                                            {/* Actions */}
                                            <div className="flex items-center gap-1 flex-shrink-0">
                                                {limiteIA.permitido && (
                                                    <Button
                                                        size="sm"
                                                        variant="ghost"
                                                        className="text-violet-600 hover:bg-violet-50 h-8 px-2"
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            handleAnalisar(aluno);
                                                        }}
                                                        title="Analisar com IA"
                                                    >
                                                        <Sparkles className="h-4 w-4" />
                                                    </Button>
                                                )}
                                                <ChevronRight className="h-4 w-4 text-gray-300" />
                                            </div>
                                        </div>
                                    </CardContent>
                                </Card>
                            );
                        })
                    )}
                </div>

                <ControlledPagination
                    totalItems={totalItems}
                    itemsPerPage={pageSize}
                    currentPage={currentPage}
                    onPageChange={setCurrentPage}
                />
            </div>

            {/* Right panel — Student details & AI analysis */}
            {alunoSelecionado && (
                <div className="fixed right-0 top-0 h-full w-[400px] bg-white border-l shadow-xl z-40 overflow-auto animate-in slide-in-from-right">
                    {/* Panel header */}
                    <div className="sticky top-0 bg-white border-b p-4 z-10">
                        <div className="flex items-center justify-between">
                            <h2 className="font-bold text-gray-800 truncate pr-2">{alunoSelecionado.nome}</h2>
                            <button onClick={fecharPainel} className="p-1.5 hover:bg-gray-100 rounded-lg">
                                <X className="h-5 w-5 text-gray-400" />
                            </button>
                        </div>
                        <p className="text-xs text-gray-500 mt-0.5">{alunoSelecionado.turma_nome}</p>
                    </div>

                    <div className="p-4 space-y-4">
                        {/* Score card */}
                        <div className={`rounded-xl p-4 ${alunoSelecionado.resultado.nivel === 'vermelho' ? 'bg-gradient-to-br from-red-50 to-red-100' :
                            alunoSelecionado.resultado.nivel === 'amarelo' ? 'bg-gradient-to-br from-amber-50 to-amber-100' :
                                'bg-gradient-to-br from-green-50 to-green-100'
                            }`}>
                            <div className="flex items-center justify-between mb-3">
                                <span className="text-xs font-medium text-gray-500 uppercase">Score de Risco</span>
                                <Badge className={NIVEL_CONFIG[alunoSelecionado.resultado.nivel].color}>
                                    {NIVEL_CONFIG[alunoSelecionado.resultado.nivel].label}
                                </Badge>
                            </div>
                            <div className="flex items-end gap-2 mb-2">
                                <span className={`text-4xl font-bold ${alunoSelecionado.resultado.nivel === 'vermelho' ? 'text-red-600' :
                                    alunoSelecionado.resultado.nivel === 'amarelo' ? 'text-amber-600' : 'text-green-600'
                                    }`}>
                                    {alunoSelecionado.resultado.score}
                                </span>
                                <span className="text-gray-400 text-sm mb-1">/ 100</span>
                            </div>
                            <Progress
                                value={alunoSelecionado.resultado.score}
                                className="h-2 bg-white/50"
                            />
                        </div>

                        {/* Quick stats */}
                        <div className="grid grid-cols-3 gap-2">
                            <div className="bg-gray-50 rounded-lg p-3 text-center">
                                <p className="text-lg font-bold text-gray-800">{alunoSelecionado.frequencia}%</p>
                                <p className="text-[10px] text-gray-500 uppercase">Frequência</p>
                            </div>
                            <div className="bg-gray-50 rounded-lg p-3 text-center">
                                <p className="text-lg font-bold text-gray-800">{alunoSelecionado.faltas}</p>
                                <p className="text-[10px] text-gray-500 uppercase">Faltas</p>
                            </div>
                            <div className="bg-gray-50 rounded-lg p-3 text-center">
                                <p className="text-lg font-bold text-gray-800">
                                    {alunoSelecionado.distancia_km ?? '—'}
                                </p>
                                <p className="text-[10px] text-gray-500 uppercase">km</p>
                            </div>
                        </div>

                        {/* Risk factors */}
                        {alunoSelecionado.resultado.fatores.length > 0 && (
                            <div>
                                <h3 className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-1.5">
                                    <BarChart3 className="h-4 w-4 text-gray-400" />
                                    Fatores de Risco
                                </h3>
                                <div className="space-y-2">
                                    {alunoSelecionado.resultado.fatores.map((f, i) => (
                                        <div key={i} className="flex items-start gap-2 p-2 rounded-lg bg-gray-50 border">
                                            <div className={`mt-0.5 ${f.peso >= 15 ? 'text-red-500' :
                                                f.peso >= 10 ? 'text-amber-500' : 'text-gray-400'
                                                }`}>
                                                {ICON_MAP[f.icone] || <AlertTriangle className="h-3.5 w-3.5" />}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center justify-between">
                                                    <span className="text-xs font-medium text-gray-700">{f.fator}</span>
                                                    <Badge variant="outline" className="text-[10px] h-4">+{f.peso}</Badge>
                                                </div>
                                                <p className="text-[11px] text-gray-500 mt-0.5">{f.descricao}</p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {alunoSelecionado.resultado.fatores.length === 0 && (
                            <div className="text-center py-4">
                                <CheckCircle2 className="h-8 w-8 text-green-300 mx-auto mb-2" />
                                <p className="text-sm text-gray-500">Nenhum fator de risco detectado</p>
                            </div>
                        )}

                        {/* Busca Ativa section */}
                        <div className="border-t pt-4">
                            <h3 className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-1.5">
                                <ClipboardList className="h-4 w-4 text-blue-500" />
                                Busca Ativa
                                {registrosBuscaAtiva.length > 0 && (
                                    <Badge variant="outline" className="text-[10px] h-4 ml-1">
                                        {registrosBuscaAtiva.length} contato(s)
                                    </Badge>
                                )}
                            </h3>

                            {loadingBuscaAtiva && (
                                <div className="flex items-center gap-2 py-3 text-xs text-gray-400">
                                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                    Carregando registros...
                                </div>
                            )}

                            {!loadingBuscaAtiva && registrosBuscaAtiva.length === 0 && (
                                <div className="bg-gray-50 rounded-lg p-3 text-center">
                                    <Phone className="h-6 w-6 text-gray-300 mx-auto mb-1" />
                                    <p className="text-xs text-gray-400">Nenhum registro de busca ativa</p>
                                </div>
                            )}

                            {!loadingBuscaAtiva && registrosBuscaAtiva.length > 0 && (
                                <div className="space-y-2 max-h-[200px] overflow-auto pr-1">
                                    {registrosBuscaAtiva.map((reg, i) => {
                                        const iconeContato = {
                                            telefone: <Phone className="h-3.5 w-3.5" />,
                                            whatsapp: <MessageSquare className="h-3.5 w-3.5" />,
                                            email: <Mail className="h-3.5 w-3.5" />,
                                            visita: <Users className="h-3.5 w-3.5" />,
                                            videochamada: <Video className="h-3.5 w-3.5" />,
                                        }[reg.formaContato] || <Phone className="h-3.5 w-3.5" />;

                                        return (
                                            <div key={i} className="p-2.5 rounded-lg bg-blue-50 border border-blue-100">
                                                <div className="flex items-center gap-2 mb-1">
                                                    <span className="text-blue-500">{iconeContato}</span>
                                                    <span className="text-xs font-medium text-gray-700 capitalize">
                                                        {reg.formaContato}
                                                    </span>
                                                    <span className="text-[10px] text-gray-400 ml-auto">
                                                        {reg.dataContato}
                                                    </span>
                                                </div>
                                                {reg.justificativaFaltas && (
                                                    <p className="text-[11px] text-gray-600 mt-1 leading-relaxed">
                                                        "{reg.justificativaFaltas}"
                                                    </p>
                                                )}
                                                {reg.monitorResponsavel && (
                                                    <p className="text-[10px] text-gray-400 mt-1">
                                                        Monitor: {reg.monitorResponsavel}
                                                    </p>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>

                        {/* AI Analysis section */}
                        <div className="border-t pt-4">
                            <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-1.5">
                                <Brain className="h-4 w-4 text-violet-500" />
                                Análise por IA
                            </h3>

                            {analisando && (
                                <div className="flex items-center justify-center gap-2 py-8">
                                    <Loader2 className="h-5 w-5 animate-spin text-violet-600" />
                                    <span className="text-sm text-violet-600">Analisando com IA...</span>
                                </div>
                            )}

                            {!analisando && !resultadoIA && (
                                <div className="space-y-3">
                                    {limiteIA.permitido ? (
                                        <Button
                                            className="w-full bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 text-white"
                                            onClick={() => handleAnalisar(alunoSelecionado)}
                                        >
                                            <Sparkles className="h-4 w-4 mr-2" />
                                            Analisar com IA
                                        </Button>
                                    ) : limiteIA.limite === 0 ? (
                                        <div className="bg-gray-50 rounded-lg p-3 text-center text-xs text-gray-500">
                                            Análise por IA não disponível para o seu perfil
                                        </div>
                                    ) : (
                                        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-center text-xs text-amber-700">
                                            <Zap className="h-4 w-4 mx-auto mb-1" />
                                            Limite diário atingido ({limiteIA.limite} análises)
                                        </div>
                                    )}

                                    <Button
                                        variant="outline"
                                        size="sm"
                                        className="w-full text-xs"
                                        onClick={() => handleVerAnalise(alunoSelecionado)}
                                    >
                                        <Clock className="h-3.5 w-3.5 mr-1.5" />
                                        Ver última análise salva
                                    </Button>
                                </div>
                            )}

                            {!analisando && resultadoIA?.recomendacaoIA && (
                                <div className="space-y-3">
                                    <div className="bg-violet-50 border border-violet-200 rounded-lg p-4">
                                        <div className="prose prose-sm max-w-none">
                                            <div className="text-sm text-gray-700 whitespace-pre-line leading-relaxed">
                                                {resultadoIA.recomendacaoIA}
                                            </div>
                                        </div>
                                    </div>

                                    <div className="flex items-center justify-between text-[10px] text-gray-400">
                                        <span className="flex items-center gap-1">
                                            <Zap className="h-3 w-3" />
                                            Modelo: {resultadoIA.modeloUtilizado === 'groq' ? 'Groq (Llama)' : resultadoIA.modeloUtilizado === 'gemini' ? 'Gemini' : 'Local'}
                                        </span>
                                    </div>

                                    {limiteIA.permitido && (
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            className="w-full text-xs"
                                            onClick={() => handleAnalisar(alunoSelecionado)}
                                        >
                                            <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
                                            Re-analisar
                                        </Button>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

