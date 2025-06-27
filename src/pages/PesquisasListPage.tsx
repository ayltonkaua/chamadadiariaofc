import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Plus, ArrowLeft, Edit, Trash2, BarChart3, Eye, Calendar, Users } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';

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
  const [deletingId, setDeletingId] = useState<string | null>(null);
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
        setPesquisas((data as Pesquisa[]) || []);
      } catch (error) {
        toast({ title: 'Erro ao buscar pesquisas', variant: 'destructive' });
      } finally {
        setLoading(false);
      }
    };

    fetchPesquisas();
  }, [user]);

  const handleDeletePesquisa = async (pesquisaId: string) => {
    setDeletingId(pesquisaId);
    try {
      const { error } = await supabase
        .from('pesquisas')
        .delete()
        .eq('id', pesquisaId);

      if (error) throw error;

      setPesquisas(prev => prev.filter(p => p.id !== pesquisaId));
      toast({ title: 'Pesquisa excluída com sucesso' });
    } catch (error) {
      toast({ title: 'Erro ao excluir pesquisa', variant: 'destructive' });
    } finally {
      setDeletingId(null);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto p-4 max-w-6xl">
        {/* Header */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Minhas Pesquisas</h1>
              <p className="text-gray-600 mt-1">Gerencie suas pesquisas e visualize os resultados</p>
            </div>
            <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
              <Button variant="outline" onClick={() => navigate('/dashboard')} className="w-full sm:w-auto">
                <ArrowLeft className="h-4 w-4 mr-2" /> Voltar
              </Button>
              <Link to="/pesquisas/nova" className="w-full sm:w-auto">
                <Button className="w-full sm:w-auto">
                  <Plus className="h-4 w-4 mr-2" /> Criar Pesquisa
                </Button>
              </Link>
            </div>
          </div>
        </div>

        {/* Content */}
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600 mx-auto mb-4"></div>
              <p className="text-gray-600">Carregando pesquisas...</p>
            </div>
          </div>
        ) : pesquisas.length === 0 ? (
          <div className="bg-white rounded-lg shadow-sm p-12 text-center">
            <div className="max-w-md mx-auto">
              <BarChart3 className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Nenhuma pesquisa criada</h3>
              <p className="text-gray-600 mb-6">Comece criando sua primeira pesquisa para coletar dados dos alunos.</p>
              <Link to="/pesquisas/nova">
                <Button>
                  <Plus className="h-4 w-4 mr-2" /> Criar Primeira Pesquisa
                </Button>
              </Link>
            </div>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {pesquisas.map((pesquisa) => (
              <Card key={pesquisa.id} className="hover:shadow-md transition-shadow duration-200">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <CardTitle className="text-lg font-semibold text-gray-900 truncate">
                        {pesquisa.titulo}
                      </CardTitle>
                      <div className="flex items-center gap-2 mt-2">
                        <Badge 
                          variant={pesquisa.status === 'ativa' ? 'default' : 'secondary'}
                          className={pesquisa.status === 'ativa' ? 'bg-green-100 text-green-800 hover:bg-green-100' : ''}
                        >
                          {pesquisa.status === 'ativa' ? 'Ativa' : 'Inativa'}
                        </Badge>
                        <div className="flex items-center text-xs text-gray-500">
                          <Calendar className="h-3 w-3 mr-1" />
                          {formatDate(pesquisa.created_at)}
                        </div>
                      </div>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="pt-0">
                  {pesquisa.descricao && (
                    <p className="text-sm text-gray-600 mb-4 line-clamp-2">
                      {pesquisa.descricao}
                    </p>
                  )}
                  
                  <div className="flex flex-wrap gap-2">
                    <Link to={`/pesquisas/${pesquisa.id}/resultados`} className="flex-1">
                      <Button variant="outline" size="sm" className="w-full">
                        <Eye className="h-4 w-4 mr-1" />
                        Ver Resultados
                      </Button>
                    </Link>
                    
                    <Link to={`/pesquisas/${pesquisa.id}/editar`} className="flex-1">
                      <Button variant="outline" size="sm" className="w-full">
                        <Edit className="h-4 w-4 mr-1" />
                        Editar
                      </Button>
                    </Link>
                    
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button 
                          variant="outline" 
                          size="sm" 
                          className="flex-1 border-red-200 text-red-700 hover:bg-red-50 hover:border-red-300"
                        >
                          <Trash2 className="h-4 w-4 mr-1" />
                          Excluir
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Excluir pesquisa</AlertDialogTitle>
                          <AlertDialogDescription>
                            Tem certeza que deseja excluir a pesquisa "{pesquisa.titulo}"? 
                            Esta ação não pode ser desfeita e todos os dados coletados serão perdidos.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancelar</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => handleDeletePesquisa(pesquisa.id)}
                            className="bg-red-600 hover:bg-red-700"
                            disabled={deletingId === pesquisa.id}
                          >
                            {deletingId === pesquisa.id ? 'Excluindo...' : 'Excluir'}
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default PesquisasListPage;