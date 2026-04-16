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
import { gestorService } from '@/domains/gestor/services/gestor.service';

interface ExportButtonProps {
    escolaId: string;
    anoLetivoId?: string;
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
    escolaId,
    anoLetivoId,
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

    const prepareExportData = async (): Promise<DashboardExportData> => {
        // Obter ids para buscar contatos da busca ativa
        const alunosComRiscoIds = [...new Set([
            ...alunosRisco.map(a => a.aluno_id),
            ...alunosConsecutivos.map(a => a.aluno_id)
        ])];

        // Buscar dados extras
        const [resumoMensal, buscaAtivaResumo] = await Promise.all([
            gestorService.getResumoMensal(escolaId, anoLetivoId),
            gestorService.getBuscaAtivaResumo(escolaId, alunosComRiscoIds)
        ]);

        let totalBuscaAtiva = 0;
        let alunosSemContato = 0;

        alunosRisco.forEach(a => {
            const bt = buscaAtivaResumo.get(a.aluno_id);
            if (bt?.contatado) totalBuscaAtiva += bt.totalContatos;
            else alunosSemContato++;
        });

        // KPIs Atualizados
        const exportKpis: ExportKPI[] = [];
        if (kpis) {
            exportKpis.push(
                { label: 'Taxa de Presença Geral', value: formatPercent(kpis.taxa_presenca_geral) },
                { label: 'Total de Alunos Ativos', value: kpis.total_alunos || 0 },
                { label: 'Alunos em Risco (>30% faltas)', value: alunosRisco.length },
                { label: 'Alunos com 3+ Faltas Consec.', value: alunosConsecutivos.length },
                { label: 'Contatos Busca Ativa (Total)', value: totalBuscaAtiva },
                { label: 'Alunos no Risco s/ Contato BA', value: alunosSemContato }
            );
        }

        const tabelas: DashboardExportData['tabelas'] = [];

        // 1. Resumo Mensal (NOVO)
        if (resumoMensal.length > 0) {
            tabelas.push({
                titulo: 'Resumo Mensal de Frequência',
                data: {
                    headers: ['Mês', '% Presença', '% Faltas'],
                    rows: resumoMensal.map(m => [
                        m.mes,
                        formatPercent(100 - m.percentualFaltas),
                        formatPercent(m.percentualFaltas)
                    ])
                }
            });
        }

        // 2. Frequência por Turma
        if (turmasData.length > 0) {
            tabelas.push({
                titulo: 'Frequência por Turma',
                data: {
                    headers: ['Turma', 'Taxa de Presença', 'Alunos em Risco'],
                    rows: turmasData.map(t => {
                        const countRisco = alunosRisco.filter(a => a.turma_nome === t.turma_nome).length;
                        return [
                            t.turma_nome || '-',
                            formatPercent(t.taxa_presenca),
                            countRisco
                        ];
                    })
                }
            });
        }

        // 3. Alunos em Risco
        if (alunosRisco.length > 0) {
            tabelas.push({
                titulo: 'Alunos em Risco de Evasão',
                data: {
                    headers: ['Aluno', 'Turma', 'Total Faltas', 'Status Busca Ativa', 'Último Contato'],
                    rows: alunosRisco.map(a => {
                        const ba = buscaAtivaResumo.get(a.aluno_id);
                        return [
                            a.aluno_nome || '-',
                            a.turma_nome || '-',
                            a.total_faltas || 0,
                            ba?.contatado ? '✓ Contatado' : '✗ Sem contato',
                            ba?.ultimoContato ? new Date(ba.ultimoContato).toLocaleDateString('pt-BR') : '-'
                        ];
                    })
                }
            });
        }

        // 4. Faltas Consecutivas
        if (alunosConsecutivos.length > 0) {
            tabelas.push({
                titulo: 'Faltas Consecutivas',
                data: {
                    headers: ['Aluno', 'Turma', 'Faltas Seguidas', 'Status Busca Ativa', 'Último Contato'],
                    rows: alunosConsecutivos.map(a => {
                        const ba = buscaAtivaResumo.get(a.aluno_id);
                        return [
                            a.aluno_nome || '-',
                            a.turma_nome || '-',
                            a.contagem_faltas_consecutivas || 0,
                            ba?.contatado ? '✓ Contatado' : '✗ Sem contato',
                            ba?.ultimoContato ? new Date(ba.ultimoContato).toLocaleDateString('pt-BR') : '-'
                        ];
                    })
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
            const data = await prepareExportData();
            await exportDashboardPDF(data);
            toast({
                title: 'PDF Exportado!',
                description: 'O download do relatório foi iniciado.',
            });
        } catch (error) {
            console.error('Erro ao exportar PDF:', error);
            toast({
                title: 'Erro ao analisar/exportar',
                description: 'Não foi possível gerar o PDF. Revise a quantidade de dados.',
                variant: 'destructive',
            });
        } finally {
            setIsExporting(false);
        }
    };

    const handleExportExcel = async () => {
        setIsExporting(true);
        try {
            const data = await prepareExportData();
            exportDashboardExcel(data);
            toast({
                title: 'Excel Exportado!',
                description: 'O download da planilha foi iniciado.',
            });
        } catch (error) {
            console.error('Erro ao exportar Excel:', error);
            toast({
                title: 'Erro ao analisar/exportar',
                description: 'Não foi possível gerar o Excel. Revise a quantidade de dados.',
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
                    {isExporting ? 'Processando...' : 'Exportar Relatório'}
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={handleExportPDF} disabled={isExporting}>
                    <FileText className="mr-2 h-4 w-4" />
                    Relatório em PDF
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleExportExcel} disabled={isExporting}>
                    <FileSpreadsheet className="mr-2 h-4 w-4" />
                    Planilha (Excel)
                </DropdownMenuItem>
            </DropdownMenuContent>
        </DropdownMenu>
    );
}
