import React, { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Loader2, ArrowRightLeft } from "lucide-react";

interface TransferStudentDialogProps {
    aluno: { id: string; nome: string; turma_id: string } | null;
    onClose: () => void;
    onSuccess: () => void;
}

export function TransferStudentDialog({ aluno, onClose, onSuccess }: TransferStudentDialogProps) {
    const [turmas, setTurmas] = useState<{ id: string; nome: string }[]>([]);
    const [targetTurmaId, setTargetTurmaId] = useState<string>("");
    const [loading, setLoading] = useState(false);
    const [loadingTurmas, setLoadingTurmas] = useState(false);
    const { toast } = useToast();

    useEffect(() => {
        if (aluno) {
            fetchTurmas();
        }
    }, [aluno]);

    const fetchTurmas = async () => {
        setLoadingTurmas(true);
        try {
            // Busca turmas da mesma escola, exceto a atual
            const { data: userData } = await supabase.auth.getUser();
            if (!userData.user) return;

            // Primeiro pegamos a escola do usuário logado (assumindo user_roles ou config)
            // Como atalho seguro, buscamos turmas onde o usuário tem acesso ou são da mesma escola da turma atual

            // Vamos buscar a escola_id da turma atual do aluno
            const { data: turmaAtual } = await supabase
                .from('turmas')
                .select('escola_id')
                .eq('id', aluno?.turma_id)
                .single();

            if (turmaAtual) {
                const { data, error } = await supabase
                    .from('turmas')
                    .select('id, nome')
                    .eq('escola_id', turmaAtual.escola_id)
                    .neq('id', aluno?.turma_id) // Exclui a turma atual
                    .order('nome');

                if (error) throw error;
                setTurmas(data || []);
            }

        } catch (error) {
            console.error("Erro ao buscar turmas:", error);
            toast({ title: "Erro", description: "Não foi possível carregar as turmas.", variant: "destructive" });
        } finally {
            setLoadingTurmas(false);
        }
    };

    const handleTransfer = async () => {
        if (!aluno || !targetTurmaId) return;

        setLoading(true);
        try {
            const { error } = await supabase
                .from('alunos')
                .update({ turma_id: targetTurmaId })
                .eq('id', aluno.id);

            if (error) throw error;

            toast({
                title: "Aluno transferido",
                description: `${aluno.nome} foi movido para a nova turma com sucesso.`,
                className: "bg-green-500 text-white"
            });
            onSuccess();
            onClose();
        } catch (error: any) {
            toast({
                title: "Erro na transferência",
                description: error.message,
                variant: "destructive"
            });
        } finally {
            setLoading(false);
        }
    };

    return (
        <Dialog open={!!aluno} onOpenChange={onClose}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <ArrowRightLeft className="h-5 w-5" /> Transferir Aluno
                    </DialogTitle>
                </DialogHeader>

                <div className="space-y-4 py-4">
                    <div className="text-sm text-gray-600">
                        Transferindo: <span className="font-bold text-gray-900">{aluno?.nome}</span>
                    </div>

                    <div className="space-y-2">
                        <Label>Selecione a Turma de Destino</Label>
                        <Select onValueChange={setTargetTurmaId} value={targetTurmaId}>
                            <SelectTrigger>
                                <SelectValue placeholder={loadingTurmas ? "Carregando turmas..." : "Selecione uma turma"} />
                            </SelectTrigger>
                            <SelectContent>
                                {turmas.map((t) => (
                                    <SelectItem key={t.id} value={t.id}>
                                        {t.nome}
                                    </SelectItem>
                                ))}
                                {turmas.length === 0 && !loadingTurmas && (
                                    <div className="p-2 text-sm text-gray-500 text-center">Nenhuma outra turma disponível</div>
                                )}
                            </SelectContent>
                        </Select>
                    </div>
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={onClose} disabled={loading}>
                        Cancelar
                    </Button>
                    <Button onClick={handleTransfer} disabled={loading || !targetTurmaId}>
                        {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Confirmar Transferência
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
