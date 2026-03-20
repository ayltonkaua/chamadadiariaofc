import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { toast } from '@/components/ui/use-toast';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Megaphone, Trash2, Plus, Loader2 } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface Aviso {
    id: string;
    titulo: string;
    tipo: string;
    conteudo: string;
    ativo: boolean;
    data_publicacao: string;
}

export function GerenciarAvisosModal() {
    const { user } = useAuth();
    const escolaId = user?.escola_id || '';
    const [open, setOpen] = useState(false);
    
    const [avisos, setAvisos] = useState<Aviso[]>([]);
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    
    const [form, setForm] = useState({
        titulo: '',
        tipo: 'Aviso',
        conteudo: ''
    });

    const loadAvisos = async () => {
        if (!escolaId) return;
        setLoading(true);
        try {
            const { data, error } = await (supabase as any)
                .from('portal_comunicados')
                .select('*')
                .eq('escola_id', escolaId)
                .order('data_publicacao', { ascending: false });
                
            if (error) throw error;
            setAvisos((data as Aviso[]) || []);
        } catch (err: any) {
            toast({ title: 'Erro ao carregar avisos', description: err.message, variant: 'destructive' });
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (open) {
            loadAvisos();
        }
    }, [open, escolaId]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);
        
        try {
            const { error } = await supabase
                .from('portal_comunicados')
                .insert({
                    escola_id: escolaId,
                    titulo: form.titulo,
                    tipo: form.tipo,
                    conteudo: form.conteudo,
                    criado_por: user?.id
                });
                
            if (error) throw error;
            
            toast({ title: 'Aviso Publicado!', description: 'Os alunos já podem ver este aviso no portal.' });
            setForm({ titulo: '', tipo: 'Aviso', conteudo: '' });
            loadAvisos();
        } catch (err: any) {
            toast({ title: 'Erro ao publicar', description: err.message, variant: 'destructive' });
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm('Deseja realmente excluir este aviso?')) return;
        
        try {
            const { error } = await supabase
                .from('portal_comunicados')
                .delete()
                .eq('id', id);
                
            if (error) throw error;
            toast({ title: 'Aviso Removido' });
            setAvisos(curr => curr.filter(a => a.id !== id));
        } catch (err: any) {
            toast({ title: 'Erro ao remover', description: err.message, variant: 'destructive' });
        }
    };

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button variant="outline" className="border-purple-200 text-purple-700 hover:bg-purple-50">
                    <Megaphone className="w-4 h-4 mr-2" />
                    Gerenciar Avisos
                </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2 text-xl text-purple-900">
                        <Megaphone className="w-5 h-5" />
                        Avisos do Portal do Aluno
                    </DialogTitle>
                </DialogHeader>
                
                <div className="space-y-6 mt-4">
                    {/* Formulário Novo Aviso */}
                    <div className="bg-purple-50/50 p-4 rounded-xl border border-purple-100">
                        <h3 className="text-sm font-semibold text-purple-800 mb-3 flex items-center gap-2">
                            <Plus className="w-4 h-4" /> Novo Aviso
                        </h3>
                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div className="grid grid-cols-3 gap-4">
                                <div className="col-span-2 space-y-2">
                                    <Label>Título do Aviso</Label>
                                    <Input 
                                        required 
                                        value={form.titulo} 
                                        onChange={e => setForm({...form, titulo: e.target.value})}
                                        placeholder="Ex: Feriado na sexta-feira" 
                                        className="bg-white"
                                    />
                                </div>
                                <div className="col-span-1 space-y-2">
                                    <Label>Tipo</Label>
                                    <Select value={form.tipo} onValueChange={(v) => setForm({...form, tipo: v})}>
                                        <SelectTrigger className="bg-white">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="Aviso">Aviso Comum</SelectItem>
                                            <SelectItem value="Importante">Importante</SelectItem>
                                            <SelectItem value="Evento">Evento Escolar</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>
                            <div className="space-y-2">
                                <Label>Conteúdo da Mensagem</Label>
                                <Textarea 
                                    required
                                    value={form.conteudo} 
                                    onChange={e => setForm({...form, conteudo: e.target.value})}
                                    placeholder="Escreva os detalhes do comunicado..."
                                    className="bg-white min-h-[100px]"
                                />
                            </div>
                            <Button type="submit" disabled={saving} className="bg-purple-600 hover:bg-purple-700 w-full md:w-auto">
                                {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                                Publicar no Portal
                            </Button>
                        </form>
                    </div>

                    {/* Lista de Avisos */}
                    <div>
                        <h3 className="text-sm font-semibold text-gray-700 mb-3 border-b pb-2">Avisos Recentes</h3>
                        {loading ? (
                            <p className="text-gray-500 text-sm">Carregando...</p>
                        ) : avisos.length === 0 ? (
                            <div className="text-center py-6 text-gray-500 bg-gray-50 rounded-lg">
                                Nenhum aviso publicado.
                            </div>
                        ) : (
                            <div className="space-y-3">
                                {avisos.map(aviso => (
                                    <div key={aviso.id} className="flex flex-col sm:flex-row justify-between gap-4 p-4 border rounded-lg bg-white shadow-sm hover:shadow-md transition-shadow">
                                        <div className="flex-1">
                                            <div className="flex items-center gap-2 mb-1">
                                                <h4 className="font-semibold text-gray-800">{aviso.titulo}</h4>
                                                <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${aviso.tipo === 'Importante' ? 'bg-red-100 text-red-700' : aviso.tipo === 'Evento' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-700'}`}>
                                                    {aviso.tipo}
                                                </span>
                                            </div>
                                            <p className="text-sm text-gray-600 mb-2 whitespace-pre-wrap">{aviso.conteudo}</p>
                                            <span className="text-xs text-gray-400">Publicado em: {format(parseISO(aviso.data_publicacao), "dd 'de' MMMM 'às' HH:mm", { locale: ptBR })}</span>
                                        </div>
                                        <div>
                                            <Button variant="ghost" size="icon" onClick={() => handleDelete(aviso.id)} className="text-red-500 hover:bg-red-50 hover:text-red-700">
                                                <Trash2 className="w-4 h-4" />
                                            </Button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}
