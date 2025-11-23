import React, { useEffect, useState, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { PlusCircle, CheckCircle, XCircle, Pencil, Trash2, Loader2, Inbox, Search, Calendar as CalendarIcon, Eye, FileText, User } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { format, parseISO } from "date-fns";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
    if (status === 'aprovado') return 'success'; // Certifique-se que existe variant 'success' ou use 'default' com className customizada
    if (status === 'rejeitado') return 'destructive';
    return 'secondary';
  };

  const getStatusBadge = (status: string) => {
      switch (status) {
          case 'aprovado': return <Badge className="bg-green-600 hover:bg-green-700">Aprovado</Badge>;
          case 'rejeitado': return <Badge variant="destructive">Rejeitado</Badge>;
          default: return <Badge variant="outline" className="bg-yellow-100 text-yellow-800 border-yellow-200">Pendente</Badge>;
      }
  }

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <h1 className="text-2xl font-bold text-gray-800">Gerenciar Atestados</h1>
        <Button onClick={openNewForm} className="w-full sm:w-auto">
          <PlusCircle className="mr-2 h-4 w-4"/> Adicionar Atestado
        </Button>
      </div>

      {/* Filtros */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">Filtros e Busca</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input type="search" placeholder="Buscar aluno..." className="pl-8 w-full" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
          </div>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className="w-full sm:w-auto justify-start text-left font-normal">
                <CalendarIcon className="mr-2 h-4 w-4" />
                {dateRange?.from ? (dateRange.to ? `${format(dateRange.from, "dd/MM")} - ${format(dateRange.to, "dd/MM")}` : format(dateRange.from, "dd/MM/yy")) : <span>Período</span>}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar initialFocus mode="range" selected={dateRange} onSelect={setDateRange} numberOfMonths={1} />
            </PopoverContent>
          </Popover>
        </CardContent>
      </Card>
      
      <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as AtestadoStatus)}>
        <TabsList className="grid w-full grid-cols-3 mb-4">
          <TabsTrigger value="pendente">Pendentes</TabsTrigger>
          <TabsTrigger value="aprovado">Aprovados</TabsTrigger>
          <TabsTrigger value="rejeitado">Rejeitados</TabsTrigger>
        </TabsList>

        {loading ? (
            <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-primary"/></div>
        ) : atestados.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-gray-500 border-2 border-dashed rounded-lg bg-gray-50">
                <Inbox className="h-12 w-12 mb-2 opacity-50"/>
                <p>Nenhum atestado encontrado nesta categoria.</p>
            </div>
        ) : (
            <>
                {/* --- VISÃO MOBILE (CARDS) --- */}
                <div className="grid grid-cols-1 gap-4 md:hidden">
                    {atestados.map((atestado) => (
                        <Card key={atestado.id} className="overflow-hidden shadow-sm border-l-4" style={{ borderLeftColor: atestado.status === 'pendente' ? '#EAB308' : atestado.status === 'aprovado' ? '#16A34A' : '#DC2626' }}>
                            <CardHeader className="pb-2 bg-gray-50/50">
                                <div className="flex justify-between items-start">
                                    <div>
                                        <CardTitle className="text-base">{atestado.alunos?.nome}</CardTitle>
                                        <CardDescription className="text-xs mt-1">{atestado.alunos?.turmas?.nome}</CardDescription>
                                    </div>
                                    {getStatusBadge(atestado.status)}
                                </div>
                            </CardHeader>
                            <CardContent className="pt-4 pb-3 space-y-2 text-sm">
                                <div className="flex items-center gap-2 text-gray-600">
                                    <CalendarIcon className="h-4 w-4 text-primary" />
                                    <span>
                                        {format(parseISO(atestado.data_inicio), "dd/MM")} até {format(parseISO(atestado.data_fim), "dd/MM/yyyy")}
                                    </span>
                                </div>
                                <div className="bg-slate-50 p-2 rounded border text-gray-700 flex gap-2 items-start">
                                    <FileText className="h-4 w-4 mt-0.5 text-gray-400 shrink-0"/>
                                    <span className="italic line-clamp-2">{atestado.descricao}</span>
                                </div>
                            </CardContent>
                            <CardFooter className="bg-gray-50 p-2 flex justify-end gap-2">
                                <Button variant="ghost" size="sm" onClick={() => setViewingAtestado(atestado)}>
                                    <Eye className="h-4 w-4 mr-1"/> Ver
                                </Button>
                                {atestado.status === 'pendente' ? (
                                    <>
                                        <Button size="sm" className="bg-green-600 hover:bg-green-700 h-8" onClick={() => handleStatusChange(atestado.id, 'aprovado')}>
                                            <CheckCircle className="h-4 w-4"/>
                                        </Button>
                                        <Button size="sm" variant="destructive" className="h-8" onClick={() => handleStatusChange(atestado.id, 'rejeitado')}>
                                            <XCircle className="h-4 w-4"/>
                                        </Button>
                                    </>
                                ) : (
                                    <Button variant="ghost" size="sm" onClick={() => handleDelete(atestado.id)}>
                                        <Trash2 className="h-4 w-4 text-red-500"/>
                                    </Button>
                                )}
                            </CardFooter>
                        </Card>
                    ))}
                </div>

                {/* --- VISÃO DESKTOP (TABELA) --- */}
                <div className="hidden md:block border rounded-lg overflow-hidden bg-white shadow-sm">
                    <Table>
                        <TableHeader className="bg-gray-50">
                            <TableRow>
                                <TableHead>Aluno</TableHead>
                                <TableHead>Turma</TableHead>
                                <TableHead>Período</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead className="text-right">Ações</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {atestados.map((atestado) => (
                                <TableRow key={atestado.id} className="hover:bg-gray-50/50">
                                    <TableCell className="font-medium">{atestado.alunos?.nome || 'Aluno Removido'}</TableCell>
                                    <TableCell>{atestado.alunos?.turmas?.nome || '-'}</TableCell>
                                    <TableCell>{format(parseISO(atestado.data_inicio), "dd/MM/yy")} a {format(parseISO(atestado.data_fim), "dd/MM/yy")}</TableCell>
                                    <TableCell>{getStatusBadge(atestado.status)}</TableCell>
                                    <TableCell className="text-right">
                                        <div className="flex justify-end gap-1">
                                            <Button variant="ghost" size="icon" title="Ver detalhes" onClick={() => setViewingAtestado(atestado)}>
                                                <Eye className="h-4 w-4 text-gray-500" />
                                            </Button>
                                            {atestado.status === 'pendente' && (
                                                <>
                                                    <Button variant="ghost" size="icon" title="Aprovar" className="text-green-600 hover:text-green-700 hover:bg-green-50" onClick={() => handleStatusChange(atestado.id, 'aprovado')}>
                                                        <CheckCircle className="h-4 w-4" />
                                                    </Button>
                                                    <Button variant="ghost" size="icon" title="Rejeitar" className="text-red-600 hover:text-red-700 hover:bg-red-50" onClick={() => handleStatusChange(atestado.id, 'rejeitado')}>
                                                        <XCircle className="h-4 w-4" />
                                                    </Button>
                                                </>
                                            )}
                                            <Button variant="ghost" size="icon" title="Editar" onClick={() => openEditForm(atestado)}>
                                                <Pencil className="h-4 w-4 text-blue-600" />
                                            </Button>
                                            <Button variant="ghost" size="icon" title="Excluir" className="text-red-600 hover:text-red-700 hover:bg-red-50" onClick={() => handleDelete(atestado.id)}>
                                                <Trash2 className="h-4 w-4" />
                                            </Button>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </div>

                {/* Paginação */}
                <div className="flex items-center justify-between pt-4">
                    <div className="text-xs text-muted-foreground">
                        Página {currentPage} de {totalPages || 1} ({totalCount} registros)
                    </div>
                    <div className="flex gap-2">
                        <Button size="sm" variant="outline" onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1}>
                            Anterior
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage >= totalPages}>
                            Próxima
                        </Button>
                    </div>
                </div>
            </>
        )}
      </Tabs>
      
      {/* Dialog de Cadastro/Edição */}
      <Dialog open={showFormDialog} onOpenChange={setShowFormDialog}>
        <DialogContent className="sm:max-w-md">
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
              <Button type="submit" disabled={loading}>
                <Loader2 className={`mr-2 h-4 w-4 animate-spin ${!loading && 'hidden'}`}/>
                {editingAtestado ? "Atualizar" : "Registrar"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      
      {/* Dialog de Visualização */}
      <Dialog open={!!viewingAtestado} onOpenChange={() => setViewingAtestado(null)}>
        <DialogContent className="sm:max-w-md">
            <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                    <FileText className="h-5 w-5 text-primary"/> Detalhes do Atestado
                </DialogTitle>
            </DialogHeader>
            {viewingAtestado && (
                <div className="space-y-4 pt-2 text-sm">
                    <div className="grid grid-cols-2 gap-4 p-3 bg-slate-50 rounded-lg">
                        <div>
                            <Label className="text-xs text-muted-foreground uppercase font-bold">Aluno</Label>
                            <p className="font-medium">{viewingAtestado.alunos?.nome}</p>
                        </div>
                        <div>
                            <Label className="text-xs text-muted-foreground uppercase font-bold">Turma</Label>
                            <p>{viewingAtestado.alunos?.turmas?.nome || '-'}</p>
                        </div>
                    </div>
                    
                    <div className="flex items-center justify-between border-b pb-2">
                        <div>
                            <Label className="text-xs text-muted-foreground uppercase font-bold">Período</Label>
                            <p className="flex items-center gap-1">
                                <CalendarIcon className="h-3 w-3"/>
                                {format(parseISO(viewingAtestado.data_inicio), "dd/MM/yyyy")} até {format(parseISO(viewingAtestado.data_fim), "dd/MM/yyyy")}
                            </p>
                        </div>
                        <div className="text-right">
                            <Label className="text-xs text-muted-foreground uppercase font-bold block mb-1">Status</Label>
                            {getStatusBadge(viewingAtestado.status)}
                        </div>
                    </div>

                    <div>
                        <Label className="text-xs text-muted-foreground uppercase font-bold">Motivo / Descrição</Label>
                        <p className="whitespace-pre-wrap bg-white border p-3 rounded-md mt-1 text-gray-700 min-h-[80px]">
                            {viewingAtestado.descricao}
                        </p>
                    </div>
                    
                    <div className="text-xs text-center text-gray-400 pt-2">
                        Enviado em: {format(parseISO(viewingAtestado.created_at), "dd/MM/yyyy 'às' HH:mm")}
                    </div>
                </div>
            )}
            <DialogFooter>
                <Button className="w-full" type="button" variant="secondary" onClick={() => setViewingAtestado(null)}>Fechar</Button>
            </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AtestadosPage;