/**
 * BulkImportTab - Import phone numbers from Excel/CSV
 * 
 * Features:
 * - Upload Excel (.xlsx) or CSV files
 * - Preview parsed data before importing  
 * - Match by matricula and update telefone_responsavel/telefone_responsavel_2
 * - Show results per row (success/not found/invalid)
 */

import React, { useState, useRef } from 'react';
import * as XLSX from 'xlsx';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Upload, FileSpreadsheet, CheckCircle2, XCircle, AlertTriangle, Loader2, Trash2, Download } from 'lucide-react';
import { whatsappBotService } from '@/domains/whatsappBot';
import type { BulkImportRow, BulkImportResult } from '@/domains/whatsappBot';
import { useToast } from '@/hooks/use-toast';

interface BulkImportTabProps {
    escolaId: string;
}

interface ParsedRow extends BulkImportRow {
    rowIndex: number;
}

export default function BulkImportTab({ escolaId }: BulkImportTabProps) {
    const { toast } = useToast();
    const fileInputRef = useRef<HTMLInputElement>(null);

    const [parsedData, setParsedData] = useState<ParsedRow[]>([]);
    const [fileName, setFileName] = useState<string>('');
    const [importing, setImporting] = useState(false);
    const [result, setResult] = useState<BulkImportResult | null>(null);

    /**
     * Handle file upload and parse Excel/CSV
     */
    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setFileName(file.name);
        setResult(null);

        const reader = new FileReader();
        reader.onload = (evt) => {
            try {
                const data = evt.target?.result;
                const workbook = XLSX.read(data, { type: 'binary' });
                const sheetName = workbook.SheetNames[0];
                const sheet = workbook.Sheets[sheetName];
                const jsonData = XLSX.utils.sheet_to_json<Record<string, any>>(sheet);

                // Map columns - try common column names
                const rows: ParsedRow[] = jsonData.map((row, index) => {
                    const matricula = String(
                        row['matricula'] || row['Matricula'] || row['MATRICULA'] ||
                        row['matrícula'] || row['Matrícula'] || row['MATRÍCULA'] ||
                        row['mat'] || row['MAT'] || ''
                    ).trim();

                    const telefone = String(
                        row['telefone'] || row['Telefone'] || row['TELEFONE'] ||
                        row['telefone_responsavel'] || row['Telefone_Responsavel'] ||
                        row['tel'] || row['TEL'] || row['fone'] || row['Fone'] ||
                        row['celular'] || row['Celular'] || row['whatsapp'] || row['WhatsApp'] || ''
                    ).trim();

                    const telefone2 = String(
                        row['telefone_2'] || row['Telefone_2'] || row['TELEFONE_2'] ||
                        row['telefone2'] || row['Telefone2'] || row['tel2'] || row['TEL2'] ||
                        row['telefone_responsavel_2'] || ''
                    ).trim();

                    return {
                        rowIndex: index + 2, // +2 because row 1 is header, 0-indexed
                        matricula,
                        telefone: telefone || '',
                        telefone_2: telefone2 || undefined,
                    };
                }).filter(r => r.matricula && r.telefone); // Remove empty rows

                setParsedData(rows);

                if (rows.length === 0) {
                    toast({
                        title: 'Nenhum dado encontrado',
                        description: 'O arquivo deve ter colunas "matricula" e "telefone"',
                        variant: 'destructive',
                    });
                } else {
                    toast({
                        title: `${rows.length} registros encontrados`,
                        description: 'Verifique os dados e clique em Importar',
                    });
                }
            } catch (err) {
                console.error('Error parsing file:', err);
                toast({
                    title: 'Erro ao ler arquivo',
                    description: 'Verifique se o arquivo é um Excel (.xlsx) ou CSV válido',
                    variant: 'destructive',
                });
            }
        };
        reader.readAsBinaryString(file);
    };

    /**
     * Submit parsed data to the API
     */
    const handleImport = async () => {
        if (parsedData.length === 0) return;

        setImporting(true);
        setResult(null);

        try {
            const importResult = await whatsappBotService.bulkImportPhones(
                escolaId,
                parsedData.map(({ matricula, telefone, telefone_2 }) => ({
                    matricula,
                    telefone,
                    telefone_2,
                }))
            );

            setResult(importResult);

            toast({
                title: `Importação concluída`,
                description: `${importResult.updated} de ${importResult.total} atualizados`,
                variant: importResult.updated > 0 ? 'default' : 'destructive',
            });
        } catch (err: any) {
            toast({
                title: 'Erro na importação',
                description: err.message,
                variant: 'destructive',
            });
        } finally {
            setImporting(false);
        }
    };

    const handleClear = () => {
        setParsedData([]);
        setFileName('');
        setResult(null);
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
    };

    /**
     * Download a sample Excel template
     */
    const handleDownloadTemplate = () => {
        const ws = XLSX.utils.aoa_to_sheet([
            ['matricula', 'telefone', 'telefone_2'],
            ['2024001', '(85) 91234-5678', '(85) 98765-4321'],
            ['2024002', '85912345678', ''],
            ['2024003', '5585912345678', ''],
        ]);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Telefones');
        XLSX.writeFile(wb, 'modelo_importacao_telefones.xlsx');
    };

    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <FileSpreadsheet className="h-5 w-5" />
                    Importar Telefones em Massa
                </CardTitle>
                <CardDescription>
                    Faça upload de uma planilha Excel (.xlsx) ou CSV com as colunas <strong>matricula</strong> e <strong>telefone</strong>.
                    Opcionalmente inclua <strong>telefone_2</strong> para o segundo responsável.
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                {/* Upload area */}
                <div className="flex flex-col sm:flex-row gap-3">
                    <input
                        type="file"
                        ref={fileInputRef}
                        accept=".xlsx,.xls,.csv"
                        onChange={handleFileUpload}
                        className="hidden"
                    />
                    <Button
                        variant="outline"
                        onClick={() => fileInputRef.current?.click()}
                        className="gap-2"
                    >
                        <Upload className="h-4 w-4" />
                        {fileName || 'Selecionar arquivo'}
                    </Button>
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={handleDownloadTemplate}
                        className="gap-2 text-xs"
                    >
                        <Download className="h-3 w-3" />
                        Baixar modelo
                    </Button>
                    {parsedData.length > 0 && (
                        <Button variant="ghost" size="sm" onClick={handleClear} className="gap-2 text-red-500">
                            <Trash2 className="h-3 w-3" />
                            Limpar
                        </Button>
                    )}
                </div>

                {/* Preview table */}
                {parsedData.length > 0 && (
                    <div className="border rounded-lg overflow-hidden">
                        <div className="overflow-x-auto max-h-[400px] overflow-y-auto">
                            <table className="w-full text-sm">
                                <thead className="bg-gray-50 sticky top-0">
                                    <tr>
                                        <th className="px-3 py-2 text-left font-medium text-gray-600">Linha</th>
                                        <th className="px-3 py-2 text-left font-medium text-gray-600">Matrícula</th>
                                        <th className="px-3 py-2 text-left font-medium text-gray-600">Telefone</th>
                                        <th className="px-3 py-2 text-left font-medium text-gray-600">Telefone 2</th>
                                        {result && (
                                            <th className="px-3 py-2 text-left font-medium text-gray-600">Status</th>
                                        )}
                                    </tr>
                                </thead>
                                <tbody className="divide-y">
                                    {parsedData.map((row, i) => {
                                        const errorForRow = result?.errors?.find(e => e.matricula === row.matricula);
                                        const isSuccess = result && !errorForRow;

                                        return (
                                            <tr key={i} className={errorForRow ? 'bg-red-50' : isSuccess ? 'bg-green-50' : ''}>
                                                <td className="px-3 py-1.5 text-gray-500">{row.rowIndex}</td>
                                                <td className="px-3 py-1.5 font-mono">{row.matricula}</td>
                                                <td className="px-3 py-1.5">{row.telefone}</td>
                                                <td className="px-3 py-1.5 text-gray-500">{row.telefone_2 || '-'}</td>
                                                {result && (
                                                    <td className="px-3 py-1.5">
                                                        {errorForRow ? (
                                                            <span className="flex items-center gap-1 text-red-600 text-xs">
                                                                <XCircle className="h-3 w-3" /> {errorForRow.error}
                                                            </span>
                                                        ) : (
                                                            <span className="flex items-center gap-1 text-green-600 text-xs">
                                                                <CheckCircle2 className="h-3 w-3" /> Atualizado
                                                            </span>
                                                        )}
                                                    </td>
                                                )}
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {/* Summary and import button */}
                {parsedData.length > 0 && !result && (
                    <div className="flex items-center justify-between bg-blue-50 p-3 rounded-lg">
                        <span className="text-sm text-blue-700">
                            <strong>{parsedData.length}</strong> registros prontos para importar
                        </span>
                        <Button onClick={handleImport} disabled={importing} className="gap-2">
                            {importing ? (
                                <>
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                    Importando...
                                </>
                            ) : (
                                <>
                                    <Upload className="h-4 w-4" />
                                    Importar Telefones
                                </>
                            )}
                        </Button>
                    </div>
                )}

                {/* Results summary */}
                {result && (
                    <div className="flex flex-wrap gap-2 p-3 bg-gray-50 rounded-lg">
                        <Badge className="bg-green-100 text-green-700">
                            <CheckCircle2 className="h-3 w-3 mr-1" />
                            {result.updated} atualizados
                        </Badge>
                        {result.not_found > 0 && (
                            <Badge className="bg-yellow-100 text-yellow-700">
                                <AlertTriangle className="h-3 w-3 mr-1" />
                                {result.not_found} não encontrados
                            </Badge>
                        )}
                        {result.invalid_phone > 0 && (
                            <Badge className="bg-red-100 text-red-700">
                                <XCircle className="h-3 w-3 mr-1" />
                                {result.invalid_phone} telefones inválidos
                            </Badge>
                        )}
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
