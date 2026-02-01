/**
 * exportUtils.ts
 * 
 * Utility library for exporting dashboard data to PDF and Excel formats.
 * Uses jsPDF for PDF generation and xlsx for Excel.
 */

import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

// =================== Types ===================

export interface ExportKPI {
    label: string;
    value: string | number;
}

export interface ExportTableData {
    headers: string[];
    rows: (string | number)[][];
}

export interface DashboardExportData {
    nomeEscola: string;
    periodo?: string;
    anoLetivo?: string;
    kpis: ExportKPI[];
    tabelas: {
        titulo: string;
        data: ExportTableData;
    }[];
    filtros?: {
        turno?: string;
        turmas?: string[];
    };
}

// =================== PDF Export ===================

/**
 * Generates a PDF report from dashboard data
 */
export async function exportDashboardPDF(data: DashboardExportData): Promise<void> {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    let yPos = 20;

    // Header with school name
    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.text(data.nomeEscola, pageWidth / 2, yPos, { align: 'center' });
    yPos += 10;

    // Subtitle
    doc.setFontSize(12);
    doc.setFont('helvetica', 'normal');
    doc.text('Relatório de Frequência Escolar', pageWidth / 2, yPos, { align: 'center' });
    yPos += 8;

    // Metadata line (period, year, generation date)
    doc.setFontSize(9);
    doc.setTextColor(100, 100, 100);
    const metaLine = [
        data.anoLetivo ? `Ano Letivo: ${data.anoLetivo}` : null,
        data.periodo ? `Período: ${data.periodo}` : null,
        `Gerado em: ${format(new Date(), "dd 'de' MMMM 'de' yyyy, HH:mm", { locale: ptBR })}`
    ].filter(Boolean).join(' | ');
    doc.text(metaLine, pageWidth / 2, yPos, { align: 'center' });
    yPos += 15;
    doc.setTextColor(0, 0, 0);

    // KPIs Section
    if (data.kpis.length > 0) {
        doc.setFontSize(14);
        doc.setFont('helvetica', 'bold');
        doc.text('Indicadores Principais', 14, yPos);
        yPos += 8;

        // Render KPIs in a grid (2 columns)
        const kpiCols = 2;
        const kpiWidth = (pageWidth - 28) / kpiCols;
        data.kpis.forEach((kpi, idx) => {
            const col = idx % kpiCols;
            const row = Math.floor(idx / kpiCols);
            const xPos = 14 + col * kpiWidth;
            const kpiY = yPos + row * 18;

            // Box background
            doc.setFillColor(245, 245, 245);
            doc.roundedRect(xPos, kpiY - 4, kpiWidth - 4, 14, 2, 2, 'F');

            // KPI label
            doc.setFontSize(9);
            doc.setFont('helvetica', 'normal');
            doc.setTextColor(80, 80, 80);
            doc.text(kpi.label, xPos + 4, kpiY + 2);

            // KPI value
            doc.setFontSize(12);
            doc.setFont('helvetica', 'bold');
            doc.setTextColor(0, 0, 0);
            doc.text(String(kpi.value), xPos + 4, kpiY + 9);
        });

        yPos += Math.ceil(data.kpis.length / kpiCols) * 18 + 10;
    }

    // Tables
    for (const tabela of data.tabelas) {
        // Check if we need a new page
        if (yPos > 250) {
            doc.addPage();
            yPos = 20;
        }

        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(0, 0, 0);
        doc.text(tabela.titulo, 14, yPos);
        yPos += 6;

        autoTable(doc, {
            startY: yPos,
            head: [tabela.data.headers],
            body: tabela.data.rows,
            theme: 'striped',
            styles: {
                fontSize: 9,
                cellPadding: 3,
            },
            headStyles: {
                fillColor: [59, 130, 246], // Blue-500
                textColor: 255,
                fontStyle: 'bold',
            },
            alternateRowStyles: {
                fillColor: [248, 250, 252], // Slate-50
            },
            margin: { left: 14, right: 14 },
        });

        yPos = (doc as any).lastAutoTable.finalY + 12;
    }

    // Footer on all pages
    const totalPages = (doc as any).internal.getNumberOfPages();
    for (let i = 1; i <= totalPages; i++) {
        doc.setPage(i);
        doc.setFontSize(8);
        doc.setTextColor(150, 150, 150);
        doc.text(
            `Página ${i} de ${totalPages} | Chamada Diária`,
            pageWidth / 2,
            doc.internal.pageSize.getHeight() - 10,
            { align: 'center' }
        );
    }

    // Save the PDF
    const filename = `Relatorio_${data.nomeEscola.replace(/\s+/g, '_')}_${format(new Date(), 'yyyyMMdd_HHmm')}.pdf`;
    doc.save(filename);
}

// =================== Excel Export ===================

/**
 * Generates an Excel workbook from dashboard data
 */
export function exportDashboardExcel(data: DashboardExportData): void {
    const workbook = XLSX.utils.book_new();

    // Sheet 1: KPIs Overview
    if (data.kpis.length > 0) {
        const kpiData = [
            ['Indicador', 'Valor'],
            ...data.kpis.map(kpi => [kpi.label, kpi.value])
        ];
        const kpiSheet = XLSX.utils.aoa_to_sheet(kpiData);

        // Style the header
        kpiSheet['!cols'] = [{ wch: 30 }, { wch: 20 }];

        XLSX.utils.book_append_sheet(workbook, kpiSheet, 'Resumo');
    }

    // Additional sheets for each table
    data.tabelas.forEach((tabela, index) => {
        const sheetData = [
            tabela.data.headers,
            ...tabela.data.rows
        ];
        const sheet = XLSX.utils.aoa_to_sheet(sheetData);

        // Auto-size columns
        const colWidths = tabela.data.headers.map((header, colIdx) => {
            const maxLen = Math.max(
                header.length,
                ...tabela.data.rows.map(row => String(row[colIdx] || '').length)
            );
            return { wch: Math.min(maxLen + 2, 40) };
        });
        sheet['!cols'] = colWidths;

        // Truncate sheet name to 31 chars (Excel limit)
        const sheetName = tabela.titulo.substring(0, 31) || `Dados_${index + 1}`;
        XLSX.utils.book_append_sheet(workbook, sheet, sheetName);
    });

    // Generate and download
    const filename = `Relatorio_${data.nomeEscola.replace(/\s+/g, '_')}_${format(new Date(), 'yyyyMMdd_HHmm')}.xlsx`;
    XLSX.writeFile(workbook, filename);
}

// =================== Helper Functions ===================

/**
 * Formats a numeric value as percentage
 */
export function formatPercent(value: number | null | undefined): string {
    if (value === null || value === undefined) return '-';
    return `${value.toFixed(1)}%`;
}

/**
 * Safely formats a value for export
 */
export function formatValue(value: unknown): string | number {
    if (value === null || value === undefined) return '-';
    if (typeof value === 'number') return value;
    return String(value);
}
