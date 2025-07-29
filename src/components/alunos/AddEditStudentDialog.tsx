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

// MODIFICADO: Adicionado os novos campos na interface
interface Student {
  id?: string;
  nome: string;
  matricula: string;
  turma_id: string;
  nome_responsavel?: string;
  telefone_responsavel?: string;
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
  // NOVO: Estados para os novos campos
  const [nomeResponsavel, setNomeResponsavel] = useState("");
  const [telefoneResponsavel, setTelefoneResponsavel] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (student && open) {
      setNome(student.nome || "");
      setMatricula(student.matricula || "");
      // NOVO: Preenche os campos do responsável ao editar
      setNomeResponsavel(student.nome_responsavel || "");
      setTelefoneResponsavel(student.telefone_responsavel || "");
    } else if (!isEditing) {
      // Reset form when opening for new student
      setNome("");
      setMatricula("");
      // NOVO: Reseta os campos do responsável ao adicionar
      setNomeResponsavel("");
      setTelefoneResponsavel("");
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
        // MODIFICADO: Incluindo os novos campos na atualização
        const { error } = await supabase
          .from("alunos")
          .update({ 
            nome, 
            matricula,
            nome_responsavel: nomeResponsavel,
            telefone_responsavel: telefoneResponsavel
          })
          .eq("id", student.id);

        if (error) throw error;

        toast({
          title: "Aluno atualizado",
          description: "Os dados do aluno foram atualizados com sucesso.",
        });
      } else {
        // MODIFICADO: Incluindo os novos campos na inserção
        const { error } = await supabase.from("alunos").insert({
          nome,
          matricula,
          turma_id: turmaId,
          nome_responsavel: nomeResponsavel,
          telefone_responsavel: telefoneResponsavel
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
            
            {/* NOVO CAMPO: Nome do Responsável */}
            <div className="grid gap-2">
              <Label htmlFor="nome_responsavel">Nome do Responsável (Obrigatório)</Label>
              <Input
                id="nome_responsavel"
                value={nomeResponsavel}
                onChange={(e) => setNomeResponsavel(e.target.value)}
                placeholder="Digite o nome do responsável"
              />
            </div>

            {/* NOVO CAMPO: Telefone do Responsável */}
            <div className="grid gap-2">
              <Label htmlFor="telefone_responsavel">Telefone do Responsável (Obrigatório)</Label>
              <Input
                id="telefone_responsavel"
                value={telefoneResponsavel}
                onChange={(e) => setTelefoneResponsavel(e.target.value)}
                placeholder="Ex: 558199998888"
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