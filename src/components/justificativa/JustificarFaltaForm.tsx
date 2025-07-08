import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DialogFooter } from "@/components/ui/dialog";
import { TablesInsert } from "@/integrations/supabase/types";
import { useAuth } from '@/contexts/AuthContext';
import { useEscolasCadastradas, Escola } from "@/hooks/useEscolasCadastradas";

// Tipos
interface Aluno {
  id: string;
  nome: string;
  matricula: string;
}

// MODIFICADO: Adicionada a prop opcional 'isPortal'
interface JustificarFaltaFormProps {
  onClose: () => void;
  onSuccess: () => void;
  isPortal?: boolean;
}

const JustificarFaltaForm: React.FC<JustificarFaltaFormProps> = ({ onClose, onSuccess, isPortal = false }) => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const { user } = useAuth(); // Usado para obter os dados do aluno logado

  // Estados para o formulário público
  const { escolas, loading: escolasLoading } = useEscolasCadastradas();
  const [escolaSelecionada, setEscolaSelecionada] = useState<string>("");
  const [alunos, setAlunos] = useState<Aluno[]>([]);
  const [alunosLoading, setAlunosLoading] = useState(false);

  const [formData, setFormData] = useState({
    aluno_id: "",
    data_inicio: "",
    data_fim: "",
    descricao: "",
  });

  // Efeito para carregar alunos (apenas se não estiver no portal)
  useEffect(() => {
    if (isPortal || !escolaSelecionada) {
      setAlunos([]);
      setFormData(prev => ({ ...prev, aluno_id: '' }));
      return;
    }

    const carregarAlunos = async () => {
      setAlunosLoading(true);
      try {
        const { data, error } = await supabase
          .from("alunos").select("id, nome, matricula")
          .eq("escola_id", escolaSelecionada).order("nome");
        if (error) throw error;
        setAlunos(data || []);
      } catch (error) {
        toast({ title: "Erro", description: "Não foi possível carregar os alunos.", variant: "destructive" });
      } finally {
        setAlunosLoading(false);
      }
    };
    carregarAlunos();
  }, [escolaSelecionada, isPortal, toast]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    // MODIFICADO: A lógica agora sabe de onde pegar os IDs
    const alunoParaEnviar = isPortal ? user?.aluno_id : formData.aluno_id;
    const escolaParaEnviar = isPortal ? user?.escola_id : escolaSelecionada;

    if (!alunoParaEnviar || !escolaParaEnviar || !formData.data_inicio || !formData.data_fim || !formData.descricao) {
      toast({ title: "Campos obrigatórios", description: "Por favor, preencha todos os campos.", variant: "destructive" });
      setLoading(false);
      return;
    }

    try {
      const insertData: TablesInsert<'atestados'> = {
        aluno_id: alunoParaEnviar,
        data_inicio: formData.data_inicio,
        data_fim: formData.data_fim,
        descricao: formData.descricao,
        status: "pendente",
        escola_id: escolaParaEnviar
      };
      const { error } = await supabase.from("atestados").insert(insertData);
      if (error) throw error;

      toast({ title: "Sucesso", description: "Atestado enviado com sucesso e aguardando aprovação." });
      onSuccess();
      onClose();

    } catch (error: any) {
      toast({ title: "Erro", description: error.message || "Não foi possível enviar o atestado.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 pt-4">
      {/* MODIFICADO: Renderização condicional dos seletores */}
      {!isPortal && (
        <>
          <div className="space-y-2">
            <Label htmlFor="escola">Escola *</Label>
            <Select onValueChange={(id) => setEscolaSelecionada(id)} value={escolaSelecionada} disabled={escolasLoading}>
              <SelectTrigger>
                <SelectValue placeholder={escolasLoading ? "Carregando..." : "Selecione a escola"} />
              </SelectTrigger>
              <SelectContent>
                {escolas.map((escola) => (<SelectItem key={escola.id} value={escola.id}>{escola.nome}</SelectItem>))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="aluno">Aluno *</Label>
            <Select value={formData.aluno_id} onValueChange={(value) => setFormData({ ...formData, aluno_id: value })} disabled={!escolaSelecionada || alunosLoading || alunos.length === 0}>
              <SelectTrigger>
                <SelectValue placeholder={!escolaSelecionada ? "Selecione uma escola" : alunosLoading ? "Carregando..." : "Selecione um aluno"} />
              </SelectTrigger>
              <SelectContent>
                {alunos.map((aluno) => (<SelectItem key={aluno.id} value={aluno.id}>{aluno.nome} - {aluno.matricula}</SelectItem>))}
              </SelectContent>
            </Select>
          </div>
        </>
      )}

      {/* Campos que aparecem em ambos os contextos */}
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="data_inicio">Data de Início *</Label>
          <Input id="data_inicio" type="date" value={formData.data_inicio} onChange={(e) => setFormData({ ...formData, data_inicio: e.target.value })} required />
        </div>
        <div className="space-y-2">
          <Label htmlFor="data_fim">Data de Término *</Label>
          <Input id="data_fim" type="date" value={formData.data_fim} onChange={(e) => setFormData({ ...formData, data_fim: e.target.value })} required />
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="descricao">Motivo/Descrição do Atestado *</Label>
        <Textarea id="descricao" value={formData.descricao} onChange={(e) => setFormData({ ...formData, descricao: e.target.value })} required placeholder="Descreva o motivo do atestado médico..." />
      </div>

      <DialogFooter className="pt-4">
        <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
        <Button type="submit" disabled={loading}>
          {loading ? <Loader2 className="animate-spin mr-2"/> : null}
          {loading ? "Enviando..." : "Enviar Atestado"}
        </Button>
      </DialogFooter>
    </form>
  );
};

export default JustificarFaltaForm;