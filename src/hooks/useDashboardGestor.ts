/**
 * useDashboardGestor Hook
 * 
 * Encapsulates all data fetching and filtering logic for the management dashboard.
 * Uses React Query pattern with memoized filtering.
 */
import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
    gestorService,
    type KpiData,
    type KpiAdminData,
    type TurmaComparisonData,
    type AlunoRiscoData,
    type AlunoFaltasConsecutivasData,
    type UltimaObservacaoData,
    type TurmaMetadata,
    type PresencaRecente
} from '@/domains';

const ITEMS_PER_PAGE = 5;

interface UseDashboardGestorReturn {
    // Data
    kpis: KpiData | null;
    kpisAdmin: KpiAdminData | null;
    ultimasObservacoes: UltimaObservacaoData[];

    // Filtered data
    filteredTurmaData: TurmaComparisonData[];
    filteredAlunosRisco: AlunoRiscoData[];
    filteredAlunosConsecutivos: AlunoFaltasConsecutivasData[];
    chartAusenciasSemana: { dia_semana_nome: string; percentual_faltas: number }[];

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
    filtroAno: string;
    setFiltroAno: (ano: string) => void;
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
    const [rawPresencasRecentes, setRawPresencasRecentes] = useState<PresencaRecente[]>([]);
    const [ultimasObservacoes, setUltimasObservacoes] = useState<UltimaObservacaoData[]>([]);

    // Loading states
    const [loading, setLoading] = useState(true);
    const [statusMsg, setStatusMsg] = useState("Inicializando...");

    // Filter states
    const [turmasDisponiveis, setTurmasDisponiveis] = useState<TurmaMetadata[]>([]);
    const [filtroTurno, setFiltroTurno] = useState<string>("todos");
    const [turmasSelecionadas, setTurmasSelecionadas] = useState<string[]>([]);
    const [filtroAno, setFiltroAno] = useState<string>(new Date().getFullYear().toString());

    // Pagination states
    const [riscoCurrentPage, setRiscoCurrentPage] = useState(1);
    const [consecutivasCurrentPage, setConsecutivasCurrentPage] = useState(1);

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

            const data = await gestorService.getDashboardData(activeEscolaId);

            setKpis(data.kpis);
            setKpisAdmin(data.kpisAdmin);
            setRawTurmaData(data.turmaComparison);
            setRawAlunosRisco(data.alunosRisco);
            setRawAlunosConsecutivos(data.alunosConsecutivos);
            setUltimasObservacoes(data.ultimasObservacoes);
            setTurmasDisponiveis(data.turmasDisponiveis);
            setRawPresencasRecentes(data.presencasRecentes);

            setStatusMsg("Dados carregados.");
            setLoading(false);

        } catch (err) {
            console.error("❌ Erro fatal no dashboard:", err);
            setStatusMsg("Erro ao carregar dados.");
            setLoading(false);
        }
    };

    useEffect(() => {
        if (user) {
            fetchAllData();
        }
    }, [user, filtroAno]);

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

    const chartAusenciasSemana = useMemo(() => {
        const presencasFiltradas = rawPresencasRecentes.filter(p => {
            if (!activeTurmaIds || activeTurmaIds.length === 0) return true;
            return activeTurmaIds.includes(p.turma_id);
        });

        const diasMap = new Map<string, { total: number; faltas: number }>();
        const ordemDias = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'];
        ordemDias.forEach(d => diasMap.set(d, { total: 0, faltas: 0 }));

        presencasFiltradas.forEach(p => {
            try {
                const data = typeof p.data_chamada === 'string' ? parseISO(p.data_chamada) : new Date(p.data_chamada);
                const diaNome = format(data, 'EEE', { locale: ptBR }).replace('.', '');
                const diaCapitalized = diaNome.charAt(0).toUpperCase() + diaNome.slice(1);
                const chave = diaCapitalized.substring(0, 3);
                if (!diasMap.has(chave)) diasMap.set(chave, { total: 0, faltas: 0 });
                const entry = diasMap.get(chave)!;
                entry.total++;
                if (!p.presente) entry.faltas++;
            } catch (err) { }
        });

        return ordemDias.map(chave => {
            const dados = diasMap.get(chave) ?? { total: 0, faltas: 0 };
            return {
                dia_semana_nome: chave,
                percentual_faltas: dados.total > 0 ? parseFloat(((dados.faltas / dados.total) * 100).toFixed(1)) : 0
            };
        });
    }, [rawPresencasRecentes, activeTurmaIds]);

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
        filtroAno,
        setFiltroAno,
        activeTurmaIds,

        // State
        loading,
        statusMsg,

        // Actions
        refresh: fetchAllData
    };
}
