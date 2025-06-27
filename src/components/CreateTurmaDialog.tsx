import React, { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Loader2 } from "lucide-react";

export default function CreateTurmaDialog({ onTurmaAdded }: { onTurmaAdded?: () => void }) {
  const [open, setOpen] = useState(false);
  const [nomeTurma, setNomeTurma] = useState("");
  const [numeroSala, setNumeroSala] = useState("");
  const [nomeAluno, setNomeAluno] = useState("");
  const [matricula, setMatricula] = useState("");
  const [alunos, setAlunos] = useState<{ nome: string, matricula: string }[]>([]);
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const { user, loadingUser } = useAuth(); // Adicionado loadingUser

  const handleAddAluno = () => {
    if (!nomeAluno || !matricula) return;
    setAlunos([...alunos, { nome: nomeAluno, matricula }]);
    setNomeAluno("");
    setMatricula("");
  };

  const resetForm = () => {
    setNomeTurma("");
    setNumeroSala("");
    setAlunos([]);
    setNomeAluno("");
    setMatricula("");
  }

  const handleSave = async () => {
    if (!nomeTurma || !numeroSala || alunos.length === 0) {
      toast({ title: "Erro", description: "Preencha o nome da turma, o número da sala e adicione pelo menos um aluno.", variant: "destructive" });
      return;
    }
    if (!user) {
      toast({ title: "Erro", description: "Usuário não autenticado.", variant: "destructive" });
      return;
    }
    // Verificação robusta do escola_id
    if (!user.escola_id) {
      toast({ title: "Erro de Configuração", description: "Seu usuário não está vinculado a uma escola. Por favor, configure o perfil da escola primeiro.", variant: "destructive" });
      return;
    }
    
    setLoading(true);
    try {
      const { data: turma, error: turmaError } = await supabase
        .from("turmas")
        .insert({ 
          nome: nomeTurma, 
          numero_sala: numeroSala, 
          user_id: user.id,
          escola_id: user.escola_id // Agora é garantido que existe
        })
        .select()
        .single();
        
      if (turmaError || !turma) {
        throw turmaError || new Error("Não foi possível obter os dados da turma criada.");
      }
      
      const alunosParaInserir = alunos.map(a => ({ 
        nome: a.nome, 
        matricula: a.matricula, 
        turma_id: turma.id,
        escola_id: user.escola_id // Vinculando aluno à escola também
      }));
      
      const { error: alunosError } = await supabase.from("alunos").insert(alunosParaInserir);
      
      if (alunosError) {
        // Se der erro ao inserir alunos, apaga a turma para não deixar dados inconsistentes
        await supabase.from("turmas").delete().eq("id", turma.id);
        throw alunosError;
      }
      
      toast({ title: "Turma criada com sucesso", description: `Turma "${nomeTurma}" adicionada com ${alunos.length} aluno(s).` });
      setOpen(false);
      resetForm();
      onTurmaAdded?.();
    } catch (error: any) {
        console.error("Erro ao salvar turma:", error);
        toast({ title: "Erro", description: error.message || "Não foi possível criar a turma.", variant: "destructive" });
    } finally {
        setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => { setOpen(isOpen); if (!isOpen) resetForm(); }}>
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
        <div className="space-y-2 mt-4 border-t pt-4">
            <h4 className="font-medium">Adicionar Alunos</h4>
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
          <ul className="mt-2 text-sm space-y-1 max-h-40 overflow-y-auto">
            {alunos.map((a, i) => (
              <li key={i} className="bg-slate-100 rounded px-2 py-1 flex justify-between items-center">
                <span>{a.nome} ({a.matricula})</span>
                <Button variant="ghost" size="sm" onClick={() => setAlunos(alunos.filter((_, idx) => idx !== i))}>X</Button>
              </li>
            ))}
          </ul>
        </div>
        <DialogFooter>
          <Button onClick={handleSave} disabled={loading || loadingUser}>
            {loading || loadingUser ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : null}
            {loading || loadingUser ? "Aguarde..." : "Salvar Turma"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}