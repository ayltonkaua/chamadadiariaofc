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
      const { data, error } = await supabase
        .from('escola_configuracao')
        .select('*')
        .order('nome', { ascending: true });
      if (error) {
        setError(error.message);
        setEscolas([]);
      } else {
        setEscolas(data || []);
      }
      setLoading(false);
    }
    fetchEscolas();
  }, []);

  return { escolas, loading, error };
} 