/**
 * useDashboardGestor Hook
 * 
 * Encapsulates all data fetching and filtering logic for the management dashboard.
 * Uses React Query pattern with memoized filtering.
 */
import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import {
    gestorService,
    type KpiData,
    type KpiAdminData,
    type TurmaComparisonData,
    type AlunoRiscoData,
    type AlunoFaltasConsecutivasData,
    type UltimaObservacaoData,
    type TurmaMetadata,
    type FrequenciaDisciplinaData,
    type FaltasDiaSemanaData
} from '@/domains';

const ITEMS_PER_PAGE = 5;

// Interface para anos letivos disponíveis
interface AnoLetivoOption {
    id: string;
    ano: number;
    nome: string;
    status: string;
}

interface UseDashboardGestorReturn {
    // Data
    kpis: KpiData | null;
    kpisAdmin: KpiAdminData | null;
    ultimasObservacoes: UltimaObservacaoData[];
    frequenciaDisciplina: FrequenciaDisciplinaData[];

    // Filtered data
    filteredTurmaData: TurmaComparisonData[];
    filteredAlunosRisco: AlunoRiscoData[];
    filteredAlunosConsecutivos: AlunoFaltasConsecutivasData[];
    chartAusenciasSemana: FaltasDiaSemanaData[];

    // Pagination
    paginatedRisco: AlunoRiscoData[];
    paginatedConsecutivos: AlunoFaltasConsecutivasData[];
    riscoCurrentPage: number;
    setRiscoCurrentPage: (page: number) => void;
    consecutivasCurrentPage: number;
    setConsecutivasCurrentPage: (page: number) => void;

    // Filters
    turmasDisponiveis: TurmaMetadata[];
    filtroTurno: string;
    setFiltroTurno: (turno: string) => void;
    turmasSelecionadas: string[];
    setTurmasSelecionadas: (turmas: string[]) => void;
    filtroAnoLetivoId: string;
    setFiltroAnoLetivoId: (id: string) => void;
    anosLetivosDisponiveis: AnoLetivoOption[];
    activeTurmaIds: string[];

    // State
    loading: boolean;
    statusMsg: string;

    // Actions
    refresh: () => Promise<void>;
}

