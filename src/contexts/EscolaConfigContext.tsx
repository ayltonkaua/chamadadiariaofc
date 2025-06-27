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
      let data, error;
      if (user?.escola_id) {
        // Busca configuração da escola pelo id
        ({ data, error } = await supabase
          .from('escola_configuracao')
          .select('*')
          .eq('id', user.escola_id)
          .single());
      } else {
        // Busca configuração padrão (primeira do banco)
        ({ data, error } = await supabase
          .from('escola_configuracao')
          .select('*')
          .order('criado_em', { ascending: true })
          .limit(1)
          .single());
      }
      if (error) {
        throw error;
      }
      setConfig(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar configurações');
      setConfig(null);
      console.error('Erro ao buscar configurações da escola:', err);
    } finally {
      setLoading(false);
    }
  };

  const updateConfig = async (updates: Partial<EscolaConfig>): Promise<boolean> => {
    try {
      setError(null);
      if (!config?.id) throw new Error('Configuração da escola não encontrada');
      const { data, error } = await supabase
        .from('escola_configuracao')
        .update({
          ...updates,
          atualizado_em: new Date().toISOString()
        })
        .eq('id', config.id)
        .select()
        .single();
      if (error) {
        throw error;
      }
      setConfig(data);
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao atualizar configurações');
      console.error('Erro ao atualizar configurações da escola:', err);
      return false;
    }
  };

  const refreshConfig = async () => {
    await fetchConfig();
  };

  useEffect(() => {
    fetchConfig();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.escola_id]);

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