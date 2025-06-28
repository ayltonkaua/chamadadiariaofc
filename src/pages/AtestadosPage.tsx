import React, { useEffect, useState, useCallback, useMemo } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowLeft, PlusCircle, CheckCircle, XCircle, Pencil, Trash2, Loader2, Inbox, Search, Calendar as CalendarIcon, Eye } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
// CORREÇÃO: Adicionado 'DialogFooter' à lista de importação do dialog.
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { DateRange } from "react-day-picker";

// Interfaces
type AtestadoStatus = 'pendente' | 'aprovado' | 'rejeitado';
interface Aluno { id: string; nome: string; matricula: string; }
interface Atestado {
  id: string;
  aluno_id: string;
  data_inicio: string;
  data_fim: string;
  descricao: string;
  status: AtestadoStatus;
  created_at: string;
  alunos: {
    nome: string;
    turmas: {
      nome: string;
    } | null;
  } | null;
}

const ITEMS_PER_PAGE = 10;

const AtestadosPage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();

  const [atestados, setAtestados] = useState<Atestado[]>([]);
  const [alunos, setAlunos] = useState<Aluno[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalCount, setTotalCount] = useState(0);
  
  const [activeTab, setActiveTab] = useState<AtestadoStatus>('pendente');
  const [currentPage, setCurrentPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState("");
  const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined);

  const [showFormDialog, setShowFormDialog] = useState(false);
  const [editingAtestado, setEditingAtestado] = useState<Atestado | null>(null);
  const [viewingAtestado, setViewingAtestado] = useState<Atestado | null>(null);
  const [formData, setFormData] = useState({ aluno_id: "", data_inicio: "", data_fim: "", descricao: "" });
  
  const fetchAtestados = useCallback(async () => {
    if (!user?.escola_id) {
        setLoading(false);
        return;
    };
    setLoading(true);

    try {
      const from = (currentPage - 1) * ITEMS_PER_PAGE;
      const to = from + ITEMS_PER_PAGE - 1;

      let query = supabase
        .from("atestados")
        .select("*, alunos!inner(nome, turmas(nome))", { count: 'exact' })
        .eq("escola_id", user.escola_id);

      query = query.eq('status', activeTab);

      if (searchTerm) {
        query = query.ilike('alunos.nome', `%${searchTerm}%`);
      }
      if (dateRange?.from) {
        query = query.gte('data_inicio', format(dateRange.from, 'yyyy-MM-dd'));
      }
      if (dateRange?.to) {
        query = query.lte('data_fim', format(dateRange.to, 'yyyy-MM-dd'));
      }
      query = query.order("created_at", { ascending: false }).range(from, to);

      const { data, error, count } = await query;
      if (error) throw error;
      
      setAtestados(data as Atestado[]);
      setTotalCount(count ?? 0);

    } catch (error: any) {
      toast({ title: "Erro ao carregar atestados", description: error.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [user?.escola_id, currentPage, activeTab, searchTerm, dateRange, toast]);

  useEffect(() => {
    fetchAtestados();
  }, [fetchAtestados]);
  
  useEffect(() => {
    const fetchAlunos = async () => {
        if(!user?.escola_id) return;
        const { data } = await supabase.from('alunos').select('id, nome, matricula').eq('escola_id', user.escola_id).order('nome');
        setAlunos(data || []);
    };
    if (showFormDialog) {
        fetchAlunos();
    }
  }, [user?.escola_id, showFormDialog]);

  const totalPages = useMemo(() => Math.ceil(totalCount / ITEMS_PER_PAGE), [totalCount]);
  
  const openNewForm = () => {
    setEditingAtestado(null);
    setFormData({ aluno_id: "", data_inicio: "", data_fim: "", descricao: "" });
    setShowFormDialog(true);
  };
  
  const openEditForm = (atestado: Atestado) => {
    setEditingAtestado(atestado);
    setFormData({
      aluno_id: atestado.aluno_id,
      data_inicio: atestado.data_inicio,
      data_fim: atestado.data_fim,
      descricao: atestado.descricao,
    });
    setShowFormDialog(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const dataToSave = {
        id: editingAtestado?.id,
        aluno_id: formData.aluno_id,
        data_inicio: formData.data_inicio,
        data_fim: formData.data_fim,
        descricao: formData.descricao,
        escola_id: user?.escola_id,
        status: editingAtestado?.status || 'pendente'
      };
      
      const { error } = await supabase.from('atestados').upsert(dataToSave);

      if (error) throw error;
      toast({ title: "Sucesso", description: `Atestado ${editingAtestado ? 'atualizado' : 'registrado'}.` });
      setShowFormDialog(false);
      fetchAtestados();
    } catch(err: any) {
      toast({ title: "Erro ao Salvar", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleStatusChange = async (id: string, status: AtestadoStatus) => {
    const { error } = await supabase.from('atestados').update({ status }).eq('id', id);
    if (error) {
      toast({ title: "Erro ao atualizar", variant: "destructive" });
    } else {
      toast({ title: "Status atualizado!" });
      fetchAtestados();
    }
  };
  
  const handleDelete = async (id: string) => {
     if (!window.confirm("Tem certeza que deseja excluir este atestado?")) return;
    const { error } = await supabase.from('atestados').delete().eq('id', id);
     if (error) {
      toast({ title: "Erro ao deletar", variant: "destructive" });
    } else {
      toast({ title: "Atestado removido." });
      fetchAtestados();
    }
  }
  
  const getStatusBadgeVariant = (status: string) => {
    if (status === 'aprovado') return 'success';
    if (status === 'rejeitado') return 'destructive';
    return 'warning';
  };

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <h1 className="text-2xl font-bold text-gray-800">Gerenciar Atestados</h1>
        <Button onClick={openNewForm}>
          <PlusCircle className="mr-2 h-4 w-4"/> Adicionar Atestado
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Filtros e Busca</CardTitle>
          <CardDescription>Use os filtros para refinar os resultados.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input type="search" placeholder="Buscar por nome do aluno..." className="pl-8 w-full" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
          </div>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className="w-full sm:w-auto justify-start text-left font-normal">
                <CalendarIcon className="mr-2 h-4 w-4" />
                {dateRange?.from ? (dateRange.to ? `${format(dateRange.from, "dd/MM/yy")} - ${format(dateRange.to, "dd/MM/yy")}` : format(dateRange.from, "dd/MM/yy")) : <span>Selecione um período</span>}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar initialFocus mode="range" selected={dateRange} onSelect={setDateRange} numberOfMonths={2} />
            </PopoverContent>
          </Popover>
        </CardContent>
      </Card>
      
      <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as AtestadoStatus)}>
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="pendente">Pendentes</TabsTrigger>
          <TabsTrigger value="aprovado">Aprovados</TabsTrigger>
          <TabsTrigger value="rejeitado">Rejeitados</TabsTrigger>
        </TabsList>
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Aluno</TableHead>
                    <TableHead className="hidden md:table-cell">Período</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading && <TableRow><TableCell colSpan={4} className="text-center h-24"><Loader2 className="animate-spin mx-auto"/></TableCell></TableRow>}
                  {!loading && atestados.length === 0 && <TableRow><TableCell colSpan={4} className="text-center h-24"><Inbox className="mx-auto h-8 w-8 text-gray-400"/><p className="mt-2">Nenhum atestado encontrado.</p></TableCell></TableRow>}
                  {!loading && atestados.map((atestado) => (
                    <TableRow key={atestado.id}>
                      <TableCell className="font-medium">{atestado.alunos?.nome || 'Aluno Removido'}</TableCell>
                      <TableCell className="hidden md:table-cell">{format(parseISO(atestado.data_inicio), "dd/MM/yy")} a {format(parseISO(atestado.data_fim), "dd/MM/yy")}</TableCell>
                      <TableCell><Badge variant={getStatusBadgeVariant(atestado.status)}>{atestado.status}</Badge></TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button variant="ghost" size="icon" onClick={() => setViewingAtestado(atestado)}><Eye className="h-4 w-4" /></Button>
                          {atestado.status === 'pendente' && (
                              <>
                                  <Button variant="ghost" size="icon" className="text-green-600 hover:text-green-700" onClick={() => handleStatusChange(atestado.id, 'aprovado')}><CheckCircle className="h-4 w-4" /></Button>
                                  <Button variant="ghost" size="icon" className="text-red-600 hover:text-red-700" onClick={() => handleStatusChange(atestado.id, 'rejeitado')}><XCircle className="h-4 w-4" /></Button>
                              </>
                          )}
                          <Button variant="ghost" size="icon" onClick={() => openEditForm(atestado)}><Pencil className="h-4 w-4" /></Button>
                          <Button variant="ghost" size="icon" className="text-red-600 hover:text-red-700" onClick={() => handleDelete(atestado.id)}><Trash2 className="h-4 w-4" /></Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
          <CardFooter className="flex items-center justify-between p-4">
            <div className="text-xs text-muted-foreground">Página {currentPage} de {totalPages} ({totalCount} atestado(s))</div>
            <div className="flex gap-2"><Button size="sm" variant="outline" onClick={() => setCurrentPage(p => p - 1)} disabled={currentPage === 1}>Anterior</Button><Button size="sm" variant="outline" onClick={() => setCurrentPage(p => p + 1)} disabled={currentPage >= totalPages}>Próxima</Button></div>
          </CardFooter>
        </Card>
      </Tabs>
      
      <Dialog open={showFormDialog} onOpenChange={setShowFormDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingAtestado ? "Editar Atestado" : "Registrar Novo Atestado"}</DialogTitle>
            <DialogDescription>Preencha as informações abaixo.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4 pt-4">
            <div className="space-y-2">
              <Label htmlFor="aluno">Aluno</Label>
              <Select value={formData.aluno_id} onValueChange={(value) => setFormData({ ...formData, aluno_id: value })}>
                <SelectTrigger><SelectValue placeholder="Selecione um aluno" /></SelectTrigger>
                <SelectContent>
                  {alunos.map((aluno) => (<SelectItem key={aluno.id} value={aluno.id}>{aluno.nome} - {aluno.matricula}</SelectItem>))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2"><Label htmlFor="data_inicio">Data de Início</Label><Input id="data_inicio" type="date" value={formData.data_inicio} onChange={(e) => setFormData({ ...formData, data_inicio: e.target.value })} required /></div>
              <div className="space-y-2"><Label htmlFor="data_fim">Data de Término</Label><Input id="data_fim" type="date" value={formData.data_fim} onChange={(e) => setFormData({ ...formData, data_fim: e.target.value })} required /></div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="descricao">Motivo</Label>
              <Textarea id="descricao" value={formData.descricao} onChange={(e) => setFormData({ ...formData, descricao: e.target.value })} required placeholder="Descreva o motivo do atestado" />
            </div>
            <DialogFooter className="pt-2">
              <Button type="button" variant="ghost" onClick={() => setShowFormDialog(false)}>Cancelar</Button>
              <Button type="submit" disabled={loading}><Loader2 className={`mr-2 h-4 w-4 animate-spin ${!loading && 'hidden'}`}/>{editingAtestado ? "Atualizar" : "Registrar"}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      
      <Dialog open={!!viewingAtestado} onOpenChange={() => setViewingAtestado(null)}>
        <DialogContent>
            <DialogHeader>
                <DialogTitle>Detalhes do Atestado</DialogTitle>
                <DialogDescription>Informações completas do atestado recebido.</DialogDescription>
            </DialogHeader>
            {viewingAtestado && (
                <div className="space-y-4 pt-4 text-sm">
                    <div><Label>Aluno:</Label><p>{viewingAtestado.alunos?.nome}</p></div>
                    <div><Label>Período:</Label><p>{format(parseISO(viewingAtestado.data_inicio), "dd/MM/yyyy")} a {format(parseISO(viewingAtestado.data_fim), "dd/MM/yyyy")}</p></div>
                    <div><Label>Status:</Label><p><Badge variant={getStatusBadgeVariant(viewingAtestado.status)}>{viewingAtestado.status}</Badge></p></div>
                    <div><Label>Data de Envio:</Label><p>{format(parseISO(viewingAtestado.created_at), "dd/MM/yyyy 'às' HH:mm")}</p></div>
                    <div className="border-t pt-4"><Label>Motivo / Descrição:</Label><p className="whitespace-pre-wrap bg-slate-50 p-2 rounded-md mt-1">{viewingAtestado.descricao}</p></div>
                </div>
            )}
            <DialogFooter className="pt-2">
                <Button type="button" variant="outline" onClick={() => setViewingAtestado(null)}>Fechar</Button>
            </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AtestadosPage;