import React, { createContext, useState, useContext, ReactNode, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Tables } from "@/integrations/supabase/types";
import { useAuth } from "@/contexts/AuthContext";

type EscolaConfig = Tables<"escola_configuracao">;

interface EscolaConfigContextType {
  config: EscolaConfig | null;
  loading: boolean;
  error: string | null;
  updateConfig: (config: Partial<EscolaConfig>) => Promise<boolean>;
  refreshConfig: () => Promise<void>;
}

const EscolaConfigContext = createContext<EscolaConfigContextType | undefined>(undefined);

export const EscolaConfigProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const [config, setConfig] = useState<EscolaConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchConfig = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Configuração padrão caso não consiga buscar do banco
      const defaultConfig: EscolaConfig = {
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

      // Se não há usuário logado, usar configuração padrão
      if (!user) {
        setConfig(defaultConfig);
        return;
      }

      // Se o usuário não tem escola_id, usar configuração padrão
      if (!user.escola_id) {
        console.log('Usuário não tem escola_id, usando configuração padrão');
        setConfig(defaultConfig);
        return;
      }

      try {
        // Buscar configuração específica da escola do usuário
        const { data, error } = await supabase
          .from('escola_configuracao')
          .select('*')
          .eq('id', user.escola_id)
          .single();
        
        if (error) {
          console.warn('Erro ao buscar configuração da escola:', error);
          // Usar configuração padrão em caso de erro
          setConfig(defaultConfig);
          return;
        }
        
        if (data) {
          console.log('Configuração carregada para escola:', data.nome);
          setConfig(data);
        } else {
          console.log('Nenhuma configuração encontrada para escola_id:', user.escola_id);
          setConfig(defaultConfig);
        }
      } catch (err) {
        console.warn('Erro ao acessar banco de dados:', err);
        // Usar configuração padrão em caso de erro
        setConfig(defaultConfig);
      }
    } catch (err) {
      console.error('Erro geral ao carregar configurações:', err);
      setError('Erro ao carregar configurações da escola');
      setConfig(null);
    } finally {
      setLoading(false);
    }
  };

  const updateConfig = async (updates: Partial<EscolaConfig>): Promise<boolean> => {
    try {
      setError(null);
      
      // Se não há usuário logado ou não tem escola_id, não permitir atualização
      if (!user || !user.escola_id) {
        console.warn('Usuário não tem permissão para atualizar configurações');
        setError('Você não tem permissão para atualizar as configurações da escola');
        return false;
      }

      // Se não há configuração válida, apenas atualizar o estado local
      if (!config?.id || config.id === 'default') {
        const newConfig = { ...config, ...updates, atualizado_em: new Date().toISOString() };
        setConfig(newConfig as EscolaConfig);
        return true;
      }

      // Verificar se o usuário tem permissão para atualizar esta escola
      if (config.id !== user.escola_id) {
        console.warn('Usuário tentando atualizar configuração de escola diferente');
        setError('Você não tem permissão para atualizar as configurações desta escola');
        return false;
      }

      // Tentar atualizar no banco
      try {
        const { data, error } = await supabase
          .from('escola_configuracao')
          .update({
            ...updates,
            atualizado_em: new Date().toISOString()
          })
          .eq('id', user.escola_id)
          .select()
          .single();
          
        if (error) {
          console.warn('Erro ao atualizar no banco:', error);
          setError('Erro ao atualizar configurações no banco de dados');
          return false;
        }
        
        if (data) {
          setConfig(data);
          return true;
        }
      } catch (err) {
        console.warn('Erro ao acessar banco para atualização:', err);
        setError('Erro ao conectar com o banco de dados');
        return false;
      }
      
      return true;
    } catch (err) {
      console.error('Erro ao atualizar configurações:', err);
      setError('Erro ao atualizar configurações');
      return false;
    }
  };

  const refreshConfig = async () => {
    await fetchConfig();
  };

  useEffect(() => {
    fetchConfig();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, user?.escola_id]);

  return (
    <EscolaConfigContext.Provider value={{
      config,
      loading,
      error,
      updateConfig,
      refreshConfig
    }}>
      {children}
    </EscolaConfigContext.Provider>
  );
};

export const useEscolaConfig = (): EscolaConfigContextType => {
  const context = useContext(EscolaConfigContext);
  if (context === undefined) {
    throw new Error("useEscolaConfig deve ser usado dentro de um EscolaConfigProvider");
  }
  return context;
}; 