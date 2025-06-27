import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Tables } from '@/integrations/supabase/types';
import { useAuth } from '@/contexts/AuthContext';

export type Escola = Tables<'escola_configuracao'>;

export function useEscolasCadastradas() {
  const { user } = useAuth();
  const [escolas, setEscolas] = useState<Escola[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchEscolas() {
      setLoading(true);
      setError(null);
      
      // Se não há usuário logado, retornar lista vazia
      if (!user) {
        setEscolas([]);
        setLoading(false);
        return;
      }

      try {
        // Buscar TODAS as escolas cadastradas no sistema
        const { data, error } = await supabase
          .from('escola_configuracao')
          .select('*')
          .order('nome');
          
        if (error) {
          console.warn('Erro ao buscar escolas:', error);
          setError(error.message);
          setEscolas([]);
        } else {
          console.log('Escolas carregadas:', data?.length || 0);
          setEscolas(data || []);
        }
      } catch (err) {
        console.warn('Erro ao acessar banco de dados:', err);
        setError('Erro ao carregar dados das escolas');
        setEscolas([]);
      } finally {
        setLoading(false);
      }
    }
    
    fetchEscolas();
  }, [user?.id]);

  return { escolas, loading, error };
} 