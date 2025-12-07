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

    // Função isolada e memoizada para evitar loops
    const fetchData = useCallback(async () => {
        if (!turmaId || !escolaId) return;

        setLoading(true);
        try {
            // 1. Buscar todos os professores da escola
            const { data: allProfs, error: errorProfs } = await supabase
                .from('dados_usuarios_view' as any)
                .select('*')
                .eq('escola_id', escolaId)
                .in('role', ['professor', 'coordenador']);

            if (errorProfs) throw errorProfs;

            // 2. Buscar vínculos atuais desta turma
            const { data: links, error: errorLinks } = await supabase
                .from('turma_professores' as any)
                .select('professor_id')
                .eq('turma_id', turmaId);

            if (errorLinks) throw errorLinks;

            // Filtrar quem já está vinculado
            const idsVinculados = links.map((l: any) => l.professor_id);

            setTodosProfessores(allProfs || []);
            setProfessoresVinculados(
                (allProfs || []).filter((p: any) => idsVinculados.includes(p.id))
            );

        } catch (error) {
            console.error("Erro ao carregar professores:", error);
            toast({
                variant: "destructive",
                title: "Erro ao carregar",
                description: "Não foi possível buscar a lista de professores.",
            });
        } finally {
            setLoading(false);
        }
    }, [turmaId, escolaId, toast]);

    // Efeito que chama a busca
    useEffect(() => {
        fetchData();
    }, [fetchData]);

    // Adicionar Professor
    const handleAddProfessor = async () => {
        if (!selectedProfId) return;

        try {
            const { error } = await supabase
                .from('turma_professores' as any)
                .insert({
                    turma_id: turmaId,
                    professor_id: selectedProfId,
                    escola_id: escolaId
                });

            if (error) throw error;

            toast({ title: "Professor adicionado com sucesso!" });
            setSelectedProfId("");
            fetchData(); // Recarrega a lista
        } catch (error) {
            toast({
                variant: "destructive",
                title: "Erro ao vincular",
                description: "Talvez este professor já esteja vinculado.",
            });
        }
    };

    // Remover Professor
    const handleRemoveProfessor = async (profId: string) => {
        try {
            const { error } = await supabase
                .from('turma_professores' as any)
                .delete()
                .eq('turma_id', turmaId)
                .eq('professor_id', profId);

            if (error) throw error;

            toast({ title: "Professor removido da turma." });
            fetchData();
        } catch (error) {
            toast({ variant: "destructive", title: "Erro ao remover" });
        }
    };

    if (loading) return <Skeleton className="h-[200px] w-full" />;

    const disponiveisParaAdicionar = todosProfessores.filter(
        p => !professoresVinculados.some(v => v.id === p.id)
    );

    return (
        <div className="space-y-6 py-4">
            {/* Área de Adicionar */}
            <div className="flex gap-2 items-end bg-slate-50 p-4 rounded-lg border">
                <div className="flex-1 space-y-2">
                    <label className="text-sm font-medium">Adicionar Professor à Turma</label>
                    <Select value={selectedProfId} onValueChange={setSelectedProfId}>
                        <SelectTrigger>
                            <SelectValue placeholder="Selecione um professor..." />
                        </SelectTrigger>
                        <SelectContent>
                            {disponiveisParaAdicionar.length === 0 ? (
                                <SelectItem value="empty" disabled>Nenhum professor disponível</SelectItem>
                            ) : (
                                disponiveisParaAdicionar.map((prof) => (
                                    <SelectItem key={prof.id} value={prof.id}>
                                        {prof.nome || prof.email}
                                    </SelectItem>
                                ))
                            )}
                        </SelectContent>
                    </Select>
                </div>
                <Button onClick={handleAddProfessor} disabled={!selectedProfId}>
                    <UserPlus className="w-4 h-4 mr-2" />
                    Vincular
                </Button>
            </div>

            {/* Lista de Vinculados */}
            <div className="space-y-3">
                <h4 className="text-sm font-semibold text-muted-foreground">Professores Vinculados ({professoresVinculados.length})</h4>

                {professoresVinculados.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground border-2 border-dashed rounded-lg">
                        <ShieldAlert className="w-8 h-8 mx-auto mb-2 opacity-50" />
                        <p>Nenhum professor vinculado a esta turma.</p>
                    </div>
                ) : (
                    professoresVinculados.map((prof) => (
                        <Card key={prof.id} className="overflow-hidden">
                            <CardContent className="p-3 flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <Avatar className="h-8 w-8">
                                        <AvatarFallback>{prof.nome?.substring(0, 2).toUpperCase() || "PR"}</AvatarFallback>
                                    </Avatar>
                                    <div>
                                        <p className="text-sm font-medium leading-none">{prof.nome}</p>
                                        <p className="text-xs text-muted-foreground">{prof.email}</p>
                                    </div>
                                </div>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="text-red-500 hover:text-red-700 hover:bg-red-50"
                                    onClick={() => handleRemoveProfessor(prof.id)}
                                >
                                    <Trash2 className="w-4 h-4" />
                                </Button>
                            </CardContent>
                        </Card>
                    ))
                )}
            </div>
        </div>
    );
}
