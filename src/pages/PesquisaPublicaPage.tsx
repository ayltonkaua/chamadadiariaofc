import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { toast } from '@/hooks/use-toast';
import { Loader2, Send, User, FileText, CheckCircle, ArrowLeft, Calendar } from 'lucide-react';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';

interface PesquisaPendente {
    id: string;
    titulo: string;
    descricao: string | null;
    created_at: string;
    pesquisa_perguntas: {
      id: string;
      texto_pergunta: string;
      opcoes: string[];
    }[];
}

const PesquisaPublicaPage: React.FC = () => {
    const [step, setStep] = useState<'loading' | 'list' | 'form' | 'error'>('loading');
    const { user, loadingUser } = useAuth();
    const [pesquisasPendentes, setPesquisasPendentes] = useState<PesquisaPendente[]>([]);
    const [pesquisaAtiva, setPesquisaAtiva] = useState<PesquisaPendente | null>(null);
    const [respostas, setRespostas] = useState<Record<string, string>>({});
    const [loading, setLoading] = useState(false);
    const navigate = useNavigate();

    useEffect(() => {
        if (loadingUser) {
            setStep('loading');
            return;
        }

        if (!user || user.type !== 'aluno' || !user.aluno_id) {
            toast({ title: "Acesso Negado", description: "Você precisa estar logado como aluno para ver as pesquisas.", variant: "destructive" });
            navigate('/portal-aluno');
            return;
        }

        const fetchPesquisasPendentes = async () => {
            setLoading(true);
            try {
                // AQUI ESTÁ A MODIFICAÇÃO CRUCIAL
                // Removemos o "!inner" e o filtro de status da query inicial
                const { data: pendentesData, error: pendentesError } = await supabase
                    .from('pesquisa_destinatarios')
                    .select(`
                        status_resposta,
                        pesquisas(
                            id, titulo, descricao, status, created_at,
                            pesquisa_perguntas(id, texto_pergunta, opcoes)
                        )
                    `)
                    .eq('aluno_id', user.aluno_id)
                    .eq('status_resposta', 'pendente');

                if (pendentesError) throw pendentesError;
                
                // A filtragem agora é feita de forma segura no código
                const pesquisasFormatadas = (pendentesData as any[])
                    .filter(item => item.pesquisas && item.pesquisas.status === 'ativa') // Garante que a pesquisa exista e esteja ativa
                    .map(item => item.pesquisas as PesquisaPendente)
                    .filter(p => p.pesquisa_perguntas && p.pesquisa_perguntas.length > 0);
                
                setPesquisasPendentes(pesquisasFormatadas);
                setStep('list');
            } catch(err: any) {
                console.error('Erro ao buscar pesquisas:', err);
                toast({ 
                    title: "Erro ao buscar pesquisas", 
                    description: err.message || "Não foi possível carregar os dados.", 
                    variant: "destructive"
                });
                setStep('error');
            } finally {
                setLoading(false);
            }
        };

        fetchPesquisasPendentes();
    }, [user, loadingUser, navigate]);
    
    // O resto do componente não precisa de alterações
    const handleSelectPesquisa = (pesquisa: PesquisaPendente) => {
        setPesquisaAtiva(pesquisa);
        setRespostas({});
        setStep('form');
    };

    const handleAnswerChange = (perguntaId: string, valor: string) => {
        setRespostas(prev => ({ ...prev, [perguntaId]: valor }));
    };

    const handleAnswerSubmit = async () => {
        if (!pesquisaAtiva || !user || !user.aluno_id) return;
        
        const totalPerguntas = pesquisaAtiva.pesquisa_perguntas.length;
        const respostasRespondidas = Object.keys(respostas).length;
        
        if (respostasRespondidas !== totalPerguntas) {
            toast({ title: "Responda todas as perguntas", variant: "destructive" });
            return;
        }
        
        setLoading(true);
        try {
            const respostasParaInserir = Object.entries(respostas).map(([perguntaId, resposta]) => ({
                pesquisa_id: pesquisaAtiva.id,
                pergunta_id: perguntaId,
                aluno_id: user.aluno_id,
                resposta,
            }));
            
            const { error: respostasError } = await supabase.from('pesquisa_respostas').insert(respostasParaInserir);
            if (respostasError) throw respostasError;
            
            const { error: updateError } = await supabase
                .from('pesquisa_destinatarios')
                .update({ status_resposta: 'concluida' })
                .eq('aluno_id', user.aluno_id)
                .eq('pesquisa_id', pesquisaAtiva.id);
            if (updateError) throw updateError;

            toast({ title: "Resposta enviada com sucesso!" });
            
            setPesquisasPendentes(prev => prev.filter(p => p.id !== pesquisaAtiva.id));
            setStep('list');
            setPesquisaAtiva(null);
            setRespostas({});
        } catch(err) {
            toast({ title: "Erro ao enviar respostas", variant: "destructive" });
        } finally {
            setLoading(false);
        }
    };

    const formatDate = (dateString: string) => {
        return new Date(dateString).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
    };

    const renderStep = () => {
        switch (step) {
            case 'loading':
                return (
                    <div className="flex justify-center items-center h-[80vh]">
                        <Loader2 className="h-10 w-10 animate-spin text-primary" />
                    </div>
                );

            case 'list':
                // ... (código para listar pesquisas)
                return (
                    <div className="max-w-2xl mx-auto">
                        <div className="text-center mb-8">
                            <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
                                <User className="h-8 w-8 text-primary" />
                            </div>
                            <h2 className="text-2xl font-bold text-gray-900 mb-2">Olá, {user?.username}!</h2>
                            <p className="text-gray-600">Aqui estão suas pesquisas pendentes.</p>
                        </div>

                        {loading ? (
                             <div className="flex justify-center items-center py-12"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
                        ) : pesquisasPendentes.length > 0 ? (
                            <div className="space-y-4">
                                {pesquisasPendentes.map((pesquisa) => (
                                    <Card key={pesquisa.id} className="hover:shadow-md transition-shadow cursor-pointer" onClick={() => handleSelectPesquisa(pesquisa)}>
                                        <CardHeader className="pb-3">
                                            <div className="flex items-start justify-between">
                                                <div className="flex-1">
                                                    <CardTitle className="text-lg font-semibold text-gray-900 mb-2">{pesquisa.titulo}</CardTitle>
                                                    {pesquisa.descricao && (<CardDescription className="text-gray-600 mb-3">{pesquisa.descricao}</CardDescription>)}
                                                    <div className="flex items-center gap-4 text-sm text-gray-500">
                                                        <div className="flex items-center gap-1"><FileText className="h-4 w-4" /><span>{pesquisa.pesquisa_perguntas.length} pergunta{pesquisa.pesquisa_perguntas.length !== 1 ? 's' : ''}</span></div>
                                                        <div className="flex items-center gap-1"><Calendar className="h-4 w-4" /><span>{formatDate(pesquisa.created_at)}</span></div>
                                                    </div>
                                                </div>
                                                <Badge variant="secondary" className="bg-yellow-100 text-yellow-800">Pendente</Badge>
                                            </div>
                                        </CardHeader>
                                        <CardContent className="pt-0">
                                            <Button className="w-full bg-primary hover:bg-primary/90">
                                                <FileText className="mr-2 h-4 w-4" />
                                                Responder Pesquisa
                                            </Button>
                                        </CardContent>
                                    </Card>
                                ))}
                            </div>
                        ) : (
                            <Card className="text-center py-12">
                                <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                                    <CheckCircle className="h-8 w-8 text-gray-400" />
                                </div>
                                <h3 className="text-lg font-semibold text-gray-900 mb-2">Nenhuma pesquisa pendente</h3>
                                <p className="text-gray-600 mb-6">Você respondeu todas as suas pesquisas.</p>
                                <Button variant="outline" onClick={() => navigate('/portal-aluno')}>
                                    <ArrowLeft className="mr-2 h-4 w-4" />
                                    Voltar ao Portal
                                </Button>
                            </Card>
                        )}
                    </div>
                );
            case 'form':
                // ... (código para exibir o formulário)
                return (
                    <div className="max-w-2xl mx-auto">
                        <div className="mb-6">
                            <Button variant="ghost" onClick={() => setStep('list')} className="mb-4">
                                <ArrowLeft className="mr-2 h-4 w-4" />
                                Voltar às Pesquisas
                            </Button>
                            <Card className="mb-6">
                                <CardHeader>
                                    <CardTitle className="text-xl font-semibold text-gray-900">{pesquisaAtiva?.titulo}</CardTitle>
                                    {pesquisaAtiva?.descricao && (<CardDescription className="text-gray-600">{pesquisaAtiva.descricao}</CardDescription>)}
                                </CardHeader>
                            </Card>
                        </div>
                        <div className="space-y-6">
                            {pesquisaAtiva?.pesquisa_perguntas.map((pergunta, index) => (
                                <Card key={pergunta.id} className="p-6">
                                    <div className="mb-4">
                                        <div className="flex items-center gap-2 mb-2">
                                            <div className="w-6 h-6 bg-primary/10 rounded-full flex items-center justify-center text-xs font-bold text-primary">{index + 1}</div>
                                            <Label className="text-base font-medium text-gray-900">{pergunta.texto_pergunta}</Label>
                                        </div>
                                    </div>
                                    <RadioGroup onValueChange={(value) => handleAnswerChange(pergunta.id, value)} className="space-y-3">
                                        {pergunta.opcoes.map((opcao, opcaoIndex) => (
                                            <div key={opcaoIndex} className="flex items-center space-x-3 p-3 rounded-lg border hover:bg-gray-50 transition-colors">
                                                <RadioGroupItem value={opcao} id={`${pergunta.id}-${opcaoIndex}`} className="text-primary" />
                                                <Label htmlFor={`${pergunta.id}-${opcaoIndex}`} className="text-sm font-medium text-gray-700 cursor-pointer flex-1">{opcao}</Label>
                                            </div>
                                        ))}
                                    </RadioGroup>
                                </Card>
                            ))}
                            <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                                <div className="text-sm text-gray-600">
                                    <span className="font-medium">{Object.keys(respostas).length}</span> de {pesquisaAtiva?.pesquisa_perguntas.length} perguntas respondidas
                                </div>
                                <Button onClick={handleAnswerSubmit} disabled={loading || Object.keys(respostas).length !== pesquisaAtiva?.pesquisa_perguntas.length} className="bg-primary hover:bg-primary/90">
                                    {loading ? (<><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Enviando...</>) : (<><Send className="mr-2 h-4 w-4" /> Enviar Respostas</>)}
                                </Button>
                            </div>
                        </div>
                    </div>
                );
            case 'error':
                 return (
                    <Card className="max-w-2xl mx-auto text-center py-12">
                        <CardHeader>
                            <CardTitle>Ocorreu um Erro</CardTitle>
                            <CardDescription>Não foi possível carregar suas pesquisas.</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <p className="text-muted-foreground mb-6">Isso pode acontecer por um problema de permissão ou conexão. Por favor, tente novamente mais tarde.</p>
                            <Button variant="outline" onClick={() => navigate('/portal-aluno')}>
                                <ArrowLeft className="mr-2 h-4 w-4" />
                                Voltar ao Portal
                            </Button>
                        </CardContent>
                    </Card>
                );
            
            default:
                return null;
        }
    };

    return (
        <div className="min-h-screen bg-gray-50 py-8">
            <div className="container mx-auto px-4">
                {renderStep()}
            </div>
        </div>
    );
};

export default PesquisaPublicaPage;