import React, { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export default function CreateTurmaDialog({ onTurmaAdded }: { onTurmaAdded?: () => void }) {
  const [open, setOpen] = useState(false);
  const [nomeTurma, setNomeTurma] = useState("");
  const [numeroSala, setNumeroSala] = useState("");
  const [nomeAluno, setNomeAluno] = useState("");
  const [matricula, setMatricula] = useState("");
  const [alunos, setAlunos] = useState<{ nome: string, matricula: string }[]>([]);
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const { user } = useAuth();

  const handleAddAluno = () => {
    if (!nomeAluno || !matricula) return;
    setAlunos([...alunos, { nome: nomeAluno, matricula }]);
    setNomeAluno("");
    setMatricula("");
  };

  const handleSave = async () => {
    if (!nomeTurma || !numeroSala || alunos.length === 0) {
      toast({ title: "Erro", description: "Preencha o nome da turma, o número da sala e adicione pelo menos um aluno.", variant: "destructive" });
      return;
    }
    if (!user) {
      toast({ title: "Erro", description: "Usuário não autenticado.", variant: "destructive" });
      return;
    }
    if (!user.escola_id) {
      toast({ title: "Erro", description: "Usuário não tem escola configurada. Configure o perfil da escola primeiro.", variant: "destructive" });
      return;
    }
    setLoading(true);
    const { data: turma, error: turmaError } = await supabase
      .from("turmas")
      .insert({ 
        nome: nomeTurma, 
        numero_sala: numeroSala, 
        user_id: user.id,
        escola_id: user.escola_id
      })
      .select()
      .maybeSingle();
    if (turmaError || !turma) {
      setLoading(false);
      toast({ title: "Erro", description: "Erro ao criar turma.", variant: "destructive" });
      return;
    }
    const alunosParaInserir = alunos.map(a => ({ nome: a.nome, matricula: a.matricula, turma_id: turma.id }));
    const { error: alunosError } = await supabase.from("alunos").insert(alunosParaInserir);
    setLoading(false);
    if (alunosError) {
      toast({ title: "Erro", description: "Erro ao adicionar alunos.", variant: "destructive" });
      return;
    }
    toast({ title: "Turma criada com sucesso", description: `Turma "${nomeTurma}" adicionada com ${alunos.length} aluno(s).` });
    setOpen(false);
    setNomeTurma("");
    setNumeroSala("");
    setAlunos([]);
    onTurmaAdded && onTurmaAdded();
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="default" className="bg-blue-600 hover:bg-blue-700">+ Nova Turma</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Criar Turma & Alunos</DialogTitle>
        </DialogHeader>
        <div className="space-y-2">
          <Label>Nome da Turma</Label>
          <Input value={nomeTurma} onChange={e => setNomeTurma(e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label>Número da Sala</Label>
          <Input value={numeroSala} onChange={e => setNumeroSala(e.target.value)} />
        </div>
        <div className="space-y-2 mt-4">
          <div className="flex gap-2">
            <div className="flex-1">
              <Label>Nome do Aluno</Label>
              <Input value={nomeAluno} onChange={e => setNomeAluno(e.target.value)} />
            </div>
            <div className="flex-1">
              <Label>Matrícula</Label>
              <Input value={matricula} onChange={e => setMatricula(e.target.value)} />
            </div>
            <Button type="button" className="self-end" onClick={handleAddAluno}>
              Adicionar
            </Button>
          </div>
          <ul className="mt-2 text-sm space-y-1">
            {alunos.map((a, i) => (
              <li key={i} className="bg-slate-100 rounded px-2 py-1">{a.nome} ({a.matricula})</li>
            ))}
          </ul>
        </div>
        <DialogFooter>
          <Button onClick={handleSave} disabled={loading}>
            {loading ? "Salvando..." : "Salvar Turma"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
