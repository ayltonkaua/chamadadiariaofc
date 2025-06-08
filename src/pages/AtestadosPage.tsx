import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Plus, Pencil, Trash2, Check, X } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Dialog,
  DialogContent,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface Atestado {
  id: string;
  aluno_id: string;
  aluno_nome: string;
  data_inicio: string;
  data_fim: string;
  descricao: string;
  status: 'pendente' | 'aprovado' | 'rejeitado';
  created_at: string;
}

interface Aluno {
  id: string;
  nome: string;
  matricula: string;
}

const AtestadosPage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [atestados, setAtestados] = useState<Atestado[]>([]);
  const [alunos, setAlunos] = useState<Aluno[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editingAtestado, setEditingAtestado] = useState<Atestado | null>(null);
  const [formData, setFormData] = useState({
    aluno_id: "",
    data_inicio: "",
    data_fim: "",
    descricao: "",
  });

  useEffect(() => {
    const carregarDados = async () => {
      if (!user) return;

      try {
        setLoading(true);

        // Carregar atestados
        const { data: atestadosData, error: atestadosError } = await supabase
          .from("atestados")
          .select(`
            id,
            aluno_id,
            alunos!inner(nome),
            data_inicio,
            data_fim,
            descricao,
            status,
            created_at
          `)
          .order("created_at", { ascending: false });

        if (atestadosError) throw atestadosError;

        const atestadosFormatados = atestadosData.map(atestado => ({
          ...atestado,
          aluno_nome: atestado.alunos.nome
        }));

        setAtestados(atestadosFormatados);

        // Carregar alunos
        const { data: alunosData, error: alunosError } = await supabase
          .from("alunos")
          .select("id, nome, matricula")
          .order("nome");

        if (alunosError) throw alunosError;
        setAlunos(alunosData);

      } catch (error) {
        console.error("Erro ao carregar dados:", error);
        toast({
          title: "Erro",
          description: "Não foi possível carregar os dados",
          variant: "destructive",
        });
      } finally {
        setLoading(false);
      }
    };

    carregarDados();
  }, [user, toast]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (editingAtestado) {
        // Atualizar atestado existente
        const { error } = await supabase
          .from("atestados")
          .update({
            aluno_id: formData.aluno_id,
            data_inicio: formData.data_inicio,
            data_fim: formData.data_fim,
            descricao: formData.descricao,
          })
          .eq("id", editingAtestado.id);

        if (error) throw error;

        toast({
          title: "Sucesso",
          description: "Atestado atualizado com sucesso",
        });
      } else {
        // Criar novo atestado
        const { error } = await supabase.from("atestados").insert({
          aluno_id: formData.aluno_id,
          data_inicio: formData.data_inicio,
          data_fim: formData.data_fim,
          descricao: formData.descricao,
          status: "pendente",
        });

        if (error) throw error;

        toast({
          title: "Sucesso",
          description: "Atestado registrado com sucesso",
        });
      }

      setShowForm(false);
      setEditingAtestado(null);
      setFormData({
        aluno_id: "",
        data_inicio: "",
        data_fim: "",
        descricao: "",
      });

      // Recarregar atestados
      const { data: atestadosData, error: atestadosError } = await supabase
        .from("atestados")
        .select(`
          id,
          aluno_id,
          alunos!inner(nome),
          data_inicio,
          data_fim,
          descricao,
          status,
          created_at
        `)
        .order("created_at", { ascending: false });

      if (atestadosError) throw atestadosError;

      const atestadosFormatados = atestadosData.map(atestado => ({
        ...atestado,
        aluno_nome: atestado.alunos.nome
      }));

      setAtestados(atestadosFormatados);

    } catch (error) {
      console.error("Erro ao salvar atestado:", error);
      toast({
        title: "Erro",
        description: "Não foi possível salvar o atestado",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (atestado: Atestado) => {
    setEditingAtestado(atestado);
    setFormData({
      aluno_id: atestado.aluno_id,
      data_inicio: atestado.data_inicio,
      data_fim: atestado.data_fim,
      descricao: atestado.descricao,
    });
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm("Tem certeza que deseja excluir este atestado?")) return;

    try {
      const { error } = await supabase
        .from("atestados")
        .delete()
        .eq("id", id);

      if (error) throw error;

      setAtestados(atestados.filter(a => a.id !== id));
      toast({
        title: "Sucesso",
        description: "Atestado excluído com sucesso",
      });
    } catch (error) {
      toast({
        title: "Erro",
        description: "Não foi possível excluir o atestado",
        variant: "destructive",
      });
    }
  };

  const handleAprovar = async (id: string) => {
    try {
      const { error } = await supabase
        .from("atestados")
        .update({ status: "aprovado" })
        .eq("id", id);

      if (error) throw error;

      setAtestados(atestados.map(a => 
        a.id === id ? { ...a, status: "aprovado" } : a
      ));

      toast({
        title: "Sucesso",
        description: "Atestado aprovado com sucesso",
      });
    } catch (error) {
      toast({
        title: "Erro",
        description: "Não foi possível aprovar o atestado",
        variant: "destructive",
      });
    }
  };

  const handleRejeitar = async (id: string) => {
    try {
      const { error } = await supabase
        .from("atestados")
        .update({ status: "rejeitado" })
        .eq("id", id);

      if (error) throw error;

      setAtestados(atestados.map(a => 
        a.id === id ? { ...a, status: "rejeitado" } : a
      ));

      toast({
        title: "Sucesso",
        description: "Atestado rejeitado com sucesso",
      });
    } catch (error) {
      toast({
        title: "Erro",
        description: "Não foi possível rejeitar o atestado",
        variant: "destructive",
      });
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 py-6">
        <div className="max-w-6xl mx-auto px-4">
          <div className="text-center">
            <p className="text-gray-600">Carregando atestados...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-6">
      <div className="max-w-6xl mx-auto px-4">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center">
            <Button variant="ghost" className="mr-2" onClick={() => navigate("/dashboard")}>
              <ArrowLeft size={18} />
            </Button>
            <h1 className="text-2xl font-bold text-gray-800">Atestados</h1>
          </div>
          <Dialog open={showForm} onOpenChange={setShowForm}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Novo Atestado
              </Button>
            </DialogTrigger>
            <DialogContent>
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
                    placeholder="Descreva o motivo do atestado"
                  />
                </div>

                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? "Salvando..." : editingAtestado ? "Atualizar Atestado" : "Registrar Atestado"}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Atestados Registrados</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Aluno</TableHead>
                  <TableHead>Período</TableHead>
                  <TableHead>Motivo</TableHead>
                  <TableHead>Data de Envio</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {atestados.map((atestado) => (
                  <TableRow key={atestado.id}>
                    <TableCell>{atestado.aluno_nome}</TableCell>
                    <TableCell>
                      {format(new Date(atestado.data_inicio + 'T00:00:00'), "dd/MM/yyyy", { locale: ptBR })} {"-"} {format(new Date(atestado.data_fim + 'T00:00:00'), "dd/MM/yyyy", { locale: ptBR })}
                    </TableCell>
                    <TableCell>{atestado.descricao}</TableCell>
                    <TableCell>
                      {format(new Date(atestado.created_at), "dd/MM/yyyy", {
                        locale: ptBR,
                      })}
                    </TableCell>
                    <TableCell>
                      <span
                        className={`px-2 py-1 rounded-full text-xs font-medium ${
                          atestado.status === "aprovado"
                            ? "bg-green-100 text-green-800"
                            : atestado.status === "rejeitado"
                            ? "bg-red-100 text-red-800"
                            : "bg-yellow-100 text-yellow-800"
                        }`}
                      >
                        {atestado.status.charAt(0).toUpperCase() +
                          atestado.status.slice(1)}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleEdit(atestado)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-red-600 hover:text-red-700"
                          onClick={() => handleDelete(atestado.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                        {atestado.status === "pendente" && (
                          <>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="text-green-600 hover:text-green-700"
                              onClick={() => handleAprovar(atestado.id)}
                            >
                              <Check className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="text-red-600 hover:text-red-700"
                              onClick={() => handleRejeitar(atestado.id)}
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                {atestados.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-4">
                      Nenhum atestado encontrado
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default AtestadosPage;
