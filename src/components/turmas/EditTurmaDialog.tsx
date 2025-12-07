import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter, // Adicionado
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Users, Settings, Calendar } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { GerenciarProfessoresTurma } from "./GerenciarProfessoresTurma";
import { GradeHorariaAvancada } from "./grade/GradeHorariaAvancada";

interface EditTurmaDialogProps {
  turma: {
    id: string;
    nome: string;
    escola_id: string;
  } | null;
  open: boolean;           // Novo: Controlado pelo pai
  onOpenChange: (open: boolean) => void; // Novo: Controlado pelo pai
  onSuccess: () => void;
}

export function EditTurmaDialog({ turma, open, onOpenChange, onSuccess }: EditTurmaDialogProps) {
  const [nome, setNome] = useState("");
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  // Atualiza o nome quando a turma muda
  useEffect(() => {
    if (turma) setNome(turma.nome);
  }, [turma]);

  if (!turma) return null;

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { error } = await supabase
        .from("turmas")
        .update({ nome })
        .eq("id", turma.id);

      if (error) throw error;

      toast({ title: "Turma atualizada!" });
      onSuccess();
      onOpenChange(false); // Fecha o modal
    } catch (error) {
      toast({ variant: "destructive", title: "Erro ao atualizar" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Gerenciar Turma: {turma.nome}</DialogTitle>
          <DialogDescription>
            Alterar nome ou professores vinculados.
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="detalhes" className="w-full mt-4">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="detalhes"><Settings className="w-4 h-4 mr-2" /> Detalhes</TabsTrigger>
            <TabsTrigger value="professores"><Users className="w-4 h-4 mr-2" /> Professores</TabsTrigger>
            <TabsTrigger value="grade"><Calendar className="w-4 h-4 mr-2" /> Grade</TabsTrigger>
          </TabsList>

          <TabsContent value="detalhes" className="py-4 space-y-4">
            <form onSubmit={handleUpdate}>
              <div className="space-y-2">
                <Label>Nome da Turma</Label>
                <Input value={nome} onChange={(e) => setNome(e.target.value)} />
              </div>
              <DialogFooter className="pt-4">
                <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
                <Button type="submit" disabled={loading}>
                  {loading ? "Salvando..." : "Salvar Alterações"}
                </Button>
              </DialogFooter>
            </form>
          </TabsContent>

          <TabsContent value="professores">
            <GerenciarProfessoresTurma
              turmaId={turma.id}
              escolaId={turma.escola_id}
            />
          </TabsContent>

          <TabsContent value="grade">
            <GradeHorariaAvancada turmaId={turma.id} />
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}