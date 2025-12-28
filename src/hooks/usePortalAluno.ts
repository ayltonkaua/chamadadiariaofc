/**
 * usePortalAluno Hook
 * 
 * Encapsulates all data fetching and state management for the student portal.
 * Extracts business logic from PortalAlunoPage for better separation of concerns.
 */
import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { portalAlunoService, type StudentData, type MeusAtestados } from '@/domains';
import { toast } from '@/components/ui/use-toast';

interface UsePortalAlunoReturn {
    // Data
    studentData: StudentData;
    beneficios: any[];
    meusAtestados: MeusAtestados[];

    // Loading states
    loadingData: boolean;
    loadingAtestados: boolean;

    // Dialog states
    showCarteirinha: boolean;
    setShowCarteirinha: (open: boolean) => void;
    isJustifyDialogOpen: boolean;
    setIsJustifyDialogOpen: (open: boolean) => void;
    isBoletimOpen: boolean;
    setIsBoletimOpen: (open: boolean) => void;
    isMeusAtestadosOpen: boolean;
    setIsMeusAtestadosOpen: (open: boolean) => void;
    isMeusDadosOpen: boolean;
    setIsMeusDadosOpen: (open: boolean) => void;
    showUpdateAlert: boolean;
    setShowUpdateAlert: (show: boolean) => void;

    // Actions
    refreshData: () => Promise<void>;
}

const DEFAULT_STUDENT_DATA: StudentData = {
    turma: "Carregando...",
    matricula: "---",
    frequencia: 100,
    status: "Excelente",
    totalAulas: 0,
    totalFaltas: 0,
    dadosIncompletos: false
};

export function usePortalAluno(): UsePortalAlunoReturn {
    const { user } = useAuth();
    const [searchParams] = useSearchParams();

    // Data states
    const [studentData, setStudentData] = useState<StudentData>(DEFAULT_STUDENT_DATA);
    const [beneficios, setBeneficios] = useState<any[]>([]);
    const [meusAtestados, setMeusAtestados] = useState<MeusAtestados[]>([]);

    // Loading states
    const [loadingData, setLoadingData] = useState(true);
    const [loadingAtestados, setLoadingAtestados] = useState(false);

    // Dialog states
    const [showCarteirinha, setShowCarteirinha] = useState(false);
    const [isJustifyDialogOpen, setIsJustifyDialogOpen] = useState(false);
    const [isBoletimOpen, setIsBoletimOpen] = useState(false);
    const [isMeusAtestadosOpen, setIsMeusAtestadosOpen] = useState(false);
    const [isMeusDadosOpen, setIsMeusDadosOpen] = useState(false);
    const [showUpdateAlert, setShowUpdateAlert] = useState(false);

    // URL Params listener for mobile navigation
    useEffect(() => {
        const tab = searchParams.get('tab');
        if (tab === 'atestados') {
            setIsMeusAtestadosOpen(true);
        } else if (tab === 'justificar') {
            setIsJustifyDialogOpen(true);
        } else if (tab === 'boletim') {
            setIsBoletimOpen(true);
        }
    }, [searchParams]);

    // Fetch student data
    const fetchStudentData = async () => {
        if (!user?.aluno_id) return;

        try {
            setLoadingData(true);
            const data = await portalAlunoService.getStudentData(user.aluno_id);
            setStudentData(data);

            if (data.dadosIncompletos) {
                setShowUpdateAlert(true);
            }
        } catch (error) {
            console.error("Erro ao carregar dados do aluno:", error);
            toast({ title: "Erro", description: "Não foi possível carregar seus dados escolares.", variant: "destructive" });
        } finally {
            setLoadingData(false);
        }
    };

    // Fetch beneficios
    const fetchBeneficios = async () => {
        const data = await portalAlunoService.getBeneficios();
        setBeneficios(data);
    };

    // Fetch atestados
    const fetchMeusAtestados = async () => {
        if (!user?.aluno_id) return;
        setLoadingAtestados(true);
        try {
            const data = await portalAlunoService.getMeusAtestados(user.aluno_id);
            setMeusAtestados(data);
        } catch (error) {
            toast({ title: "Erro", description: "Erro ao carregar histórico de atestados.", variant: "destructive" });
        } finally {
            setLoadingAtestados(false);
        }
    };

    // Initial data fetch
    useEffect(() => {
        fetchStudentData();
    }, [user?.aluno_id]);

    useEffect(() => {
        fetchBeneficios();
    }, []);

    // Fetch atestados when dialog opens
    useEffect(() => {
        if (isMeusAtestadosOpen) {
            fetchMeusAtestados();
        }
    }, [isMeusAtestadosOpen]);

    return {
        // Data
        studentData,
        beneficios,
        meusAtestados,

        // Loading states
        loadingData,
        loadingAtestados,

        // Dialog states
        showCarteirinha,
        setShowCarteirinha,
        isJustifyDialogOpen,
        setIsJustifyDialogOpen,
        isBoletimOpen,
        setIsBoletimOpen,
        isMeusAtestadosOpen,
        setIsMeusAtestadosOpen,
        isMeusDadosOpen,
        setIsMeusDadosOpen,
        showUpdateAlert,
        setShowUpdateAlert,

        // Actions
        refreshData: fetchStudentData
    };
}
