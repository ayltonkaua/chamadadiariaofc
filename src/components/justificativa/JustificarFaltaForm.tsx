import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { X } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { TablesInsert } from "@/integrations/supabase/types";

interface Aluno {
  id: string;
  nome: string;
  matricula: string;
}

interface JustificarFaltaFormProps {
  onClose: () => void;
  alunoId?: string;
}

const JustificarFaltaForm: React.FC<JustificarFaltaFormProps> = ({ onClose, alunoId }) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [alunos, setAlunos] = useState<Aluno[]>([]);
  const [formData, setFormData] = useState({
    aluno_id: alunoId || "",
    data_inicio: "",
    data_fim: "",
    descricao: "",
  });

  useEffect(() => {
    const carregarAlunos = async () => {
      try {
        const { data, error } = await supabase
          .from("alunos")
          .select("id, nome, matricula")
          .order("nome");

        if (error) throw error;
        setAlunos(data || []);
      } catch (error) {
        console.error("Erro ao carregar alunos:", error);
        toast({
          title: "Erro",
          description: "Não foi possível carregar os alunos",
          variant: "destructive",
        });
      }
    };

    carregarAlunos();
  }, [toast]);

  useEffect(() => {
    if (alunoId) {
      setFormData((prev) => ({ ...prev, aluno_id: alunoId }));
    }
  }, [alunoId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const insertData: TablesInsert<'atestados'> = {
        aluno_id: formData.aluno_id,
        data_inicio: formData.data_inicio,
        data_fim: formData.data_fim,
        descricao: formData.descricao,
        status: "pendente",
      };
      const { error } = await supabase.from("atestados").insert(insertData);

      if (error) throw error;

      toast({
        title: "Sucesso",
        description: "Justificativa enviada com sucesso",
      });

      onClose();
    } catch (error) {
      console.error("Erro ao enviar justificativa:", error);
      toast({
        title: "Erro",
        description: "Não foi possível enviar a justificativa",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Justificar Falta</CardTitle>
        <Button variant="ghost" size="icon" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="aluno">Aluno</Label>
            <Select
              value={formData.aluno_id}
              onValueChange={(value) => setFormData({ ...formData, aluno_id: value })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione um aluno" />
              </SelectTrigger>
              <SelectContent>
                {alunos.map((aluno) => (
                  <SelectItem key={aluno.id} value={aluno.id}>
                    {aluno.nome} - {aluno.matricula}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="data_inicio">Data de Início</Label>
            <Input
              id="data_inicio"
              type="date"
              value={formData.data_inicio}
              onChange={(e) => setFormData({ ...formData, data_inicio: e.target.value })}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="data_fim">Data de Término</Label>
            <Input
              id="data_fim"
              type="date"
              value={formData.data_fim}
              onChange={(e) => setFormData({ ...formData, data_fim: e.target.value })}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="descricao">Motivo</Label>
            <Textarea
              id="descricao"
              value={formData.descricao}
              onChange={(e) => setFormData({ ...formData, descricao: e.target.value })}
              required
              placeholder="Descreva o motivo da falta"
            />
          </div>

          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "Enviando..." : "Enviar Justificativa"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
};

export default JustificarFaltaForm; 