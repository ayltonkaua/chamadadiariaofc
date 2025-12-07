import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Edit, Trash2, BookOpen, Loader2 } from "lucide-react";
import { useEscolaConfig } from "@/contexts/EscolaConfigContext";
import { useAuth } from "@/contexts/AuthContext"; // Para pegar o ID da escola seguro
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { DisciplinaDialog } from "@/components/disciplinas/DisciplinaDialog";
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

interface Disciplina {
    id: string;
    nome: string;
    escola_id: string;
}

export default function DisciplinasPage() {
    const { config } = useEscolaConfig(); // Cores
    const { user } = useAuth(); // ID Seguro
    const escolaId = user?.escola_id;
    const { toast } = useToast();

    const [disciplinas, setDisciplinas] = useState<Disciplina[]>([]);
    const [loading, setLoading] = useState(true);

    // Modais
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [editingItem, setEditingItem] = useState<Disciplina | null>(null);
    const [deleteItem, setDeleteItem] = useState<Disciplina | null>(null);

    const fetchDisciplinas = async () => {
        if (!escolaId) return;
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from("disciplinas")
                .select("*")
                .eq("escola_id", escolaId)
                .order("nome");

            if (error) throw error;
            setDisciplinas(data || []);
        } catch (error) {
            console.error(error);
            toast({ variant: "destructive", title: "Erro ao carregar disciplinas" });
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchDisciplinas();
    }, [escolaId]);

    const handleDelete = async () => {
        if (!deleteItem) return;
        try {
            const { error } = await supabase
                .from("disciplinas")
                .delete()
                .eq("id", deleteItem.id);

            if (error) throw error;
            toast({ title: "Disciplina removida" });
            fetchDisciplinas();
        } catch (error) {
            toast({ variant: "destructive", title: "Erro ao remover", description: "Pode haver dados vinculados a esta matéria." });
        } finally {
            setDeleteItem(null);
        }
    };

    if (!escolaId && loading) {
        return <div className="flex h-screen items-center justify-center"><Loader2 className="animate-spin text-primary" /></div>;
    }

    return (
        <div className="p-6 space-y-6 animate-in fade-in">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900">Disciplinas</h1>
                    <p className="text-gray-500">Grade curricular para Boletins e Horários.</p>
                </div>
                <Button
                    onClick={() => { setEditingItem(null); setIsDialogOpen(true); }}
                    className="gap-2 text-white shadow-md hover:opacity-90"
                    style={{ backgroundColor: config.cor_primaria || "#6D28D9" }}
                >
                    <Plus className="h-4 w-4" /> Nova Disciplina
                </Button>
            </div>

            <Card className="border-t-4" style={{ borderTopColor: config.cor_primaria || "#6D28D9" }}>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-lg">
                        <BookOpen className="h-5 w-5 text-gray-500" />
                        Matérias Cadastradas
                    </CardTitle>
                    <CardDescription>
                        Estas matérias serão usadas para lançar notas e configurar a grade horária do aluno.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    {loading ? (
                        <div className="text-center py-10 text-gray-500 flex justify-center"><Loader2 className="animate-spin" /></div>
                    ) : disciplinas.length === 0 ? (
                        <div className="text-center py-12 bg-slate-50 rounded-lg border border-dashed">
                            <BookOpen className="h-10 w-10 mx-auto text-gray-300 mb-2" />
                            <p className="text-gray-500 font-medium">Nenhuma disciplina cadastrada.</p>
                            <p className="text-sm text-gray-400">Clique em "Nova Disciplina" para começar.</p>
                        </div>
                    ) : (
                        <div className="rounded-md border">
                            <Table>
                                <TableHeader>
                                    <TableRow className="bg-slate-50">
                                        <TableHead>Nome da Matéria</TableHead>
                                        <TableHead className="text-right">Ações</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {disciplinas.map((disc) => (
                                        <TableRow key={disc.id} className="hover:bg-slate-50">
                                            <TableCell className="font-medium text-base">{disc.nome}</TableCell>
                                            <TableCell className="text-right space-x-1">
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    onClick={() => { setEditingItem(disc); setIsDialogOpen(true); }}
                                                    title="Editar Nome"
                                                >
                                                    <Edit className="h-4 w-4 text-blue-600" />
                                                </Button>
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    onClick={() => setDeleteItem(disc)}
                                                    title="Excluir Matéria"
                                                >
                                                    <Trash2 className="h-4 w-4 text-red-600" />
                                                </Button>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* MODAL EDITAR/CRIAR */}
            <DisciplinaDialog
                open={isDialogOpen}
                onOpenChange={setIsDialogOpen}
                disciplinaToEdit={editingItem}
                onSuccess={fetchDisciplinas}
            />

            {/* CONFIRMAÇÃO DE EXCLUSÃO */}
            <AlertDialog open={!!deleteItem} onOpenChange={() => setDeleteItem(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Excluir Disciplina?</AlertDialogTitle>
                        <AlertDialogDescription>
                            Você tem certeza que deseja excluir <strong>{deleteItem?.nome}</strong>?
                            Isso pode afetar históricos escolares e grades horárias já configuradas.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <AlertDialogAction onClick={handleDelete} className="bg-red-600 hover:bg-red-700 text-white">
                            Excluir Definitivamente
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}
