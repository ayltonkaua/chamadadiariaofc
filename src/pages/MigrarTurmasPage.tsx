/**
 * Migrar Turmas Page - Wizard de Migração de Ano Letivo
 * 
 * Wizard de 3 passos:
 * 1. Selecionar turmas e editar nomes
 * 2. Revisar alunos por turma (quem migra)
 * 3. Confirmação e execução
 */

import React, { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useEscolaConfig } from "@/contexts/EscolaConfigContext";
import { supabase } from "@/integrations/supabase/client";
import { anoLetivoService, type AnoLetivoComStats } from "@/domains";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import { toast } from "@/hooks/use-toast";
import {
    ArrowLeft,
    ArrowRight,
    Check,
    Loader2,
    Users,
    GraduationCap,
    AlertTriangle,
    CheckCircle2,
    XCircle,
    RefreshCw
} from "lucide-react";

// Types
interface TurmaParaMigrar {
    turma_id: string;
    turma_nome: string;
    turma_numero_sala: string;
    turma_turno: string;
    total_alunos: number;
    alunos_ativos: number;
    selecionada: boolean;
    novo_nome: string;
    novo_turno: string;
    ja_migrada?: boolean;
}

interface AlunoParaMigrar {
    aluno_id: string;
    aluno_nome: string;
    aluno_matricula: string;
    situacao: string;
    total_faltas: number;
    frequencia_percentual: number;
    selecionado: boolean;
}

interface MigracaoConfig {
    turma_origem_id: string;
    novo_nome: string;
    novo_turno: string;
    alunos_ids: string[];
}

// Opções de turno disponíveis
const TURNOS_OPCOES = [
    { value: 'Manhã', label: 'Manhã' },
    { value: 'Tarde', label: 'Tarde' },
    { value: 'Noite', label: 'Noite' },
    { value: 'Integral', label: 'Integral' },
];

