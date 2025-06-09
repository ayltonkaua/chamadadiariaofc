import React, { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface Student {
  id?: string;
  nome: string;
  matricula: string;
  turma_id: string;
}

interface AddEditStudentDialogProps {
  open: boolean;
  onClose: () => void;
  onStudentAdded: () => void;
  turmaId: string;
  student?: Student;
  isEditing?: boolean;
}

export default function AddEditStudentDialog({
  open,
  onClose,
  onStudentAdded,
  turmaId,
  student,
  isEditing = false,
}: AddEditStudentDialogProps) {
  const { toast } = useToast();
  const [nome, setNome] = useState("");
  const [matricula, setMatricula] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (student && open) {
      setNome(student.nome || "");
      setMatricula(student.matricula || "");
    } else if (!isEditing) {
      // Reset form when opening for new student
      setNome("");
      setMatricula("");
    }
  }, [student, open, isEditing]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nome.trim() || !matricula.trim()) {
      toast({
        title: "Erro",
        description: "Nome e matrícula são obrigatórios.",
        variant: "destructive",
      });
      return;
    }
    setIsLoading(true);

    try {
      if (isEditing && student?.id) {
        // Atualizar aluno existente
        const { error } = await supabase
          .from("alunos")
          .update({ nome, matricula })
          .eq("id", student.id);

        if (error) throw error;

        toast({
          title: "Aluno atualizado",
          description: "Os dados do aluno foram atualizados com sucesso.",
        });
      } else {
        // Adicionar novo aluno
        const { error } = await supabase.from("alunos").insert({
          nome,
          matricula,
          turma_id: turmaId,
        });

        if (error) throw error;

        toast({
          title: "Aluno adicionado",
          description: "O aluno foi adicionado à turma com sucesso.",
        });
      }

      onStudentAdded();
      onClose();
    } catch (error) {
      console.error("Erro ao salvar dados do aluno:", error);
      toast({
        title: "Erro ao salvar",
        description: "Ocorreu um erro ao salvar os dados do aluno.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {isEditing ? "Editar aluno" : "Adicionar novo aluno"}
          </DialogTitle>
          <DialogDescription>
            {isEditing
              ? "Atualize os dados do aluno abaixo."
              : "Preencha os dados do novo aluno para adicioná-lo à turma."}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="nome">Nome do aluno</Label>
              <Input
                id="nome"
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                placeholder="Digite o nome completo"
                required
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="matricula">Matrícula</Label>
              <Input
                id="matricula"
                value={matricula}
                onChange={(e) => setMatricula(e.target.value)}
                placeholder="Digite o número de matrícula"
                required
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading
                ? "Salvando..."
                : isEditing
                ? "Atualizar"
                : "Adicionar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
