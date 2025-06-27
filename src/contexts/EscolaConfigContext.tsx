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
      
      // Se não há usuário logado, não permitir atualização
      if (!user) {
        console.warn('Usuário não logado, não pode atualizar configurações');
        setError('Você precisa estar logado para atualizar as configurações');
        return false;
      }

      // SEMPRE criar uma nova escola quando o usuário edita o perfil
      // Isso garante que cada usuário tenha sua própria escola
      try {
        // Criar nova escola
        const { data: newEscola, error: insertError } = await supabase
          .from('escola_configuracao')
          .insert({
            nome: updates.nome || 'Nova Escola',
            endereco: updates.endereco || 'Endereço da escola',
            telefone: updates.telefone || '(11) 1234-5678',
            email: updates.email || 'contato@escola.com',
            cor_primaria: updates.cor_primaria || '#7c3aed',
            cor_secundaria: updates.cor_secundaria || '#f3f4f6',
            url_logo: updates.url_logo || null,
          })
          .select()
          .single();

        if (insertError) {
          console.warn('Erro ao criar nova escola:', insertError);
          setError('Erro ao criar nova escola no banco de dados');
          return false;
        }

        if (newEscola) {
          // Se o usuário já tem um role, atualizar para a nova escola
          if (user.escola_id) {
            const { error: updateRoleError } = await supabase
              .from('user_roles')
              .update({ escola_id: newEscola.id })
              .eq('user_id', user.id);

            if (updateRoleError) {
              console.warn('Erro ao atualizar role do usuário:', updateRoleError);
            }
          } else {
            // Criar novo registro na tabela user_roles para o usuário
            const { error: roleError } = await supabase
              .from('user_roles')
              .insert({
                user_id: user.id,
                escola_id: newEscola.id,
                role: 'admin' // Usuário que cria a escola é admin
              });

            if (roleError) {
              console.warn('Erro ao criar role do usuário:', roleError);
            }
          }

          setConfig(newEscola);
          console.log('Nova escola criada:', newEscola.nome);
          
          // Atualizar o contexto de autenticação para refletir a nova escola_id
          // Isso pode requerer um refresh da página ou atualização do contexto
          window.location.reload();
          
          return true;
        }
      } catch (err) {
        console.warn('Erro ao criar nova escola:', err);
        setError('Erro ao criar nova escola');
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