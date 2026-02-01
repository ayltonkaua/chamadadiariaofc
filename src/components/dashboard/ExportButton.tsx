/**
 * ExportButton Component
 * 
 * A dropdown button that allows users to export dashboard data in PDF or Excel format.
 */

import { useState } from 'react';
import { Download, FileSpreadsheet, FileText, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { toast } from '@/hooks/use-toast';
import {
    exportDashboardPDF,
    exportDashboardExcel,
    formatPercent,
    type DashboardExportData,
    type ExportKPI,
} from '@/lib/exportUtils';
import type { KpiData, KpiAdminData, TurmaComparisonData, AlunoRiscoData, AlunoFaltasConsecutivasData } from '@/domains';

interface ExportButtonProps {
    nomeEscola: string;
    anoLetivo?: string;
    kpis: KpiData | null;
    kpisAdmin: KpiAdminData | null;
    turmasData: TurmaComparisonData[];
    alunosRisco: AlunoRiscoData[];
    alunosConsecutivos: AlunoFaltasConsecutivasData[];
    disabled?: boolean;
}

export function ExportButton({
    nomeEscola,
    anoLetivo,
    kpis,
    kpisAdmin,
    turmasData,
    alunosRisco,
    alunosConsecutivos,
    disabled = false,
}: ExportButtonProps) {
    const [isExporting, setIsExporting] = useState(false);

    const prepareExportData = (): DashboardExportData => {
        // Build KPIs array
        const exportKpis: ExportKPI[] = [];

        if (kpis) {
            exportKpis.push(
                { label: 'Taxa de Presença Geral', value: formatPercent(kpis.taxa_presenca_geral) },
                { label: 'Total de Alunos', value: kpis.total_alunos || 0 }
            );
        }

        if (kpisAdmin) {
            exportKpis.push(
                { label: 'Atestados Pendentes', value: kpisAdmin.atestados_pendentes || 0 },
                { label: 'Justificativas a Rever', value: kpisAdmin.justificativas_a_rever || 0 }
            );
        }

        // Build tables
        const tabelas: DashboardExportData['tabelas'] = [];

        // Table: Frequency by Class
        if (turmasData.length > 0) {
            tabelas.push({
                titulo: 'Frequência por Turma',
                data: {
                    headers: ['Turma', 'Taxa de Presença'],
                    rows: turmasData.map(t => [
                        t.turma_nome || '-',
                        formatPercent(t.taxa_presenca)
                    ])
                }
            });
        }

        // Table: Students at Risk
        if (alunosRisco.length > 0) {
            tabelas.push({
                titulo: 'Alunos em Risco',
                data: {
                    headers: ['Aluno', 'Turma', 'Total de Faltas'],
                    rows: alunosRisco.map(a => [
                        a.aluno_nome || '-',
                        a.turma_nome || '-',
                        a.total_faltas || 0
                    ])
                }
            });
        }

        // Table: Consecutive Absences
        if (alunosConsecutivos.length > 0) {
            tabelas.push({
                titulo: 'Faltas Consecutivas',
                data: {
                    headers: ['Aluno', 'Turma', 'Faltas Consecutivas', 'Última Falta'],
                    rows: alunosConsecutivos.map(a => [
                        a.aluno_nome || '-',
                        a.turma_nome || '-',
                        a.contagem_faltas_consecutivas || 0,
                        a.ultima_falta || '-'
                    ])
                }
            });
        }

        return {
            nomeEscola,
            anoLetivo,
            kpis: exportKpis,
            tabelas
        };
    };

    const handleExportPDF = async () => {
        setIsExporting(true);
        try {
            const data = prepareExportData();
            await exportDashboardPDF(data);
            toast({
                title: 'PDF Exportado!',
                description: 'O download do relatório foi iniciado.',
            });
        } catch (error) {
            console.error('Erro ao exportar PDF:', error);
            toast({
                title: 'Erro ao exportar',
                description: 'Não foi possível gerar o PDF. Tente novamente.',
                variant: 'destructive',
            });
        } finally {
            setIsExporting(false);
        }
    };

    const handleExportExcel = async () => {
        setIsExporting(true);
        try {
            const data = prepareExportData();
            exportDashboardExcel(data);
            toast({
                title: 'Excel Exportado!',
                description: 'O download da planilha foi iniciado.',
            });
        } catch (error) {
            console.error('Erro ao exportar Excel:', error);
            toast({
                title: 'Erro ao exportar',
                description: 'Não foi possível gerar o Excel. Tente novamente.',
                variant: 'destructive',
            });
        } finally {
            setIsExporting(false);
        }
    };

    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button variant="outline" disabled={disabled || isExporting}>
                    {isExporting ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                        <Download className="mr-2 h-4 w-4" />
                    )}
                    Exportar
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={handleExportPDF} disabled={isExporting}>
                    <FileText className="mr-2 h-4 w-4" />
                    Exportar PDF
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleExportExcel} disabled={isExporting}>
                    <FileSpreadsheet className="mr-2 h-4 w-4" />
                    Exportar Excel
                </DropdownMenuItem>
            </DropdownMenuContent>
        </DropdownMenu>
    );
}
