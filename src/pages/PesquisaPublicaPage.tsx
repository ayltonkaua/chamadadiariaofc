// src/pages/PesquisaPublicaPage.tsx

import React, { useState } from 'react';
import { createClient } from '@supabase/supabase-js';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { toast } from '@/hooks/use-toast';
import { Loader2, Send } from 'lucide-react';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';

interface Aluno { id: string; nome: string; }
interface PesquisaPendente {
    id: string;
    titulo: string;
    descricao: string | null;
    pesquisa_perguntas: { id: string; texto_pergunta: string; opcoes: string[] }[];
}

// Cliente Supabase genérico para contornar problemas de tipo
const supabaseGeneric = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
);

const PesquisaPublicaPage: React.FC = () => {
    const [step, setStep] = useState<'login' | 'list' | 'form'>('login');
    const [nome, setNome] = useState('');
    const [matricula, setMatricula] = useState('');
    const [aluno, setAluno] = useState<Aluno | null>(null);
    const [pesquisasPendentes, setPesquisasPendentes] = useState<PesquisaPendente[]>([]);
    const [pesquisaAtiva, setPesquisaAtiva] = useState<PesquisaPendente | null>(null);
    const [respostas, setRespostas] = useState<Record<string, string>>({});
    const [loading, setLoading] = useState(false);

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        try {
            const { data: alunoData, error: alunoError } = await supabaseGeneric
                .from('alunos')
                .select('id, nome')
                .eq('matricula', matricula)
                .ilike('nome', nome.trim())
                .single();
            
            if (alunoError || !alunoData) {
                toast({ title: "Aluno não encontrado", description: "Verifique o nome completo e a matrícula.", variant: "destructive" });
                return;
            }
            setAluno(alunoData);

            const { data: pendentesData, error: pendentesError } = await supabaseGeneric
                .from('pesquisa_destinatarios')
                .select(`pesquisas!inner(id, titulo, descricao, status, pesquisa_perguntas(id, texto_pergunta, opcoes))`)
                .eq('aluno_id', alunoData.id)
                .eq('status_resposta', 'pendente')
                .eq('pesquisas.status', 'ativa');

            if (pendentesError) throw pendentesError;
            const pesquisasFormatadas = (pendentesData as any[]).map(item => item.pesquisas as PesquisaPendente);
            setPesquisasPendentes(pesquisasFormatadas);
            setStep('list');
        } catch(err) {
            toast({ title: "Erro", description: (err as Error).message, variant: "destructive"});
        } finally {
            setLoading(false);
        }
    };
    
    const handleSelectPesquisa = (pesquisa: PesquisaPendente) => {
        setPesquisaAtiva(pesquisa);
        setStep('form');
    };

    const handleAnswerChange = (perguntaId: string, valor: string) => {
        setRespostas(prev => ({ ...prev, [perguntaId]: valor }));
    };

    const handleAnswerSubmit = async () => {
        if (Object.keys(respostas).length !== pesquisaAtiva?.pesquisa_perguntas.length) {
            toast({ title: "Responda todas as perguntas", variant: "destructive" });
            return;
        }
        setLoading(true);
        try {
            const respostasParaInserir = Object.entries(respostas).map(([perguntaId, resposta]) => ({
                pesquisa_id: pesquisaAtiva!.id,
                pergunta_id: perguntaId,
                aluno_id: aluno!.id,
                resposta,
            }));
            
            await supabaseGeneric.from('pesquisa_respostas').insert(respostasParaInserir);
            
            await supabaseGeneric
                .from('pesquisa_destinatarios')
                .update({ status_resposta: 'concluida' })
                .eq('aluno_id', aluno!.id)
                .eq('pesquisa_id', pesquisaAtiva!.id);

            toast({ title: "Obrigado por responder!", description: "Sua resposta foi enviada com sucesso." });
            setStep('login'); // ou voltar para a lista
            setPesquisaAtiva(null);
            setRespostas({});
        } catch(err) {
            toast({ title: "Erro ao enviar respostas", description: (err as Error).message, variant: "destructive"});
        } finally {
            setLoading(false);
        }
    };

    const renderStep = () => {
        switch (step) {
            case 'login':
                return (
                    <form onSubmit={handleLogin} className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="nome">Nome Completo</Label>
                            <Input id="nome" value={nome} onChange={(e) => setNome(e.target.value)} required />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="matricula">Matrícula</Label>
                            <Input id="matricula" value={matricula} onChange={(e) => setMatricula(e.target.value)} required />
                        </div>
                        <Button type="submit" disabled={loading} className="w-full">
                            {loading ? <Loader2 className="animate-spin" /> : 'Acessar'}
                        </Button>
                    </form>
                );
            case 'list':
                return (
                    <div>
                        <h2 className="text-lg font-semibold mb-4">Olá, {aluno?.nome}!</h2>
                        {pesquisasPendentes.length > 0 ? (
                            <div className="space-y-3">
                                <p>Você tem pesquisas pendentes:</p>
                                {pesquisasPendentes.map(p => (
                                    <Button key={p.id} onClick={() => handleSelectPesquisa(p)} className="w-full justify-start">{p.titulo}</Button>
                                ))}
                            </div>
                        ) : (
                            <p>Você não tem nenhuma pesquisa pendente no momento.</p>
                        )}
                    </div>
                );
            case 'form':
                return (
                    <div className="space-y-6">
                        {pesquisaAtiva?.pesquisa_perguntas.map((pergunta) => (
                            <div key={pergunta.id}>
                                <Label className="font-semibold">{pergunta.texto_pergunta}</Label>
                                <RadioGroup onValueChange={(value) => handleAnswerChange(pergunta.id, value)} className="mt-2 space-y-1">
                                    {pergunta.opcoes.map((opcao, i) => (
                                        <div key={i} className="flex items-center space-x-2">
                                            <RadioGroupItem value={opcao} id={`${pergunta.id}-${i}`} />
                                            <Label htmlFor={`${pergunta.id}-${i}`}>{opcao}</Label>
                                        </div>
                                    ))}
                                </RadioGroup>
                            </div>
                        ))}
                        <Button onClick={handleAnswerSubmit} disabled={loading} className="w-full">
                            {loading ? <Loader2 className="animate-spin"/> : <><Send className="mr-2 h-4 w-4"/> Enviar Respostas</>}
                        </Button>
                    </div>
                );
        }
    };

    return (
        <div className="flex items-center justify-center min-h-screen bg-gray-100">
            <Card className="w-full max-w-lg">
                <CardHeader>
                    <CardTitle>{pesquisaAtiva?.titulo || "Responder Pesquisas"}</CardTitle>
                    <CardDescription>{pesquisaAtiva?.descricao || "Identifique-se para ver suas pesquisas."}</CardDescription>
                </CardHeader>
                <CardContent>
                    {renderStep()}
                </CardContent>
            </Card>
        </div>
    );
};

export default PesquisaPublicaPage;