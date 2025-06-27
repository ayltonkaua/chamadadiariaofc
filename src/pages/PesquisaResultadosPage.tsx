// src/pages/PesquisaResultadosPage.tsx

import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { createClient } from '@supabase/supabase-js';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { ArrowLeft, Loader2, PieChart, Users, FileText, BarChart3, Calendar } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend, CartesianGrid } from 'recharts';

// Cliente Supabase genérico
const supabaseGeneric = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
);

// Tipos para estruturar os dados
interface Resposta { 
  resposta: string; 
  alunos: { nome: string; } | null;
}
interface Pergunta { 
  id: string;
  texto_pergunta: string; 
  opcoes: string[]; 
  pesquisa_respostas: Resposta[]; 
}
interface PesquisaCompleta { 
  id: string;
  titulo: string; 
  descricao: string | null; 
  created_at: string;
  pesquisa_perguntas: Pergunta[]; 
}

const PesquisaResultadosPage: React.FC = () => {
  const { pesquisaId } = useParams<{ pesquisaId: string }>();
  const [pesquisa, setPesquisa] = useState<PesquisaCompleta | null>(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchResultados = async () => {
      if (!pesquisaId) {
        toast({ title: "ID da pesquisa não encontrado.", variant: "destructive" });
        setLoading(false);
        return;
      }
      try {
        // Buscar a pesquisa com perguntas
        const { data: pesquisaData, error: pesquisaError } = await supabaseGeneric
          .from('pesquisas')
          .select(`
            id,
            titulo, 
            descricao, 
            created_at,
            pesquisa_perguntas(
              id,
              texto_pergunta, 
              opcoes
            )
          `)
          .eq('id', pesquisaId)
          .single();

        if (pesquisaError) throw pesquisaError;

        // Buscar as respostas para cada pergunta
        const perguntasComRespostas = await Promise.all(
          pesquisaData.pesquisa_perguntas.map(async (pergunta: any) => {
            const { data: respostasData, error: respostasError } = await supabaseGeneric
              .from('pesquisa_respostas')
              .select(`
                resposta,
                alunos!inner(nome)
              `)
              .eq('pergunta_id', pergunta.id);

            if (respostasError) throw respostasError;

            return {
              ...pergunta,
              pesquisa_respostas: respostasData || []
            };
          })
        );

        setPesquisa({
          ...pesquisaData,
          pesquisa_perguntas: perguntasComRespostas
        });
      } catch (err) {
        console.error('Erro ao carregar resultados:', err);
        toast({ 
          title: "Erro ao carregar resultados", 
          description: (err as Error).message, 
          variant: "destructive" 
        });
      } finally {
        setLoading(false);
      }
    };

    fetchResultados();
  }, [pesquisaId]);

  const processarResultados = (pergunta: Pergunta) => {
    const contagem = pergunta.pesquisa_respostas.reduce((acc, resp) => {
      acc[resp.resposta] = (acc[resp.resposta] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return pergunta.opcoes.map(opcao => ({
      name: opcao,
      votos: contagem[opcao] || 0,
      porcentagem: pergunta.pesquisa_respostas.length > 0 
        ? Math.round((contagem[opcao] || 0) / pergunta.pesquisa_respostas.length * 100)
        : 0
    }));
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-purple-600" />
          <p className="text-gray-600">Carregando resultados...</p>
        </div>
      </div>
    );
  }

  if (!pesquisa) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <FileText className="h-12 w-12 mx-auto mb-4 text-gray-400" />
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Pesquisa não encontrada</h2>
          <p className="text-gray-600 mb-4">A pesquisa que você está procurando não existe ou foi removida.</p>
          <Button onClick={() => navigate('/pesquisas')}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Voltar às Pesquisas
          </Button>
        </div>
      </div>
    );
  }

  const totalRespostas = pesquisa.pesquisa_perguntas.reduce((total, pergunta) => 
    total + pergunta.pesquisa_respostas.length, 0
  );

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto p-4 max-w-6xl">
        {/* Header */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <Button variant="outline" size="icon" onClick={() => navigate('/pesquisas')}>
                <ArrowLeft className="h-4 w-4" />
              </Button>
              <div>
                <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">{pesquisa.titulo}</h1>
                {pesquisa.descricao && (
                  <p className="text-gray-600 mt-1">{pesquisa.descricao}</p>
                )}
                <div className="flex items-center gap-4 mt-2 text-sm text-gray-500">
                  <div className="flex items-center gap-1">
                    <Calendar className="h-4 w-4" />
                    <span>Criada em {formatDate(pesquisa.created_at)}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Users className="h-4 w-4" />
                    <span>{totalRespostas} resposta{totalRespostas !== 1 ? 's' : ''}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Resultados */}
        <div className="space-y-6">
          {pesquisa.pesquisa_perguntas.map((pergunta, index) => {
            const dadosGrafico = processarResultados(pergunta);
            const totalRespostasPergunta = pergunta.pesquisa_respostas.length;
            
            return (
              <Card key={pergunta.id} className="shadow-sm">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <CardTitle className="text-lg font-semibold text-gray-900 mb-2">
                        Pergunta {index + 1}: {pergunta.texto_pergunta}
                      </CardTitle>
                      <div className="flex items-center gap-4 text-sm text-gray-500">
                        <div className="flex items-center gap-1">
                          <BarChart3 className="h-4 w-4" />
                          <span>{totalRespostasPergunta} resposta{totalRespostasPergunta !== 1 ? 's' : ''}</span>
                        </div>
                        {totalRespostasPergunta > 0 && (
                          <div className="flex items-center gap-1">
                            <PieChart className="h-4 w-4" />
                            <span>Taxa de resposta: {Math.round((totalRespostasPergunta / totalRespostas) * 100)}%</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  {dadosGrafico.length > 0 && totalRespostasPergunta > 0 ? (
                    <div className="space-y-6">
                      {/* Gráfico */}
                      <div className="h-80">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={dadosGrafico} layout="vertical" margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis type="number" />
                            <YAxis dataKey="name" type="category" width={150} />
                            <Tooltip 
                              formatter={(value: any, name: any) => [
                                `${value} votos (${dadosGrafico.find(d => d.name === name)?.porcentagem}%)`, 
                                'Votos'
                              ]}
                            />
                            <Legend />
                            <Bar dataKey="votos" fill="#8b5cf6" name="Votos" />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                      
                      {/* Tabela de resultados */}
                      <div className="border rounded-lg overflow-hidden">
                        <table className="w-full">
                          <thead className="bg-gray-50">
                            <tr>
                              <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Opção</th>
                              <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Votos</th>
                              <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Porcentagem</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-200">
                            {dadosGrafico.map((item, idx) => (
                              <tr key={idx} className="hover:bg-gray-50">
                                <td className="px-4 py-3 text-sm text-gray-900">{item.name}</td>
                                <td className="px-4 py-3 text-sm text-gray-900 font-medium">{item.votos}</td>
                                <td className="px-4 py-3 text-sm text-gray-900">{item.porcentagem}%</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-8">
                      <FileText className="h-12 w-12 mx-auto mb-4 text-gray-400" />
                      <p className="text-gray-600">Nenhuma resposta para esta pergunta ainda.</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default PesquisaResultadosPage;