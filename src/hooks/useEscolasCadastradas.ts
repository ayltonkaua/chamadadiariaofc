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

      // Se o usuário não tem escola_id, retornar lista vazia
      if (!user.escola_id) {
        console.log('Usuário não tem escola_id, retornando lista vazia');
        setEscolas([]);
        setLoading(false);
        return;
      }

      try {
        // Buscar apenas a escola do usuário
        const { data, error } = await supabase
          .from('escola_configuracao')
          .select('*')
          .eq('id', user.escola_id);
          
        if (error) {
          console.warn('Erro ao buscar escola do usuário:', error);
          setError(error.message);
          setEscolas([]);
        } else {
          console.log('Escola carregada para usuário:', data?.[0]?.nome);
          setEscolas(data || []);
        }
      } catch (err) {
        console.warn('Erro ao acessar banco de dados:', err);
        setError('Erro ao carregar dados da escola');
        setEscolas([]);
      } finally {
        setLoading(false);
      }
    }
    
    fetchEscolas();
  }, [user?.id, user?.escola_id]);

  return { escolas, loading, error };
} 