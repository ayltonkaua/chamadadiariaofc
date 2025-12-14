import React, { useState, useEffect, useRef } from 'react';
import { programasService, type ProgramaSocialRow, type MappingColumns } from '@/domains';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from "@/hooks/use-toast";
import * as XLSX from 'xlsx';
import {
    Card, CardContent, CardHeader, CardTitle, CardDescription
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import {
    Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger
} from "@/components/ui/dialog";
import {
    Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from "@/components/ui/select";
import {
    Table, TableBody, TableCell, TableHead, TableHeader, TableRow
} from "@/components/ui/table";
import {
    Plus, Upload, Trash2, Eye, EyeOff, FileSpreadsheet, Loader2, CheckCircle
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useNavigate } from "react-router-dom";

export default function GerenciarProgramasPage() {
    const { user } = useAuth();
    const { toast } = useToast();
    const navigate = useNavigate();
    const [programas, setProgramas] = useState<ProgramaSocialRow[]>([]);
    const [loading, setLoading] = useState(false);

    // Estados do Modal de Criação
    const [modalOpen, setModalOpen] = useState(false);
    const [step, setStep] = useState(1); // 1: Info/File, 2: Mapping, 3: Uploading
    const [novoProgramaNome, setNovoProgramaNome] = useState('');
    const [file, setFile] = useState<File | null>(null);
    const [excelData, setExcelData] = useState<any[]>([]);
    const [excelHeaders, setExcelHeaders] = useState<string[]>([]);

    // Mapeamento de Colunas
    const [mapping, setMapping] = useState({
        matricula: '',
        nome_responsavel: '',
        cpf_responsavel: '',
        banco: '',
        agencia: '',
        conta: '',
        valor: '',
        data_pagamento: ''
    });

    // Estado do Upload
    const [progress, setProgress] = useState(0);
    const [totalRegistros, setTotalRegistros] = useState(0);
    const [registrosProcessados, setRegistrosProcessados] = useState(0);

    useEffect(() => {
        loadProgramas();
    }, [user?.escola_id]);

    const loadProgramas = async () => {
        if (!user?.escola_id) return;
        const data = await programasService.loadProgramas(user.escola_id);
        setProgramas(data);
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            setFile(e.target.files[0]);
        }
    };

    const lerExcel = async () => {
        if (!file || !novoProgramaNome) {
            toast({ title: "Preencha o nome e selecione um arquivo", variant: "destructive" });
            return;
        }

        const reader = new FileReader();
        reader.onload = (evt) => {
            const bstr = evt.target?.result;
            const wb = XLSX.read(bstr, { type: 'binary' });
            const wsname = wb.SheetNames[0];
            const ws = wb.Sheets[wsname];
            const data = XLSX.utils.sheet_to_json(ws);

            if (data.length === 0) {
                toast({ title: "Planilha vazia!", variant: "destructive" });
                return;
            }

            // Pegar cabeçalhos da primeira linha
            const headers = Object.keys(data[0] as object);
            setExcelHeaders(headers);
            setExcelData(data);
            setStep(2); // Vai para o mapeamento
        };
        reader.readAsBinaryString(file);
    };

    const iniciarImportacao = async () => {
        if (!mapping.matricula || !mapping.data_pagamento) {
            toast({ title: "Selecione as colunas obrigatórias", description: "Matrícula e Data de Pagamento são obrigatórias.", variant: "destructive" });
            return;
        }

        setStep(3);
        setTotalRegistros(excelData.length);
        setProgress(0);

        try {
            // 1. Criar o Programa
            const progData = await programasService.createPrograma(novoProgramaNome, user?.escola_id || '');

            // 2. Importar registros usando service
            await programasService.importRegistros(
                progData.id,
                excelData,
                mapping as MappingColumns,
                (processed, total) => {
                    setRegistrosProcessados(processed);
                    setProgress(Math.round((processed / total) * 100));
                }
            );

            toast({ title: "Importação concluída com sucesso!" });
            setTimeout(() => {
                setModalOpen(false);
                resetForm();
                loadProgramas();
            }, 1000);

        } catch (error: any) {
            console.error(error);
            toast({ title: "Erro na importação", description: error.message, variant: "destructive" });
            setStep(2);
        }
    };

    const resetForm = () => {
        setStep(1);
        setFile(null);
        setNovoProgramaNome('');
        setExcelData([]);
        setRegistrosProcessados(0);
        setProgress(0);
        setMapping({ matricula: '', nome_responsavel: '', cpf_responsavel: '', banco: '', agencia: '', conta: '', valor: '', data_pagamento: '' });
    };

    const toggleAtivo = async (id: string, atual: boolean) => {
        await programasService.toggleAtivo(id, atual);
        loadProgramas();
    };

    const excluirPrograma = async (id: string) => {
        if (!window.confirm("Tem certeza? Isso apagará todos os registros deste programa.")) return;
        await programasService.deletePrograma(id);
        loadProgramas();
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Programas Sociais</h1>
                    <p className="text-gray-500">Gerencie benefícios e importações de planilhas.</p>
                </div>
                <Dialog open={modalOpen} onOpenChange={setModalOpen}>
                    <DialogTrigger asChild>
                        <Button className="bg-green-600 hover:bg-green-700" onClick={resetForm}>
                            <Plus className="mr-2 h-4 w-4" /> Novo Programa
                        </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-2xl">
                        <DialogHeader>
                            <DialogTitle>Importar Novo Programa</DialogTitle>
                            <DialogDescription>Siga os passos para carregar os dados dos beneficiários.</DialogDescription>
                        </DialogHeader>

                        {/* PASSO 1: ARQUIVO */}
                        {step === 1 && (
                            <div className="space-y-4 py-4">
                                <div className="space-y-2">
                                    <Label>Nome do Programa</Label>
                                    <Input
                                        placeholder="Ex: Auxílio Material 2025"
                                        value={novoProgramaNome}
                                        onChange={e => setNovoProgramaNome(e.target.value)}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label>Arquivo Excel (.xlsx)</Label>
                                    <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:bg-gray-50 transition-colors">
                                        <Input type="file" accept=".xlsx, .xls" onChange={handleFileChange} className="hidden" id="file-upload" />
                                        <Label htmlFor="file-upload" className="cursor-pointer flex flex-col items-center">
                                            <FileSpreadsheet className="h-10 w-10 text-green-600 mb-2" />
                                            <span className="text-sm text-gray-600">{file ? file.name : "Clique para selecionar o arquivo"}</span>
                                        </Label>
                                    </div>
                                </div>
                                <Button onClick={lerExcel} className="w-full" disabled={!file || !novoProgramaNome}>
                                    Ler Arquivo
                                </Button>
                            </div>
                        )}

                        {/* PASSO 2: MAPEAMENTO */}
                        {step === 2 && (
                            <div className="space-y-4 py-2">
                                <p className="text-sm text-gray-500 bg-blue-50 p-3 rounded border border-blue-100">
                                    Identificamos as colunas abaixo. Por favor, relacione com os dados do sistema.
                                </p>
                                <div className="grid grid-cols-2 gap-4 max-h-[300px] overflow-y-auto pr-2">
                                    <div className="space-y-1">
                                        <Label className="text-red-600 font-bold">Coluna da Matrícula (Obrigatório)*</Label>
                                        <Select onValueChange={v => setMapping({ ...mapping, matricula: v })}>
                                            <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                                            <SelectContent>{excelHeaders.map(h => <SelectItem key={h} value={h}>{h}</SelectItem>)}</SelectContent>
                                        </Select>
                                    </div>
                                    <div className="space-y-1">
                                        <Label className="text-red-600 font-bold">Coluna da Data de Pagamento (Obrigatório)*</Label>
                                        <Select onValueChange={v => setMapping({ ...mapping, data_pagamento: v })}>
                                            <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                                            <SelectContent>{excelHeaders.map(h => <SelectItem key={h} value={h}>{h}</SelectItem>)}</SelectContent>
                                        </Select>
                                    </div>
                                    <div className="space-y-1">
                                        <Label>Valor Recebido</Label>
                                        <Select onValueChange={v => setMapping({ ...mapping, valor: v })}>
                                            <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                                            <SelectContent>{excelHeaders.map(h => <SelectItem key={h} value={h}>{h}</SelectItem>)}</SelectContent>
                                        </Select>
                                    </div>
                                    <div className="space-y-1">
                                        <Label>Nome Responsável</Label>
                                        <Select onValueChange={v => setMapping({ ...mapping, nome_responsavel: v })}>
                                            <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                                            <SelectContent>{excelHeaders.map(h => <SelectItem key={h} value={h}>{h}</SelectItem>)}</SelectContent>
                                        </Select>
                                    </div>
                                    <div className="space-y-1">
                                        <Label>CPF Responsável</Label>
                                        <Select onValueChange={v => setMapping({ ...mapping, cpf_responsavel: v })}>
                                            <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                                            <SelectContent>{excelHeaders.map(h => <SelectItem key={h} value={h}>{h}</SelectItem>)}</SelectContent>
                                        </Select>
                                    </div>
                                    <div className="space-y-1">
                                        <Label>Banco</Label>
                                        <Select onValueChange={v => setMapping({ ...mapping, banco: v })}>
                                            <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                                            <SelectContent>{excelHeaders.map(h => <SelectItem key={h} value={h}>{h}</SelectItem>)}</SelectContent>
                                        </Select>
                                    </div>
                                    <div className="space-y-1">
                                        <Label>Agência</Label>
                                        <Select onValueChange={v => setMapping({ ...mapping, agencia: v })}>
                                            <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                                            <SelectContent>{excelHeaders.map(h => <SelectItem key={h} value={h}>{h}</SelectItem>)}</SelectContent>
                                        </Select>
                                    </div>
                                    <div className="space-y-1">
                                        <Label>Conta</Label>
                                        <Select onValueChange={v => setMapping({ ...mapping, conta: v })}>
                                            <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                                            <SelectContent>{excelHeaders.map(h => <SelectItem key={h} value={h}>{h}</SelectItem>)}</SelectContent>
                                        </Select>
                                    </div>
                                </div>
                                <Button onClick={iniciarImportacao} className="w-full bg-blue-600 hover:bg-blue-700">
                                    <Upload className="mr-2 h-4 w-4" /> Iniciar Importação
                                </Button>
                            </div>
                        )}

                        {/* PASSO 3: PROGRESSO */}
                        {step === 3 && (
                            <div className="py-10 text-center space-y-6">
                                {progress < 100 ? (
                                    <Loader2 className="h-16 w-16 text-blue-600 animate-spin mx-auto" />
                                ) : (
                                    <CheckCircle className="h-16 w-16 text-green-600 mx-auto" />
                                )}

                                <div className="space-y-2">
                                    <h3 className="text-xl font-bold text-gray-800">
                                        {progress < 100 ? "Importando dados..." : "Sucesso!"}
                                    </h3>
                                    <Progress value={progress} className="h-4 w-full" />
                                    <p className="text-sm text-gray-500">
                                        Processando {registrosProcessados} de {totalRegistros} registros.
                                    </p>
                                </div>
                            </div>
                        )}
                    </DialogContent>
                </Dialog>
            </div>

            {/* LISTA DE PROGRAMAS */}
            <Card>
                <CardHeader>
                    <CardTitle>Histórico de Importações</CardTitle>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Nome do Programa</TableHead>
                                <TableHead>Data Criação</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead className="text-right">Ações</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {programas.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={4} className="text-center py-8 text-gray-500">Nenhum programa cadastrado.</TableCell>
                                </TableRow>
                            ) : (
                                programas.map((prog) => (
                                    <TableRow key={prog.id}>
                                        <TableCell className="font-medium">{prog.nome}</TableCell>
                                        <TableCell>{new Date(prog.created_at).toLocaleDateString()}</TableCell>
                                        <TableCell>
                                            <Badge className={prog.ativo ? "bg-green-600" : "bg-gray-400"}>
                                                {prog.ativo ? "Ativo" : "Inativo"}
                                            </Badge>
                                        </TableCell>
                                        <TableCell className="text-right space-x-2">
                                            <Button variant="ghost" size="icon" onClick={() => toggleAtivo(prog.id, prog.ativo)}>
                                                {prog.ativo ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                                            </Button>
                                            <Button variant="ghost" size="icon" className="text-red-500 hover:bg-red-50" onClick={() => excluirPrograma(prog.id)}>
                                                <Trash2 className="h-4 w-4" />
                                            </Button>
                                        </TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
        </div>
    );
}