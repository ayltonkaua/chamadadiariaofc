import React, { useEffect, useState, useMemo } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client"; // Only for Realtime channels
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import {
    Loader2, UserX, Search, UserPlus, Pencil, Circle,
    Trash2, KeyRound, Mail, GraduationCap, Users,
    Copy, CheckCircle2, RefreshCw, Eye, EyeOff
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import {
    acessoService,
    generateTempPassword,
    type MembroEquipe,
    type AlunoAcesso
} from "@/domains";

export default function GerenciarAcessoPage() {
    const { user } = useAuth();
    const { toast } = useToast();
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState("equipe");

    // Dados
    const [equipe, setEquipe] = useState<MembroEquipe[]>([]);
    const [alunos, setAlunos] = useState<AlunoAcesso[]>([]);
    const [onlineUsers, setOnlineUsers] = useState<Set<string>>(new Set());

    // Filtros
    const [busca, setBusca] = useState("");
    const [filtroStatus, setFiltroStatus] = useState<"todos" | "online" | "offline">("todos");
    const [filtroAlunoAcesso, setFiltroAlunoAcesso] = useState<"todos" | "com_conta" | "sem_conta">("todos");

    // Modais
    const [modalConviteOpen, setModalConviteOpen] = useState(false);
    const [modalRoleOpen, setModalRoleOpen] = useState(false);
    const [modalDeleteOpen, setModalDeleteOpen] = useState(false);
    const [modalResetOpen, setModalResetOpen] = useState(false);

    // Estados de Formulário — Criação de Conta
    const [emailConvite, setEmailConvite] = useState("");
    const [nomeConvite, setNomeConvite] = useState("");
    const [roleConvite, setRoleConvite] = useState("professor");
    const [senhaTemp, setSenhaTemp] = useState(() => generateTempPassword());
    const [showSenha, setShowSenha] = useState(false);
    const [loadingConvite, setLoadingConvite] = useState(false);

    // Modal de sucesso com credenciais
    const [modalCredenciaisOpen, setModalCredenciaisOpen] = useState(false);
    const [credenciaisCriadas, setCredenciaisCriadas] = useState<{ email: string; senha: string; nome: string } | null>(null);
    const [copiado, setCopiado] = useState(false);

    const [editingUser, setEditingUser] = useState<MembroEquipe | null>(null);
    const [newRole, setNewRole] = useState("");

    // Delete/Reset state
    const [selectedUser, setSelectedUser] = useState<{
        id: string;
        nome: string;
        email?: string;
        tipo: 'staff' | 'aluno';
    } | null>(null);
    const [actionLoading, setActionLoading] = useState(false);

    // --- 1. REALTIME PRESENCE ---
    useEffect(() => {
        if (!user?.escola_id) return;

        const channel = supabase.channel(`escola:${user.escola_id}`)
            .on('presence', { event: 'sync' }, () => {
                const state = channel.presenceState();
                const userIds = new Set<string>();
                Object.values(state).forEach((presences: any) => {
                    presences.forEach((p: any) => {
                        if (p.user_id) userIds.add(p.user_id);
                    });
                });
                setOnlineUsers(userIds);
            })
            .subscribe(async (status) => {
                if (status === 'SUBSCRIBED') {
                    await channel.track({
                        user_id: user.id,
                        online_at: new Date().toISOString()
                    });
                }
            });

        return () => { supabase.removeChannel(channel) };
    }, [user?.escola_id, user?.id]);

    // --- 2. FETCH DADOS ---
    const fetchDados = async () => {
        if (!user?.escola_id) return;
        setLoading(true);
        try {
            const [equipeData, alunosData] = await Promise.all([
                acessoService.getEquipe(user.escola_id),
                acessoService.getAlunosAcesso(user.escola_id)
            ]);
            setEquipe(equipeData);
            setAlunos(alunosData);
        } catch (error: any) {
            console.error("Erro ao buscar dados:", error);
            toast({ title: "Erro", description: error.message, variant: "destructive" });
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchDados();
    }, [user?.escola_id]);

    // --- 3. AÇÕES ---
    const handleCriarConta = async () => {
        if (!emailConvite || !nomeConvite || !user?.escola_id) return;
        setLoadingConvite(true);
        try {
            await acessoService.criarContaEquipe({
                email: emailConvite.trim(),
                nome: nomeConvite.trim(),
                role: roleConvite,
                password: senhaTemp,
            });

            // Store credentials for the success dialog
            setCredenciaisCriadas({
                email: emailConvite.trim(),
                senha: senhaTemp,
                nome: nomeConvite.trim(),
            });

            // Close creation modal, open credentials modal
            setModalConviteOpen(false);
            setModalCredenciaisOpen(true);

            // Reset form
            setEmailConvite("");
            setNomeConvite("");
            setSenhaTemp(generateTempPassword());

            // Refresh data
            fetchDados();

        } catch (error: any) {
            toast({ title: "Erro ao criar conta", description: error.message, variant: "destructive" });
        } finally {
            setLoadingConvite(false);
        }
    };

    const handleCopiarCredenciais = async () => {
        if (!credenciaisCriadas) return;
        const texto = `Acesso ao Chamada Diária:\nEmail: ${credenciaisCriadas.email}\nSenha temporária: ${credenciaisCriadas.senha}\n\n⚠️ Troque a senha no primeiro acesso.`;
        await navigator.clipboard.writeText(texto);
        setCopiado(true);
        setTimeout(() => setCopiado(false), 3000);
        toast({ title: "📋 Credenciais copiadas!", description: "Envie as credenciais para o novo membro." });
    };

    const handleUpdateRole = async () => {
        if (!editingUser || !newRole || !user?.escola_id) return;
        try {
            await acessoService.updateRole(editingUser.user_id, user.escola_id, newRole);
            toast({ title: "Função Atualizada" });
            setModalRoleOpen(false);
            fetchDados();
        } catch (error: any) {
            toast({ title: "Erro", description: error.message, variant: "destructive" });
        }
    };

    const handleRemoverAcesso = async (userId: string, tipo: 'staff' | 'aluno', nome: string) => {
        if (!confirm(`Tem certeza que deseja remover o acesso de ${nome}?`)) return;
        try {
            if (tipo === 'staff') {
                await acessoService.removerAcessoStaff(userId);
            } else {
                await acessoService.removerAcessoAluno(userId);
            }
            toast({ title: "Acesso removido" });
            fetchDados();
        } catch (err: any) {
            toast({ title: "Erro", description: err.message, variant: "destructive" });
        }
    };

    // NOVA: Enviar link de reset de senha
    const handleSendPasswordReset = async () => {
        if (!selectedUser?.email) {
            toast({ title: "E-mail não encontrado", variant: "destructive" });
            return;
        }
        setActionLoading(true);
        try {
            await acessoService.sendPasswordReset(selectedUser.email);
            toast({
                title: "Link enviado!",
                description: `E-mail de recuperação enviado para ${selectedUser.email}`
            });
            setModalResetOpen(false);
        } catch (error: any) {
            toast({ title: "Erro", description: error.message, variant: "destructive" });
        } finally {
            setActionLoading(false);
        }
    };

    // NOVA: Excluir conta (remove user_id do aluno ou user_roles do staff)
    const handleDeleteAccount = async () => {
        if (!selectedUser) return;
        setActionLoading(true);
        try {
            if (selectedUser.tipo === 'aluno') {
                // Remove vinculo do aluno (não deleta o registro do aluno)
                await acessoService.unlinkStudentAccount(selectedUser.id);
            } else {
                // Remove da equipe
                await acessoService.removerAcessoStaff(selectedUser.id);
            }
            toast({ title: "Conta desvinculada", description: `${selectedUser.nome} foi desvinculado.` });
            setModalDeleteOpen(false);
            fetchDados();
        } catch (error: any) {
            toast({ title: "Erro", description: error.message, variant: "destructive" });
        } finally {
            setActionLoading(false);
        }
    };

    // --- 4. FILTROS ---
    // --- 4. FILTROS MEMOIZADOS ---
    const filteredEquipe = useMemo(() => {
        return equipe.filter(m => {
            const termo = busca.toLowerCase();
            const match = (m.nome || "").toLowerCase().includes(termo) || (m.email || "").toLowerCase().includes(termo);
            const isOnline = onlineUsers.has(m.user_id);
            if (filtroStatus === 'online' && !isOnline) return false;
            if (filtroStatus === 'offline' && isOnline) return false;
            return match;
        });
    }, [equipe, busca, filtroStatus, onlineUsers]);

    const filteredAlunos = useMemo(() => {
        return alunos.filter(a => {
            const termo = busca.toLowerCase();
            const match = a.nome.toLowerCase().includes(termo) || a.matricula.toLowerCase().includes(termo);
            if (filtroAlunoAcesso === 'com_conta' && !a.user_id) return false;
            if (filtroAlunoAcesso === 'sem_conta' && a.user_id) return false;
            return match;
        });
    }, [alunos, busca, filtroAlunoAcesso]);

    const OnlineIndicator = ({ isOnline, lastSeen }: { isOnline: boolean, lastSeen?: string }) => (
        <div className="flex flex-col items-start">
            <div className={`flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium border ${isOnline ? 'bg-green-50 text-green-700 border-green-200' : 'bg-gray-50 text-gray-500 border-gray-200'}`}>
                <Circle className={`h-2 w-2 fill-current ${isOnline ? 'text-green-500' : 'text-gray-300'}`} />
                {isOnline ? 'Online' : 'Offline'}
            </div>
            {!isOnline && lastSeen && (
                <span className="text-[10px] text-gray-400 mt-1 ml-1">
                    Visto: {new Date(lastSeen).toLocaleDateString()}
                </span>
            )}
        </div>
    );

    return (
        <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-6">
            {/* CABEÇALHO */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-2xl md:text-3xl font-bold text-gray-900">Gerenciamento de Acesso</h1>
                    <p className="text-gray-500 text-sm">Controle de equipe, alunos e contas.</p>
                </div>
                <Button onClick={() => setModalConviteOpen(true)} className="bg-purple-600 hover:bg-purple-700">
                    <UserPlus className="h-4 w-4 mr-2" /> Convidar Equipe
                </Button>
            </div>

            {/* TABS */}
            <Tabs value={activeTab} onValueChange={setActiveTab}>
                <TabsList className="grid w-full max-w-md grid-cols-2">
                    <TabsTrigger value="equipe" className="gap-2">
                        <Users className="h-4 w-4" /> Equipe
                    </TabsTrigger>
                    <TabsTrigger value="alunos" className="gap-2">
                        <GraduationCap className="h-4 w-4" /> Alunos
                    </TabsTrigger>
                </TabsList>

                {/* FILTROS */}
                <div className="flex flex-col md:flex-row gap-3 bg-white p-3 rounded-lg border shadow-sm mt-4">
                    <div className="relative flex-1">
                        <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
                        <Input
                            placeholder={activeTab === 'equipe' ? "Buscar por nome ou email..." : "Buscar por nome ou matrícula..."}
                            className="pl-9 bg-gray-50 border-gray-200"
                            value={busca}
                            onChange={(e) => setBusca(e.target.value)}
                        />
                    </div>
                    {activeTab === 'equipe' ? (
                        <Select value={filtroStatus} onValueChange={(v: any) => setFiltroStatus(v)}>
                            <SelectTrigger className="w-full md:w-[150px]"><SelectValue placeholder="Status" /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="todos">Todos Status</SelectItem>
                                <SelectItem value="online">🟢 Online</SelectItem>
                                <SelectItem value="offline">⚪ Offline</SelectItem>
                            </SelectContent>
                        </Select>
                    ) : (
                        <Select value={filtroAlunoAcesso} onValueChange={(v: any) => setFiltroAlunoAcesso(v)}>
                            <SelectTrigger className="w-full md:w-[180px]"><SelectValue placeholder="Conta" /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="todos">Todos</SelectItem>
                                <SelectItem value="com_conta">✅ Com Conta</SelectItem>
                                <SelectItem value="sem_conta">⚪ Sem Conta</SelectItem>
                            </SelectContent>
                        </Select>
                    )}
                </div>

                {/* TAB: EQUIPE */}
                <TabsContent value="equipe">
                    <Card>
                        <CardHeader className="pb-2"><CardTitle className="text-lg">Membros da Equipe</CardTitle></CardHeader>
                        <CardContent className="p-0">
                            {loading ? (
                                <div className="p-8 flex justify-center"><Loader2 className="animate-spin text-purple-600" /></div>
                            ) : (
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Usuário</TableHead>
                                            <TableHead>Status</TableHead>
                                            <TableHead>Função</TableHead>
                                            <TableHead className="text-right">Ações</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {filteredEquipe.length === 0 ? (
                                            <TableRow>
                                                <TableCell colSpan={4} className="text-center py-8 text-gray-500">
                                                    Nenhum membro encontrado.
                                                </TableCell>
                                            </TableRow>
                                        ) : (
                                            filteredEquipe.map((m) => (
                                                <TableRow key={m.user_id}>
                                                    <TableCell className="flex items-center gap-3">
                                                        <Avatar className="h-9 w-9 border bg-slate-100">
                                                            <AvatarFallback className="text-purple-700 font-bold">
                                                                {(m.nome || m.email || "?")[0].toUpperCase()}
                                                            </AvatarFallback>
                                                        </Avatar>
                                                        <div>
                                                            <div className="font-medium text-slate-900">{m.nome || "Sem Nome"}</div>
                                                            <div className="text-xs text-slate-500">{m.email}</div>
                                                        </div>
                                                    </TableCell>
                                                    <TableCell>
                                                        <OnlineIndicator isOnline={onlineUsers.has(m.user_id)} lastSeen={m.last_sign_in_at} />
                                                    </TableCell>
                                                    <TableCell>
                                                        <Badge variant="secondary" className="uppercase bg-slate-100 text-slate-700 border-slate-200">{m.role}</Badge>
                                                    </TableCell>
                                                    <TableCell className="text-right">
                                                        <div className="flex justify-end gap-1">
                                                            <Button variant="ghost" size="icon" title="Editar função" onClick={() => { setEditingUser(m); setNewRole(m.role); setModalRoleOpen(true); }}>
                                                                <Pencil className="h-4 w-4 text-slate-500" />
                                                            </Button>
                                                            <Button variant="ghost" size="icon" title="Enviar link de nova senha" onClick={() => { setSelectedUser({ id: m.user_id, nome: m.nome, email: m.email, tipo: 'staff' }); setModalResetOpen(true); }}>
                                                                <KeyRound className="h-4 w-4 text-blue-500" />
                                                            </Button>
                                                            {m.role !== 'admin' && m.user_id !== user?.id && (
                                                                <Button variant="ghost" size="icon" title="Excluir conta" className="text-red-500 hover:text-red-600 hover:bg-red-50" onClick={() => { setSelectedUser({ id: m.user_id, nome: m.nome, email: m.email, tipo: 'staff' }); setModalDeleteOpen(true); }}>
                                                                    <Trash2 className="h-4 w-4" />
                                                                </Button>
                                                            )}
                                                        </div>
                                                    </TableCell>
                                                </TableRow>
                                            ))
                                        )}
                                    </TableBody>
                                </Table>
                            )}
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* TAB: ALUNOS */}
                <TabsContent value="alunos">
                    <Card>
                        <CardHeader className="pb-2"><CardTitle className="text-lg">Alunos com Acesso</CardTitle></CardHeader>
                        <CardContent className="p-0">
                            {loading ? (
                                <div className="p-8 flex justify-center"><Loader2 className="animate-spin text-purple-600" /></div>
                            ) : (
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Aluno</TableHead>
                                            <TableHead>Turma</TableHead>
                                            <TableHead>Conta</TableHead>
                                            <TableHead className="text-right">Ações</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {filteredAlunos.length === 0 ? (
                                            <TableRow>
                                                <TableCell colSpan={4} className="text-center py-8 text-gray-500">
                                                    Nenhum aluno encontrado.
                                                </TableCell>
                                            </TableRow>
                                        ) : (
                                            filteredAlunos.map((a) => (
                                                <TableRow key={a.id}>
                                                    <TableCell className="flex items-center gap-3">
                                                        <Avatar className="h-9 w-9 border bg-blue-50">
                                                            <AvatarFallback className="text-blue-700 font-bold">
                                                                {a.nome[0].toUpperCase()}
                                                            </AvatarFallback>
                                                        </Avatar>
                                                        <div>
                                                            <div className="font-medium text-slate-900">{a.nome}</div>
                                                            <div className="text-xs text-slate-500">Matrícula: {a.matricula}</div>
                                                        </div>
                                                    </TableCell>
                                                    <TableCell>
                                                        <Badge variant="outline" className="bg-slate-50">{a.turma_nome}</Badge>
                                                    </TableCell>
                                                    <TableCell>
                                                        {a.user_id ? (
                                                            <Badge className="bg-green-100 text-green-700 border-green-200">Vinculado</Badge>
                                                        ) : (
                                                            <Badge variant="secondary" className="bg-gray-100 text-gray-500">Sem Conta</Badge>
                                                        )}
                                                    </TableCell>
                                                    <TableCell className="text-right">
                                                        {a.user_id && (
                                                            <div className="flex justify-end gap-1">
                                                                <Button variant="ghost" size="icon" title="Desvincular conta" className="text-red-500 hover:text-red-600 hover:bg-red-50" onClick={() => { setSelectedUser({ id: a.user_id!, nome: a.nome, tipo: 'aluno' }); setModalDeleteOpen(true); }}>
                                                                    <UserX className="h-4 w-4" />
                                                                </Button>
                                                            </div>
                                                        )}
                                                    </TableCell>
                                                </TableRow>
                                            ))
                                        )}
                                    </TableBody>
                                </Table>
                            )}
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>

            {/* MODAL: CRIAR CONTA */}
            <Dialog open={modalConviteOpen} onOpenChange={setModalConviteOpen}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <UserPlus className="h-5 w-5 text-purple-600" />
                            Criar Conta de Equipe
                        </DialogTitle>
                        <DialogDescription>
                            A conta será criada com uma senha temporária. O membro deverá trocá-la no primeiro acesso.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div className="space-y-2">
                            <label className="text-sm font-medium">Nome Completo</label>
                            <Input placeholder="Ex: Maria Silva" value={nomeConvite} onChange={e => setNomeConvite(e.target.value)} />
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-medium">E-mail</label>
                            <Input type="email" placeholder="email@exemplo.com" value={emailConvite} onChange={e => setEmailConvite(e.target.value)} />
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-medium">Função</label>
                            <Select value={roleConvite} onValueChange={setRoleConvite}>
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="professor">Professor</SelectItem>
                                    <SelectItem value="coordenador">Coordenador</SelectItem>
                                    <SelectItem value="secretario">Secretário</SelectItem>
                                    <SelectItem value="diretor">Diretor</SelectItem>
                                    <SelectItem value="admin">Admin</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-medium">Senha Temporária</label>
                            <div className="flex gap-2">
                                <div className="relative flex-1">
                                    <Input
                                        type={showSenha ? "text" : "password"}
                                        value={senhaTemp}
                                        onChange={e => setSenhaTemp(e.target.value)}
                                        className="pr-10 font-mono"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowSenha(!showSenha)}
                                        className="absolute right-3 top-2.5 text-gray-400 hover:text-gray-600"
                                    >
                                        {showSenha ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                    </button>
                                </div>
                                <Button
                                    type="button"
                                    variant="outline"
                                    size="icon"
                                    title="Gerar nova senha"
                                    onClick={() => setSenhaTemp(generateTempPassword())}
                                >
                                    <RefreshCw className="h-4 w-4" />
                                </Button>
                            </div>
                            <p className="text-xs text-gray-500">O membro será obrigado a trocar essa senha no primeiro login.</p>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setModalConviteOpen(false)}>Cancelar</Button>
                        <Button
                            onClick={handleCriarConta}
                            disabled={loadingConvite || !emailConvite || !nomeConvite || senhaTemp.length < 6}
                            className="bg-purple-600 hover:bg-purple-700"
                        >
                            {loadingConvite && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Criar Conta
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* MODAL: CREDENCIAIS CRIADAS */}
            <Dialog open={modalCredenciaisOpen} onOpenChange={setModalCredenciaisOpen}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2 text-green-700">
                            <CheckCircle2 className="h-5 w-5" />
                            Conta Criada com Sucesso!
                        </DialogTitle>
                        <DialogDescription>
                            Compartilhe as credenciais abaixo com <strong>{credenciaisCriadas?.nome}</strong>.
                        </DialogDescription>
                    </DialogHeader>
                    {credenciaisCriadas && (
                        <div className="space-y-4 py-4">
                            <div className="bg-gray-50 border rounded-xl p-4 space-y-3 font-mono text-sm">
                                <div className="flex justify-between items-center">
                                    <span className="text-gray-500">Email:</span>
                                    <span className="font-medium text-gray-900">{credenciaisCriadas.email}</span>
                                </div>
                                <div className="border-t" />
                                <div className="flex justify-between items-center">
                                    <span className="text-gray-500">Senha:</span>
                                    <span className="font-bold text-violet-700 text-base">{credenciaisCriadas.senha}</span>
                                </div>
                            </div>
                            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-800">
                                ⚠️ A senha deverá ser trocada no primeiro acesso. Não será possível visualizá-la novamente.
                            </div>
                        </div>
                    )}
                    <DialogFooter className="gap-2 sm:gap-0">
                        <Button variant="outline" onClick={() => setModalCredenciaisOpen(false)}>Fechar</Button>
                        <Button onClick={handleCopiarCredenciais} className="bg-violet-600 hover:bg-violet-700">
                            {copiado ? (
                                <><CheckCircle2 className="mr-2 h-4 w-4" /> Copiado!</>
                            ) : (
                                <><Copy className="mr-2 h-4 w-4" /> Copiar Credenciais</>
                            )}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* MODAL: EDITAR FUNÇÃO */}
            <Dialog open={modalRoleOpen} onOpenChange={setModalRoleOpen}>
                <DialogContent>
                    <DialogHeader><DialogTitle>Editar Função de {editingUser?.nome}</DialogTitle></DialogHeader>
                    <div className="py-4">
                        <Select value={newRole} onValueChange={setNewRole}>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="professor">Professor</SelectItem>
                                <SelectItem value="coordenador">Coordenador</SelectItem>
                                <SelectItem value="secretario">Secretário</SelectItem>
                                <SelectItem value="diretor">Diretor</SelectItem>
                                <SelectItem value="admin">Admin</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setModalRoleOpen(false)}>Cancelar</Button>
                        <Button onClick={handleUpdateRole}>Salvar</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* MODAL: RESET SENHA */}
            <Dialog open={modalResetOpen} onOpenChange={setModalResetOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <KeyRound className="h-5 w-5 text-blue-500" />
                            Enviar Link de Nova Senha
                        </DialogTitle>
                        <DialogDescription>
                            Um e-mail será enviado para <strong>{selectedUser?.email}</strong> com instruções para criar uma nova senha.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="py-4 bg-blue-50 rounded-lg p-4 text-sm text-blue-800">
                        <p><strong>Usuário:</strong> {selectedUser?.nome}</p>
                        <p><strong>E-mail:</strong> {selectedUser?.email}</p>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setModalResetOpen(false)}>Cancelar</Button>
                        <Button onClick={handleSendPasswordReset} disabled={actionLoading} className="bg-blue-600 hover:bg-blue-700">
                            {actionLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            <Mail className="mr-2 h-4 w-4" /> Enviar Link
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* MODAL: EXCLUIR/DESVINCULAR CONTA */}
            <Dialog open={modalDeleteOpen} onOpenChange={setModalDeleteOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2 text-red-600">
                            <Trash2 className="h-5 w-5" />
                            {selectedUser?.tipo === 'aluno' ? 'Desvincular Conta do Aluno' : 'Remover Membro da Equipe'}
                        </DialogTitle>
                        <DialogDescription>
                            {selectedUser?.tipo === 'aluno'
                                ? 'O aluno perderá acesso ao portal, mas seus dados de presença serão mantidos.'
                                : 'O membro será removido da equipe e perderá todos os acessos.'
                            }
                        </DialogDescription>
                    </DialogHeader>
                    <div className="py-4 bg-red-50 rounded-lg p-4 text-sm text-red-800">
                        <p><strong>Nome:</strong> {selectedUser?.nome}</p>
                        {selectedUser?.email && <p><strong>E-mail:</strong> {selectedUser?.email}</p>}
                        <p className="mt-2 font-medium">⚠️ Esta ação não pode ser desfeita.</p>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setModalDeleteOpen(false)}>Cancelar</Button>
                        <Button onClick={handleDeleteAccount} disabled={actionLoading} variant="destructive">
                            {actionLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Confirmar Exclusão
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}