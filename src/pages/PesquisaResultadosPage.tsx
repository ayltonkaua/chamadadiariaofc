// src/pages/PesquisaResultadosPage.tsx

import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { ArrowLeft, Loader2, PieChart } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from 'recharts';

// Tipos para estruturar os dados
interface Resposta { resposta: string; }
interface Pergunta { texto_pergunta: string; opcoes: string[]; pesquisa_respostas: Resposta[]; }
interface PesquisaCompleta { titulo: string; descricao: string | null; pesquisa_perguntas: Pergunta[]; }

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
        const { data, error } = await supabase
          .from('pesquisas')
          .select(`titulo, descricao, pesquisa_perguntas(texto_pergunta, opcoes, pesquisa_respostas(resposta))`)
          .eq('id', pesquisaId)
          .single();

        if (error) throw error;
        setPesquisa(data);
      } catch (err) {
        toast({ title: "Erro ao carregar resultados", description: (err as Error).message, variant: "destructive" });
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
    }));
  };

  if (loading) {
    return <div className="flex justify-center items-center h-screen"><Loader2 className="h-8 w-8 animate-spin" /></div>;
  }

  return (
    <div className="container mx-auto p-4 max-w-5xl">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={() => navigate('/pesquisas')}><ArrowLeft /></Button>
          <div>
            <h1 className="text-2xl font-bold text-gray-800">{pesquisa?.titulo}</h1>
            <p className="text-muted-foreground">{pesquisa?.descricao}</p>
          </div>
        </div>
      </div>

      <div className="space-y-6">
        {pesquisa?.pesquisa_perguntas.map((pergunta, index) => {
          const dadosGrafico = processarResultados(pergunta);
          return (
            <Card key={index}>
              <CardHeader>
                <CardTitle>Pergunta {index + 1}: {pergunta.texto_pergunta}</CardTitle>
                <CardDescription>{pergunta.pesquisa_respostas.length} respostas</CardDescription>
              </CardHeader>
              <CardContent>
                {dadosGrafico.length > 0 ? (
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={dadosGrafico} layout="vertical" margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis type="number" />
                      <YAxis dataKey="name" type="category" width={150} />
                      <Tooltip />
                      <Legend />
                      <Bar dataKey="votos" fill="#8884d8" name="Votos" />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <p className="text-muted-foreground">Nenhuma resposta para esta pergunta ainda.</p>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
};

export default PesquisaResultadosPage;