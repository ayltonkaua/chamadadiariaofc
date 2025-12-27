import React, { useState, useMemo, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
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
import { Clock, ArrowLeft, Search, AlertCircle, CheckCircle, XCircle } from "lucide-react";
import { Link } from "react-router-dom";
import { useEscolasCadastradas } from '@/hooks/useEscolasCadastradas';

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
}

interface PresencaFalta {
  id: string;
  aluno_id: string;
  data_chamada: string;
  presente: boolean;
  falta_justificada: boolean;
}

export default function ConsultarFaltasPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const isMobile = useIsMobile();
  const [alunos, setAlunos] = useState<Aluno[]>([]);
  const [registrosAtraso, setRegistrosAtraso] = useState<RegistroAtraso[]>([]);
  const [presencasFaltas, setPresencasFaltas] = useState<PresencaFalta[]>([]);
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
    fetchRegistrosAtraso();
    fetchPresencasFaltas();
  }, [user, navigate, escolaSelecionada]);

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

  const fetchRegistrosAtraso = async () => {
    try {
      const { data, error } = await (supabase as any)
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

  const fetchPresencasFaltas = async () => {
    try {
      const { data, error } = await (supabase as any)
        .from("presencas")
        .select("id, aluno_id, data_chamada, presente, falta_justificada")
        .eq('escola_id', escolaSelecionada)
        .eq('presente', false)
        .order("data_chamada", { ascending: false })
        .limit(100);
      if (error) throw error;
      setPresencasFaltas(data || []);
    } catch (error) {
      console.error("Erro ao buscar faltas:", error);
    }
  };

  const normalizeText = (text: string): string => {
    return text
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  };

  const registrosAtrasoFiltrados = useMemo(() => {
    if (!searchTerm) return registrosAtraso;
    const searchNormalized = normalizeText(searchTerm);
    return registrosAtraso.filter(
      (registro: any) =>
        (registro.alunos?.nome && normalizeText(registro.alunos.nome).includes(searchNormalized)) ||
        (registro.alunos?.matricula && normalizeText(registro.alunos.matricula).includes(searchNormalized))
    );
  }, [registrosAtraso, searchTerm]);

  const presencasFaltasFiltradas = useMemo(() => {
    if (!searchTerm) return presencasFaltas;
    const searchNormalized = normalizeText(searchTerm);
    return presencasFaltas.filter((p) => {
      const aluno = alunos.find(a => a.id === p.aluno_id);
      return aluno && (
        normalizeText(aluno.nome).includes(searchNormalized) ||
        normalizeText(aluno.matricula).includes(searchNormalized)
      );
    });
  }, [presencasFaltas, searchTerm, alunos]);

  const totalAtrasos = registrosAtraso.length;
  const totalFaltasNaoJustificadas = presencasFaltas.filter(p => !p.falta_justificada).length;
  const totalFaltasJustificadas = presencasFaltas.filter(p => p.falta_justificada).length;

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
        <h1 className="text-2xl font-bold text-purple-700">Consultar Faltas e Atrasos</h1>
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
              <CardTitle className="text-sm font-medium">Faltas Não Justificadas</CardTitle>
              <XCircle className="h-4 w-4 text-red-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">{totalFaltasNaoJustificadas}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Faltas Justificadas</CardTitle>
              <CheckCircle className="h-4 w-4 text-green-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">{totalFaltasJustificadas}</div>
            </CardContent>
          </Card>
        </div>

        {/* Busca */}
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

        {/* Lista de Faltas (baseada em presencas) */}
        <Card>
          <CardHeader>
            <CardTitle>Registros de Faltas (últimas 100)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Aluno</TableHead>
                    {!isMobile && <TableHead>Matrícula</TableHead>}
                    <TableHead>Data</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {presencasFaltasFiltradas.map((falta) => (
                    <TableRow key={falta.id}>
                      <TableCell className="font-medium">{getAlunoInfo(falta.aluno_id).nome}</TableCell>
                      {!isMobile && <TableCell>{getAlunoInfo(falta.aluno_id).matricula}</TableCell>}
                      <TableCell>
                        {format(new Date(falta.data_chamada + 'T03:00:00'), "dd/MM/yyyy", { locale: ptBR })}
                      </TableCell>
                      <TableCell>
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${falta.falta_justificada ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"
                          }`}>
                          {falta.falta_justificada ? "Justificada" : "Não Justificada"}
                        </span>
                      </TableCell>
                    </TableRow>
                  ))}
                  {presencasFaltasFiltradas.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={isMobile ? 3 : 4} className="text-center py-4 text-gray-500">
                        {searchTerm
                          ? `Nenhuma falta encontrada com "${searchTerm}"`
                          : "Nenhum registro de falta encontrado"}
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
                  {registrosAtrasoFiltrados.map((registro: any) => (
                    <TableRow key={registro.id}>
                      <TableCell className="font-medium">{registro.alunos?.nome || '-'}</TableCell>
                      {!isMobile && <TableCell>{registro.alunos?.matricula || '-'}</TableCell>}
                      <TableCell>
                        {format(new Date(registro.data_atraso), "dd/MM/yyyy", { locale: ptBR })}
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
      </div>
    </div>
  );
}