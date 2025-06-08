
import React, { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface EditTurmaDialogProps {
  turma?: {
    id: string;
    nome: string;
    numero_sala: string;
  };
  onClose: () => void;
  onTurmaUpdated: () => void;
}

export function EditTurmaDialog({ turma, onClose, onTurmaUpdated }: EditTurmaDialogProps) {
  const [nomeTurma, setNomeTurma] = useState(turma?.nome || "");
  const [numeroSala, setNumeroSala] = useState(turma?.numero_sala || "");
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const handleSave = async () => {
    if (!turma?.id || !nomeTurma || !numeroSala) {
      toast({
        title: "Erro",
        description: "Preencha todos os campos",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    const { error } = await supabase
      .from("turmas")
      .update({ nome: nomeTurma, numero_sala: numeroSala })
      .eq("id", turma.id);

    setLoading(false);

    if (error) {
      toast({
        title: "Erro ao atualizar turma",
        description: error.message,
        variant: "destructive",
      });
      return;
    }

    toast({
      title: "Turma atualizada",
      description: "Os dados da turma foram atualizados com sucesso.",
    });
    
    onTurmaUpdated();
    onClose();
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Editar Turma</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Nome da Turma</Label>
            <Input value={nomeTurma} onChange={e => setNomeTurma(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Número da Sala</Label>
            <Input value={numeroSala} onChange={e => setNumeroSala(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button onClick={handleSave} disabled={loading}>
            {loading ? "Salvando..." : "Salvar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
