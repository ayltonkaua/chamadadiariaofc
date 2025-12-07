import { useState } from "react";
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

interface DeleteTurmaDialogProps {
  turma: { id: string; nome: string } | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export function DeleteTurmaDialog({ turma, open, onOpenChange, onSuccess }: DeleteTurmaDialogProps) {
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  if (!turma) return null;

  const handleDelete = async () => {
    setLoading(true);
    try {
      // 1. Remove dependências (Alunos, Presenças, Vínculos)
      // Nota: Idealmente use CASCADE no banco, mas aqui garantimos via código
      await supabase.from("alunos").delete().eq("turma_id", turma.id);
      await supabase.from("presencas").delete().eq("turma_id", turma.id);
      await supabase.from("turma_professores").delete().eq("turma_id", turma.id); // Novo vinculo

      // 2. Remove a turma
      const { error } = await supabase.from("turmas").delete().eq("id", turma.id);

      if (error) throw error;

      toast({ title: "Turma removida com sucesso" });
      onSuccess();
      onOpenChange(false);
    } catch (error: any) {
      console.error(error);
      toast({
        variant: "destructive",
        title: "Erro ao remover",
        description: "Verifique se há dados vinculados que impedem a exclusão."
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Excluir Turma?</AlertDialogTitle>
          <AlertDialogDescription>
            Você está prestes a excluir a turma <strong>{turma.nome}</strong> e todos os seus alunos e chamadas.
            Esta ação não pode ser desfeita.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={loading}>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => { e.preventDefault(); handleDelete(); }}
            className="bg-red-600 hover:bg-red-700"
            disabled={loading}
          >
            {loading ? "Excluindo..." : "Sim, excluir"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}