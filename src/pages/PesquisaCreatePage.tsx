// src/pages/PesquisaCreatePage.tsx

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from '@/hooks/use-toast';
import { Plus, Trash2, Save, Loader2, ArrowLeft } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useEscolaConfig } from '@/contexts/EscolaConfigContext';
import { useEscolasCadastradas } from '@/hooks/useEscolasCadastradas';

interface Pergunta {
  id: string;
  texto: string;
  opcoes: string[];
}

const PesquisaCreatePage: React.FC = () => {
  const { user } = useAuth();
  const { config: escolaConfig } = useEscolaConfig();
  const { escolas } = useEscolasCadastradas();
  const [escolaSelecionada, setEscolaSelecionada] = useState<string>("");
  const [titulo, setTitulo] = useState('');
  const [descricao, setDescricao] = useState('');
  const [perguntas, setPerguntas] = useState<Pergunta[]>([]);
  const [loading, setLoading] = useState(false);
  const [turmas, setTurmas] = useState<any[]>([]);
  const [turmasSelecionadas, setTurmasSelecionadas] = useState<string[]>([]);

  useEffect(() => {
    if (escolas.length > 0 && !escolaSelecionada) {
      setEscolaSelecionada(escolas[0].id);
    }
  }, [escolas]);

  useEffect(() => {
    if (escolaSelecionada) {
      carregarTurmas();
    }
  }, [escolaSelecionada]);

  const carregarTurmas = async () => {
    try {
      const { data, error } = await supabase
        .from('turmas')
        .select('*')
        .eq('escola_id', escolaSelecionada)
        .order('nome');

      if (error) throw error;
      setTurmas(data || []);
    } catch (error) {
      console.error('Erro ao carregar turmas:', error);
      toast({
        title: "Erro",
        description: "Não foi possível carregar as turmas.",
        variant: "destructive"
      });
    }
  };

  const adicionarPergunta = () => {
    const novaPergunta: Pergunta = {
      id: Date.now().toString(),
      texto: '',
      opcoes: ['', '']
    };
    setPerguntas([...perguntas, novaPergunta]);
  };

  const removerPergunta = (id: string) => {
    setPerguntas(perguntas.filter(p => p.id !== id));
  };

  const atualizarPergunta = (id: string, campo: 'texto' | 'opcoes', valor: string | string[]) => {
    setPerguntas(perguntas.map(p => 
      p.id === id ? { ...p, [campo]: valor } : p
    ));
  };

  const adicionarOpcao = (perguntaId: string) => {
    setPerguntas(perguntas.map(p => 
      p.id === perguntaId 
        ? { ...p, opcoes: [...p.opcoes, ''] }
        : p
    ));
  };

  const removerOpcao = (perguntaId: string, index: number) => {
    setPerguntas(perguntas.map(p => 
      p.id === perguntaId 
        ? { ...p, opcoes: p.opcoes.filter((_, i) => i !== index) }
        : p
    ));
  };

  const atualizarOpcao = (perguntaId: string, index: number, valor: string) => {
    setPerguntas(perguntas.map(p => 
      p.id === perguntaId 
        ? { ...p, opcoes: p.opcoes.map((opcao, i) => i === index ? valor : opcao) }
        : p
    ));
  };

  const validarFormulario = () => {
    if (!titulo.trim()) {
      toast({
        title: "Título obrigatório",
        description: "Digite um título para a pesquisa.",
        variant: "destructive"
      });
      return false;
    }

    if (perguntas.length === 0) {
      toast({
        title: "Perguntas obrigatórias",
        description: "Adicione pelo menos uma pergunta.",
        variant: "destructive"
      });
      return false;
    }

    for (const pergunta of perguntas) {
      if (!pergunta.texto.trim()) {
        toast({
          title: "Pergunta inválida",
          description: "Todas as perguntas devem ter um texto.",
          variant: "destructive"
        });
        return false;
      }

      if (pergunta.opcoes.length < 2) {
        toast({
          title: "Opções insuficientes",
          description: "Cada pergunta deve ter pelo menos 2 opções.",
          variant: "destructive"
        });
        return false;
      }

      for (const opcao of pergunta.opcoes) {
        if (!opcao.trim()) {
          toast({
            title: "Opção inválida",
            description: "Todas as opções devem ter um texto.",
            variant: "destructive"
          });
          return false;
        }
      }
    }

    if (turmasSelecionadas.length === 0) {
      toast({
        title: "Turmas obrigatórias",
        description: "Selecione pelo menos uma turma.",
        variant: "destructive"
      });
      return false;
    }

    return true;
  };

  const criarPesquisa = async () => {
    if (!validarFormulario() || !user) return;

    setLoading(true);
    try {
      // 1. Criar a pesquisa
      const { data: pesquisaData, error: pesquisaError } = await supabase
        .from('pesquisas')
        .insert({
          titulo: titulo.trim(),
          descricao: descricao.trim() || null,
          status: 'ativa',
          escola_id: escolaSelecionada
        })
        .select()
        .single();

      if (pesquisaError) throw pesquisaError;

      // 2. Criar as perguntas
      const perguntasParaInserir = perguntas.map(pergunta => ({
        pesquisa_id: pesquisaData.id,
        texto_pergunta: pergunta.texto.trim(),
        opcoes: pergunta.opcoes.map(opcao => opcao.trim())
      }));

      const { error: perguntasError } = await supabase
        .from('pesquisa_perguntas')
        .insert(perguntasParaInserir);

      if (perguntasError) throw perguntasError;

      // 3. Buscar alunos das turmas selecionadas
      const { data: alunosData, error: alunosError } = await supabase
        .from('alunos')
        .select('id')
        .in('turma_id', turmasSelecionadas);

      if (alunosError) throw alunosError;

      // 4. Criar destinatários
      if (alunosData && alunosData.length > 0) {
        const destinatariosParaInserir = alunosData.map(aluno => ({
          pesquisa_id: pesquisaData.id,
          aluno_id: aluno.id,
          status_resposta: 'pendente'
        }));

        const { error: destinatariosError } = await supabase
          .from('pesquisa_destinatarios')
          .insert(destinatariosParaInserir);

        if (destinatariosError) throw destinatariosError;
      }

      toast({
        title: "Pesquisa criada com sucesso!",
        description: `A pesquisa foi enviada para ${alunosData?.length || 0} alunos.`,
      });

      // Limpar formulário
      setTitulo('');
      setDescricao('');
      setPerguntas([]);
      setTurmasSelecionadas([]);

    } catch (error) {
      console.error('Erro ao criar pesquisa:', error);
      toast({
        title: "Erro",
        description: "Não foi possível criar a pesquisa. Tente novamente.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          onClick={() => window.history.back()}
          className="flex items-center gap-2"
        >
          <ArrowLeft className="h-4 w-4" />
          Voltar
        </Button>
        <div>
          <h1 className="text-3xl font-bold" style={{ color: escolaConfig?.cor_primaria }}>
            Criar Nova Pesquisa
          </h1>
          <p className="text-gray-600 mt-2">Crie uma pesquisa para coletar feedback dos alunos</p>
        </div>
      </div>

      {/* Seletor de Escola */}
      <Card>
        <CardHeader>
          <CardTitle>Selecionar Escola</CardTitle>
        </CardHeader>
        <CardContent>
          <select
            className="w-full p-2 border rounded-md"
            value={escolaSelecionada}
            onChange={(e) => setEscolaSelecionada(e.target.value)}
          >
            <option value="">Selecione uma escola</option>
            {escolas.map(escola => (
              <option key={escola.id} value={escola.id}>{escola.nome}</option>
            ))}
          </select>
        </CardContent>
      </Card>

      {/* Informações da Pesquisa */}
      <Card>
        <CardHeader>
          <CardTitle>Informações da Pesquisa</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="titulo">Título *</Label>
            <Input
              id="titulo"
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
              placeholder="Digite o título da pesquisa"
              className="mt-1"
            />
          </div>
          
          <div>
            <Label htmlFor="descricao">Descrição (opcional)</Label>
            <Textarea
              id="descricao"
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              placeholder="Digite uma descrição para a pesquisa"
              className="mt-1"
              rows={3}
            />
          </div>
        </CardContent>
      </Card>

      {/* Seleção de Turmas */}
      {escolaSelecionada && (
        <Card>
          <CardHeader>
            <CardTitle>Selecionar Turmas *</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {turmas.map(turma => (
                <label key={turma.id} className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    checked={turmasSelecionadas.includes(turma.id)}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setTurmasSelecionadas([...turmasSelecionadas, turma.id]);
                      } else {
                        setTurmasSelecionadas(turmasSelecionadas.filter(id => id !== turma.id));
                      }
                    }}
                    className="rounded"
                  />
                  <span>{turma.nome}</span>
                </label>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Perguntas */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Perguntas da Pesquisa</span>
            <Button
              onClick={adicionarPergunta}
              variant="outline"
              size="sm"
              className="flex items-center gap-2"
            >
              <Plus className="h-4 w-4" />
              Adicionar Pergunta
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {perguntas.map((pergunta, index) => (
            <div key={pergunta.id} className="border rounded-lg p-4 space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="font-medium">Pergunta {index + 1}</h4>
                <Button
                  onClick={() => removerPergunta(pergunta.id)}
                  variant="ghost"
                  size="sm"
                  className="text-red-600 hover:text-red-700"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
              
              <div>
                <Label>Texto da Pergunta *</Label>
                <Input
                  value={pergunta.texto}
                  onChange={(e) => atualizarPergunta(pergunta.id, 'texto', e.target.value)}
                  placeholder="Digite a pergunta"
                  className="mt-1"
                />
              </div>
              
              <div>
                <div className="flex items-center justify-between mb-2">
                  <Label>Opções de Resposta *</Label>
                  <Button
                    onClick={() => adicionarOpcao(pergunta.id)}
                    variant="outline"
                    size="sm"
                    className="flex items-center gap-1"
                  >
                    <Plus className="h-3 w-3" />
                    Adicionar Opção
                  </Button>
                </div>
                
                <div className="space-y-2">
                  {pergunta.opcoes.map((opcao, opcaoIndex) => (
                    <div key={opcaoIndex} className="flex items-center gap-2">
                      <Input
                        value={opcao}
                        onChange={(e) => atualizarOpcao(pergunta.id, opcaoIndex, e.target.value)}
                        placeholder={`Opção ${opcaoIndex + 1}`}
                        className="flex-1"
                      />
                      {pergunta.opcoes.length > 2 && (
                        <Button
                          onClick={() => removerOpcao(pergunta.id, opcaoIndex)}
                          variant="ghost"
                          size="sm"
                          className="text-red-600 hover:text-red-700"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ))}
          
          {perguntas.length === 0 && (
            <div className="text-center py-8 text-gray-500">
              <p>Nenhuma pergunta adicionada</p>
              <p className="text-sm">Clique em "Adicionar Pergunta" para começar</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Botão de Salvar */}
      <div className="flex justify-end">
        <Button
          onClick={criarPesquisa}
          disabled={loading}
          style={{ backgroundColor: escolaConfig?.cor_primaria }}
          className="flex items-center gap-2"
        >
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Save className="h-4 w-4" />
          )}
          {loading ? 'Criando...' : 'Criar Pesquisa'}
        </Button>
      </div>
    </div>
  );
};

export default PesquisaCreatePage;