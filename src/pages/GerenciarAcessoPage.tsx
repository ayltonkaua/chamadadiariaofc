import React, { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import {
    Loader2, UserX, Shield, Search, Mail, UserCheck,
    UserPlus, Pencil, Filter, Circle
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

// Interfaces
interface MembroEquipe {
    user_id: string;
    nome: string;
    email: string;
    role: string;
    data_entrada: string;
}

interface AlunoAcesso {
    id: string;
    nome: string;
    matricula: string;
    turma_nome: string;
    user_id: string | null;
    email?: string; // Pode vir do auth.users se cruzarmos dados, mas por simplicidade vamos focar no vínculo
}

export default function GerenciarAcessoPage() {
    const { user } = useAuth();
    const { toast } = useToast();
    const [loading, setLoading] = useState(true);

    // Dados
    const [equipe, setEquipe] = useState<MembroEquipe[]>([]);
    const [alunos, setAlunos] = useState<AlunoAcesso[]>([]);
    const [onlineUsers, setOnlineUsers] = useState<Set<string>>(new Set());

    // Filtros
    const [busca, setBusca] = useState("");
    const [filtroStatus, setFiltroStatus] = useState<"todos" | "online" | "offline">("todos");
    const [filtroConta, setFiltroConta] = useState<"todos" | "com_acesso" | "sem_acesso">("todos");

    // Modais
    const [modalConviteOpen, setModalConviteOpen] = useState(false);
    const [modalRoleOpen, setModalRoleOpen] = useState(false);

    // Estados de Formulário
    const [emailConvite, setEmailConvite] = useState("");
    const [roleConvite, setRoleConvite] = useState("professor");
    const [loadingConvite, setLoadingConvite] = useState(false);

    const [editingUser, setEditingUser] = useState<MembroEquipe | null>(null);
    const [newRole, setNewRole] = useState("");

    // --- 1. REALTIME PRESENCE ---
    useEffect(() => {
        if (!user?.escola_id) return;

        // O nome da sala TEM que ser igual ao do usePresence: `escola:${user.escola_id}`
        const channelName = `escola:${user.escola_id}`;
        console.log("[Gestor] Escutando presença na sala:", channelName);

        const channel = supabase.channel(channelName)
            .on('presence', { event: 'sync' }, () => {
                const state = channel.presenceState();
                const userIds = new Set<string>();

                Object.values(state).forEach((presences: any) => {
                    presences.forEach((p: any) => {
                        if (p.user_id) userIds.add(p.user_id);
                    });
                });

                console.log("[Gestor] Usuários online detectados:", userIds.size);
                setOnlineUsers(userIds);
            })
            .subscribe();

        return () => { supabase.removeChannel(channel) };
    }, [user?.escola_id]);

    // --- 2. FETCH DADOS ---
    useEffect(() => {
        if (user?.escola_id) fetchDados();
    }, [user?.escola_id]);

    const fetchDados = async () => {
        setLoading(true);
        try {
            // Buscar Equipe
            const { data: staffData, error: staffError } = await supabase.rpc('get_escola_equipe', {
                _escola_id: user?.escola_id
            });
            if (staffError) throw staffError;
            setEquipe(staffData || []);

            // Buscar Alunos
            const { data: alunosData, error: alunosError } = await supabase
                .from('alunos')
                .select(`id, nome, matricula, user_id, turmas ( nome )`)
                .eq('escola_id', user?.escola_id)
                .order('nome');

            if (alunosError) throw alunosError;

            const alunosFormatados = alunosData.map((aluno: any) => ({
                id: aluno.id,
                nome: aluno.nome,
                matricula: aluno.matricula,
                turma_nome: aluno.turmas?.nome || "Sem Turma",
                user_id: aluno.user_id
            }));
            setAlunos(alunosFormatados);

        } catch (error: any) {
            console.error(error);
            toast({ title: "Erro", description: "Falha ao carregar dados.", variant: "destructive" });
        } finally {
            setLoading(false);
        }
    };

    // --- 3. AÇÕES (Convite, Editar, Remover) ---

    const handleEnviarConvite = async () => {
        if (!emailConvite || !user?.escola_id) return;
        setLoadingConvite(true);
        try {
            // 1. Salva na tabela de convites (para vincular role depois)
            const { error: dbError } = await supabase
                .from('convites_acesso')
                .insert({
                    email: emailConvite,
                    escola_id: user.escola_id,
                    role: roleConvite
                });

            if (dbError) throw dbError;

            // 2. Envia Magic Link do Supabase
            const { error: authError } = await supabase.auth.signInWithOtp({
                email: emailConvite,
                options: {
                    // O usuário será redirecionado para cá. Se ele não existir, cria a conta.
                    emailRedirectTo: window.location.origin + "/dashboard",
                }
            });

            if (authError) throw authError;

            toast({ title: "Convite Enviado!", description: `Um link de acesso foi enviado para ${emailConvite}.` });
            setModalConviteOpen(false);
            setEmailConvite("");

        } catch (error: any) {
            toast({ title: "Erro ao convidar", description: error.message, variant: "destructive" });
        } finally {
            setLoadingConvite(false);
        }
    };

    const handleUpdateRole = async () => {
        if (!editingUser || !newRole) return;
        try {
            const { error } = await supabase.rpc('update_user_role', {
                target_user_id: editingUser.user_id,
                new_role: newRole
            });
            if (error) throw error;

            toast({ title: "Função Atualizada", className: "bg-green-600 text-white" });
            setModalRoleOpen(false);
            fetchDados();
        } catch (error: any) {
            toast({ title: "Erro ao atualizar", description: error.message, variant: "destructive" });
        }
    };

    const handleRemoverAcesso = async (userId: string, tipo: 'staff' | 'aluno', nome: string) => {
        if (!confirm(`Remover acesso de ${nome}?`)) return;
        try {
            if (tipo === 'staff') {
                await supabase.from('user_roles').delete().eq('user_id', userId);
            } else {
                await supabase.from('alunos').update({ user_id: null }).eq('user_id', userId);
            }
            toast({ title: "Acesso removido" });
            fetchDados();
        } catch (err: any) {
            toast({ title: "Erro", description: err.message, variant: "destructive" });
        }
    };

    // --- 4. LÓGICA DE FILTRAGEM ---
    const filtrarEquipe = () => {
        return equipe.filter(m => {
            const matchBusca = m.nome.toLowerCase().includes(busca.toLowerCase()) || m.email.toLowerCase().includes(busca.toLowerCase());
            const isOnline = onlineUsers.has(m.user_id);

            if (filtroStatus === 'online' && !isOnline) return false;
            if (filtroStatus === 'offline' && isOnline) return false;

            return matchBusca;
        });
    };

    const filtrarAlunos = () => {
        return alunos.filter(a => {
            const matchBusca = a.nome.toLowerCase().includes(busca.toLowerCase()) || a.matricula.includes(busca);
            const temAcesso = !!a.user_id;
            const isOnline = a.user_id ? onlineUsers.has(a.user_id) : false;

            if (filtroConta === 'com_acesso' && !temAcesso) return false;
            if (filtroConta === 'sem_acesso' && temAcesso) return false;

            if (filtroStatus === 'online' && !isOnline) return false;
            if (filtroStatus === 'offline' && isOnline) return false;

            return matchBusca;
        });
    };

    // Renderizadores Auxiliares
    const OnlineIndicator = ({ isOnline }: { isOnline: boolean }) => (
        <div className={`flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium border ${isOnline ? 'bg-green-50 text-green-700 border-green-200' : 'bg-gray-50 text-gray-500 border-gray-200'}`}>
            <Circle className={`h-2 w-2 fill-current ${isOnline ? 'text-green-500' : 'text-gray-300'}`} />
            {isOnline ? 'Online' : 'Offline'}
        </div>
    );

    return (
        <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-6">

            {/* HEADER E AÇÕES */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-2xl md:text-3xl font-bold text-gray-900">Gerenciamento de Acesso</h1>
                    <p className="text-gray-500 text-sm">Controle equipe e alunos.</p>
                </div>
                <Button onClick={() => setModalConviteOpen(true)} className="bg-purple-600 hover:bg-purple-700">
                    <UserPlus className="h-4 w-4 mr-2" /> Convidar Equipe
                </Button>
            </div>

            {/* BARRA DE FILTROS */}
            <div className="flex flex-col md:flex-row gap-3 bg-white p-3 rounded-lg border shadow-sm">
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
                    <Input
                        placeholder="Buscar..."
                        className="pl-9 bg-gray-50 border-gray-200"
                        value={busca}
                        onChange={(e) => setBusca(e.target.value)}
                    />
                </div>

                <Select value={filtroStatus} onValueChange={(v: any) => setFiltroStatus(v)}>
                    <SelectTrigger className="w-full md:w-[150px]"><SelectValue placeholder="Status" /></SelectTrigger>
                    <SelectContent>
                        <SelectItem value="todos">Todos Status</SelectItem>
                        <SelectItem value="online">🟢 Online</SelectItem>
                        <SelectItem value="offline">⚪ Offline</SelectItem>
                    </SelectContent>
                </Select>

                <Select value={filtroConta} onValueChange={(v: any) => setFiltroConta(v)}>
                    <SelectTrigger className="w-full md:w-[160px]"><SelectValue placeholder="Conta" /></SelectTrigger>
                    <SelectContent>
                        <SelectItem value="todos">Todos Alunos</SelectItem>
                        <SelectItem value="com_acesso">Com Acesso</SelectItem>
                        <SelectItem value="sem_acesso">Sem Acesso</SelectItem>
                    </SelectContent>
                </Select>
            </div>

            {/* CONTEÚDO (TABS) */}
            <Tabs defaultValue="equipe" className="w-full">
                <TabsList className="grid w-full grid-cols-2 mb-4">
                    <TabsTrigger value="equipe">Equipe ({equipe.length})</TabsTrigger>
                    <TabsTrigger value="alunos">Alunos ({alunos.length})</TabsTrigger>
                </TabsList>

                <TabsContent value="equipe">
                    <Card>
                        <CardHeader className="pb-2"><CardTitle className="text-lg">Membros da Equipe</CardTitle></CardHeader>
                        <CardContent className="p-0">
                            {/* VERSÃO DESKTOP (TABELA) */}
                            <div className="hidden md:block">
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
                                        {filtrarEquipe().map((m) => (
                                            <TableRow key={m.user_id}>
                                                <TableCell className="flex items-center gap-3">
                                                    <Avatar className="h-9 w-9 border">
                                                        <AvatarFallback className="bg-purple-50 text-purple-700">{m.nome[0]}</AvatarFallback>
                                                    </Avatar>
                                                    <div>
                                                        <div className="font-medium">{m.nome}</div>
                                                        <div className="text-xs text-gray-500">{m.email}</div>
                                                    </div>
                                                </TableCell>
                                                <TableCell><OnlineIndicator isOnline={onlineUsers.has(m.user_id)} /></TableCell>
                                                <TableCell><Badge variant="outline" className="uppercase">{m.role}</Badge></TableCell>
                                                <TableCell className="text-right">
                                                    <Button variant="ghost" size="icon" onClick={() => { setEditingUser(m); setNewRole(m.role); setModalRoleOpen(true); }}>
                                                        <Pencil className="h-4 w-4 text-gray-500" />
                                                    </Button>
                                                    <Button variant="ghost" size="icon" className="text-red-500 hover:text-red-600"
                                                        onClick={() => handleRemoverAcesso(m.user_id, 'staff', m.nome)}
                                                        disabled={m.user_id === user?.id}>
                                                        <UserX className="h-4 w-4" />
                                                    </Button>
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </div>

                            {/* VERSÃO MOBILE (CARDS) */}
                            <div className="md:hidden divide-y">
                                {filtrarEquipe().map((m) => (
                                    <div key={m.user_id} className="p-4 flex flex-col gap-3">
                                        <div className="flex items-start justify-between">
                                            <div className="flex items-center gap-3">
                                                <Avatar><AvatarFallback>{m.nome[0]}</AvatarFallback></Avatar>
                                                <div>
                                                    <div className="font-semibold">{m.nome}</div>
                                                    <div className="text-xs text-gray-500">{m.email}</div>
                                                </div>
                                            </div>
                                            <OnlineIndicator isOnline={onlineUsers.has(m.user_id)} />
                                        </div>
                                        <div className="flex justify-between items-center mt-2">
                                            <Badge variant="secondary" className="uppercase">{m.role}</Badge>
                                            <div className="flex gap-2">
                                                <Button size="sm" variant="outline" onClick={() => { setEditingUser(m); setNewRole(m.role); setModalRoleOpen(true); }}>Editar</Button>
                                                <Button size="sm" variant="outline" className="text-red-600 border-red-200" onClick={() => handleRemoverAcesso(m.user_id, 'staff', m.nome)}>Remover</Button>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="alunos">
                    <Card>
                        <CardHeader className="pb-2"><CardTitle className="text-lg">Acesso de Alunos</CardTitle></CardHeader>
                        <CardContent className="p-0">
                            {/* Lógica similar para alunos: Desktop Table / Mobile Cards */}
                            <div className="hidden md:block">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Aluno</TableHead>
                                            <TableHead>Status</TableHead>
                                            <TableHead>Conta</TableHead>
                                            <TableHead className="text-right">Ações</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {filtrarAlunos().map((a) => (
                                            <TableRow key={a.id}>
                                                <TableCell>
                                                    <div className="font-medium">{a.nome}</div>
                                                    <div className="text-xs text-gray-500">{a.matricula} • {a.turma_nome}</div>
                                                </TableCell>
                                                <TableCell>
                                                    {a.user_id && <OnlineIndicator isOnline={onlineUsers.has(a.user_id)} />}
                                                </TableCell>
                                                <TableCell>
                                                    {a.user_id ? <Badge className="bg-green-100 text-green-700 hover:bg-green-100">Ativa</Badge> : <Badge variant="outline">Sem Conta</Badge>}
                                                </TableCell>
                                                <TableCell className="text-right">
                                                    {a.user_id && (
                                                        <Button variant="ghost" size="sm" className="text-red-600" onClick={() => handleRemoverAcesso(a.user_id!, 'aluno', a.nome)}>
                                                            <UserX className="h-4 w-4 mr-1" /> Desvincular
                                                        </Button>
                                                    )}
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </div>

                            <div className="md:hidden divide-y">
                                {filtrarAlunos().map((a) => (
                                    <div key={a.id} className="p-4">
                                        <div className="flex justify-between">
                                            <div>
                                                <div className="font-medium">{a.nome}</div>
                                                <div className="text-xs text-gray-500">{a.matricula}</div>
                                            </div>
                                            <div className="flex flex-col items-end gap-1">
                                                {a.user_id ? <Badge className="bg-green-100 text-green-700">Com Acesso</Badge> : <Badge variant="outline">Sem Acesso</Badge>}
                                                {a.user_id && <OnlineIndicator isOnline={onlineUsers.has(a.user_id)} />}
                                            </div>
                                        </div>
                                        {a.user_id && (
                                            <Button variant="outline" size="sm" className="w-full mt-3 text-red-600 border-red-200" onClick={() => handleRemoverAcesso(a.user_id!, 'aluno', a.nome)}>
                                                Desvincular Conta
                                            </Button>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>

            {/* --- MODAL DE CONVITE --- */}
            <Dialog open={modalConviteOpen} onOpenChange={setModalConviteOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Convidar Membro</DialogTitle>
                        <DialogDescription>O usuário receberá um link mágico no e-mail para acessar.</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div className="space-y-2">
                            <label className="text-sm font-medium">E-mail</label>
                            <div className="relative">
                                <Mail className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                                <Input placeholder="email@exemplo.com" className="pl-9" value={emailConvite} onChange={e => setEmailConvite(e.target.value)} />
                            </div>
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
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setModalConviteOpen(false)}>Cancelar</Button>
                        <Button onClick={handleEnviarConvite} disabled={loadingConvite}>
                            {loadingConvite && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Enviar Convite
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* --- MODAL DE EDIÇÃO DE ROLE --- */}
            <Dialog open={modalRoleOpen} onOpenChange={setModalRoleOpen}>
                <DialogContent>
                    <DialogHeader><DialogTitle>Alterar Função</DialogTitle></DialogHeader>
                    <div className="py-4 space-y-4">
                        <p className="text-sm text-gray-600">Alterando função de <strong>{editingUser?.nome}</strong></p>
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
                        <Button onClick={handleUpdateRole}>Salvar Alteração</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
