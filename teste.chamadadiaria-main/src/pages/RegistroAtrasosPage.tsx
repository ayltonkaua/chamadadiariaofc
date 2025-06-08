import { useState, useMemo, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useIsMobile } from "@/hooks/use-mobile";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Clock, ArrowLeft, Save, Search, Filter, User, Pencil, Trash2 } from "lucide-react";
import { Link } from "react-router-dom";

interface Aluno {
  id: string;
  nome: string;
  matricula: string;
}

interface RegistroAtraso {
  id: string;
  aluno_id: string;
  data_atraso: string;
  horario_registro: string;
  criado_em: string;
}

export default function RegistroAtrasosPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const isMobile = useIsMobile();
  const [alunos, setAlunos] = useState<Aluno[]>([]);
  const [registros, setRegistros] = useState<RegistroAtraso[]>([]);
  const [selectedAluno, setSelectedAluno] = useState<string>("");
  const [dataAtraso, setDataAtraso] = useState<string>(format(new Date(), "yyyy-MM-dd"));
  const [horarioRegistro, setHorarioRegistro] = useState<string>(format(new Date(), "HH:mm"));
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterAluno, setFilterAluno] = useState("");
  const [editingRegistro, setEditingRegistro] = useState<string | null>(null);
  const [showSearch, setShowSearch] = useState(false);

  useEffect(() => {
    if (!user) {
      navigate("/login");
      return;
    }

    fetchAlunos();
    fetchRegistros();
  }, [user, navigate]);

  const fetchAlunos = async () => {
    try {
      const { data, error } = await supabase
        .from("alunos")
        .select("id, nome, matricula")
        .order("nome");

      if (error) throw error;
      setAlunos(data || []);
    } catch (error) {
      console.error("Erro ao buscar alunos:", error);
      toast({
        title: "Erro",
        description: "Não foi possível carregar a lista de alunos.",
        variant: "destructive",
      });
    }
  };

  const fetchRegistros = async () => {
    try {
      const { data, error } = await supabase
        .from("registros_atrasos")
        .select("*")
        .order("data_atraso", { ascending: false });

      if (error) throw error;
      setRegistros(data || []);
    } catch (error) {
      console.error("Erro ao buscar registros:", error);
      toast({
        title: "Erro",
        description: "Não foi possível carregar os registros de atraso.",
        variant: "destructive",
      });
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Tem certeza que deseja excluir este registro?")) return;

    try {
      const { error } = await supabase
        .from("registros_atrasos")
        .delete()
        .eq("id", id);

      if (error) throw error;

      toast({
        title: "Sucesso",
        description: "Registro excluído com sucesso!",
      });

      fetchRegistros();
    } catch (error) {
      console.error("Erro ao excluir registro:", error);
      toast({
        title: "Erro",
        description: "Não foi possível excluir o registro.",
        variant: "destructive",
      });
    }
  };

  const handleEdit = async (id: string) => {
    setEditingRegistro(id);
    const registro = registros.find((r) => r.id === id);
    if (registro) {
      setSelectedAluno(registro.aluno_id);
      setDataAtraso(registro.data_atraso);
      setHorarioRegistro(registro.horario_registro);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAluno || !dataAtraso || !horarioRegistro) {
      toast({
        title: "Erro",
        description: "Por favor, preencha todos os campos.",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      if (editingRegistro) {
        // Atualizar registro existente
        const { error } = await supabase
          .from("registros_atrasos")
          .update({
            aluno_id: selectedAluno,
            data_atraso: dataAtraso,
            horario_registro: horarioRegistro,
          })
          .eq("id", editingRegistro);

        if (error) throw error;

        toast({
          title: "Sucesso",
          description: "Registro atualizado com sucesso!",
        });
      } else {
        // Criar novo registro
        const { error } = await supabase.from("registros_atrasos").insert({
          aluno_id: selectedAluno,
          data_atraso: dataAtraso,
          horario_registro: horarioRegistro,
        });

        if (error) throw error;

        toast({
          title: "Sucesso",
          description: "Registro de atraso cadastrado com sucesso!",
        });
      }

      setSelectedAluno("");
      setDataAtraso(format(new Date(), "yyyy-MM-dd"));
      setHorarioRegistro(format(new Date(), "HH:mm"));
      setEditingRegistro(null);
      fetchRegistros();
    } catch (error) {
      console.error("Erro ao salvar registro:", error);
      toast({
        title: "Erro",
        description: "Não foi possível salvar o registro.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const filteredAlunos = useMemo(() => {
    if (!searchTerm) return alunos;
    const searchLower = searchTerm.toLowerCase();
    return alunos.filter(
      (aluno) =>
        aluno.nome.toLowerCase().includes(searchLower) ||
        aluno.matricula.toLowerCase().includes(searchLower)
    );
  }, [alunos, searchTerm]);

  const registrosFormatados = useMemo(() => {
    return registros.map((registro) => {
      const aluno = alunos.find((a) => a.id === registro.aluno_id);
      return {
        ...registro,
        nomeAluno: aluno?.nome || "Aluno não encontrado",
        matriculaAluno: aluno?.matricula || "-",
      };
    });
  }, [registros, alunos]);

  const registrosFiltrados = useMemo(() => {
    if (!filterAluno) return registrosFormatados;
    const searchLower = filterAluno.toLowerCase();
    return registrosFormatados.filter((registro) =>
      registro.nomeAluno.toLowerCase().includes(searchLower)
    );
  }, [registrosFormatados, filterAluno]);

  return (
    <div className="container mx-auto p-4 max-w-6xl">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-purple-700">Registro de Atrasos</h1>
        <Link to="/dashboard">
          <Button variant="outline" className="flex gap-2">
            <ArrowLeft size={18} /> Voltar ao Dashboard
          </Button>
        </Link>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Formulário de Registro */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              {editingRegistro ? "Editar Registro" : "Novo Registro de Atraso"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="aluno">Pesquisar Aluno</Label>
                <div className="relative">
                  <Search className="absolute left-2 top-2.5 h-4 w-4 text-gray-500" />
                  <Input
                    type="text"
                    placeholder="Digite o nome do aluno..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-8"
                  />
                </div>
                {searchTerm && (
                  <div className="mt-2 border rounded-md max-h-48 overflow-y-auto">
                    {filteredAlunos.length === 0 ? (
                      <div className="p-2 text-sm text-gray-500">
                        Nenhum aluno encontrado com "{searchTerm}"
                      </div>
                    ) : (
                      filteredAlunos.map((aluno) => (
                        <div
                          key={aluno.id}
                          className={`p-2 hover:bg-gray-100 cursor-pointer ${
                            selectedAluno === aluno.id ? "bg-purple-50" : ""
                          }`}
                          onClick={() => setSelectedAluno(aluno.id)}
                        >
                          {aluno.nome} - {aluno.matricula}
                        </div>
                      ))
                    )}
                  </div>
                )}
                {selectedAluno && (
                  <div className="mt-2 p-2 bg-purple-50 rounded-md">
                    <p className="text-sm font-medium">
                      Aluno selecionado: {alunos.find(a => a.id === selectedAluno)?.nome}
                    </p>
                  </div>
                )}
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="dataAtraso">Data do Atraso</Label>
                  <Input
                    id="dataAtraso"
                    type="date"
                    value={dataAtraso}
                    onChange={(e) => setDataAtraso(e.target.value)}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="horarioRegistro">Horário do Registro</Label>
                  <Input
                    id="horarioRegistro"
                    type="time"
                    value={horarioRegistro}
                    onChange={(e) => setHorarioRegistro(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="flex gap-2">
                <Button 
                  type="submit" 
                  disabled={loading || !selectedAluno}
                  className="flex-1 bg-purple-600 hover:bg-purple-700"
                >
                  <Save className="mr-2 h-4 w-4" />
                  {loading ? "Salvando..." : editingRegistro ? "Atualizar" : "Registrar Atraso"}
                </Button>
                {editingRegistro && (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setEditingRegistro(null);
                      setSelectedAluno("");
                      setDataAtraso(format(new Date(), "yyyy-MM-dd"));
                      setHorarioRegistro(format(new Date(), "HH:mm"));
                    }}
                  >
                    Cancelar
                  </Button>
                )}
              </div>
            </form>
          </CardContent>
        </Card>

        {/* Lista de Registros */}
        <Card>
          <CardHeader>
            <div className="flex flex-col gap-4">
              <CardTitle>Registros de Atraso</CardTitle>
              <div className="relative">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-gray-500" />
                <Input
                  type="text"
                  placeholder="Filtrar por nome do aluno..."
                  value={filterAluno}
                  onChange={(e) => setFilterAluno(e.target.value)}
                  className="pl-8"
                />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Aluno</TableHead>
                    {!isMobile && <TableHead>Matrícula</TableHead>}
                    <TableHead>Data</TableHead>
                    <TableHead>Horário</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {registrosFiltrados.map((registro) => (
                    <TableRow key={registro.id}>
                      <TableCell className="font-medium">{registro.nomeAluno}</TableCell>
                      {!isMobile && <TableCell>{registro.matriculaAluno}</TableCell>}
                      <TableCell>
                        {format(new Date(registro.data_atraso), "dd/MM/yyyy", {
                          locale: ptBR,
                        })}
                      </TableCell>
                      <TableCell>{registro.horario_registro}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleEdit(registro.id)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDelete(registro.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                  {registrosFiltrados.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={isMobile ? 4 : 5} className="text-center py-4 text-gray-500">
                        {filterAluno
                          ? `Nenhum registro encontrado com "${filterAluno}"`
                          : "Nenhum registro de atraso encontrado"}
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
} 