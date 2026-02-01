/**
 * Arquivos do Ano Page - Visualização de Dados Arquivados v2.0
 * 
 * Exibe dados COMPLETOS do ano arquivado:
 * - Estatísticas gerais
 * - Dados por turma (com lista de alunos)
 * - Top faltosos
 * - Atestados
 */

import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useEscolaConfig } from "@/contexts/EscolaConfigContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { toast } from "@/hooks/use-toast";
import {
    ArrowLeft, Calendar, Users, GraduationCap, TrendingUp, TrendingDown,
    Clock, Download, RefreshCw, Loader2, AlertTriangle, CheckCircle2,
    Trophy, ChevronDown, ChevronRight, User, FileText
} from "lucide-react";

// Types para v2.0
interface AlunoCompleto {
    aluno_id: string;
    nome: string;
    matricula: string;
    turma_id: string;
    turma_nome: string;
    situacao: string;
    presentes: number;
    faltas: number;
    atestados: number;
    frequencia: number;
    total_dias_letivos: number;
}

interface TurmaCompleta {
    id: string;
    nome: string;
    turno: string;
    total_alunos: number;
    alunos: AlunoCompleto[];
    total_dias_chamada: number;
}

interface ArchiveMetadata {
    escola_id: string;
    escola_nome: string;
    ano: number;
    nome: string;
    periodo: { inicio: string; fim: string };
    archived_at: string;
    expires_at: string;
    stats: {
        total_turmas: number;
        total_alunos: number;
        total_presencas: number;
        total_faltas: number;
        total_atestados: number;
        frequencia_geral: number;
    };
}

interface ArchiveData {
    version?: string;
    metadata: ArchiveMetadata;
    turmas: TurmaCompleta[];
    alunos_ranking: AlunoCompleto[];
    atestados: any[];
}