export function useDashboardGestor(): UseDashboardGestorReturn {
    const { user } = useAuth();

    // Raw data states
    const [kpis, setKpis] = useState<KpiData | null>(null);
    const [kpisAdmin, setKpisAdmin] = useState<KpiAdminData | null>(null);
    const [rawTurmaData, setRawTurmaData] = useState<TurmaComparisonData[]>([]);
    const [rawAlunosRisco, setRawAlunosRisco] = useState<AlunoRiscoData[]>([]);
    const [rawAlunosConsecutivos, setRawAlunosConsecutivos] = useState<AlunoFaltasConsecutivasData[]>([]);
    const [faltasPorDiaSemana, setFaltasPorDiaSemana] = useState<FaltasDiaSemanaData[]>([]);
    const [ultimasObservacoes, setUltimasObservacoes] = useState<UltimaObservacaoData[]>([]);
    const [rawFrequenciaDisciplina, setRawFrequenciaDisciplina] = useState<FrequenciaDisciplinaData[]>([]);

    // Loading states
    const [loading, setLoading] = useState(true);
    const [statusMsg, setStatusMsg] = useState("Inicializando...");

    // Filter states
    const [turmasDisponiveis, setTurmasDisponiveis] = useState<TurmaMetadata[]>([]);
    const [filtroTurno, setFiltroTurno] = useState<string>("todos");
    const [turmasSelecionadas, setTurmasSelecionadas] = useState<string[]>([]);

    // Anos letivos dinâmicos
    const [anosLetivosDisponiveis, setAnosLetivosDisponiveis] = useState<AnoLetivoOption[]>([]);
    const [filtroAnoLetivoId, setFiltroAnoLetivoId] = useState<string>("");

    // Pagination states
    const [riscoCurrentPage, setRiscoCurrentPage] = useState(1);
    const [consecutivasCurrentPage, setConsecutivasCurrentPage] = useState(1);

    // Buscar anos letivos disponíveis
    useEffect(() => {
        const fetchAnosLetivos = async () => {
            if (!user?.escola_id) return;

            try {
                const { data, error } = await supabase
                    .from('anos_letivos')
                    .select('id, ano, nome, status')
                    .eq('escola_id', user.escola_id)
                    .neq('status', 'arquivado')
                    .order('ano', { ascending: false });

                if (error) throw error;

                if (data && data.length > 0) {
                    setAnosLetivosDisponiveis(data);
                    const anoAtivo = data.find(a => a.status === 'ativo') || data[0];
                    if (anoAtivo && !filtroAnoLetivoId) {
                        setFiltroAnoLetivoId(anoAtivo.id);
                    }
                }
            } catch (err) {
                console.error('Erro ao buscar anos letivos:', err);
            }
        };

        fetchAnosLetivos();
    }, [user?.escola_id]);

    // Fetch all data
    const fetchAllData = async () => {
        try {
            setLoading(true);
            setStatusMsg("Identificando escola...");

            if (!user?.escola_id) {
                console.log("⏳ ID da escola ainda não encontrado. Aguardando...");
                return;
            }

            const activeEscolaId = user.escola_id;
            setStatusMsg("Baixando dados pedagógicos...");

            const data = await gestorService.getDashboardData(activeEscolaId, filtroAnoLetivoId || undefined);

            setKpis(data.kpis);
            setKpisAdmin(data.kpisAdmin);
            setRawTurmaData(data.turmaComparison);
            setRawAlunosRisco(data.alunosRisco);
            setRawAlunosConsecutivos(data.alunosConsecutivos);
            setUltimasObservacoes(data.ultimasObservacoes);
            setTurmasDisponiveis(data.turmasDisponiveis);
            setFaltasPorDiaSemana(data.faltasPorDiaSemana);
            setRawFrequenciaDisciplina(data.frequenciaDisciplina);

            setStatusMsg("Dados carregados.");
            setLoading(false);

        } catch (err) {
            console.error("❌ Erro fatal no dashboard:", err);
            setStatusMsg("Erro ao carregar dados.");
            setLoading(false);
        }
    };

    useEffect(() => {
        if (user && filtroAnoLetivoId) {
            fetchAllData();
        }
    }, [user, filtroAnoLetivoId]);

    // Memoized filtering logic
    const activeTurmas = useMemo(() => {
        let filtered = turmasDisponiveis;
        if (filtroTurno !== "todos") {
            filtered = filtered.filter(t => t.turno === filtroTurno);
        }
        if (turmasSelecionadas.length > 0) {
            filtered = filtered.filter(t => turmasSelecionadas.includes(t.id));
        }
        return filtered;
    }, [turmasDisponiveis, filtroTurno, turmasSelecionadas]);

    const activeTurmaIds = useMemo(() => activeTurmas.map(t => t.id), [activeTurmas]);
    const activeTurmaNomes = useMemo(() => activeTurmas.map(t => t.nome), [activeTurmas]);

    const filteredTurmaData = useMemo(() => {
        if (!rawTurmaData || rawTurmaData.length === 0) return [];
        if (activeTurmaNomes.length === 0) return rawTurmaData;
        return rawTurmaData.filter(item => activeTurmaNomes.includes(item.turma_nome));
    }, [rawTurmaData, activeTurmaNomes]);

    // Server-side computed — no client-side date processing needed
    const chartAusenciasSemana = faltasPorDiaSemana;

    const filteredAlunosRisco = useMemo(() => {
        if (!rawAlunosRisco) return [];
        if (activeTurmaNomes.length === 0) return rawAlunosRisco;
        return rawAlunosRisco.filter(item => activeTurmaNomes.includes(item.turma_nome));
    }, [rawAlunosRisco, activeTurmaNomes]);

    const filteredAlunosConsecutivos = useMemo(() => {
        if (!rawAlunosConsecutivos) return [];
        if (activeTurmaNomes.length === 0) return rawAlunosConsecutivos;
        return rawAlunosConsecutivos.filter(item => activeTurmaNomes.includes(item.turma_nome));
    }, [rawAlunosConsecutivos, activeTurmaNomes]);

    const paginatedRisco = useMemo(() => {
        const start = (riscoCurrentPage - 1) * ITEMS_PER_PAGE;
        return filteredAlunosRisco.slice(start, start + ITEMS_PER_PAGE);
    }, [filteredAlunosRisco, riscoCurrentPage]);

    const paginatedConsecutivos = useMemo(() => {
        const start = (consecutivasCurrentPage - 1) * ITEMS_PER_PAGE;
        return filteredAlunosConsecutivos.slice(start, start + ITEMS_PER_PAGE);
    }, [filteredAlunosConsecutivos, consecutivasCurrentPage]);

    return {
        // Data
        kpis,
        kpisAdmin,
        ultimasObservacoes,
        frequenciaDisciplina: rawFrequenciaDisciplina,

        // Filtered data
        filteredTurmaData,
        filteredAlunosRisco,
        filteredAlunosConsecutivos,
        chartAusenciasSemana,

        // Pagination
        paginatedRisco,
        paginatedConsecutivos,
        riscoCurrentPage,
        setRiscoCurrentPage,
        consecutivasCurrentPage,
        setConsecutivasCurrentPage,

        // Filters
        turmasDisponiveis,
        filtroTurno,
        setFiltroTurno,
        turmasSelecionadas,
        setTurmasSelecionadas,
        filtroAnoLetivoId,
        setFiltroAnoLetivoId,
        anosLetivosDisponiveis,
        activeTurmaIds,

        // State
        loading,
        statusMsg,

        // Actions
        refresh: fetchAllData
    };
}
