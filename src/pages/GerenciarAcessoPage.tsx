import React, { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
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
    Loader2, UserX, Search, Mail,
    UserPlus, Pencil, Circle
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

// Interfaces atualizadas para bater com o RPC
interface MembroEquipe {
    user_id: string;
    nome: string;
    email: string;
    role: string;
    last_sign_in_at?: string;
}

interface AlunoAcesso {
    id: string;
    nome: string;
    matricula: string;
    turma_nome: string;
    user_id: string | null;
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

    // Modais
    const [modalConviteOpen, setModalConviteOpen] = useState(false);
    const [modalRoleOpen, setModalRoleOpen] = useState(false);

    // Estados de Formulário
    const [emailConvite, setEmailConvite] = useState("");
    const [roleConvite, setRoleConvite] = useState("professor");
    const [loadingConvite, setLoadingConvite] = useState(false);

    const [editingUser, setEditingUser] = useState<MembroEquipe | null>(null);
    const [newRole, setNewRole] = useState("");

    // --- 1. REALTIME PRESENCE (Quem está online) ---
    useEffect(() => {
        if (!user?.escola_id) return;

        const channel = supabase.channel(`escola:${user.escola_id}`)
            .on('presence', { event: 'sync' }, () => {
                const state = channel.presenceState();
                const userIds = new Set<string>();

                // Extrai os IDs de quem está na sala
                Object.values(state).forEach((presences: any) => {
                    presences.forEach((p: any) => {
                        if (p.user_id) userIds.add(p.user_id);
                    });
                });

                setOnlineUsers(userIds);
            })
            .subscribe(async (status) => {
                if (status === 'SUBSCRIBED') {
                    // O admin também se anuncia na sala para ser visto por outros
                    await channel.track({
                        user_id: user.id,
                        online_at: new Date().toISOString()
                    });
                }
            });

        return () => { supabase.removeChannel(channel) };
    }, [user?.escola_id, user?.id]);

    // --- 2. FETCH DADOS (Correção Principal) ---
    const fetchDados = async () => {
        if (!user?.escola_id) return;
        setLoading(true);
        try {
            // CORREÇÃO: Usar RPC segura em vez de query manual
            // Isso resolve o problema de "não ver nomes" e "não ver emails"
            const { data: staffData, error: staffError } = await supabase
                .rpc('get_school_users', { _escola_id: user.escola_id });

            if (staffError) throw staffError;

            setEquipe(staffData || []);

            // Buscar Alunos
            const { data: alunosData, error: alunosError } = await supabase
                .from('alunos')
                .select(`id, nome, matricula, user_id, turmas ( nome )`)
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
            console.error("Erro ao buscar dados:", error);
            toast({ title: "Erro", description: error.message || "Falha ao carregar equipe.", variant: "destructive" });
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchDados();
    }, [user?.escola_id]);

    // --- 3. AÇÕES ---

    const handleEnviarConvite = async () => {
        if (!emailConvite || !user?.escola_id) return;
        setLoadingConvite(true);
        try {
            // 1. Salva o convite no banco (Requer Policy de Insert na tabela convites_acesso)
            const { error: dbError } = await supabase
                .from('convites_acesso')
                .insert({
                    email: emailConvite.trim(),
                    escola_id: user.escola_id,
                    role: roleConvite
                });

            if (dbError) throw dbError;

            // 2. Dispara o Magic Link
            const { error: authError } = await supabase.auth.signInWithOtp({
                email: emailConvite.trim(),
                options: {
                    emailRedirectTo: window.location.origin + "/dashboard",
                    data: {
                        invited_by: user.id,
                        escola_id: user.escola_id
                    }
                }
            });

            if (authError) throw authError;

            toast({ title: "Convite Enviado", description: `Link enviado para ${emailConvite}` });
            setModalConviteOpen(false);
            setEmailConvite("");

        } catch (error: any) {
            console.error(error);
            toast({ title: "Erro ao convidar", description: error.message, variant: "destructive" });
        } finally {
            setLoadingConvite(false);
        }
    };

    const handleUpdateRole = async () => {
        if (!editingUser || !newRole) return;
        try {
            // Supondo que você tenha ou use update direto se for admin
            const { error } = await supabase
                .from('user_roles')
                .update({ role: newRole })
                .eq('user_id', editingUser.user_id)
                .eq('escola_id', user?.escola_id);

            if (error) throw error;

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

    // --- 4. FILTROS ---
    const filtrarEquipe = () => {
        return equipe.filter(m => {
            const termo = busca.toLowerCase();
            const match = (m.nome || "").toLowerCase().includes(termo) || (m.email || "").toLowerCase().includes(termo);
            const isOnline = onlineUsers.has(m.user_id);

            if (filtroStatus === 'online' && !isOnline) return false;
            if (filtroStatus === 'offline' && isOnline) return false;

            return match;
        });
    };

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
                    <p className="text-gray-500 text-sm">Controle de equipe e status.</p>
                </div>
                <Button onClick={() => setModalConviteOpen(true)} className="bg-purple-600 hover:bg-purple-700">
                    <UserPlus className="h-4 w-4 mr-2" /> Convidar Equipe
                </Button>
            </div>

            {/* FILTROS */}
            <div className="flex flex-col md:flex-row gap-3 bg-white p-3 rounded-lg border shadow-sm">
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
                    <Input
                        placeholder="Buscar por nome ou email..."
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
            </div>

            {/* TABELA DE EQUIPE */}
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
                                {filtrarEquipe().length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={4} className="text-center py-8 text-gray-500">
                                            Nenhum membro encontrado.
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    filtrarEquipe().map((m) => (
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
                                                <OnlineIndicator
                                                    isOnline={onlineUsers.has(m.user_id)}
                                                    lastSeen={m.last_sign_in_at}
                                                />
                                            </TableCell>
                                            <TableCell><Badge variant="secondary" className="uppercase bg-slate-100 text-slate-700 border-slate-200">{m.role}</Badge></TableCell>
                                            <TableCell className="text-right">
                                                <div className="flex justify-end gap-2">
                                                    <Button variant="ghost" size="icon" onClick={() => { setEditingUser(m); setNewRole(m.role); setModalRoleOpen(true); }}>
                                                        <Pencil className="h-4 w-4 text-slate-500" />
                                                    </Button>
                                                    {m.role !== 'admin' && m.user_id !== user?.id && (
                                                        <Button variant="ghost" size="icon" className="text-red-500 hover:text-red-600 hover:bg-red-50" onClick={() => handleRemoverAcesso(m.user_id, 'staff', m.nome)}>
                                                            <UserX className="h-4 w-4" />
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

            {/* MODAIS (Convite e Edição) mantidos conforme lógica original, apenas com o layout limpo */}
            <Dialog open={modalConviteOpen} onOpenChange={setModalConviteOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Convidar Membro</DialogTitle>
                        <DialogDescription>O usuário receberá acesso com a função selecionada.</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div className="space-y-2">
                            <label className="text-sm font-medium">E-mail</label>
                            <Input placeholder="email@exemplo.com" value={emailConvite} onChange={e => setEmailConvite(e.target.value)} />
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
                            {loadingConvite && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Enviar
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog open={modalRoleOpen} onOpenChange={setModalRoleOpen}>
                <DialogContent>
                    <DialogHeader><DialogTitle>Editar Função</DialogTitle></DialogHeader>
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
                        <Button onClick={handleUpdateRole}>Salvar</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}