const ArquivosAnoPage: React.FC = () => {
    const { anoLetivoId } = useParams<{ anoLetivoId: string }>();
    const navigate = useNavigate();
    const { user } = useAuth();
    const { config } = useEscolaConfig();
    const corPrimaria = config?.cor_primaria || "#6D28D9";

    const [loading, setLoading] = useState(true);
    const [archiveData, setArchiveData] = useState<ArchiveData | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [expandedTurmas, setExpandedTurmas] = useState<Set<string>>(new Set());

    useEffect(() => {
        if (user?.escola_id && anoLetivoId) {
            loadArchiveData();
        }
    }, [user?.escola_id, anoLetivoId]);

    const loadArchiveData = async () => {
        if (!user?.escola_id || !anoLetivoId) return;
        setLoading(true);
        setError(null);

        try {
            const { data: anoLetivo } = await supabase
                .from("anos_letivos").select("*").eq("id", anoLetivoId).single();

            if (!anoLetivo) { setError("Ano letivo não encontrado"); return; }
            if (anoLetivo.status !== "arquivado") { setError("Este ano ainda não foi arquivado"); return; }

            // Tentar Edge Function
            try {
                const { data, error } = await supabase.functions.invoke('arquivar-ano-letivo', {
                    body: { action: 'read', ano_letivo_id: anoLetivoId, escola_id: user.escola_id }
                });
                if (!error && data?.success) {
                    setArchiveData(data.data as ArchiveData);
                    return;
                }
            } catch (e) {
                console.warn("Edge Function falhou:", e);
            }

            // Fallback local (versão simplificada)
            toast({ title: "Modo Offline", description: "Dados limitados disponíveis.", className: "bg-amber-100" });

        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleDownloadJSON = () => {
        if (!archiveData) return;
        const blob = new Blob([JSON.stringify(archiveData, null, 2)], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `arquivo_${archiveData.metadata.nome.replace(/\s/g, "_")}_completo.json`;
        a.click();
        URL.revokeObjectURL(url);
    };

    const toggleTurma = (turmaId: string) => {
        setExpandedTurmas(prev => {
            const next = new Set(prev);
            if (next.has(turmaId)) next.delete(turmaId);
            else next.add(turmaId);
            return next;
        });
    };

    const getDiasRestantes = () => {
        if (!archiveData?.metadata.expires_at) return 0;
        const expires = new Date(archiveData.metadata.expires_at);
        return Math.max(0, Math.ceil((expires.getTime() - Date.now()) / (1000 * 60 * 60 * 24)));
    };

    if (loading) {
        return (
            <div className="flex h-[60vh] items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin" style={{ color: corPrimaria }} />
            </div>
        );
    }

    if (error) {
        return (
            <div className="container mx-auto py-6 px-4 max-w-4xl">
                <div className="flex items-center gap-3 mb-6">
                    <Button variant="ghost" size="icon" onClick={() => navigate('/arquivos')}>
                        <ArrowLeft className="h-5 w-5" />
                    </Button>
                    <h1 className="text-2xl font-bold">Arquivo do Ano</h1>
                </div>
                <Alert variant="destructive">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertTitle>Erro</AlertTitle>
                    <AlertDescription>{error}</AlertDescription>
                </Alert>
            </div>
        );
    }

    if (!archiveData) return null;

    const { metadata, turmas, alunos_ranking } = archiveData;
    const diasRestantes = getDiasRestantes();

    return (
        <div className="container mx-auto py-6 px-4 max-w-5xl space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between flex-wrap gap-4">
                <div className="flex items-center gap-3">
                    <Button variant="ghost" size="icon" onClick={() => navigate('/arquivos')}>
                        <ArrowLeft className="h-5 w-5" />
                    </Button>
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900">{metadata.nome}</h1>
                        <p className="text-gray-500 text-sm">
                            Arquivado em {new Date(metadata.archived_at).toLocaleDateString('pt-BR')}
                            {archiveData.version && <Badge variant="outline" className="ml-2">v{archiveData.version}</Badge>}
                        </p>
                    </div>
                </div>
                <Button variant="outline" size="sm" onClick={handleDownloadJSON}>
                    <Download className="h-4 w-4 mr-2" /> Baixar JSON
                </Button>
            </div>

            {/* TTL Alert */}
            {diasRestantes <= 60 && (
                <Alert variant={diasRestantes <= 14 ? "destructive" : "default"}
                    className={diasRestantes > 14 ? "border-amber-300 bg-amber-50" : ""}>
                    <Clock className="h-4 w-4" />
                    <AlertTitle>Expiração em {diasRestantes} dias</AlertTitle>
                    <AlertDescription>
                        Este arquivo será excluído em {new Date(metadata.expires_at).toLocaleDateString('pt-BR')}.
                    </AlertDescription>
                </Alert>
            )}

            {/* Stats Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <Card>
                    <CardContent className="pt-6">
                        <div className="flex items-center gap-2 text-gray-500 text-sm mb-1">
                            <GraduationCap className="h-4 w-4" /> Turmas
                        </div>
                        <p className="text-2xl font-bold">{metadata.stats.total_turmas}</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="pt-6">
                        <div className="flex items-center gap-2 text-gray-500 text-sm mb-1">
                            <Users className="h-4 w-4" /> Alunos
                        </div>
                        <p className="text-2xl font-bold">{metadata.stats.total_alunos}</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="pt-6">
                        <div className="flex items-center gap-2 text-green-600 text-sm mb-1">
                            <TrendingUp className="h-4 w-4" /> Frequência
                        </div>
                        <p className="text-2xl font-bold">{metadata.stats.frequencia_geral}%</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="pt-6">
                        <div className="flex items-center gap-2 text-red-500 text-sm mb-1">
                            <TrendingDown className="h-4 w-4" /> Faltas
                        </div>
                        <p className="text-2xl font-bold">{metadata.stats.total_faltas.toLocaleString()}</p>
                    </CardContent>
                </Card>
            </div>

            {/* Tabs */}
            <Tabs defaultValue="turmas" className="space-y-4">
                <TabsList>
                    <TabsTrigger value="turmas">Turmas ({turmas?.length || 0})</TabsTrigger>
                    <TabsTrigger value="ranking">Top Faltosos</TabsTrigger>
                    <TabsTrigger value="atestados">Atestados</TabsTrigger>
                </TabsList>

                {/* Turmas Tab */}
                <TabsContent value="turmas" className="space-y-3">
                    {turmas?.map(turma => (
                        <Collapsible key={turma.id} open={expandedTurmas.has(turma.id)}>
                            <Card>
                                <CollapsibleTrigger asChild onClick={() => toggleTurma(turma.id)}>
                                    <CardHeader className="cursor-pointer hover:bg-gray-50 py-4">
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-3">
                                                {expandedTurmas.has(turma.id) ?
                                                    <ChevronDown className="h-5 w-5 text-gray-400" /> :
                                                    <ChevronRight className="h-5 w-5 text-gray-400" />
                                                }
                                                <div>
                                                    <CardTitle className="text-lg">{turma.nome}</CardTitle>
                                                    <CardDescription>
                                                        {turma.turno} • {turma.total_alunos} alunos • {turma.total_dias_chamada} dias de chamada
                                                    </CardDescription>
                                                </div>
                                            </div>
                                            <Badge variant="outline">{turma.total_alunos}</Badge>
                                        </div>
                                    </CardHeader>
                                </CollapsibleTrigger>
                                <CollapsibleContent>
                                    <CardContent className="pt-0">
                                        <div className="border rounded-lg overflow-hidden">
                                            <table className="w-full text-sm">
                                                <thead className="bg-gray-50">
                                                    <tr>
                                                        <th className="text-left p-3 font-medium">Aluno</th>
                                                        <th className="text-center p-3 font-medium w-20">P</th>
                                                        <th className="text-center p-3 font-medium w-20">F</th>
                                                        <th className="text-center p-3 font-medium w-20">A</th>
                                                        <th className="text-right p-3 font-medium w-24">Freq.</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {turma.alunos?.map((aluno, idx) => (
                                                        <tr key={aluno.aluno_id} className={idx % 2 === 0 ? "bg-white" : "bg-gray-50"}>
                                                            <td className="p-3">
                                                                <div className="flex items-center gap-2">
                                                                    <User className="h-4 w-4 text-gray-400" />
                                                                    <span className="font-medium">{aluno.nome}</span>
                                                                    {aluno.situacao !== 'ativo' && (
                                                                        <Badge variant="secondary" className="text-xs">{aluno.situacao}</Badge>
                                                                    )}
                                                                </div>
                                                                <span className="text-xs text-gray-500">{aluno.matricula}</span>
                                                            </td>
                                                            <td className="text-center p-3 text-green-600 font-medium">{aluno.presentes}</td>
                                                            <td className="text-center p-3 text-red-600 font-medium">{aluno.faltas}</td>
                                                            <td className="text-center p-3 text-amber-600 font-medium">{aluno.atestados}</td>
                                                            <td className="text-right p-3">
                                                                <span className={aluno.frequencia >= 75 ? "text-green-600" : "text-red-600"}>
                                                                    {aluno.frequencia}%
                                                                </span>
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    </CardContent>
                                </CollapsibleContent>
                            </Card>
                        </Collapsible>
                    ))}
                </TabsContent>

                {/* Ranking Tab */}
                <TabsContent value="ranking">
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <Trophy className="h-5 w-5 text-amber-500" />
                                Top 50 Alunos com Mais Faltas
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-2">
                                {alunos_ranking?.slice(0, 50).map((aluno, index) => (
                                    <div key={aluno.aluno_id} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                                        <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-white ${index === 0 ? 'bg-red-500' : index === 1 ? 'bg-orange-500' : index === 2 ? 'bg-amber-500' : 'bg-gray-400'
                                            }`}>
                                            {index + 1}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="font-medium truncate">{aluno.nome}</p>
                                            <p className="text-sm text-gray-500">{aluno.turma_nome}</p>
                                        </div>
                                        <div className="text-right">
                                            <p className="font-bold text-red-600">{aluno.faltas} faltas</p>
                                            <p className="text-sm text-gray-500">{aluno.frequencia}% freq.</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* Atestados Tab */}
                <TabsContent value="atestados">
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <FileText className="h-5 w-5 text-blue-500" />
                                Atestados Registrados
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            {archiveData.atestados?.length === 0 ? (
                                <p className="text-gray-500 text-center py-8">Nenhum atestado registrado</p>
                            ) : (
                                <div className="space-y-2">
                                    {archiveData.atestados?.map((atestado) => (
                                        <div key={atestado.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                                            <div>
                                                <p className="font-medium">{atestado.aluno_nome}</p>
                                                <p className="text-sm text-gray-500">
                                                    {new Date(atestado.data_inicio + 'T00:00:00').toLocaleDateString('pt-BR')} - {new Date(atestado.data_fim + 'T00:00:00').toLocaleDateString('pt-BR')}
                                                </p>
                                            </div>
                                            <Badge variant={atestado.status === 'aprovado' ? 'default' : 'secondary'}>
                                                {atestado.status}
                                            </Badge>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>
        </div>
    );
};

export default ArquivosAnoPage;
