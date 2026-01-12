/**
 * Observações Tab Component
 * 
 * Tab para gerenciar observações pedagógicas do aluno.
 * CRUD completo: listar, adicionar, editar, excluir.
 */

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Plus, Edit2, Trash2, FileText, Loader2 } from 'lucide-react';
import { perfilAlunoService, type ObservacaoAluno } from '@/domains';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';

interface ObservacoesTabProps {
    alunoId: string;
    turmaId?: string;
}

export function ObservacoesTab({ alunoId, turmaId }: ObservacoesTabProps) {
    const { user } = useAuth();
    const { toast } = useToast();
    const [observacoes, setObservacoes] = useState<ObservacaoAluno[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    // Form state
    const [isOpen, setIsOpen] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [titulo, setTitulo] = useState('');
    const [descricao, setDescricao] = useState('');

    const fetchObservacoes = async () => {
        try {
            setLoading(true);
            const data = await perfilAlunoService.getObservacoes(alunoId);
            setObservacoes(data);
        } catch (error: any) {
            toast({ title: 'Erro', description: error.message, variant: 'destructive' });
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchObservacoes();
    }, [alunoId]);

    const openNewDialog = () => {
        setEditingId(null);
        setTitulo('');
        setDescricao('');
        setIsOpen(true);
    };

    const openEditDialog = (obs: ObservacaoAluno) => {
        setEditingId(obs.id);
        setTitulo(obs.titulo);
        setDescricao(obs.descricao || '');
        setIsOpen(true);
    };

    const handleSave = async () => {
        if (!titulo.trim()) {
            toast({ title: 'Erro', description: 'Título é obrigatório', variant: 'destructive' });
            return;
        }

        setSaving(true);
        try {
            if (editingId) {
                await perfilAlunoService.updateObservacao(editingId, titulo.trim(), descricao.trim());
                toast({ title: 'Sucesso', description: 'Observação atualizada!' });
            } else {
                await perfilAlunoService.addObservacao(alunoId, titulo.trim(), descricao.trim(), user?.escola_id || '', turmaId);
                toast({ title: 'Sucesso', description: 'Observação adicionada!' });
            }
            setIsOpen(false);
            fetchObservacoes();
        } catch (error: any) {
            toast({ title: 'Erro', description: error.message, variant: 'destructive' });
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async (id: string) => {
        try {
            await perfilAlunoService.deleteObservacao(id);
            toast({ title: 'Sucesso', description: 'Observação excluída!' });
            fetchObservacoes();
        } catch (error: any) {
            toast({ title: 'Erro', description: error.message, variant: 'destructive' });
        }
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
                        <FileText className="h-4 w-4" />
                        Observações Pedagógicas ({observacoes.length})
                    </h3>
                    <Dialog open={isOpen} onOpenChange={setIsOpen}>
                        <DialogTrigger asChild>
                            <Button size="sm" onClick={openNewDialog}>
                                <Plus className="h-4 w-4 mr-1" />
                                Adicionar
                            </Button>
                        </DialogTrigger>
                        <DialogContent>
                            <DialogHeader>
                                <DialogTitle>{editingId ? 'Editar Observação' : 'Nova Observação'}</DialogTitle>
                            </DialogHeader>
                            <div className="space-y-4 py-4">
                                <div>
                                    <label className="text-sm font-medium text-gray-700">Título *</label>
                                    <Input
                                        value={titulo}
                                        onChange={(e) => setTitulo(e.target.value)}
                                        placeholder="Ex: Dificuldade em matemática"
                                        className="mt-1"
                                    />
                                </div>
                                <div>
                                    <label className="text-sm font-medium text-gray-700">Descrição</label>
                                    <Textarea
                                        value={descricao}
                                        onChange={(e) => setDescricao(e.target.value)}
                                        placeholder="Detalhes da observação..."
                                        className="mt-1"
                                        rows={4}
                                    />
                                </div>
                            </div>
                            <DialogFooter>
                                <Button variant="outline" onClick={() => setIsOpen(false)}>Cancelar</Button>
                                <Button onClick={handleSave} disabled={saving}>
                                    {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                                    {editingId ? 'Atualizar' : 'Salvar'}
                                </Button>
                            </DialogFooter>
                        </DialogContent>
                    </Dialog>
                </div>

                {/* List */}
                <div className="space-y-3">
                    {observacoes.length === 0 ? (
                        <p className="text-center text-muted-foreground py-8">
                            Nenhuma observação registrada.
                        </p>
                    ) : (
                        observacoes.map((obs) => (
                            <div key={obs.id} className="p-4 bg-gray-50 rounded-lg border border-gray-100 hover:bg-gray-100 transition-colors">
                                <div className="flex justify-between items-start gap-2">
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 flex-wrap mb-1">
                                            <h4 className="font-semibold text-gray-800">{obs.titulo}</h4>
                                            {obs.turmaNome && (
                                                <Badge variant="secondary" className="text-xs">{obs.turmaNome}</Badge>
                                            )}
                                        </div>
                                        <p className="text-sm text-gray-600 line-clamp-2">{obs.descricao}</p>
                                        <p className="text-xs text-gray-400 mt-2">
                                            {format(parseISO(obs.dataObservacao), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
                                        </p>
                                    </div>
                                    <div className="flex gap-1 shrink-0">
                                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEditDialog(obs)}>
                                            <Edit2 className="h-4 w-4 text-gray-500" />
                                        </Button>
                                        <AlertDialog>
                                            <AlertDialogTrigger asChild>
                                                <Button variant="ghost" size="icon" className="h-8 w-8">
                                                    <Trash2 className="h-4 w-4 text-red-500" />
                                                </Button>
                                            </AlertDialogTrigger>
                                            <AlertDialogContent>
                                                <AlertDialogHeader>
                                                    <AlertDialogTitle>Excluir Observação?</AlertDialogTitle>
                                                    <AlertDialogDescription>
                                                        Esta ação não pode ser desfeita. A observação será permanentemente excluída.
                                                    </AlertDialogDescription>
                                                </AlertDialogHeader>
                                                <AlertDialogFooter>
                                                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                                    <AlertDialogAction onClick={() => handleDelete(obs.id)} className="bg-red-600 hover:bg-red-700">
                                                        Excluir
                                                    </AlertDialogAction>
                                                </AlertDialogFooter>
                                            </AlertDialogContent>
                                        </AlertDialog>
                                    </div>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </CardContent>
        </Card>
    );
}
