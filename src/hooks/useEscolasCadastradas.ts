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
        const { data, error } = await supabase
          .from('escola_configuracao')
          .select('*')
          .order('nome', { ascending: true });
          
        if (error) {
          console.warn('Erro ao buscar escolas:', error);
          // Em caso de erro, usar uma escola padrão
          const defaultEscola: Escola = {
            id: 'default',
            nome: 'Minha Escola',
            endereco: 'Endereço da escola',
            telefone: '(11) 1234-5678',
            email: 'contato@escola.com',
            cor_primaria: '#7c3aed',
            cor_secundaria: '#f3f4f6',
            url_logo: null,
            criado_em: new Date().toISOString(),
            atualizado_em: new Date().toISOString()
          };
          setEscolas([defaultEscola]);
        } else {
          setEscolas(data || []);
        }
      } catch (err) {
        console.warn('Erro ao acessar banco de dados:', err);
        // Em caso de erro, usar uma escola padrão
        const defaultEscola: Escola = {
          id: 'default',
          nome: 'Minha Escola',
          endereco: 'Endereço da escola',
          telefone: '(11) 1234-5678',
          email: 'contato@escola.com',
          cor_primaria: '#7c3aed',
          cor_secundaria: '#f3f4f6',
          url_logo: null,
          criado_em: new Date().toISOString(),
          atualizado_em: new Date().toISOString()
        };
        setEscolas([defaultEscola]);
      } finally {
        setLoading(false);
      }
    }
    
    fetchEscolas();
  }, []);

  return { escolas, loading, error };
} 