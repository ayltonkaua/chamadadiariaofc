import React, { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from '@/hooks/use-toast';
import { Loader2, PhoneCall } from 'lucide-react';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from '@/components/ui/dialog';

interface RegistrarContatoModalProps {
    alunoId: string;
    nomeAluno: string;
    escolaId: string;
    onSuccess: (novoRegistro?: any) => void;
    open?: boolean;
    onOpenChange?: (open: boolean) => void;
    hideTrigger?: boolean;
    defaultStatusFunil?: string;
}

export function RegistrarContatoModal({ alunoId, nomeAluno, escolaId, onSuccess, open: externalOpen, onOpenChange: externalOnOpenChange, hideTrigger, defaultStatusFunil }: RegistrarContatoModalProps) {
    const { user } = useAuth();
    const [internalOpen, setInternalOpen] = useState(false);
    
    const open = externalOpen !== undefined ? externalOpen : internalOpen;
    const setOpen = externalOnOpenChange || setInternalOpen;

    const [loading, setLoading] = useState(false);
    
    const [formaContato, setFormaContato] = useState('');
    const [justificativa, setJustificativa] = useState('');
    const [statusFunil, setStatusFunil] = useState(defaultStatusFunil || 'EM_ACOMPANHAMENTO');

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        
        if (!formaContato) {
            toast({ title: 'Atenção', description: 'Selecione a forma de contato.', variant: 'destructive' });
            return;
        }

        if (!justificativa.trim()) {
            toast({ title: 'Atenção', description: 'Descreva a justificativa ou anotação do contato.', variant: 'destructive' });
            return;
        }

        setLoading(true);
        try {
            const novoRegistro = {
                aluno_id: alunoId,
                escola_id: escolaId,
                forma_contato: formaContato,
                justificativa_faltas: justificativa,
                status_funil: statusFunil,
                data_contato: new Date().toISOString(),
                monitor_responsavel: user?.nome || user?.email || 'Sistema'
            };

            const { error } = await supabase
                .from('registros_contato_busca_ativa')
                .insert([novoRegistro]);

            if (error) throw error;

            toast({ title: 'Sucesso', description: 'Registro de contato salvo com sucesso.' });
            setOpen(false);
            setFormaContato('');
            setJustificativa('');
            setStatusFunil('EM_ACOMPANHAMENTO');
            onSuccess(novoRegistro);
        } catch (error: any) {
            console.error('Erro ao salvar contato:', error);
            toast({ title: 'Erro', description: error.message || 'Erro ao salvar contato', variant: 'destructive' });
        } finally {
            setLoading(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            {!hideTrigger && (
                <DialogTrigger asChild>
                    <Button size="sm" variant="default" className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700">
                        <PhoneCall className="w-4 h-4 mr-2" />
                        Registrar
                    </Button>
                </DialogTrigger>
            )}
            <DialogContent className="sm:max-w-[425px]">
                <form onSubmit={handleSubmit}>
                    <DialogHeader>
                        <DialogTitle>Registrar Busca Ativa</DialogTitle>
                        <DialogDescription>
                            Aluno(a): {nomeAluno}
                        </DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                        <div className="space-y-2">
                            <label className="text-sm font-medium">Forma de Contato</label>
                            <Select value={formaContato} onValueChange={setFormaContato}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Selecione o meio de contato" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="WhatsApp">WhatsApp</SelectItem>
                                    <SelectItem value="Ligação Telefônica">Ligação Telefônica</SelectItem>
                                    <SelectItem value="Visita Domiciliar">Visita Domiciliar</SelectItem>
                                    <SelectItem value="Reunião na Escola">Reunião na Escola</SelectItem>
                                    <SelectItem value="Outro">Outro</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-medium">Status no Funil</label>
                            <Select value={statusFunil} onValueChange={setStatusFunil}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Selecione o status" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="EM_ACOMPANHAMENTO">Aguardando Avaliação / Acompanhamento</SelectItem>
                                    <SelectItem value="AGUARDANDO_RETORNO">Aguardando Resposta da Família</SelectItem>
                                    <SelectItem value="RESOLVIDO">Resolvido (Aluno Retornou)</SelectItem>
                                    <SelectItem value="EVASAO_CONFIRMADA">Evasão / Trancamento Confirmado</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-medium">Desfecho / Anotação</label>
                            <Textarea 
                                placeholder="Descreva o que foi conversado ou o motivo das faltas..."
                                value={justificativa}
                                onChange={(e) => setJustificativa(e.target.value)}
                                rows={2}
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                            Cancelar
                        </Button>
                        <Button type="submit" disabled={loading}>
                            {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                            Salvar Registro
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
