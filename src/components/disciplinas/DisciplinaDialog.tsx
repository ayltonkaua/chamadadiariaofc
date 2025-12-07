import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useEscolaConfig } from "@/contexts/EscolaConfigContext";

interface Disciplina {
    id: string;
    nome: string;
    escola_id: string;
}

interface DisciplinaDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    disciplinaToEdit: Disciplina | null;
    onSuccess: () => void;
}

export function DisciplinaDialog({ open, onOpenChange, disciplinaToEdit, onSuccess }: DisciplinaDialogProps) {
    const [nome, setNome] = useState("");
    const [loading, setLoading] = useState(false);
    const { toast } = useToast();

    // Usando o contexto corrigido
    const { config } = useEscolaConfig();
    // Se não tiver ID carregado (raro), não deixa salvar
    const escolaId = config?.nome ? (supabase.auth.getUser().then(u => u.data.user?.user_metadata.escola_id) || null) : null;
    // Nota: O ideal é pegar o ID do user no AuthContext, mas usaremos a config para estilização

    // Atualiza campo ao abrir edição
    useEffect(() => {
        if (disciplinaToEdit) {
            setNome(disciplinaToEdit.nome);
        } else {
            setNome("");
        }
    }, [disciplinaToEdit, open]);

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);

        try {
            // Pequeno truque para garantir o ID da escola correto via sessão atual
            const { data: { session } } = await supabase.auth.getSession();
            const userEscolaId = session?.user?.user_metadata?.escola_id;

            if (!userEscolaId) throw new Error("Escola não identificada.");

            if (disciplinaToEdit) {
                // Edição
                const { error } = await supabase
                    .from("disciplinas")
                    .update({ nome })
                    .eq("id", disciplinaToEdit.id);
                if (error) throw error;
                toast({ title: "Disciplina atualizada!" });
            } else {
                // Criação
                const { error } = await supabase
                    .from("disciplinas")
                    .insert({
                        nome,
                        escola_id: userEscolaId
                    });
                if (error) throw error;
                toast({ title: "Disciplina criada com sucesso!" });
            }

            onSuccess();
            onOpenChange(false);
            setNome("");
        } catch (error: any) {
            console.error(error);
            toast({ variant: "destructive", title: "Erro ao salvar", description: error.message });
        } finally {
            setLoading(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle>{disciplinaToEdit ? "Editar Disciplina" : "Nova Disciplina"}</DialogTitle>
                    <DialogDescription>
                        Cadastre as matérias que aparecerão no boletim e grade horária.
                    </DialogDescription>
                </DialogHeader>

                <form onSubmit={handleSave} className="space-y-4 py-4">
                    <div className="space-y-2">
                        <Label htmlFor="nome">Nome da Matéria</Label>
                        <Input
                            id="nome"
                            value={nome}
                            onChange={(e) => setNome(e.target.value)}
                            placeholder="Ex: Matemática, Ciências, Artes..."
                            required
                        />
                    </div>

                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
                        <Button
                            type="submit"
                            disabled={loading}
                            style={{ backgroundColor: config.cor_primaria || "#6D28D9" }}
                            className="text-white hover:opacity-90"
                        >
                            {loading ? "Salvando..." : "Salvar"}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
