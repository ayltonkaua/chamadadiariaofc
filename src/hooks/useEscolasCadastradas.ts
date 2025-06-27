import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Tables } from '@/integrations/supabase/types';

export type Escola = Tables<'escola_configuracao'>;

export function useEscolasCadastradas() {
  const [escolas, setEscolas] = useState<Escola[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchEscolas() {
      setLoading(true);
      setError(null);
      
      try {
        // Busca TODAS as escolas cadastradas, agora permitido pela nova política RLS.
        const { data, error } = await supabase
          .from('escola_configuracao')
          .select('*')
          .order('nome');
          
        if (error) {
          console.warn('Erro ao buscar escolas:', error);
          setError(error.message);
          setEscolas([]);
        } else {
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
  }, []); // Removida a dependência do user.id para funcionar publicamente

  return { escolas, loading, error };
}