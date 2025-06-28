import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from '@/hooks/use-toast';
import { Plus, Trash2, Save, Loader2, ArrowLeft } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Checkbox } from '@/components/ui/checkbox';

// Interface simplificada para o estado do formulário
interface Pergunta {
  id: number;
  texto_pergunta: string;
  opcoes: string[];
}

const PesquisaCreatePage: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [titulo, setTitulo] = useState('');
  const [descricao, setDescricao] = useState('');
  const [perguntas, setPerguntas] = useState<Pergunta[]>([{ id: 1, texto_pergunta: '', opcoes: ['', ''] }]);
  const [loading, setLoading] = useState(false);
  const [turmas, setTurmas] = useState<{ id: string; nome: string; }[]>([]);
  const [turmasSelecionadas, setTurmasSelecionadas] = useState<string[]>([]);

  // Carrega as turmas da escola do usuário logado
  useEffect(() => {
    if (!user?.escola_id) return;
    const carregarTurmas = async () => {
      const { data, error } = await supabase
        .from('turmas')
        .select('id, nome')
        .eq('escola_id', user.escola_id)
        .order('nome');
      if (error) {
        toast({ title: "Erro ao carregar turmas", variant: "destructive" });
      } else {
        setTurmas(data || []);
      }
    };
    carregarTurmas();
  }, [user?.escola_id, toast]);

  const adicionarPergunta = () => {
    setPerguntas([...perguntas, { id: Date.now(), texto_pergunta: '', opcoes: ['', ''] }]);
  };

  const removerPergunta = (id: number) => {
    setPerguntas(perguntas.filter(p => p.id !== id));
  };

  const atualizarTextoPergunta = (id: number, texto: string) => {
    setPerguntas(perguntas.map(p => (p.id === id ? { ...p, texto_pergunta: texto } : p)));
  };

  const adicionarOpcao = (perguntaId: number) => {
    setPerguntas(perguntas.map(p => (p.id === perguntaId ? { ...p, opcoes: [...p.opcoes, ''] } : p)));
  };

  const removerOpcao = (perguntaId: number, index: number) => {
    setPerguntas(perguntas.map(p => (p.id === perguntaId ? { ...p, opcoes: p.opcoes.filter((_, i) => i !== index) } : p)));
  };

  const atualizarOpcao = (perguntaId: number, index: number, valor: string) => {
    setPerguntas(perguntas.map(p => (p.id === perguntaId ? { ...p, opcoes: p.opcoes.map((op, i) => i === index ? valor : op) } : p)));
  };

  const handleTurmaToggle = (turmaId: string) => {
    setTurmasSelecionadas(prev =>
      prev.includes(turmaId) ? prev.filter(id => id !== turmaId) : [...prev, turmaId]
    );
  };

  const criarPesquisa = async () => {
    // Validação
    if (!titulo.trim() || perguntas.length === 0 || turmasSelecionadas.length === 0) {
      toast({ title: "Campos obrigatórios", description: "Título, ao menos uma pergunta e uma turma são necessários.", variant: "destructive" });
      return;
    }
    if (!user?.escola_id) {
        toast({ title: "Erro", description: "Escola não identificada.", variant: "destructive" });
        return;
    }

    setLoading(true);
    try {
      // Simplificado para uma única chamada RPC
      const { error } = await supabase.rpc('criar_pesquisa_completa', {
        titulo: titulo.trim(),
        descricao: descricao.trim() || null,
        escola_id: user.escola_id,
        perguntas: perguntas.map(p => ({ texto_pergunta: p.texto_pergunta, opcoes: p.opcoes })),
        turma_ids: turmasSelecionadas
      });

      if (error) throw error;

      toast({ title: "Pesquisa criada com sucesso!" });
      navigate('/pesquisas');

    } catch (error: any) {
      console.error('Erro ao criar pesquisa:', error);
      toast({ title: "Erro", description: error.message || "Não foi possível criar a pesquisa.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container mx-auto p-4 sm:p-6 space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate('/pesquisas')}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold">Criar Nova Pesquisa</h1>
          <p className="text-muted-foreground mt-1">Crie e envie uma pesquisa para as turmas selecionadas.</p>
        </div>
      </div>

      <Card>
        <CardHeader><CardTitle>1. Detalhes da Pesquisa</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="titulo">Título *</Label>
            <Input id="titulo" value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder="Ex: Pesquisa de Satisfação Semestral" />
          </div>
          <div>
            <Label htmlFor="descricao">Descrição (opcional)</Label>
            <Textarea id="descricao" value={descricao} onChange={(e) => setDescricao(e.target.value)} placeholder="Descreva o objetivo da pesquisa" />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>2. Turmas de Destino *</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
          {turmas.length > 0 ? turmas.map(turma => (
            <div key={turma.id} className="flex items-center space-x-2">
              <Checkbox id={`turma-${turma.id}`} checked={turmasSelecionadas.includes(turma.id)} onCheckedChange={() => handleTurmaToggle(turma.id)} />
              <Label htmlFor={`turma-${turma.id}`} className="font-normal cursor-pointer">{turma.nome}</Label>
            </div>
          )) : <p className="text-sm text-muted-foreground col-span-full">Nenhuma turma encontrada para esta escola.</p>}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>3. Perguntas da Pesquisa *</span>
            <Button onClick={adicionarPergunta} variant="outline" size="sm"><Plus className="h-4 w-4 mr-2" />Pergunta</Button>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {perguntas.length === 0 && <p className="text-sm text-center text-muted-foreground py-4">Adicione a primeira pergunta.</p>}
          {perguntas.map((pergunta, index) => (
            <div key={pergunta.id} className="border rounded-lg p-4 space-y-4 bg-slate-50">
              <div className="flex items-center justify-between">
                <h4 className="font-medium">Pergunta {index + 1}</h4>
                <Button onClick={() => removerPergunta(pergunta.id)} variant="ghost" size="icon" className="text-destructive hover:text-destructive-hover"><Trash2 className="h-4 w-4" /></Button>
              </div>
              <div className="space-y-2">
                <Label>Texto da Pergunta *</Label>
                <Input value={pergunta.texto_pergunta} onChange={(e) => atualizarTextoPergunta(pergunta.id, e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Opções de Resposta *</Label>
                {pergunta.opcoes.map((opcao, opcaoIndex) => (
                  <div key={opcaoIndex} className="flex items-center gap-2">
                    <Input value={opcao} onChange={(e) => atualizarOpcao(pergunta.id, opcaoIndex, e.target.value)} placeholder={`Opção ${opcaoIndex + 1}`} />
                    {pergunta.opcoes.length > 2 && (
                      <Button onClick={() => removerOpcao(pergunta.id, opcaoIndex)} variant="ghost" size="icon" className="text-destructive hover:text-destructive-hover"><X className="h-4 w-4" /></Button>
                    )}
                  </div>
                ))}
                <Button onClick={() => adicionarOpcao(pergunta.id)} variant="outline" size="sm" className="mt-2"><Plus className="h-4 w-4 mr-2" />Opção</Button>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={criarPesquisa} disabled={loading} size="lg">
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          <span className="ml-2">{loading ? 'Criando...' : 'Criar e Enviar Pesquisa'}</span>
        </Button>
      </div>
    </div>
  );
};

export default PesquisaCreatePage;