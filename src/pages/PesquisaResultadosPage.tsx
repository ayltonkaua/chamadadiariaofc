// src/pages/PesquisaResultadosPage.tsx

import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { toast } from '@/hooks/use-toast';

// Tipos para estruturar os dados recebidos
interface Resposta {
  resposta: string;
}

interface Pergunta {
  texto_pergunta: string;
  pesquisa_respostas: Resposta[];
}

interface PesquisaCompleta {
  titulo: string;
  descricao: string | null;
  pesquisa_perguntas: Pergunta[];
}

const PesquisaResultadosPage: React.FC = () => {
  const { pesquisaId } = useParams<{ pesquisaId: string }>();
  const [pesquisa, setPesquisa] = useState<PesquisaCompleta | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();
  const { user } = useAuth();

  useEffect(() => {
    if (!user) {
      navigate('/login');
    }

    const fetchResultados = async () => {
      if (!pesquisaId) {
        setError("ID da pesquisa não encontrado.");
        setLoading(false);
        return;
      }

      setLoading(true);
      try {
        // Este é o seu trecho de código, agora dentro do useEffect
        const { data, error: fetchError } = await supabase
          .from('pesquisas')
          .select(`
            titulo,
            descricao,
            pesquisa_perguntas (
              texto_pergunta,
              tipo_pergunta,
              opcoes,
              pesquisa_respostas (
                resposta
              )
            )
          `)
          .eq('id', pesquisaId)
          .single();

        if (fetchError) throw fetchError;

        setPesquisa(data);
      } catch (err) {
        setError("Não foi possível carregar os resultados da pesquisa.");
        toast({ title: "Erro", description: (err as Error).message, variant: "destructive" });
      } finally {
        setLoading(false);
      }
    };

    fetchResultados();
  }, [pesquisaId, user, navigate]);

  if (loading) {
    return <div className="flex justify-center items-center h-screen"><Loader2 className="h-8 w-8 animate-spin" /></div>;
  }

  if (error) {
    return <div className="text-center text-red-500 mt-10">{error}</div>;
  }

  return (
    <div className="container mx-auto p-4 max-w-4xl">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" onClick={() => navigate('/pesquisas')}>
                <ArrowLeft />
            </Button>
            <div>
                <h1 className="text-2xl font-bold text-gray-800">{pesquisa?.titulo}</h1>
                <p className="text-muted-foreground">{pesquisa?.descricao}</p>
            </div>
        </div>
      </div>

      <div className="space-y-6">
        {pesquisa?.pesquisa_perguntas.map((pergunta, index) => (
          <Card key={index}>
            <CardHeader>
              <CardTitle>Pergunta {index + 1}: {pergunta.texto_pergunta}</CardTitle>
            </CardHeader>
            <CardContent>
              <h4 className="font-semibold mb-2">Respostas:</h4>
              <ul className="list-disc pl-5 space-y-1 text-sm text-gray-700">
                {pergunta.pesquisa_respostas.length > 0 ? (
                    pergunta.pesquisa_respostas.map((resposta, rIndex) => (
                        <li key={rIndex}>{resposta.resposta}</li>
                    ))
                ) : (
                    <p className="text-muted-foreground">Nenhuma resposta para esta pergunta ainda.</p>
                )}
              </ul>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
};

export default PesquisaResultadosPage;