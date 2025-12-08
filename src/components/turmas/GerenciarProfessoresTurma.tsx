import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Trash2, UserPlus, ShieldAlert } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";

interface Professor {
    id: string;
    nome: string;
    email: string;
    role: string;
}

interface GerenciarProfessoresTurmaProps {
    turmaId: string;
    escolaId: string;
}

export function GerenciarProfessoresTurma({ turmaId, escolaId }: GerenciarProfessoresTurmaProps) {
    const { toast } = useToast();
    const [loading, setLoading] = useState(true);
    const [professoresVinculados, setProfessoresVinculados] = useState<Professor[]>([]);
    const [todosProfessores, setTodosProfessores] = useState<Professor[]>([]);
    const [selectedProfId, setSelectedProfId] = useState<string>("");

    const fetchData = useCallback(async () => {
        if (!turmaId || !escolaId) return;

        setLoading(true);
        try {
            // CORREÇÃO 1: Usar RPC segura em vez de View inexistente
            // A função get_school_users já filtra por escola e segurança
            const { data: usersData, error: errorUsers } = await supabase
                .rpc('get_school_users', { _escola_id: escolaId });

            if (errorUsers) throw errorUsers;

            // Filtrar apenas quem é professor ou coordenador
            // Mapear user_id (do RPC) para id (do frontend)
            const listaProfessores = (usersData || [])
                .filter((u: any) => ['professor', 'coordenador'].includes(u.role))
                .map((u: any) => ({
                    id: u.user_id, // RPC retorna user_id
                    nome: u.nome,
                    email: u.email,
                    role: u.role
                }));

            // 2. Buscar vínculos atuais desta turma
            const { data: links, error: errorLinks } = await supabase
                .from('turma_professores')
                .select('professor_id')
                .eq('turma_id', turmaId);

            if (errorLinks) throw errorLinks;

            const idsVinculados = links.map((l) => l.professor_id);

            setTodosProfessores(listaProfessores);
            setProfessoresVinculados(
                listaProfessores.filter((p) => idsVinculados.includes(p.id))
            );

        } catch (error: any) {
            console.error("Erro ao carregar professores:", error);
            toast({
                variant: "destructive",
                title: "Erro ao carregar",
                description: error.message || "Não foi possível buscar a lista de professores.",
            });
        } finally {
            setLoading(false);
        }
    }, [turmaId, escolaId, toast]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const handleAddProfessor = async () => {
        if (!selectedProfId) return;

        try {
            // CORREÇÃO 2: Remover 'as any' para garantir tipagem se possível
            const { error } = await supabase
                .from('turma_professores')
                .insert({
                    turma_id: turmaId,
                    professor_id: selectedProfId,
                    escola_id: escolaId
                });

            if (error) {
                // Tratamento específico para duplicidade
                if (error.code === '23505') throw new Error("Professor já está na turma.");
                throw error;
            }

            toast({ title: "Professor vinculado com sucesso!", className: "bg-green-600 text-white" });
            setSelectedProfId("");
            fetchData();
        } catch (error: any) {
            toast({
                variant: "destructive",
                title: "Erro ao vincular",
                description: error.message || "Ocorreu um erro ao tentar vincular.",
            });
        }
    };

    const handleRemoveProfessor = async (profId: string) => {
        try {
            const { error } = await supabase
                .from('turma_professores')
                .delete()
                .eq('turma_id', turmaId)
                .eq('professor_id', profId);

            if (error) throw error;

            toast({ title: "Vínculo removido." });
            fetchData();
        } catch (error) {
            toast({ variant: "destructive", title: "Erro ao remover" });
        }
    };

    if (loading) return <Skeleton className="h-[200px] w-full rounded-xl" />;

    const disponiveisParaAdicionar = todosProfessores.filter(
        p => !professoresVinculados.some(v => v.id === p.id)
    );

    return (
        <div className="space-y-6 py-4 animate-in fade-in">
            {/* Área de Adicionar */}
            <div className="flex flex-col sm:flex-row gap-3 items-end bg-slate-50 p-4 rounded-xl border border-slate-100 shadow-sm">
                <div className="flex-1 space-y-2 w-full">
                    <label className="text-sm font-semibold text-slate-700">Adicionar Professor à Turma</label>
                    <Select value={selectedProfId} onValueChange={setSelectedProfId}>
                        <SelectTrigger className="bg-white">
                            <SelectValue placeholder="Selecione um professor..." />
                        </SelectTrigger>
                        <SelectContent>
                            {disponiveisParaAdicionar.length === 0 ? (
                                <SelectItem value="empty" disabled>Nenhum disponível</SelectItem>
                            ) : (
                                disponiveisParaAdicionar.map((prof) => (
                                    <SelectItem key={prof.id} value={prof.id}>
                                        {prof.nome} <span className="text-xs text-muted-foreground">({prof.role})</span>
                                    </SelectItem>
                                ))
                            )}
                        </SelectContent>
                    </Select>
                </div>
                <Button onClick={handleAddProfessor} disabled={!selectedProfId} className="w-full sm:w-auto">
                    <UserPlus className="w-4 h-4 mr-2" />
                    Vincular
                </Button>
            </div>

            {/* Lista de Vinculados */}
            <div className="space-y-3">
                <h4 className="text-sm font-semibold text-slate-500 uppercase tracking-wider">Professores Vinculados ({professoresVinculados.length})</h4>

                {professoresVinculados.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-10 text-slate-400 border-2 border-dashed border-slate-200 rounded-xl bg-slate-50/50">
                        <ShieldAlert className="w-10 h-10 mb-2 opacity-20" />
                        <p className="text-sm font-medium">Nenhum professor vinculado.</p>
                        <p className="text-xs">Esta turma não aparecerá no painel de nenhum professor.</p>
                    </div>
                ) : (
                    <div className="grid gap-3 sm:grid-cols-2">
                        {professoresVinculados.map((prof) => (
                            <Card key={prof.id} className="overflow-hidden border-slate-200 shadow-sm hover:shadow-md transition-shadow">
                                <CardContent className="p-3 flex items-center justify-between">
                                    <div className="flex items-center gap-3 overflow-hidden">
                                        <Avatar className="h-9 w-9 border-2 border-white shadow-sm bg-purple-100 text-purple-700">
                                            <AvatarFallback>{prof.nome?.substring(0, 2).toUpperCase()}</AvatarFallback>
                                        </Avatar>
                                        <div className="min-w-0">
                                            <p className="text-sm font-bold text-slate-800 truncate">{prof.nome}</p>
                                            <p className="text-xs text-slate-500 truncate">{prof.email}</p>
                                        </div>
                                    </div>
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className="text-slate-400 hover:text-red-600 hover:bg-red-50 shrink-0"
                                        onClick={() => handleRemoveProfessor(prof.id)}
                                        title="Remover acesso"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </Button>
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}