const MigrarTurmasPage: React.FC = () => {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const { user } = useAuth();
    const { config } = useEscolaConfig();
    const corPrimaria = config?.cor_primaria || "#6D28D9";

    // Wizard state
    const [passo, setPasso] = useState(1);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);

    // Data state
    const [anosLetivos, setAnosLetivos] = useState<AnoLetivoComStats[]>([]);
    const [anoOrigemId, setAnoOrigemId] = useState<string>("");
    const [anoDestinoId, setAnoDestinoId] = useState<string>("");
    const [turmas, setTurmas] = useState<TurmaParaMigrar[]>([]);
    const [alunosPorTurma, setAlunosPorTurma] = useState<Record<string, AlunoParaMigrar[]>>({});
    const [turmaAtualIndex, setTurmaAtualIndex] = useState(0);

    // Load anos letivos on mount
    useEffect(() => {
        if (user?.escola_id) {
            loadAnosLetivos();
        }
    }, [user?.escola_id]);

    const loadAnosLetivos = async () => {
        if (!user?.escola_id) return;
        setLoading(true);
        try {
            const anos = await anoLetivoService.getAll(user.escola_id);
            setAnosLetivos(anos);

            // Auto-select if coming from AnoLetivoPage
            const origemParam = searchParams.get('origem');
            const destinoParam = searchParams.get('destino');
            if (origemParam) setAnoOrigemId(origemParam);
            if (destinoParam) setAnoDestinoId(destinoParam);

            // Default: fechado mais recente como origem, aberto como destino
            const fechado = anos.find(a => a.status === 'fechado');
            const aberto = anos.find(a => a.status === 'aberto');
            if (fechado && !origemParam) setAnoOrigemId(fechado.id);
            if (aberto && !destinoParam) setAnoDestinoId(aberto.id);
        } catch (error) {
            toast({ title: "Erro", description: "Erro ao carregar anos letivos", variant: "destructive" });
        } finally {
            setLoading(false);
        }
    };

    const loadTurmas = async () => {
        if (!user?.escola_id || !anoOrigemId || !anoDestinoId) return;
        setLoading(true);
        try {
            // Buscar turmas do ano de origem
            const { data, error } = await (supabase as any)
                .rpc('get_turmas_para_migrar', {
                    p_escola_id: user.escola_id,
                    p_ano_letivo_origem_id: anoOrigemId
                });

            if (error) throw error;

            // Verificar quais turmas já têm alunos migrados para o ano destino
            const { data: turmasDestino } = await supabase
                .from('turmas')
                .select('nome')
                .eq('escola_id', user.escola_id)
                .eq('ano_letivo_id', anoDestinoId);

            const nomesTurmasDestino = new Set(turmasDestino?.map(t => t.nome.toLowerCase()) || []);

            const turmasFormatadas: TurmaParaMigrar[] = (data || []).map((t: any) => {
                const novoNome = sugerirNovoNome(t.turma_nome);
                const jaMigrada = nomesTurmasDestino.has(novoNome.toLowerCase());
                return {
                    ...t,
                    selecionada: !jaMigrada, // Não seleciona se já migrada
                    novo_nome: novoNome,
                    novo_turno: t.turma_turno || 'Manhã',
                    ja_migrada: jaMigrada
                };
            });

            setTurmas(turmasFormatadas);

            // Avisar se todas já foram migradas
            const todasMigradas = turmasFormatadas.every(t => t.ja_migrada);
            if (todasMigradas && turmasFormatadas.length > 0) {
                toast({
                    title: "Atenção",
                    description: "Todas as turmas já foram migradas para o ano destino.",
                    variant: "destructive"
                });
            }
        } catch (error: any) {
            toast({ title: "Erro", description: error.message, variant: "destructive" });
        } finally {
            setLoading(false);
        }
    };

    const sugerirNovoNome = (nomeAtual: string): string => {
        // Tenta incrementar números no nome
        // Ex: "6º Ano A" -> "7º Ano A"
        const match = nomeAtual.match(/(\d+)(º|°|ª)?(\s*[Aa][Nn][Oo])?/);
        if (match) {
            const numero = parseInt(match[1]);
            return nomeAtual.replace(match[0], `${numero + 1}${match[2] || ''}${match[3] || ''}`);
        }
        return nomeAtual + " (Novo)";
    };

    const loadAlunosDaTurma = async (turmaId: string) => {
        if (alunosPorTurma[turmaId]) return; // Já carregado

        try {
            const { data, error } = await (supabase as any)
                .rpc('get_alunos_para_migrar', { p_turma_id: turmaId });

            if (error) throw error;

            const alunosFormatados: AlunoParaMigrar[] = (data || []).map((a: any) => ({
                ...a,
                // Seleciona automaticamente apenas ativos e aprovados
                selecionado: ['ativo', 'aprovado'].includes(a.situacao)
            }));

            setAlunosPorTurma(prev => ({ ...prev, [turmaId]: alunosFormatados }));
        } catch (error: any) {
            toast({ title: "Erro", description: error.message, variant: "destructive" });
        }
    };

    // Handlers
    const handleToggleTurma = (turmaId: string) => {
        setTurmas(prev => prev.map(t =>
            t.turma_id === turmaId ? { ...t, selecionada: !t.selecionada } : t
        ));
    };

    const handleChangeNovoNome = (turmaId: string, novoNome: string) => {
        setTurmas(prev => prev.map(t =>
            t.turma_id === turmaId ? { ...t, novo_nome: novoNome } : t
        ));
    };

    const handleChangeNovoTurno = (turmaId: string, novoTurno: string) => {
        setTurmas(prev => prev.map(t =>
            t.turma_id === turmaId ? { ...t, novo_turno: novoTurno } : t
        ));
    };

    const handleToggleAluno = (turmaId: string, alunoId: string) => {
        setAlunosPorTurma(prev => ({
            ...prev,
            [turmaId]: prev[turmaId].map(a =>
                a.aluno_id === alunoId ? { ...a, selecionado: !a.selecionado } : a
            )
        }));
    };

    const handleSelecionarTodosAlunos = (turmaId: string, selecionar: boolean) => {
        setAlunosPorTurma(prev => ({
            ...prev,
            [turmaId]: prev[turmaId].map(a => ({ ...a, selecionado: selecionar }))
        }));
    };

    const handleAvancar = async () => {
        if (passo === 1) {
            // Validar seleção
            const turmasSelecionadas = turmas.filter(t => t.selecionada);
            if (turmasSelecionadas.length === 0) {
                toast({ title: "Atenção", description: "Selecione ao menos uma turma", variant: "destructive" });
                return;
            }
            // Carregar alunos da primeira turma
            await loadAlunosDaTurma(turmasSelecionadas[0].turma_id);
            setTurmaAtualIndex(0);
            setPasso(2);
        } else if (passo === 2) {
            const turmasSelecionadas = turmas.filter(t => t.selecionada);
            const proximoIndex = turmaAtualIndex + 1;

            if (proximoIndex < turmasSelecionadas.length) {
                // Próxima turma
                await loadAlunosDaTurma(turmasSelecionadas[proximoIndex].turma_id);
                setTurmaAtualIndex(proximoIndex);
            } else {
                // Fim - ir para confirmação
                setPasso(3);
            }
        }
    };

    const handleVoltar = () => {
        if (passo === 2 && turmaAtualIndex > 0) {
            setTurmaAtualIndex(turmaAtualIndex - 1);
        } else {
            setPasso(passo - 1);
        }
    };

    const handleExecutarMigracao = async () => {
        if (!user?.escola_id) return;
        setSubmitting(true);

        try {
            const turmasSelecionadas = turmas.filter(t => t.selecionada && !t.ja_migrada);
            const migracoes: MigracaoConfig[] = turmasSelecionadas.map(t => ({
                turma_origem_id: t.turma_id,
                novo_nome: t.novo_nome,
                novo_turno: t.novo_turno,
                alunos_ids: (alunosPorTurma[t.turma_id] || [])
                    .filter(a => a.selecionado)
                    .map(a => a.aluno_id)
            }));

            const { data, error } = await (supabase as any)
                .rpc('executar_migracao_turmas', {
                    p_escola_id: user.escola_id,
                    p_ano_letivo_destino_id: anoDestinoId,
                    p_migracoes: migracoes
                });

            if (error) throw error;

            toast({
                title: "Migração Concluída!",
                description: data.message,
                className: "bg-green-600 text-white"
            });

            navigate('/ano-letivo');
        } catch (error: any) {
            toast({ title: "Erro na Migração", description: error.message, variant: "destructive" });
        } finally {
            setSubmitting(false);
        }
    };

    // Computed values
    const turmasSelecionadas = turmas.filter(t => t.selecionada);
    const turmaAtual = turmasSelecionadas[turmaAtualIndex];
    const alunosTurmaAtual = turmaAtual ? (alunosPorTurma[turmaAtual.turma_id] || []) : [];
    const anoOrigem = anosLetivos.find(a => a.id === anoOrigemId);
    const anoDestino = anosLetivos.find(a => a.id === anoDestinoId);

    // Contagem para resumo
    const totalAlunosSelecionados = turmasSelecionadas.reduce((acc, t) => {
        const alunos = alunosPorTurma[t.turma_id] || [];
        return acc + alunos.filter(a => a.selecionado).length;
    }, 0);

    if (loading && passo === 1 && turmas.length === 0) {
        return (
            <div className="flex h-[60vh] items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin" style={{ color: corPrimaria }} />
            </div>
        );
    }

    return (
        <div className="container mx-auto py-6 px-4 max-w-3xl">
            {/* Header */}
            <div className="flex items-center gap-3 mb-6">
                <Button variant="ghost" size="icon" onClick={() => navigate('/ano-letivo')}>
                    <ArrowLeft className="h-5 w-5" />
                </Button>
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Migrar Turmas</h1>
                    <p className="text-gray-500">
                        {anoOrigem?.nome || 'Origem'} → {anoDestino?.nome || 'Destino'}
                    </p>
                </div>
            </div>

            {/* Progress */}
            <div className="mb-6">
                <div className="flex justify-between text-sm mb-2">
                    <span className={passo >= 1 ? 'text-gray-900 font-medium' : 'text-gray-400'}>1. Turmas</span>
                    <span className={passo >= 2 ? 'text-gray-900 font-medium' : 'text-gray-400'}>2. Alunos</span>
                    <span className={passo >= 3 ? 'text-gray-900 font-medium' : 'text-gray-400'}>3. Confirmar</span>
                </div>
                <Progress value={(passo / 3) * 100} className="h-2" />
            </div>

            {/* Passo 1: Selecionar Turmas */}
            {passo === 1 && (
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <GraduationCap className="h-5 w-5" />
                            Selecionar Turmas para Migrar
                        </CardTitle>
                        <CardDescription>
                            Escolha as turmas e defina os novos nomes para o próximo ano
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        {/* Seleção de anos */}
                        {turmas.length === 0 && (
                            <div className="grid grid-cols-2 gap-4 mb-4">
                                <div>
                                    <Label>Ano de Origem (fechado)</Label>
                                    <select
                                        className="w-full mt-1 p-2 border rounded-md"
                                        value={anoOrigemId}
                                        onChange={e => setAnoOrigemId(e.target.value)}
                                    >
                                        <option value="">Selecione...</option>
                                        {anosLetivos.filter(a => a.status === 'fechado').map(a => (
                                            <option key={a.id} value={a.id}>{a.nome}</option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <Label>Ano de Destino (aberto)</Label>
                                    <select
                                        className="w-full mt-1 p-2 border rounded-md"
                                        value={anoDestinoId}
                                        onChange={e => setAnoDestinoId(e.target.value)}
                                    >
                                        <option value="">Selecione...</option>
                                        {anosLetivos.filter(a => a.status === 'aberto').map(a => (
                                            <option key={a.id} value={a.id}>{a.nome}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>
                        )}

                        {turmas.length === 0 && anoOrigemId && (
                            <Button onClick={loadTurmas} disabled={loading}>
                                {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <RefreshCw className="h-4 w-4 mr-2" />}
                                Carregar Turmas
                            </Button>
                        )}

                        {/* Lista de turmas */}
                        {turmas.map(turma => (
                            <div
                                key={turma.turma_id}
                                className={`p-4 border rounded-lg transition-colors ${turma.ja_migrada
                                        ? 'border-orange-300 bg-orange-50 opacity-60'
                                        : turma.selecionada
                                            ? 'border-green-300 bg-green-50'
                                            : 'border-gray-200 bg-gray-50'
                                    }`}
                            >
                                <div className="flex items-start gap-3">
                                    <Checkbox
                                        checked={turma.selecionada}
                                        disabled={turma.ja_migrada}
                                        onCheckedChange={() => handleToggleTurma(turma.turma_id)}
                                    />
                                    <div className="flex-1">
                                        <div className="flex items-center justify-between mb-2">
                                            <div className="flex items-center gap-2">
                                                <span className="font-medium">{turma.turma_nome}</span>
                                                {turma.ja_migrada && (
                                                    <Badge className="bg-orange-100 text-orange-700 text-xs">
                                                        Já migrada
                                                    </Badge>
                                                )}
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <span className="text-xs text-gray-500">{turma.turma_turno}</span>
                                                <Badge variant="secondary">
                                                    {turma.alunos_ativos}/{turma.total_alunos} alunos
                                                </Badge>
                                            </div>
                                        </div>
                                        {turma.selecionada && !turma.ja_migrada && (
                                            <div className="space-y-2">
                                                <div className="flex items-center gap-2">
                                                    <ArrowRight className="h-4 w-4 text-gray-400" />
                                                    <Input
                                                        value={turma.novo_nome}
                                                        onChange={e => handleChangeNovoNome(turma.turma_id, e.target.value)}
                                                        placeholder="Novo nome da turma"
                                                        className="flex-1"
                                                    />
                                                </div>
                                                <div className="flex items-center gap-2 ml-6">
                                                    <Label className="text-xs text-gray-500 w-16">Turno:</Label>
                                                    <select
                                                        value={turma.novo_turno}
                                                        onChange={e => handleChangeNovoTurno(turma.turma_id, e.target.value)}
                                                        className="flex-1 p-1.5 text-sm border rounded-md bg-white"
                                                    >
                                                        {TURNOS_OPCOES.map(t => (
                                                            <option key={t.value} value={t.value}>{t.label}</option>
                                                        ))}
                                                    </select>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </CardContent>
                </Card>
            )}

            {/* Passo 2: Revisar Alunos */}
            {passo === 2 && turmaAtual && (
                <Card>
                    <CardHeader>
                        <div className="flex items-center justify-between">
                            <div>
                                <CardTitle className="flex items-center gap-2">
                                    <Users className="h-5 w-5" />
                                    {turmaAtual.turma_nome} → {turmaAtual.novo_nome}
                                </CardTitle>
                                <CardDescription>
                                    Turma {turmaAtualIndex + 1} de {turmasSelecionadas.length} - Selecione os alunos que serão migrados
                                </CardDescription>
                            </div>
                            <div className="flex gap-2">
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => handleSelecionarTodosAlunos(turmaAtual.turma_id, true)}
                                >
                                    Todos
                                </Button>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => handleSelecionarTodosAlunos(turmaAtual.turma_id, false)}
                                >
                                    Nenhum
                                </Button>
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-2 max-h-[400px] overflow-y-auto">
                            {alunosTurmaAtual.map(aluno => (
                                <div
                                    key={aluno.aluno_id}
                                    className={`p-3 border rounded-lg flex items-center gap-3 cursor-pointer transition-colors ${aluno.selecionado ? 'border-green-300 bg-green-50' : 'border-gray-200 hover:bg-gray-50'
                                        }`}
                                    onClick={() => handleToggleAluno(turmaAtual.turma_id, aluno.aluno_id)}
                                >
                                    <Checkbox checked={aluno.selecionado} />
                                    <div className="flex-1">
                                        <p className="font-medium">{aluno.aluno_nome}</p>
                                        <p className="text-sm text-gray-500">
                                            Mat: {aluno.aluno_matricula} • {aluno.frequencia_percentual || 0}% freq.
                                        </p>
                                    </div>
                                    <Badge
                                        variant={
                                            aluno.situacao === 'aprovado' ? 'default' :
                                                aluno.situacao === 'ativo' ? 'secondary' :
                                                    'destructive'
                                        }
                                        className={
                                            aluno.situacao === 'aprovado' ? 'bg-green-100 text-green-800' :
                                                aluno.situacao === 'reprovado' ? 'bg-red-100 text-red-800' :
                                                    aluno.situacao === 'abandono' ? 'bg-orange-100 text-orange-800' :
                                                        ''
                                        }
                                    >
                                        {aluno.situacao}
                                    </Badge>
                                </div>
                            ))}
                        </div>

                        <div className="mt-4 pt-4 border-t text-sm text-gray-600">
                            Selecionados: {alunosTurmaAtual.filter(a => a.selecionado).length} / {alunosTurmaAtual.length} alunos
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Passo 3: Confirmação */}
            {passo === 3 && (
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <CheckCircle2 className="h-5 w-5 text-green-600" />
                            Confirmar Migração
                        </CardTitle>
                        <CardDescription>
                            Revise as informações antes de confirmar
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <Alert>
                            <AlertTriangle className="h-4 w-4" />
                            <AlertTitle>Atenção</AlertTitle>
                            <AlertDescription>
                                Os alunos selecionados serão movidos para as novas turmas no {anoDestino?.nome}.
                                Esta ação não pode ser desfeita facilmente.
                            </AlertDescription>
                        </Alert>

                        <div className="bg-gray-50 p-4 rounded-lg space-y-3">
                            <h3 className="font-semibold">Resumo da Migração</h3>

                            {turmasSelecionadas.map(turma => {
                                const alunos = alunosPorTurma[turma.turma_id] || [];
                                const selecionados = alunos.filter(a => a.selecionado).length;
                                return (
                                    <div key={turma.turma_id} className="flex items-center justify-between py-2 border-b last:border-0">
                                        <div className="flex items-center gap-2">
                                            <span className="text-gray-500">{turma.turma_nome}</span>
                                            <ArrowRight className="h-4 w-4 text-gray-400" />
                                            <span className="font-medium">{turma.novo_nome}</span>
                                        </div>
                                        <Badge variant="secondary">{selecionados} alunos</Badge>
                                    </div>
                                );
                            })}

                            <div className="pt-3 flex justify-between font-semibold">
                                <span>Total</span>
                                <span>{turmasSelecionadas.length} turmas • {totalAlunosSelecionados} alunos</span>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Navigation Buttons */}
            <div className="flex justify-between mt-6">
                <Button
                    variant="outline"
                    onClick={handleVoltar}
                    disabled={passo === 1 && turmaAtualIndex === 0}
                >
                    <ArrowLeft className="h-4 w-4 mr-2" />
                    Voltar
                </Button>

                {passo < 3 ? (
                    <Button onClick={handleAvancar} disabled={loading} style={{ backgroundColor: corPrimaria }}>
                        Próximo
                        <ArrowRight className="h-4 w-4 ml-2" />
                    </Button>
                ) : (
                    <Button
                        onClick={handleExecutarMigracao}
                        disabled={submitting}
                        className="bg-green-600 hover:bg-green-700"
                    >
                        {submitting ? (
                            <>
                                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                                Migrando...
                            </>
                        ) : (
                            <>
                                <Check className="h-4 w-4 mr-2" />
                                Confirmar Migração
                            </>
                        )}
                    </Button>
                )}
            </div>
        </div>
    );
};

export default MigrarTurmasPage;
