// src/pages/PesquisaPublicaPage.tsx

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { toast } from '@/hooks/use-toast';
import { Loader2, Send, User, FileText, CheckCircle, AlertCircle, ArrowLeft, Search, Users, Calendar } from 'lucide-react';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Badge } from '@/components/ui/badge';
import { useEscolasCadastradas } from '@/hooks/useEscolasCadastradas';
import { supabase } from '@/integrations/supabase/client';

interface Aluno { 
  id: string; 
  nome: string; 
  matricula: string;
}

interface PesquisaPendente {
    id: string;
    titulo: string;
    descricao: string | null;
    created_at: string;
    pesquisa_perguntas: { 
      id: string; 
      texto_pergunta: string; 
      opcoes: string[] 
    }[];
}

const PesquisaPublicaPage: React.FC = () => {
    const [step, setStep] = useState<'login' | 'list' | 'form'>('login');
    const [nome, setNome] = useState('');
    const [matricula, setMatricula] = useState('');
    const [aluno, setAluno] = useState<Aluno | null>(null);
    const [pesquisasPendentes, setPesquisasPendentes] = useState<PesquisaPendente[]>([]);
    const [pesquisaAtiva, setPesquisaAtiva] = useState<PesquisaPendente | null>(null);
    const [respostas, setRespostas] = useState<Record<string, string>>({});
    const [loading, setLoading] = useState(false);
    const [searchLoading, setSearchLoading] = useState(false);
    const { escolas, loading: escolasLoading } = useEscolasCadastradas();
    const [escolaSelecionada, setEscolaSelecionada] = useState<string>("");

    React.useEffect(() => {
        if (escolas.length > 0 && !escolaSelecionada) {
            setEscolaSelecionada(escolas[0].id);
        }
    }, [escolas]);

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!escolaSelecionada) {
            toast({ title: "Selecione uma escola", variant: "destructive" });
            return;
        }
        setSearchLoading(true);
        try {
            const { data: alunoData, error: alunoError } = await supabase
                .from('alunos')
                .select('id, nome, matricula, escola_id')
                .eq('matricula', matricula.trim())
                .ilike('nome', nome.trim())
                .eq('escola_id', escolaSelecionada)
                .single();
            
            if (alunoError || !alunoData) {
                toast({ 
                    title: "Aluno não encontrado", 
                    description: "Verifique o nome completo e a matrícula.", 
                    variant: "destructive" 
                });
                return;
            }
            setAluno(alunoData);

            // Buscar pesquisas pendentes do aluno
            const { data: pendentesData, error: pendentesError } = await supabase
                .from('pesquisa_destinatarios')
                .select(`
                    status_resposta,
                    pesquisas!inner(
                        id, 
                        titulo, 
                        descricao, 
                        status, 
                        created_at,
                        pesquisa_perguntas(
                            id, 
                            texto_pergunta, 
                            opcoes
                        )
                    )
                `)
                .eq('aluno_id', alunoData.id)
                .eq('status_resposta', 'pendente')
                .eq('pesquisas.status', 'ativa');

            if (pendentesError) throw pendentesError;
            
            const pesquisasFormatadas = (pendentesData as any[])
                .map(item => item.pesquisas as PesquisaPendente)
                .filter(p => p.pesquisa_perguntas && p.pesquisa_perguntas.length > 0);
            
            setPesquisasPendentes(pesquisasFormatadas);
            setStep('list');
        } catch(err) {
            console.error('Erro ao buscar aluno:', err);
            toast({ 
                title: "Erro", 
                description: "Ocorreu um erro ao buscar suas pesquisas. Tente novamente.", 
                variant: "destructive"
            });
        } finally {
            setSearchLoading(false);
        }
    };
    
    const handleSelectPesquisa = (pesquisa: PesquisaPendente) => {
        setPesquisaAtiva(pesquisa);
        setRespostas({});
        setStep('form');
    };

    const handleAnswerChange = (perguntaId: string, valor: string) => {
        setRespostas(prev => ({ ...prev, [perguntaId]: valor }));
    };

    const handleAnswerSubmit = async () => {
        if (!pesquisaAtiva) return;
        
        const totalPerguntas = pesquisaAtiva.pesquisa_perguntas.length;
        const respostasRespondidas = Object.keys(respostas).length;
        
        if (respostasRespondidas !== totalPerguntas) {
            toast({ 
                title: "Responda todas as perguntas", 
                description: `Você respondeu ${respostasRespondidas} de ${totalPerguntas} perguntas.`,
                variant: "destructive" 
            });
            return;
        }
        
        setLoading(true);
        try {
            // Salvar as respostas
            const respostasParaInserir = Object.entries(respostas).map(([perguntaId, resposta]) => ({
                pesquisa_id: pesquisaAtiva.id,
                pergunta_id: perguntaId,
                aluno_id: aluno!.id,
                resposta,
            }));
            
            const { error: respostasError } = await supabase
                .from('pesquisa_respostas')
                .insert(respostasParaInserir);
            
            if (respostasError) throw respostasError;
            
            // Atualizar status do destinatário
            const { error: updateError } = await supabase
                .from('pesquisa_destinatarios')
                .update({ status_resposta: 'concluida' })
                .eq('aluno_id', aluno!.id)
                .eq('pesquisa_id', pesquisaAtiva.id);

            if (updateError) throw updateError;

            toast({ 
                title: "Resposta enviada com sucesso!", 
                description: "Obrigado por participar da pesquisa." 
            });
            
            // Voltar para a lista e remover a pesquisa respondida
            setPesquisasPendentes(prev => prev.filter(p => p.id !== pesquisaAtiva.id));
            setStep('list');
            setPesquisaAtiva(null);
            setRespostas({});
        } catch(err) {
            console.error('Erro ao enviar respostas:', err);
            toast({ 
                title: "Erro ao enviar respostas", 
                description: "Tente novamente. Se o problema persistir, entre em contato com o suporte.", 
                variant: "destructive"
            });
        } finally {
            setLoading(false);
        }
    };

    const formatDate = (dateString: string) => {
        return new Date(dateString).toLocaleDateString('pt-BR', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric'
        });
    };

    const renderStep = () => {
        switch (step) {
            case 'login':
                return (
                    <div className="max-w-md mx-auto">
                        <div className="text-center mb-8">
                            <div className="w-16 h-16 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-4">
                                <Search className="h-8 w-8 text-purple-600" />
                            </div>
                            <h2 className="text-2xl font-bold text-gray-900 mb-2">Consultar Pesquisas</h2>
                            <p className="text-gray-600">Identifique-se para ver suas pesquisas pendentes</p>
                        </div>
                        <form onSubmit={handleLogin} className="space-y-6">
                            <div className="space-y-2">
                                <Label htmlFor="escola-select" className="text-sm font-medium">Escola</Label>
                                <select
                                    id="escola-select"
                                    className="border rounded px-2 py-2 w-full"
                                    value={escolaSelecionada}
                                    onChange={e => setEscolaSelecionada(e.target.value)}
                                    disabled={escolasLoading}
                                    required
                                >
                                    {escolas.map(escola => (
                                        <option key={escola.id} value={escola.id}>{escola.nome}</option>
                                    ))}
                                </select>
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="nome" className="text-sm font-medium">Nome Completo</Label>
                                <Input 
                                    id="nome" 
                                    value={nome} 
                                    onChange={(e) => setNome(e.target.value)} 
                                    placeholder="Digite seu nome completo"
                                    required 
                                    className="h-12"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="matricula" className="text-sm font-medium">Matrícula</Label>
                                <Input 
                                    id="matricula" 
                                    value={matricula} 
                                    onChange={(e) => setMatricula(e.target.value)} 
                                    placeholder="Digite sua matrícula"
                                    required 
                                    className="h-12"
                                />
                            </div>
                            <Button 
                                type="submit" 
                                disabled={searchLoading || !escolaSelecionada} 
                                className="w-full h-12 bg-purple-600 hover:bg-purple-700"
                            >
                                {searchLoading ? (
                                    <>
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                        Buscando...
                                    </>
                                ) : (
                                    <>
                                        <Search className="mr-2 h-4 w-4" />
                                        Buscar Pesquisas
                                    </>
                                )}
                            </Button>
                        </form>
                    </div>
                );
                
            case 'list':
                return (
                    <div className="max-w-2xl mx-auto">
                        <div className="text-center mb-8">
                            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                                <User className="h-8 w-8 text-green-600" />
                            </div>
                            <h2 className="text-2xl font-bold text-gray-900 mb-2">Olá, {aluno?.nome}!</h2>
                            <p className="text-gray-600">Aqui estão suas pesquisas pendentes</p>
                        </div>

                        {pesquisasPendentes.length > 0 ? (
                            <div className="space-y-4">
                                {pesquisasPendentes.map((pesquisa) => (
                                    <Card key={pesquisa.id} className="hover:shadow-md transition-shadow cursor-pointer" onClick={() => handleSelectPesquisa(pesquisa)}>
                                        <CardHeader className="pb-3">
                                            <div className="flex items-start justify-between">
                                                <div className="flex-1">
                                                    <CardTitle className="text-lg font-semibold text-gray-900 mb-2">
                                                        {pesquisa.titulo}
                                                    </CardTitle>
                                                    {pesquisa.descricao && (
                                                        <CardDescription className="text-gray-600 mb-3">
                                                            {pesquisa.descricao}
                                                        </CardDescription>
                                                    )}
                                                    <div className="flex items-center gap-4 text-sm text-gray-500">
                                                        <div className="flex items-center gap-1">
                                                            <FileText className="h-4 w-4" />
                                                            <span>{pesquisa.pesquisa_perguntas.length} pergunta{pesquisa.pesquisa_perguntas.length !== 1 ? 's' : ''}</span>
                                                        </div>
                                                        <div className="flex items-center gap-1">
                                                            <Calendar className="h-4 w-4" />
                                                            <span>{formatDate(pesquisa.created_at)}</span>
                                                        </div>
                                                    </div>
                                                </div>
                                                <Badge variant="secondary" className="bg-yellow-100 text-yellow-800">
                                                    Pendente
                                                </Badge>
                                            </div>
                                        </CardHeader>
                                        <CardContent className="pt-0">
                                            <Button className="w-full bg-purple-600 hover:bg-purple-700">
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
                                <p className="text-gray-600 mb-6">Você respondeu todas as suas pesquisas ou não há pesquisas disponíveis no momento.</p>
                                <Button 
                                    variant="outline" 
                                    onClick={() => {
                                        setStep('login');
                                        setAluno(null);
                                        setNome('');
                                        setMatricula('');
                                    }}
                                >
                                    <ArrowLeft className="mr-2 h-4 w-4" />
                                    Consultar Outro Aluno
                                </Button>
                            </Card>
                        )}
                    </div>
                );
                
            case 'form':
                return (
                    <div className="max-w-2xl mx-auto">
                        <div className="mb-6">
                            <Button 
                                variant="ghost" 
                                onClick={() => setStep('list')}
                                className="mb-4"
                            >
                                <ArrowLeft className="mr-2 h-4 w-4" />
                                Voltar às Pesquisas
                            </Button>
                            
                            <Card className="mb-6">
                                <CardHeader>
                                    <CardTitle className="text-xl font-semibold text-gray-900">
                                        {pesquisaAtiva?.titulo}
                                    </CardTitle>
                                    {pesquisaAtiva?.descricao && (
                                        <CardDescription className="text-gray-600">
                                            {pesquisaAtiva.descricao}
                                        </CardDescription>
                                    )}
                                </CardHeader>
                            </Card>
                        </div>

                        <div className="space-y-6">
                            {pesquisaAtiva?.pesquisa_perguntas.map((pergunta, index) => (
                                <Card key={pergunta.id} className="p-6">
                                    <div className="mb-4">
                                        <div className="flex items-center gap-2 mb-2">
                                            <div className="w-6 h-6 bg-purple-100 rounded-full flex items-center justify-center text-xs font-bold text-purple-700">
                                                {index + 1}
                                            </div>
                                            <Label className="text-base font-medium text-gray-900">
                                                {pergunta.texto_pergunta}
                                            </Label>
                                        </div>
                                    </div>
                                    
                                    <RadioGroup 
                                        onValueChange={(value) => handleAnswerChange(pergunta.id, value)}
                                        className="space-y-3"
                                    >
                                        {pergunta.opcoes.map((opcao, opcaoIndex) => (
                                            <div key={opcaoIndex} className="flex items-center space-x-3 p-3 rounded-lg border hover:bg-gray-50 transition-colors">
                                                <RadioGroupItem 
                                                    value={opcao} 
                                                    id={`${pergunta.id}-${opcaoIndex}`}
                                                    className="text-purple-600"
                                                />
                                                <Label 
                                                    htmlFor={`${pergunta.id}-${opcaoIndex}`}
                                                    className="text-sm font-medium text-gray-700 cursor-pointer flex-1"
                                                >
                                                    {opcao}
                                                </Label>
                                            </div>
                                        ))}
                                    </RadioGroup>
                                </Card>
                            ))}
                            
                            <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                                <div className="text-sm text-gray-600">
                                    <span className="font-medium">
                                        {Object.keys(respostas).length}
                                    </span> de {pesquisaAtiva?.pesquisa_perguntas.length} perguntas respondidas
                                </div>
                                <Button 
                                    onClick={handleAnswerSubmit} 
                                    disabled={loading || Object.keys(respostas).length !== pesquisaAtiva?.pesquisa_perguntas.length}
                                    className="bg-purple-600 hover:bg-purple-700"
                                >
                                    {loading ? (
                                        <>
                                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                            Enviando...
                                        </>
                                    ) : (
                                        <>
                                            <Send className="mr-2 h-4 w-4" />
                                            Enviar Respostas
                                        </>
                                    )}
                                </Button>
                            </div>
                        </div>
                    </div>
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
