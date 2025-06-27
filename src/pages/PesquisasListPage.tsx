// src/pages/PesquisasListPage.tsx

import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Plus, ArrowLeft } from 'lucide-react';
import { toast } from '@/hooks/use-toast';

interface Pesquisa {
  id: string;
  titulo: string;
  descricao: string | null;
  status: string;
  created_at: string;
}

const PesquisasListPage: React.FC = () => {
  const [pesquisas, setPesquisas] = useState<Pesquisa[]>([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    const fetchPesquisas = async () => {
      if (!user) return;
      
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from('pesquisas')
          .select('*')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false });

        if (error) throw error;
        setPesquisas(data || []);
      } catch (error) {
        toast({ title: 'Erro ao buscar pesquisas', variant: 'destructive' });
      } finally {
        setLoading(false);
      }
    };

    fetchPesquisas();
  }, [user]);

  return (
    <div className="container mx-auto p-4 max-w-4xl">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-800">Minhas Pesquisas</h1>
        <div className="flex gap-2">
            <Button variant="outline" onClick={() => navigate('/dashboard')}>
                <ArrowLeft className="h-4 w-4 mr-2" /> Voltar
            </Button>
            <Link to="/pesquisas/nova">
                <Button>
                    <Plus className="h-4 w-4 mr-2" /> Criar Pesquisa
                </Button>
            </Link>
        </div>
      </div>

      {loading ? (
        <p>Carregando...</p>
      ) : pesquisas.length === 0 ? (
        <p className="text-center text-gray-500 mt-8">Nenhuma pesquisa criada ainda.</p>
      ) : (
        <div className="grid gap-4">
          {pesquisas.map((pesquisa) => (
            <Card key={pesquisa.id}>
              <CardHeader>
                <CardTitle>{pesquisa.titulo}</CardTitle>
              </CardHeader>
              <CardContent className="flex justify-between items-center">
                <div>
                    <p className="text-sm text-muted-foreground">{pesquisa.descricao}</p>
                    <span className={`text-xs font-semibold px-2 py-1 rounded-full ${pesquisa.status === 'ativa' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}>
                        {pesquisa.status}
                    </span>
                </div>
                <Link to={`/pesquisas/${pesquisa.id}/resultados`}>
                  <Button variant="secondary">Ver Resultados</Button>
                </Link>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default PesquisasListPage;