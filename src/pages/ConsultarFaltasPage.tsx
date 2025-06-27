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
import { Clock, ArrowLeft, Search, FileText, AlertCircle } from "lucide-react";
import { Link } from "react-router-dom";
import { Tables } from "@/integrations/supabase/types";
import { useEscolasCadastradas } from '@/hooks/useEscolasCadastradas';

interface Aluno {
  id: string;
  nome: string;
  matricula: string;
}

interface RegistroFalta {
  id: string;
  aluno_id: string;
  data_falta: string;
  justificativa: string;
  tipo: "falta" | "atestado";
  criado_em: string;
}

interface RegistroAtraso {
  id: string;
  aluno_id: string;
  data_atraso: string;
  horario_registro: string;
  criado_em: string;
}

export default function ConsultarFaltasPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const isMobile = useIsMobile();
  const [alunos, setAlunos] = useState<Aluno[]>([]);
  const [registros, setRegistros] = useState<RegistroFalta[]>([]);
  const [registrosAtraso, setRegistrosAtraso] = useState<RegistroAtraso[]>([]);
  const [faltasJustificadas, setFaltasJustificadas] = useState<Tables<'justificativa_faltas'>[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const { escolas, loading: escolasLoading } = useEscolasCadastradas();
  const [escolaSelecionada, setEscolaSelecionada] = useState<string>("");

  useEffect(() => {
    if (escolas.length > 0 && !escolaSelecionada) {
      setEscolaSelecionada(escolas[0].id);
    }
  }, [escolas]);

  useEffect(() => {
    if (!user) {
      navigate("/login");
      return;
    }
    if (!escolaSelecionada) return;
    fetchAlunos();
    fetchRegistros();
    fetchRegistrosAtraso();
  }, [user, navigate, escolaSelecionada]);

  useEffect(() => {
    if (user && alunos.length > 0) {
      fetchFaltasJustificadas();
    }
  }, [user, alunos]);

  const fetchAlunos = async () => {
    try {
      const { data, error } = await supabase
        .from("alunos")
        .select("id, nome, matricula, escola_id")
        .eq('escola_id', escolaSelecionada)
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
        .from("registros_faltas")
        .select(`*, alunos (nome, matricula, escola_id)`)
        .order("data_falta", { ascending: false });
      if (error) throw error;
      setRegistros((data || []).filter((r: any) => r.alunos?.escola_id === escolaSelecionada));
    } catch (error) {
      console.error("Erro ao buscar registros:", error);
      toast({
        title: "Erro",
        description: "Não foi possível carregar os registros de falta.",
        variant: "destructive",
      });
    }
  };

  const fetchRegistrosAtraso = async () => {
    try {
      const { data, error } = await supabase
        .from("registros_atrasos")
        .select(`*, alunos (nome, matricula, escola_id)`)
        .order("data_atraso", { ascending: false });
      if (error) throw error;
      setRegistrosAtraso((data || []).filter((r: any) => r.alunos?.escola_id === escolaSelecionada));
    } catch (error) {
      console.error("Erro ao buscar registros de atraso:", error);
      toast({
        title: "Erro",
        description: "Não foi possível carregar os registros de atraso.",
        variant: "destructive",
      });
    }
  };

  const fetchFaltasJustificadas = async () => {
    try {
      let alunoId = alunos.length > 0 ? alunos[0].id : null;
      if (!alunoId) return;
      const { data, error } = await supabase
        .from("justificativa_faltas")
        .select("*")
        .eq("aluno_id", alunoId)
        .order("data", { ascending: false });
      if (error) throw error;
      setFaltasJustificadas(data || []);
    } catch (error) {
      console.error("Erro ao buscar faltas justificadas:", error);
      toast({
        title: "Erro",
        description: "Não foi possível carregar as faltas justificadas.",
        variant: "destructive",
      });
    }
  };

  const normalizeText = (text: string): string => {
    return text
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '') // Remove acentos
      .replace(/\s+/g, ' ') // Substitui múltiplos espaços por um único espaço
      .trim(); // Remove espaços no início e fim
  };

  const registrosFormatados = useMemo(() => registros.map((registro) => ({
    ...registro,
    dataFormatada: format(new Date(registro.data_falta + 'T03:00:00'), "dd/MM/yyyy", { locale: ptBR })
  })), [registros]);

  const registrosFiltrados = useMemo(() => {
    if (!searchTerm) return registrosFormatados;
    const searchNormalized = normalizeText(searchTerm);
    return registrosFormatados.filter(
      (registro) =>
        (registro.nome && normalizeText(registro.nome).includes(searchNormalized)) ||
        (registro.matricula && normalizeText(registro.matricula).includes(searchNormalized))
    );
  }, [registrosFormatados, searchTerm]);

  const registrosAtrasoFormatados = useMemo(() => registrosAtraso.map((registro) => ({
    ...registro
  })), [registrosAtraso]);

  const registrosAtrasoFiltrados = useMemo(() => {
    if (!searchTerm) return registrosAtrasoFormatados;
    const searchNormalized = normalizeText(searchTerm);
    return registrosAtrasoFormatados.filter(
      (registro) =>
        (registro.nome && normalizeText(registro.nome).includes(searchNormalized)) ||
        (registro.matricula && normalizeText(registro.matricula).includes(searchNormalized))
    );
  }, [registrosAtrasoFormatados, searchTerm]);

  const totalAtrasos = useMemo(() => {
    return registrosAtraso.length;
  }, [registrosAtraso]);

  const totalAtestados = useMemo(() => {
    return registros.filter((registro) => registro.tipo === "atestado").length;
  }, [registros]);

  const getAlunoInfo = (aluno_id: string) => {
    const aluno = alunos.find((a) => a.id === aluno_id);
    return {
      nome: aluno ? aluno.nome : '-',
      matricula: aluno ? aluno.matricula : '-',
    };
  };

  return (
    <div className="container mx-auto p-4 max-w-6xl">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-6 gap-4">
        <h1 className="text-2xl font-bold text-purple-700">Consultar Faltas</h1>
        <div className="flex items-center gap-2">
          <Label htmlFor="escola-select">Escola:</Label>
          <select
            id="escola-select"
            className="border rounded px-2 py-1"
            value={escolaSelecionada}
            onChange={e => setEscolaSelecionada(e.target.value)}
            disabled={escolasLoading}
          >
            {escolas.map(escola => (
              <option key={escola.id} value={escola.id}>{escola.nome}</option>
            ))}
          </select>
        </div>
        <Link to="/dashboard">
          <Button variant="outline" className="flex gap-2">
            <ArrowLeft size={18} /> Voltar ao Dashboard
          </Button>
        </Link>
      </div>

      <div className="grid gap-6">
        {/* Cards de Resumo */}
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total de Atrasos</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totalAtrasos}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total de Atestados</CardTitle>
              <FileText className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totalAtestados}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total de Faltas</CardTitle>
              <AlertCircle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {registros.filter((registro) => registro.tipo === "falta").length}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Lista de Registros de Faltas e Atestados */}
        <Card>
          <CardHeader>
            <div className="flex flex-col gap-4">
              <CardTitle>Registros de Faltas e Atestados</CardTitle>
              <div className="relative">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-gray-500" />
                <Input
                  type="text"
                  placeholder="Filtrar por nome ou matrícula do aluno..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
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
                    <TableHead>Tipo</TableHead>
                    <TableHead>Justificativa</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {registrosFiltrados.map((registro) => (
                    <TableRow key={registro.id}>
                      <TableCell className="font-medium">{alunos.length > 0 ? getAlunoInfo(registro.aluno_id).nome : '-'}</TableCell>
                      {!isMobile && <TableCell>{alunos.length > 0 ? getAlunoInfo(registro.aluno_id).matricula : '-'}</TableCell>}
                      <TableCell>{registro.dataFormatada}</TableCell>
                      <TableCell>
                        <span
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                            registro.tipo === "atestado"
                              ? "bg-green-100 text-green-800"
                              : "bg-red-100 text-red-800"
                          }`}
                        >
                          {registro.tipo === "atestado" ? "Atestado" : "Falta"}
                        </span>
                      </TableCell>
                      <TableCell>{registro.justificativa}</TableCell>
                    </TableRow>
                  ))}
                  {registrosFiltrados.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={isMobile ? 4 : 5} className="text-center py-4 text-gray-500">
                        {searchTerm
                          ? `Nenhum registro encontrado com "${searchTerm}"`
                          : "Nenhum registro de falta ou atestado encontrado"}
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        {/* Lista de Registros de Atrasos */}
        <Card>
          <CardHeader>
            <CardTitle>Registros de Atrasos</CardTitle>
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
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {registrosAtrasoFiltrados.map((registro) => (
                    <TableRow key={registro.id}>
                      <TableCell className="font-medium">{alunos.length > 0 ? getAlunoInfo(registro.aluno_id).nome : '-'}</TableCell>
                      {!isMobile && <TableCell>{alunos.length > 0 ? getAlunoInfo(registro.aluno_id).matricula : '-'}</TableCell>}
                      <TableCell>
                        {format(new Date(registro.data_atraso), "dd/MM/yyyy", {
                          locale: ptBR,
                        })}
                      </TableCell>
                      <TableCell>{registro.horario_registro}</TableCell>
                    </TableRow>
                  ))}
                  {registrosAtrasoFiltrados.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={isMobile ? 3 : 4} className="text-center py-4 text-gray-500">
                        {searchTerm
                          ? `Nenhum registro de atraso encontrado com "${searchTerm}"`
                          : "Nenhum registro de atraso encontrado"}
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        {/* Lista de Faltas Justificadas */}
        <Card>
          <CardHeader>
            <CardTitle>Faltas Justificadas</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Aluno</TableHead>
                    {!isMobile && <TableHead>Matrícula</TableHead>}
                    <TableHead>Data</TableHead>
                    <TableHead>Motivo</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {faltasJustificadas.map((falta) => (
                    <TableRow key={falta.id}>
                      <TableCell className="font-medium">{alunos.length > 0 ? getAlunoInfo(falta.aluno_id).nome : '-'}</TableCell>
                      {!isMobile && <TableCell>{alunos.length > 0 ? getAlunoInfo(falta.aluno_id).matricula : '-'}</TableCell>}
                      <TableCell>{format(new Date(falta.data + 'T03:00:00'), "dd/MM/yyyy", { locale: ptBR })}</TableCell>
                      <TableCell>{falta.motivo}</TableCell>
                    </TableRow>
                  ))}
                  {faltasJustificadas.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={isMobile ? 3 : 4} className="text-center py-4 text-gray-500">
                        Nenhuma falta justificada encontrada
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