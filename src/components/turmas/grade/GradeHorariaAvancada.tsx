import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
    Save,
    Loader2,
    Wand2,
    Trash2,
    RefreshCw,
    Coffee,
    AlertTriangle
} from "lucide-react";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useEscolaConfig } from "@/contexts/EscolaConfigContext";

// --- TIPOS ---
interface Disciplina {
    id: string;
    nome: string;
}

interface GradeSlot {
    horario_inicio: string;
    horario_fim: string;
    isIntervalo?: boolean;
    dias: {
        [key: number]: string;
    };
}

interface GradeHorariaAvancadaProps {
    turmaId: string;
}

const addMinutes = (time: string, mins: number) => {
    const [h, m] = time.split(':').map(Number);
    const date = new Date();
    date.setHours(h, m, 0, 0);
    date.setMinutes(date.getMinutes() + mins);
    return date.toTimeString().slice(0, 5);
};

export function GradeHorariaAvancada({ turmaId }: GradeHorariaAvancadaProps) {
    const { config } = useEscolaConfig();
    const { toast } = useToast();

    // Dados
    const [disciplinas, setDisciplinas] = useState<Disciplina[]>([]);
    const [slots, setSlots] = useState<GradeSlot[]>([]);

    // Estados de Interface
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [deleting, setDeleting] = useState(false);
    const [errorMsg, setErrorMsg] = useState<string | null>(null);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

    // Config do Gerador
    const [horaInicio, setHoraInicio] = useState("07:00");
    const [qtdAulas, setQtdAulas] = useState("5");
    const [duracaoAula, setDuracaoAula] = useState("50");
    const [temIntervalo, setTemIntervalo] = useState(true);
    const [posicaoIntervalo, setPosicaoIntervalo] = useState("3");
    const [duracaoIntervalo, setDuracaoIntervalo] = useState("20");

    // --- BUSCA DE DADOS ---
    const fetchData = useCallback(async () => {
        setLoading(true);
        setErrorMsg(null);

        try {
            let activeEscolaId = config?.id; // Usando a propriedade correta do seu contexto

            // Fallback de segurança se o contexto não tiver carregado
            if (!activeEscolaId) {
                const { data: session } = await supabase.auth.getSession();
                activeEscolaId = session.session?.user?.user_metadata?.escola_id;
                if (!activeEscolaId) {
                    const { data: roleData } = await supabase.from('user_roles').select('escola_id').maybeSingle();
                    activeEscolaId = roleData?.escola_id;
                }
            }

            if (!activeEscolaId) throw new Error("ID da escola não encontrado.");

            const { data: discData, error: discError } = await supabase
                .from("disciplinas")
                .select("id, nome")
                .eq("escola_id", activeEscolaId)
                .order("nome");

            if (discError) throw discError;
            setDisciplinas(discData || []);

            const { data: gradeData, error: gradeError } = await supabase
                .from("grade_horaria")
                .select("*")
                .eq("turma_id", turmaId)
                .order("horario_inicio");

            if (gradeError) throw gradeError;

            if (gradeData && gradeData.length > 0) {
                reconstruirGradeVisual(gradeData);
            } else {
                setSlots([]);
            }

        } catch (error: any) {
            console.error("Erro grade:", error);
            setErrorMsg("Erro ao carregar dados.");
        } finally {
            setLoading(false);
        }
    }, [turmaId, config]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const reconstruirGradeVisual = (dadosBanco: any[]) => {
        const horariosSet = new Set(dadosBanco.map(d => `${d.horario_inicio.slice(0, 5)}-${d.horario_fim.slice(0, 5)}`));
        const horariosUnicos = Array.from(horariosSet).sort();

        const novosSlots: GradeSlot[] = horariosUnicos.map(horario => {
            const [inicio, fim] = horario.split('-');
            const aulasNoHorario = dadosBanco.filter(d => d.horario_inicio.slice(0, 5) === inicio);
            const diasMap: { [key: number]: string } = {};
            aulasNoHorario.forEach(a => {
                diasMap[a.dia_semana] = a.disciplina_id;
            });

            return {
                horario_inicio: inicio,
                horario_fim: fim,
                dias: diasMap,
                isIntervalo: false
            };
        });
        setSlots(novosSlots);
    };

    const gerarGradeEstrutura = () => {
        const qtd = parseInt(qtdAulas) || 5;
        const duracao = parseInt(duracaoAula) || 50;
        const posInt = parseInt(posicaoIntervalo) || 3;
        const durInt = parseInt(duracaoIntervalo) || 20;

        let horaAtual = horaInicio;
        const novosSlots: GradeSlot[] = [];

        for (let i = 1; i <= qtd; i++) {
            const fimAula = addMinutes(horaAtual, duracao);
            novosSlots.push({
                horario_inicio: horaAtual,
                horario_fim: fimAula,
                dias: {},
                isIntervalo: false
            });
            horaAtual = fimAula;

            if (temIntervalo && i === posInt) {
                const fimIntervalo = addMinutes(horaAtual, durInt);
                novosSlots.push({
                    horario_inicio: horaAtual,
                    horario_fim: fimIntervalo,
                    dias: {},
                    isIntervalo: true
                });
                horaAtual = fimIntervalo;
            }
        }
        setSlots(novosSlots);
        toast({ title: "Grade gerada!", description: "Preencha as matérias." });
    };

    const updateCelula = (slotIndex: number, dia: number, disciplinaId: string) => {
        const novosSlots = [...slots];
        novosSlots[slotIndex].dias[dia] = disciplinaId;
        setSlots(novosSlots);
    };

    const handleDeleteAll = async () => {
        setDeleting(true);
        try {
            const { error } = await supabase.from("grade_horaria").delete().eq("turma_id", turmaId);
            if (error) throw error;

            setSlots([]);
            setShowDeleteConfirm(false);
            toast({ title: "Grade excluída com sucesso" });
        } catch (error: any) {
            toast({ variant: "destructive", title: "Erro ao excluir", description: error.message });
        } finally {
            setDeleting(false);
        }
    };

    const handleSaveAll = async () => {
        setSaving(true);
        try {
            const { data: { session } } = await supabase.auth.getSession();
            const escolaId = session?.user?.user_metadata?.escola_id
                || config?.id
                || (await supabase.from('user_roles').select('escola_id').maybeSingle()).data?.escola_id;

            if (!escolaId) throw new Error("Escola não identificada.");

            await supabase.from("grade_horaria").delete().eq("turma_id", turmaId);

            const inserts = [];
            for (const slot of slots) {
                if (slot.isIntervalo) continue;

                for (let dia = 2; dia <= 6; dia++) {
                    const discId = slot.dias[dia];
                    if (discId) {
                        inserts.push({
                            escola_id: escolaId,
                            turma_id: turmaId,
                            disciplina_id: discId,
                            dia_semana: dia,
                            horario_inicio: slot.horario_inicio,
                            horario_fim: slot.horario_fim
                        });
                    }
                }
            }

            if (inserts.length > 0) {
                const { error } = await supabase.from("grade_horaria").insert(inserts);
                if (error) throw error;
            }

            toast({ title: "Grade salva!", className: "bg-green-600 text-white" });
        } catch (error: any) {
            console.error(error);
            toast({ variant: "destructive", title: "Erro ao salvar", description: error.message });
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return (
            <div className="flex justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        );
    }

    if (errorMsg) {
        return (
            <div className="flex flex-col items-center justify-center py-10 gap-3">
                <p className="text-red-500 font-medium">{errorMsg}</p>
                <Button variant="outline" onClick={fetchData} className="gap-2">
                    <RefreshCw className="h-4 w-4" /> Tentar Novamente
                </Button>
            </div>
        );
    }

    return (
        <div className="space-y-6 w-full max-w-full">

            {/* 1. CONFIGURAÇÃO (RESPONSIVO E COM INPUTS MAIORES) */}
            <Card className="bg-slate-50 border-dashed border-slate-200">
                <CardContent className="p-3 sm:p-4 space-y-4">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 text-slate-700">
                            <Wand2 className="h-4 w-4 text-purple-600" />
                            <h3 className="font-semibold text-sm">Gerador Automático</h3>
                        </div>

                        {slots.length > 0 && (
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setShowDeleteConfirm(true)}
                                className="h-10 text-red-500 hover:text-red-700 hover:bg-red-50 px-3"
                            >
                                <Trash2 className="h-4 w-4 mr-2" /> Excluir Grade
                            </Button>
                        )}
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div className="space-y-1">
                            <Label className="text-xs text-slate-500 font-semibold">Início</Label>
                            <Input type="time" value={horaInicio} onChange={e => setHoraInicio(e.target.value)} className="h-10 bg-white" />
                        </div>
                        <div className="space-y-1">
                            <Label className="text-xs text-slate-500 font-semibold">Qtd Aulas</Label>
                            <Input type="number" value={qtdAulas} onChange={e => setQtdAulas(e.target.value)} className="h-10 bg-white" />
                        </div>
                        <div className="space-y-1">
                            <Label className="text-xs text-slate-500 font-semibold">Min/Aula</Label>
                            <Input type="number" value={duracaoAula} onChange={e => setDuracaoAula(e.target.value)} className="h-10 bg-white" />
                        </div>
                        <div className="flex items-end col-span-2 md:col-span-1">
                            <Button onClick={gerarGradeEstrutura} className="w-full h-10 bg-purple-600 hover:bg-purple-700 active:scale-95 transition-all text-sm font-bold">
                                Gerar
                            </Button>
                        </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 text-sm text-slate-600 pt-4 border-t border-slate-200/50 mt-2">
                        <div className="flex items-center gap-2 mr-2 mb-2 sm:mb-0">
                            <input
                                type="checkbox"
                                checked={temIntervalo}
                                onChange={e => setTemIntervalo(e.target.checked)}
                                id="intCheck"
                                className="w-5 h-5 accent-purple-600 cursor-pointer"
                            />
                            <Label htmlFor="intCheck" className="cursor-pointer font-medium text-slate-700">Intervalo</Label>
                        </div>

                        {temIntervalo && (
                            <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
                                <span className="whitespace-nowrap">após a</span>
                                {/* Aumentado para w-16 para caber o número "20" sem cortar */}
                                <Input
                                    type="number"
                                    value={posicaoIntervalo}
                                    onChange={e => setPosicaoIntervalo(e.target.value)}
                                    className="w-16 h-10 text-center bg-white"
                                />
                                <span>ª, de</span>
                                {/* Aumentado para w-20 para segurança */}
                                <Input
                                    type="number"
                                    value={duracaoIntervalo}
                                    onChange={e => setDuracaoIntervalo(e.target.value)}
                                    className="w-20 h-10 text-center bg-white"
                                />
                                <span>min</span>
                            </div>
                        )}
                    </div>
                </CardContent>
            </Card>

            {/* 2. TABELA COM SCROLL HORIZONTAL CORRIGIDO PARA MOBILE */}
            {slots.length === 0 ? (
                <div className="text-center py-10 text-gray-400 bg-slate-50 rounded-lg border border-dashed">
                    <p>Nenhuma grade configurada.</p>
                    <p className="text-sm">Use o gerador acima para criar os horários.</p>
                </div>
            ) : (
                <div className="border rounded-md bg-white shadow-sm overflow-hidden w-full">
                    {/* Container responsivo que força a barra de rolagem a aparecer DENTRO do card */}
                    <div className="overflow-x-auto w-full max-w-[calc(100vw-4rem)] sm:max-w-full pb-3">
                        <Table className="min-w-[800px]"> {/* Largura mínima para garantir que as colunas não amassem */}
                            <TableHeader>
                                <TableRow className="bg-slate-100/50 hover:bg-slate-100/50">
                                    <TableHead className="w-[90px] text-xs font-bold text-slate-700 border-r text-center sticky left-0 bg-slate-100 z-10 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]">Horário</TableHead>
                                    <TableHead className="text-center w-[16%] text-xs font-bold text-slate-700 border-r min-w-[120px]">Segunda</TableHead>
                                    <TableHead className="text-center w-[16%] text-xs font-bold text-slate-700 border-r min-w-[120px]">Terça</TableHead>
                                    <TableHead className="text-center w-[16%] text-xs font-bold text-slate-700 border-r min-w-[120px]">Quarta</TableHead>
                                    <TableHead className="text-center w-[16%] text-xs font-bold text-slate-700 border-r min-w-[120px]">Quinta</TableHead>
                                    <TableHead className="text-center w-[16%] text-xs font-bold text-slate-700 border-r min-w-[120px]">Sexta</TableHead>
                                    <TableHead className="w-[50px]"></TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {slots.map((slot, idx) => {
                                    if (slot.isIntervalo) {
                                        return (
                                            <TableRow key={idx} className="bg-slate-100/80 hover:bg-slate-100">
                                                <TableCell className="font-mono text-xs font-bold text-slate-500 border-r text-center sticky left-0 bg-slate-100 z-10 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]">
                                                    {slot.horario_inicio} <br /> {slot.horario_fim}
                                                </TableCell>
                                                <TableCell colSpan={5} className="text-center py-2 border-r">
                                                    <div className="flex items-center justify-center gap-2 text-xs font-bold text-slate-400 uppercase tracking-widest h-10">
                                                        <Coffee className="h-4 w-4" /> Intervalo
                                                    </div>
                                                </TableCell>
                                                <TableCell className="p-1 text-center">
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        className="h-10 w-10 text-slate-400 hover:text-red-500"
                                                        onClick={() => {
                                                            const nova = [...slots];
                                                            nova.splice(idx, 1);
                                                            setSlots(nova);
                                                        }}
                                                    >
                                                        <Trash2 className="h-4 w-4" />
                                                    </Button>
                                                </TableCell>
                                            </TableRow>
                                        );
                                    }

                                    return (
                                        <TableRow key={idx} className="hover:bg-slate-50">
                                            {/* Coluna Sticky para Mobile */}
                                            <TableCell className="font-mono text-xs font-medium text-slate-600 bg-slate-50 whitespace-nowrap border-r text-center sticky left-0 z-10 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]">
                                                {slot.horario_inicio} <br />
                                                <span className="text-slate-400">{slot.horario_fim}</span>
                                            </TableCell>

                                            {[2, 3, 4, 5, 6].map((dia) => (
                                                <TableCell key={dia} className="p-1 border-r last:border-r-0">
                                                    <select
                                                        className={`w-full h-10 text-xs border rounded px-1 focus:outline-none focus:ring-2 focus:ring-primary/20 transition-colors cursor-pointer ${slot.dias[dia] ? 'bg-white border-slate-300 text-slate-900 font-medium shadow-sm' : 'bg-slate-50/50 border-transparent text-slate-400 hover:bg-white hover:border-slate-200'}`}
                                                        value={slot.dias[dia] || ""}
                                                        onChange={(e) => updateCelula(idx, dia, e.target.value)}
                                                    >
                                                        <option value="">--</option>
                                                        {disciplinas.map(d => (
                                                            <option key={d.id} value={d.id}>{d.nome}</option>
                                                        ))}
                                                    </select>
                                                </TableCell>
                                            ))}

                                            <TableCell className="p-1 text-center">
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="h-10 w-10 text-slate-300 hover:text-red-500 hover:bg-red-50"
                                                    onClick={() => {
                                                        const nova = [...slots];
                                                        nova.splice(idx, 1);
                                                        setSlots(nova);
                                                    }}
                                                >
                                                    <Trash2 className="h-4 w-4" />
                                                </Button>
                                            </TableCell>
                                        </TableRow>
                                    );
                                })}
                            </TableBody>
                        </Table>
                    </div>
                </div>
            )}

            {/* 3. RODAPÉ DE AÇÃO FIXO NO FINAL */}
            {slots.length > 0 && (
                <div className="flex justify-end pt-4 border-t sticky bottom-0 bg-white/95 backdrop-blur-sm p-3 rounded-b-lg shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)] z-20">
                    <Button
                        onClick={handleSaveAll}
                        disabled={saving}
                        className="w-full sm:w-auto h-12 text-base font-semibold gap-2 text-white shadow-md hover:opacity-90 active:scale-95 transition-all"
                        style={{ backgroundColor: config?.cor_primaria || "#6D28D9" }}
                    >
                        {saving ? <Loader2 className="animate-spin h-5 w-5" /> : <Save className="h-5 w-5" />}
                        Salvar Grade Completa
                    </Button>
                </div>
            )}

            {/* DIÁLOGO DE CONFIRMAÇÃO DE EXCLUSÃO */}
            <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
                <AlertDialogContent className="w-[90vw] max-w-md rounded-lg">
                    <AlertDialogHeader>
                        <AlertDialogTitle className="flex items-center gap-2 text-red-600">
                            <AlertTriangle className="h-6 w-6" /> Limpar Grade?
                        </AlertDialogTitle>
                        <AlertDialogDescription>
                            Isso excluirá <strong>todas</strong> as aulas e horários configurados para esta turma.
                            <br /><br />
                            Esta ação não pode ser desfeita.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter className="flex-col gap-2 sm:flex-row">
                        <AlertDialogCancel disabled={deleting} className="w-full sm:w-auto h-12 sm:h-10">Cancelar</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={(e) => { e.preventDefault(); handleDeleteAll(); }}
                            className="bg-red-600 hover:bg-red-700 text-white w-full sm:w-auto h-12 sm:h-10"
                            disabled={deleting}
                        >
                            {deleting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Trash2 className="h-4 w-4 mr-2" />}
                            Confirmar Exclusão
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

        </div>
    );
}