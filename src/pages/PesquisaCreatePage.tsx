// src/pages/PesquisaCreatePage.tsx

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PlusCircle, Trash2, ArrowLeft, Loader2 } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';

// Tipos
interface Pergunta {
  texto_pergunta: string;
  opcoes: string[];
}
interface Turma { id: string; nome: string; }
interface Aluno { id: string; nome: string; }

const PesquisaCreatePage: React.FC = () => {
  const [titulo, setTitulo] = useState('');
  const [descricao, setDescricao] = useState('');
  const [perguntas, setPerguntas] = useState<Pergunta[]>([{ texto_pergunta: '', opcoes: ['', ''] }]);
  const [turmas, setTurmas] = useState<Turma[]>([]);
  const [turmaIdSelecionada, setTurmaIdSelecionada] = useState<string>('');
  const [alunosDaTurma, setAlunosDaTurma] = useState<Aluno[]>([]);
  const [alunosSelecionados, setAlunosSelecionados] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const { user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    const fetchTurmas = async () => {
      if (!user) return;
      const { data } = await supabase.from('turmas').select('id, nome').eq('user_id', user.id);
      setTurmas(data || []);
    };
    fetchTurmas();
  }, [user]);

  useEffect(() => {
    const fetchAlunos = async () => {
      if (!turmaIdSelecionada) {
        setAlunosDaTurma([]);
        setAlunosSelecionados(new Set());
        return;
      }
      const { data } = await supabase.from('alunos').select('id, nome').eq('turma_id', turmaIdSelecionada).order('nome');
      setAlunosDaTurma(data || []);
    };
    fetchAlunos();
  }, [turmaIdSelecionada]);

  const handleAddPergunta = () => {
    setPerguntas([...perguntas, { texto_pergunta: '', opcoes: ['', ''] }]);
  };

  const handleRemovePergunta = (index: number) => {
    setPerguntas(perguntas.filter((_, i) => i !== index));
  };

  const handlePerguntaChange = (index: number, value: string) => {
    const novasPerguntas = [...perguntas];
    novasPerguntas[index].texto_pergunta = value;
    setPerguntas(novasPerguntas);
  };

  const handleOpcaoChange = (pIndex: number, oIndex: number, value: string) => {
    const novasPerguntas = [...perguntas];
    novasPerguntas[pIndex].opcoes[oIndex] = value;
    setPerguntas(novasPerguntas);
  };

  const handleAddOpcao = (pIndex: number) => {
    const novasPerguntas = [...perguntas];
    novasPerguntas[pIndex].opcoes.push('');
    setPerguntas(novasPerguntas);
  };
  
  const handleRemoveOpcao = (pIndex: number, oIndex: number) => {
    const novasPerguntas = [...perguntas];
    novasPerguntas[pIndex].opcoes.splice(oIndex, 1);
    setPerguntas(novasPerguntas);
  };
  
  const handleAlunoToggle = (alunoId: string) => {
      const novosSelecionados = new Set(alunosSelecionados);
      if (novosSelecionados.has(alunoId)) {
          novosSelecionados.delete(alunoId);
      } else {
          novosSelecionados.add(alunoId);
      }
      setAlunosSelecionados(novosSelecionados);
  };

  const handleSalvar = async () => {
    setLoading(true);
    if (!titulo || perguntas.length === 0 || alunosSelecionados.size === 0) {
      toast({ title: "Erro de Validação", description: "Título, ao menos uma pergunta, e ao menos um aluno devem ser selecionados.", variant: "destructive" });
      setLoading(false);
      return;
    }

    try {
      const { data: userRole } = await supabase.from('user_roles').select('escola_id').eq('user_id', user!.id).single();
      if (!userRole?.escola_id) throw new Error("Usuário não associado a uma escola.");

      const { data: pData, error: pError } = await supabase.from('pesquisas').insert({ user_id: user!.id, escola_id: userRole.escola_id, titulo, descricao, status: 'ativa' }).select().single();
      if (pError || !pData) throw pError || new Error("Falha ao criar pesquisa.");

      const perguntasParaSalvar = perguntas.map((p, i) => ({ pesquisa_id: pData.id, texto_pergunta: p.texto_pergunta, tipo_pergunta: 'multipla_escolha', opcoes: p.opcoes, ordem: i }));
      await supabase.from('pesquisa_perguntas').insert(perguntasParaSalvar);
      
      const destinatarios = Array.from(alunosSelecionados).map(alunoId => ({ pesquisa_id: pData.id, aluno_id: alunoId }));
      await supabase.from('pesquisa_destinatarios').insert(destinatarios);

      toast({ title: "Pesquisa publicada com sucesso!" });
      navigate('/pesquisas');
    } catch (error) {
      toast({ title: "Erro ao salvar pesquisa", description: (error as Error).message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container mx-auto p-4 max-w-4xl">
      <Card>
        <CardHeader>
            <div className="flex items-center justify-between">
                <CardTitle className="text-2xl">Nova Pesquisa</CardTitle>
                <Button variant="ghost" onClick={() => navigate('/pesquisas')}><ArrowLeft className="h-4 w-4 mr-2" /> Voltar</Button>
            </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="titulo">Título da Pesquisa</Label>
            <Input id="titulo" value={titulo} onChange={e => setTitulo(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="descricao">Descrição (Opcional)</Label>
            <Textarea id="descricao" value={descricao} onChange={e => setDescricao(e.target.value)} />
          </div>

          <div>
            <Label>Perguntas (Apenas Múltipla Escolha)</Label>
            <div className="space-y-4 mt-2">
              {perguntas.map((pergunta, pIndex) => (
                <Card key={pIndex} className="p-4 bg-gray-50/50">
                  <div className="flex justify-between items-center mb-2">
                    <Label>Pergunta {pIndex + 1}</Label>
                    <Button variant="ghost" size="icon" onClick={() => handleRemovePergunta(pIndex)}><Trash2 className="h-4 w-4 text-red-500" /></Button>
                  </div>
                  <Textarea placeholder="Ex: Qual sua matéria favorita?" value={pergunta.texto_pergunta} onChange={e => handlePerguntaChange(pIndex, e.target.value)} />
                  <div className="mt-4 space-y-2">
                    <Label>Opções de Resposta</Label>
                    {pergunta.opcoes.map((opcao, oIndex) => (
                      <div key={oIndex} className="flex items-center gap-2">
                        <Input placeholder={`Opção ${oIndex + 1}`} value={opcao} onChange={e => handleOpcaoChange(pIndex, oIndex, e.target.value)} />
                        <Button variant="ghost" size="icon" onClick={() => handleRemoveOpcao(pIndex, oIndex)}><Trash2 className="h-3 w-3" /></Button>
                      </div>
                    ))}
                    <Button variant="outline" size="sm" onClick={() => handleAddOpcao(pIndex)}>Adicionar Opção</Button>
                  </div>
                </Card>
              ))}
              <Button variant="outline" onClick={handleAddPergunta}><PlusCircle className="h-4 w-4 mr-2" />Adicionar Pergunta</Button>
            </div>
          </div>
          
          <div>
            <Label>Selecione os Destinatários</Label>
            <div className="grid md:grid-cols-2 gap-4 mt-2">
                <div>
                    <Label htmlFor="turma">1. Selecione a Turma</Label>
                    <Select value={turmaIdSelecionada} onValueChange={setTurmaIdSelecionada}>
                        <SelectTrigger><SelectValue placeholder="Escolha uma turma..." /></SelectTrigger>
                        <SelectContent>
                            {turmas.map(turma => <SelectItem key={turma.id} value={turma.id}>{turma.nome}</SelectItem>)}
                        </SelectContent>
                    </Select>
                </div>
                {alunosDaTurma.length > 0 && (
                    <div className="max-h-60 overflow-y-auto border p-2 rounded-md">
                        <Label>2. Selecione os Alunos</Label>
                        <div className="space-y-2 mt-2">
                            {alunosDaTurma.map(aluno => (
                                <div key={aluno.id} className="flex items-center space-x-2">
                                    <Checkbox id={`aluno-${aluno.id}`} checked={alunosSelecionados.has(aluno.id)} onCheckedChange={() => handleAlunoToggle(aluno.id)} />
                                    <Label htmlFor={`aluno-${aluno.id}`}>{aluno.nome}</Label>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>
          </div>

          <Button onClick={handleSalvar} disabled={loading} className="w-full text-lg py-6">
              {loading ? <><Loader2 className="mr-2 h-5 w-5 animate-spin" /> Salvando...</> : 'Publicar Pesquisa'}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};

export default PesquisaCreatePage;