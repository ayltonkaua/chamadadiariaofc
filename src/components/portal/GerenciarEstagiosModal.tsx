import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { toast } from '@/components/ui/use-toast';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Briefcase, Trash2, Plus, Loader2 } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface Estagio {
    id: string;
    cargo: string;
    empresa: string;
    descricao: string;
    bolsa: number | null;
    link_inscricao: string | null;
    ativo: boolean;
    data_publicacao: string;
}

export function GerenciarEstagiosModal() {
    const { user } = useAuth();
    const escolaId = user?.escola_id || '';
    const [open, setOpen] = useState(false);
    
    const [estagios, setEstagios] = useState<Estagio[]>([]);
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    
    const [form, setForm] = useState({
        cargo: '',
        empresa: '',
        descricao: '',
        bolsa: '',
        link_inscricao: ''
    });

    const loadEstagios = async () => {
        if (!escolaId) return;
        setLoading(true);
        try {
            const { data, error } = await (supabase as any)
                .from('portal_estagios')
                .select('*')
                .eq('escola_id', escolaId)
                .order('data_publicacao', { ascending: false });
                
            if (error) throw error;
            setEstagios((data as Estagio[]) || []);
        } catch (err: any) {
            toast({ title: 'Erro ao carregar vagas', description: err.message, variant: 'destructive' });
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (open) {
            loadEstagios();
        }
    }, [open, escolaId]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);
        
        try {
            const { error } = await supabase
                .from('portal_estagios')
                .insert({
                    escola_id: escolaId,
                    cargo: form.cargo,
                    empresa: form.empresa,
                    descricao: form.descricao,
                    bolsa: form.bolsa ? parseFloat(form.bolsa) : null,
                    link_inscricao: form.link_inscricao,
                    criado_por: user?.id
                });
                
            if (error) throw error;
            
            toast({ title: 'Vaga Publicada!', description: 'Os alunos já podem visualizar a vaga de estágio.' });
            setForm({ cargo: '', empresa: '', descricao: '', bolsa: '', link_inscricao: '' });
            loadEstagios();
        } catch (err: any) {
            toast({ title: 'Erro ao publicar', description: err.message, variant: 'destructive' });
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm('Deseja realmente remover esta vaga?')) return;
        
        try {
            const { error } = await supabase
                .from('portal_estagios')
                .delete()
                .eq('id', id);
                
            if (error) throw error;
            toast({ title: 'Vaga Removida' });
            setEstagios(curr => curr.filter(a => a.id !== id));
        } catch (err: any) {
            toast({ title: 'Erro ao remover', description: err.message, variant: 'destructive' });
        }
    };

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button variant="outline" className="border-indigo-200 text-indigo-700 hover:bg-indigo-50">
                    <Briefcase className="w-4 h-4 mr-2" />
                    Vagas de Estágio
                </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2 text-xl text-indigo-900">
                        <Briefcase className="w-5 h-5" />
                        Mural de Estágios e Empregos
                    </DialogTitle>
                </DialogHeader>
                
                <div className="space-y-6 mt-4">
                    {/* Formulário Novo Estágio */}
                    <div className="bg-indigo-50/50 p-4 rounded-xl border border-indigo-100">
                        <h3 className="text-sm font-semibold text-indigo-800 mb-3 flex items-center gap-2">
                            <Plus className="w-4 h-4" /> Cadastrar Nova Vaga
                        </h3>
                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label>Cargo / Vaga</Label>
                                    <Input 
                                        required 
                                        value={form.cargo} 
                                        onChange={e => setForm({...form, cargo: e.target.value})}
                                        placeholder="Ex: Menor Aprendiz Administrativo" 
                                        className="bg-white"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label>Nome da Empresa (Opcional)</Label>
                                    <Input 
                                        value={form.empresa} 
                                        onChange={e => setForm({...form, empresa: e.target.value})}
                                        placeholder="Ex: Coca-Cola" 
                                        className="bg-white"
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label>Bolsa / Salário (R$)</Label>
                                    <Input 
                                        type="number"
                                        step="0.01"
                                        value={form.bolsa} 
                                        onChange={e => setForm({...form, bolsa: e.target.value})}
                                        placeholder="Ex: 850.00" 
                                        className="bg-white"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label>Link para Inscrição (Opcional)</Label>
                                    <Input 
                                        type="url"
                                        value={form.link_inscricao} 
                                        onChange={e => setForm({...form, link_inscricao: e.target.value})}
                                        placeholder="https://..." 
                                        className="bg-white"
                                    />
                                </div>
                            </div>

                            <div className="space-y-2">
                                <Label>Descrição e Requisitos</Label>
                                <Textarea 
                                    required
                                    value={form.descricao} 
                                    onChange={e => setForm({...form, descricao: e.target.value})}
                                    placeholder="Detalhes da vaga, horários e requisitos..."
                                    className="bg-white min-h-[100px]"
                                />
                            </div>
                            <Button type="submit" disabled={saving} className="bg-indigo-600 hover:bg-indigo-700 w-full md:w-auto">
                                {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                                Publicar Vaga
                            </Button>
                        </form>
                    </div>

                    {/* Lista de Vagas */}
                    <div>
                        <h3 className="text-sm font-semibold text-gray-700 mb-3 border-b pb-2">Vagas Divulgadas</h3>
                        {loading ? (
                            <p className="text-gray-500 text-sm">Carregando...</p>
                        ) : estagios.length === 0 ? (
                            <div className="text-center py-6 text-gray-500 bg-gray-50 rounded-lg">
                                Nenhuma vaga publicada.
                            </div>
                        ) : (
                            <div className="space-y-3">
                                {estagios.map(vaga => (
                                    <div key={vaga.id} className="flex flex-col sm:flex-row justify-between gap-4 p-4 border rounded-lg bg-white shadow-sm hover:shadow-md transition-shadow">
                                        <div className="flex-1">
                                            <div className="flex justify-between items-start mb-1">
                                                <h4 className="font-semibold text-gray-800">{vaga.cargo}</h4>
                                                {vaga.bolsa && <span className="text-xs font-bold text-green-700 bg-green-100 px-2 py-1 rounded">R$ {Number(vaga.bolsa).toFixed(2)}</span>}
                                            </div>
                                            <p className="text-xs font-medium text-gray-500 mb-2">{vaga.empresa}</p>
                                            <p className="text-sm text-gray-600 mb-2 whitespace-pre-wrap">{vaga.descricao}</p>
                                            <div className="flex items-center gap-4">
                                                <span className="text-xs text-gray-400">Publicado em: {format(parseISO(vaga.data_publicacao), "dd/MM/yyyy", { locale: ptBR })}</span>
                                            </div>
                                        </div>
                                        <div>
                                            <Button variant="ghost" size="icon" onClick={() => handleDelete(vaga.id)} className="text-red-500 hover:bg-red-50 hover:text-red-700">
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
