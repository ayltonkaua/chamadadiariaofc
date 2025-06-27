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
  const { user, refreshUserData } = useAuth();
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

      // Se o usuário tem escola_id, tentar buscar a configuração
      if (user.escola_id) {
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
            return;
          }
        } catch (err) {
          console.warn('Erro ao acessar banco de dados:', err);
        }
      }

      // Se chegou até aqui, usar configuração padrão
      console.log('Usando configuração padrão para usuário:', user.email);
      setConfig(defaultConfig);
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
      
      // Se não há usuário logado, não permitir atualização
      if (!user) {
        console.warn('Usuário não logado, não pode atualizar configurações');
        setError('Você precisa estar logado para atualizar as configurações');
        return false;
      }

      // Se o usuário não tem escola_id, criar uma nova escola usando a função RPC
      if (!user.escola_id) {
        try {
          // Chama a função RPC 'criar_escola_e_associar_admin' no Supabase
          const { data: newSchoolId, error } = await supabase.rpc('criar_escola_e_associar_admin', {
            nome_escola: updates.nome || 'Nova Escola',
            endereco_escola: updates.endereco || 'Endereço da escola',
            telefone_escola: updates.telefone || '(11) 1234-5678',
            email_escola: updates.email || 'contato@escola.com',
            url_logo_escola: updates.url_logo || null,
            cor_primaria_escola: updates.cor_primaria || '#7c3aed',
            cor_secundaria_escola: updates.cor_secundaria || '#f3f4f6'
          });

          if (error) {
            console.error('Erro ao chamar a função RPC:', error);
            setError(`Ocorreu um erro ao criar a escola: ${error.message}`);
            return false;
          }

          // Buscar os dados completos da escola criada para atualizar o contexto imediatamente
          const { data: escolaData, error: fetchError } = await supabase
            .from('escola_configuracao')
            .select('*')
            .eq('id', newSchoolId)
            .single();

          if (fetchError) {
            console.warn('Erro ao buscar dados da escola criada:', fetchError);
            setError('Escola criada, mas erro ao carregar dados. Recarregue a página.');
            return false;
          }

          if (escolaData) {
            setConfig(escolaData);
            console.log('Nova escola criada e configurada:', escolaData.nome);
          }

          // Agora sim, atualize o usuário para refletir o novo escola_id
          await refreshUserData();
          // E por fim, garanta que o contexto está sincronizado
          await refreshConfig();

          return true;
        } catch (err) {
          console.error('Exceção na criação da escola:', err);
          setError('Ocorreu um erro inesperado. Por favor, contate o suporte.');
          return false;
        }
      } else {
        // Usuário já tem escola_id, atualizar a escola existente
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
            console.log('Escola atualizada:', data.nome);
            await refreshConfig();
            return true;
          }
        } catch (err) {
          console.warn('Erro ao acessar banco para atualização:', err);
          setError('Erro ao conectar com o banco de dados');
          return false;
        }
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
    // Só busca se user existir (autenticado)
    if (user) {
      fetchConfig();
    } else {
      // Se deslogar, limpa o config
      setConfig(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

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