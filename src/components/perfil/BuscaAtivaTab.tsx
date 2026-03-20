/**
 * Busca Ativa Tab Component
 * 
 * Tab para gerenciar contatos de busca ativa do aluno.
 * CRUD completo: listar, adicionar, excluir.
 */

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Plus, Trash2, Phone, MessageSquare, Mail, Video, Users, Loader2 } from 'lucide-react';
import { perfilAlunoService, type ContatoBuscaAtiva } from '@/domains';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { getLocalDateString } from '@/lib/dateUtils';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';

interface BuscaAtivaTabProps {
    alunoId: string;
}

const formasContato = [
    { value: 'telefone', label: 'Telefone', icon: Phone },
    { value: 'whatsapp', label: 'WhatsApp', icon: MessageSquare },
    { value: 'email', label: 'E-mail', icon: Mail },
    { value: 'visita', label: 'Visita Domiciliar', icon: Users },
    { value: 'videochamada', label: 'Videochamada', icon: Video },
];

export function BuscaAtivaTab({ alunoId }: BuscaAtivaTabProps) {
    const { user } = useAuth();
    const { toast } = useToast();
    const [contatos, setContatos] = useState<ContatoBuscaAtiva[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    // Form state
    const [isOpen, setIsOpen] = useState(false);
    const [dataContato, setDataContato] = useState(getLocalDateString());
    const [formaContato, setFormaContato] = useState('telefone');
    const [justificativaFaltas, setJustificativaFaltas] = useState('');
    const [monitorResponsavel, setMonitorResponsavel] = useState('');

    const fetchContatos = async () => {
        try {
            setLoading(true);
            const data = await perfilAlunoService.getContatosBuscaAtiva(alunoId);
            setContatos(data);
        } catch (error: any) {
            toast({ title: 'Erro', description: error.message, variant: 'destructive' });
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchContatos();
    }, [alunoId]);

    const openNewDialog = () => {
        setDataContato(getLocalDateString());
        setFormaContato('telefone');
        setJustificativaFaltas('');
        setMonitorResponsavel('');
        setIsOpen(true);
    };

    const handleSave = async () => {
        if (!formaContato) {
            toast({ title: 'Erro', description: 'Selecione a forma de contato', variant: 'destructive' });
            return;
        }

        setSaving(true);
        try {
            await perfilAlunoService.addContatoBuscaAtiva(alunoId, user?.escola_id || '', {
                dataContato,
                formaContato,
                justificativaFaltas: justificativaFaltas.trim() || undefined,
                monitorResponsavel: monitorResponsavel.trim() || undefined,
            });
            toast({ title: 'Sucesso', description: 'Contato registrado!' });
            setIsOpen(false);
            fetchContatos();
        } catch (error: any) {
            toast({ title: 'Erro', description: error.message, variant: 'destructive' });
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async (id: string) => {
        try {
            await perfilAlunoService.deleteContatoBuscaAtiva(id);
            toast({ title: 'Sucesso', description: 'Contato excluído!' });
            fetchContatos();
        } catch (error: any) {
            toast({ title: 'Erro', description: error.message, variant: 'destructive' });
        }
    };

    const getFormaContatoIcon = (forma: string) => {
        const found = formasContato.find(f => f.value === forma);
        if (found) {
            const Icon = found.icon;
            return <Icon className="h-4 w-4" />;
        }
        return <Phone className="h-4 w-4" />;
    };

    const getFormaContatoLabel = (forma: string) => {
        return formasContato.find(f => f.value === forma)?.label || forma;
    };

    if (loading) {
        return (
            <Card>
                <CardContent className="pt-6 space-y-4">
                    <Skeleton className="h-20 w-full" />
                    <Skeleton className="h-20 w-full" />
                </CardContent>
            </Card>
        );
    }

    return (
        <Card>
            <CardContent className="pt-6">
                {/* Header */}
                <div className="flex justify-between items-center mb-4">
                    <h3 className="font-semibold text-gray-700 flex items-center gap-2">
                        <Phone className="h-4 w-4" />
                        Contatos de Busca Ativa ({contatos.length})
                    </h3>
                    <Dialog open={isOpen} onOpenChange={setIsOpen}>
                        <DialogTrigger asChild>
                            <Button size="sm" onClick={openNewDialog}>
                                <Plus className="h-4 w-4 mr-1" />
                                Registrar Contato
                            </Button>
                        </DialogTrigger>
                        <DialogContent>
                            <DialogHeader>
                                <DialogTitle>Registrar Contato de Busca Ativa</DialogTitle>
                            </DialogHeader>
                            <div className="space-y-4 py-4">
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="text-sm font-medium text-gray-700">Data *</label>
                                        <Input
                                            type="date"
                                            value={dataContato}
                                            onChange={(e) => setDataContato(e.target.value)}
                                            className="mt-1"
                                        />
                                    </div>
                                    <div>
                                        <label className="text-sm font-medium text-gray-700">Forma de Contato *</label>
                                        <Select value={formaContato} onValueChange={setFormaContato}>
                                            <SelectTrigger className="mt-1">
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {formasContato.map((f) => (
                                                    <SelectItem key={f.value} value={f.value}>
                                                        <span className="flex items-center gap-2">
                                                            <f.icon className="h-4 w-4" />
                                                            {f.label}
                                                        </span>
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                </div>
                                <div>
                                    <label className="text-sm font-medium text-gray-700">Responsável pelo Contato</label>
                                    <Input
                                        value={monitorResponsavel}
                                        onChange={(e) => setMonitorResponsavel(e.target.value)}
                                        placeholder="Nome do professor/monitor"
                                        className="mt-1"
                                    />
                                </div>
                                <div>
                                    <label className="text-sm font-medium text-gray-700">Justificativa/Resultado</label>
                                    <Textarea
                                        value={justificativaFaltas}
                                        onChange={(e) => setJustificativaFaltas(e.target.value)}
                                        placeholder="O que foi conversado? Qual a justificativa para as faltas?"
                                        className="mt-1"
                                        rows={4}
                                    />
                                </div>
                            </div>
                            <DialogFooter>
                                <Button variant="outline" onClick={() => setIsOpen(false)}>Cancelar</Button>
                                <Button onClick={handleSave} disabled={saving}>
                                    {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                                    Registrar
                                </Button>
                            </DialogFooter>
                        </DialogContent>
                    </Dialog>
                </div>

                {/* List */}
                <div className="space-y-3">
                    {contatos.length === 0 ? (
                        <div className="text-center py-8">
                            <Phone className="h-12 w-12 text-gray-300 mx-auto mb-3" />
                            <p className="text-muted-foreground">
                                Nenhum contato de busca ativa registrado.
                            </p>
                            <p className="text-sm text-gray-400 mt-1">
                                Registre tentativas de contato com o aluno ou responsável.
                            </p>
                        </div>
                    ) : (
                        contatos.map((contato) => (
                            <div key={contato.id} className="p-4 bg-gray-50 rounded-lg border border-gray-100 hover:bg-gray-100 transition-colors">
                                <div className="flex justify-between items-start gap-2">
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 flex-wrap mb-2">
                                            <Badge variant="outline" className="flex items-center gap-1">
                                                {getFormaContatoIcon(contato.formaContato)}
                                                {getFormaContatoLabel(contato.formaContato)}
                                            </Badge>
                                            <span className="text-xs text-gray-500">
                                                {format(parseISO(contato.dataContato), "dd/MM/yyyy", { locale: ptBR })}
                                            </span>
                                        </div>
                                        {contato.justificativaFaltas && (
                                            <p className="text-sm text-gray-600 line-clamp-2 mb-1">
                                                {contato.justificativaFaltas}
                                            </p>
                                        )}
                                        {contato.monitorResponsavel && (
                                            <p className="text-xs text-gray-400">
                                                Responsável: {contato.monitorResponsavel}
                                            </p>
                                        )}
                                    </div>
                                    <AlertDialog>
                                        <AlertDialogTrigger asChild>
                                            <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0">
                                                <Trash2 className="h-4 w-4 text-red-500" />
                                            </Button>
                                        </AlertDialogTrigger>
                                        <AlertDialogContent>
                                            <AlertDialogHeader>
                                                <AlertDialogTitle>Excluir Contato?</AlertDialogTitle>
                                                <AlertDialogDescription>
                                                    Esta ação não pode ser desfeita. O registro do contato será permanentemente excluído.
                                                </AlertDialogDescription>
                                            </AlertDialogHeader>
                                            <AlertDialogFooter>
                                                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                                <AlertDialogAction onClick={() => handleDelete(contato.id)} className="bg-red-600 hover:bg-red-700">
                                                    Excluir
                                                </AlertDialogAction>
                                            </AlertDialogFooter>
                                        </AlertDialogContent>
                                    </AlertDialog>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </CardContent>
        </Card>
    );
}
