// src/pages/PesquisaCreatePage.tsx

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { createClient } from '@supabase/supabase-js';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PlusCircle, Trash2, ArrowLeft, Loader2, FileText, Users, Settings } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';

// Tipos
interface Pergunta {
  texto_pergunta: string;
  opcoes: string[];
}
interface Turma { id: string; nome: string; }
interface Aluno { id: string; nome: string; }

// Cliente Supabase genérico
const supabaseGeneric = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
);

const PesquisaCreatePage: React.FC = () => {
  const [titulo, setTitulo] = useState('');
  const [descricao, setDescricao] = useState('');
  const [perguntas, setPerguntas] = useState<Pergunta[]>([{ texto_pergunta: '', opcoes: ['', ''] }]);
  const [turmas, setTurmas] = useState<Turma[]>([]);
  const [turmaIdSelecionada, setTurmaIdSelecionada] = useState<string>('');
  const [alunosDaTurma, setAlunosDaTurma] = useState<Aluno[]>([]);
  const [alunosSelecionados, setAlunosSelecionados] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [isLoadingData, setIsLoadingData] = useState(true);
  const { user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    const fetchTurmas = async () => {
      if (!user) return;
      setIsLoadingData(true);
      try {
        const { data } = await supabaseGeneric.from('turmas').select('id, nome').eq('user_id', user.id);
        setTurmas(data || []);
      } catch (error) {
        toast({ title: 'Erro ao carregar turmas', variant: 'destructive' });
      } finally {
        setIsLoadingData(false);
      }
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
      try {
        const { data } = await supabaseGeneric.from('alunos').select('id, nome').eq('turma_id', turmaIdSelecionada).order('nome');
        setAlunosDaTurma(data || []);
      } catch (error) {
        toast({ title: 'Erro ao carregar alunos', variant: 'destructive' });
      }
    };
    fetchAlunos();
  }, [turmaIdSelecionada]);

  const handleAddPergunta = () => {
    setPerguntas([...perguntas, { texto_pergunta: '', opcoes: ['', ''] }]);
  };

  const handleRemovePergunta = (index: number) => {
    if (perguntas.length > 1) {
      setPerguntas(perguntas.filter((_, i) => i !== index));
    } else {
      toast({ title: 'Erro', description: 'A pesquisa deve ter pelo menos uma pergunta.', variant: 'destructive' });
    }
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
    if (novasPerguntas[pIndex].opcoes.length > 2) {
      novasPerguntas[pIndex].opcoes.splice(oIndex, 1);
      setPerguntas(novasPerguntas);
    } else {
      toast({ title: 'Erro', description: 'Cada pergunta deve ter pelo menos 2 opções.', variant: 'destructive' });
    }
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
      // Criar a pesquisa
      const { data: pData, error: pError } = await supabaseGeneric
        .from('pesquisas')
        .insert({ 
          user_id: user!.id, 
          titulo, 
          descricao, 
          status: 'ativa' 
        })
        .select()
        .single();

      if (pError || !pData) {
        throw pError || new Error("Falha ao criar pesquisa.");
      }

      // Salvar as perguntas
      const perguntasParaSalvar = perguntas.map((p, i) => ({ 
        pesquisa_id: pData.id, 
        texto_pergunta: p.texto_pergunta, 
        tipo_pergunta: 'multipla_escolha', 
        opcoes: p.opcoes, 
        ordem: i 
      }));
      
      const { error: perguntasError } = await supabaseGeneric
        .from('pesquisa_perguntas')
        .insert(perguntasParaSalvar);
      
      if (perguntasError) throw perguntasError;

      // Salvar os destinatários
      const destinatarios = Array.from(alunosSelecionados).map(alunoId => ({ 
        pesquisa_id: pData.id, 
        aluno_id: alunoId,
        status_resposta: 'pendente'
      }));
      
      const { error: destinatariosError } = await supabaseGeneric
        .from('pesquisa_destinatarios')
        .insert(destinatarios);
      
      if (destinatariosError) throw destinatariosError;

      toast({ title: "Pesquisa publicada com sucesso!" });
      navigate('/pesquisas');
    } catch (error) {
      console.error('Erro ao salvar pesquisa:', error);
      toast({ 
        title: "Erro ao salvar pesquisa", 
        description: (error as Error).message, 
        variant: "destructive" 
      });
    } finally {
      setLoading(false);
    }
  };

  if (isLoadingData) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-purple-600" />
          <p className="text-gray-600">Carregando dados...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto p-4 max-w-6xl">
        {/* Header */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Nova Pesquisa</h1>
              <p className="text-gray-600 mt-1">Crie uma nova pesquisa para coletar dados dos alunos</p>
            </div>
            <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
              <Button variant="outline" onClick={() => navigate('/pesquisas')} className="w-full sm:w-auto">
                <ArrowLeft className="h-4 w-4 mr-2" /> Voltar
              </Button>
            </div>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          {/* Formulário Principal */}
          <div className="lg:col-span-2 space-y-6">
            {/* Informações Básicas */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  Informações da Pesquisa
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="titulo">Título da Pesquisa *</Label>
                  <Input 
                    id="titulo" 
                    value={titulo} 
                    onChange={e => setTitulo(e.target.value)}
                    placeholder="Ex: Avaliação do curso de Matemática"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="descricao">Descrição (Opcional)</Label>
                  <Textarea 
                    id="descricao" 
                    value={descricao} 
                    onChange={e => setDescricao(e.target.value)}
                    placeholder="Descreva o objetivo da pesquisa..."
                    rows={3}
                  />
                </div>
              </CardContent>
            </Card>

            {/* Perguntas */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Settings className="h-5 w-5" />
                  Perguntas da Pesquisa
                  <Badge variant="secondary">{perguntas.length}</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {perguntas.map((pergunta, pIndex) => (
                  <Card key={pIndex} className="p-4 bg-gray-50/50 border-2">
                    <div className="flex justify-between items-center mb-4">
                      <Label className="font-semibold text-gray-700">Pergunta {pIndex + 1}</Label>
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        onClick={() => handleRemovePergunta(pIndex)}
                        className="text-red-500 hover:text-red-700 hover:bg-red-50"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                    <Textarea 
                      placeholder="Digite sua pergunta aqui..." 
                      value={pergunta.texto_pergunta} 
                      onChange={e => handlePerguntaChange(pIndex, e.target.value)}
                      className="mb-4"
                    />
                    <div className="space-y-3">
                      <Label className="text-sm font-medium">Opções de Resposta</Label>
                      {pergunta.opcoes.map((opcao, oIndex) => (
                        <div key={oIndex} className="flex items-center gap-2">
                          <div className="w-4 h-4 rounded-full bg-purple-200 flex items-center justify-center text-xs font-bold text-purple-700">
                            {String.fromCharCode(65 + oIndex)}
                          </div>
                          <Input 
                            placeholder={`Opção ${oIndex + 1}`} 
                            value={opcao} 
                            onChange={e => handleOpcaoChange(pIndex, oIndex, e.target.value)}
                            className="flex-1"
                          />
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            onClick={() => handleRemoveOpcao(pIndex, oIndex)}
                            className="text-red-500 hover:text-red-700"
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      ))}
                      <Button 
                        variant="outline" 
                        size="sm" 
                        onClick={() => handleAddOpcao(pIndex)}
                        className="w-full"
                      >
                        <PlusCircle className="h-4 w-4 mr-2" />
                        Adicionar Opção
                      </Button>
                    </div>
                  </Card>
                ))}
                <Button 
                  variant="outline" 
                  onClick={handleAddPergunta}
                  className="w-full"
                >
                  <PlusCircle className="h-4 w-4 mr-2" />
                  Adicionar Pergunta
                </Button>
              </CardContent>
            </Card>
          </div>

          {/* Sidebar - Destinatários */}
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5" />
                  Destinatários
                  <Badge variant="secondary">{alunosSelecionados.size}</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="turma">Selecione a Turma</Label>
                  <Select value={turmaIdSelecionada} onValueChange={setTurmaIdSelecionada}>
                    <SelectTrigger className="mt-2">
                      <SelectValue placeholder="Escolha uma turma..." />
                    </SelectTrigger>
                    <SelectContent>
                      {turmas.map(turma => (
                        <SelectItem key={turma.id} value={turma.id}>
                          {turma.nome}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {alunosDaTurma.length > 0 && (
                  <div>
                    <Label>Selecione os Alunos</Label>
                    <div className="max-h-60 overflow-y-auto border rounded-md p-3 mt-2 space-y-2 bg-gray-50">
                      {alunosDaTurma.map(aluno => (
                        <div key={aluno.id} className="flex items-center space-x-2">
                          <Checkbox 
                            id={`aluno-${aluno.id}`} 
                            checked={alunosSelecionados.has(aluno.id)} 
                            onCheckedChange={() => handleAlunoToggle(aluno.id)} 
                          />
                          <Label 
                            htmlFor={`aluno-${aluno.id}`}
                            className="text-sm cursor-pointer hover:text-purple-600"
                          >
                            {aluno.nome}
                          </Label>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <Button 
                  onClick={handleSalvar} 
                  disabled={loading || !titulo || perguntas.length === 0 || alunosSelecionados.size === 0}
                  className="w-full"
                >
                  {loading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Publicando...
                    </>
                  ) : (
                    <>
                      <FileText className="mr-2 h-4 w-4" />
                      Publicar Pesquisa
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PesquisaCreatePage;