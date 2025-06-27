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
import { PlusCircle, Trash2, ArrowLeft } from 'lucide-react';
import { toast } from '@/hooks/use-toast';

interface Pergunta {
  texto_pergunta: string;
  tipo_pergunta: 'texto' | 'multipla_escolha';
  opcoes: string[];
}

interface Turma {
  id: string;
  nome: string;
}

const PesquisaCreatePage: React.FC = () => {
  const [titulo, setTitulo] = useState('');
  const [descricao, setDescricao] = useState('');
  const [perguntas, setPerguntas] = useState<Pergunta[]>([{ texto_pergunta: '', tipo_pergunta: 'texto', opcoes: [] }]);
  const [turmas, setTurmas] = useState<Turma[]>([]);
  const [turmasSelecionadas, setTurmasSelecionadas] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const { user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    // Carregar turmas do professor
    const fetchTurmas = async () => {
      if (!user) return;
      const { data } = await supabase.from('turmas').select('id, nome').eq('user_id', user.id);
      setTurmas(data || []);
    };
    fetchTurmas();
  }, [user]);

  const handleAddPergunta = () => {
    setPerguntas([...perguntas, { texto_pergunta: '', tipo_pergunta: 'texto', opcoes: [] }]);
  };

  const handleRemovePergunta = (index: number) => {
    const novasPerguntas = perguntas.filter((_, i) => i !== index);
    setPerguntas(novasPerguntas);
  };

  const handlePerguntaChange = (index: number, field: keyof Pergunta, value: any) => {
    const novasPerguntas = [...perguntas];
    (novasPerguntas[index] as any)[field] = value;
    if (field === 'tipo_pergunta' && value === 'texto') {
      novasPerguntas[index].opcoes = [];
    }
    setPerguntas(novasPerguntas);
  };
  
  const handleOpcaoChange = (pIndex: number, oIndex: number, value: string) => {
      const novasPerguntas = [...perguntas];
      novasPerguntas[pIndex].opcoes[oIndex] = value;
      setPerguntas(novasPerguntas);
  }

  const handleAddOpcao = (pIndex: number) => {
      const novasPerguntas = [...perguntas];
      novasPerguntas[pIndex].opcoes.push('');
      setPerguntas(novasPerguntas);
  }

  const handleTurmaToggle = (turmaId: string) => {
    setTurmasSelecionadas(prev => 
      prev.includes(turmaId) ? prev.filter(id => id !== turmaId) : [...prev, turmaId]
    );
  };
  
  const handleSalvar = async () => {
      setLoading(true);
      if (!titulo || perguntas.length === 0 || turmasSelecionadas.length === 0) {
          toast({ title: "Preencha todos os campos obrigatórios", variant: "destructive" });
          setLoading(false);
          return;
      }
      try {
          // 1. Salvar a pesquisa
          const { data: pesquisaData, error: pesquisaError } = await supabase
              .from('pesquisas')
              .insert({ user_id: user!.id, titulo, descricao, status: 'ativa' })
              .select()
              .single();

          if (pesquisaError) throw pesquisaError;
          const pesquisaId = pesquisaData.id;

          // 2. Salvar as perguntas
          const perguntasParaSalvar = perguntas.map((p, index) => ({
              pesquisa_id: pesquisaId,
              texto_pergunta: p.texto_pergunta,
              tipo_pergunta: p.tipo_pergunta,
              opcoes: p.tipo_pergunta === 'multipla_escolha' ? p.opcoes : null,
              ordem: index
          }));
          await supabase.from('pesquisa_perguntas').insert(perguntasParaSalvar);

          // 3. Buscar alunos das turmas selecionadas
          const { data: alunos } = await supabase
              .from('alunos')
              .select('id')
              .in('turma_id', turmasSelecionadas);
          
          if(!alunos) return;

          // 4. Salvar os destinatários
          const destinatarios = alunos.map(aluno => ({
              pesquisa_id: pesquisaId,
              aluno_id: aluno.id
          }));
          await supabase.from('pesquisa_destinatarios').insert(destinatarios);

          toast({ title: "Pesquisa criada com sucesso!" });
          navigate('/pesquisas');

      } catch (error) {
          console.error(error);
          toast({ title: "Erro ao criar pesquisa", variant: "destructive" });
      } finally {
          setLoading(false);
      }
  }

  return (
    <div className="container mx-auto p-4 max-w-4xl">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-2xl">Nova Pesquisa</CardTitle>
            <Button variant="ghost" onClick={() => navigate('/pesquisas')}>
              <ArrowLeft className="h-4 w-4 mr-2" /> Voltar
            </Button>
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
            <Label>Perguntas</Label>
            <div className="space-y-4 mt-2">
              {perguntas.map((pergunta, pIndex) => (
                <Card key={pIndex} className="p-4 bg-gray-50">
                  <div className="flex justify-between items-center mb-2">
                    <Label>Pergunta {pIndex + 1}</Label>
                    <Button variant="ghost" size="icon" onClick={() => handleRemovePergunta(pIndex)}><Trash2 className="h-4 w-4" /></Button>
                  </div>
                  <Textarea placeholder="Digite o texto da pergunta..." value={pergunta.texto_pergunta} onChange={e => handlePerguntaChange(pIndex, 'texto_pergunta', e.target.value)} />
                  {/* ... Lógica para tipo e opções ... */}
                </Card>
              ))}
              <Button variant="outline" onClick={handleAddPergunta}><PlusCircle className="h-4 w-4 mr-2" />Adicionar Pergunta</Button>
            </div>
          </div>
          
          <div>
              <Label>Selecione as turmas de destino</Label>
              <div className="flex flex-wrap gap-2 mt-2">
                  {turmas.map(turma => (
                      <Button key={turma.id} variant={turmasSelecionadas.includes(turma.id) ? 'default' : 'outline'} onClick={() => handleTurmaToggle(turma.id)}>
                          {turma.nome}
                      </Button>
                  ))}
              </div>
          </div>

          <Button onClick={handleSalvar} disabled={loading} className="w-full">
              {loading ? 'Salvando...' : 'Publicar Pesquisa'}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};

export default PesquisaCreatePage;