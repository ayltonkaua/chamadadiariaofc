import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./AuthContext";
import { Tables, TablesInsert } from "@/integrations/supabase/types";
import { toast } from "@/hooks/use-toast";

type EscolaConfig = Omit<Tables<'escola_configuracao'>, "id" | "criado_em" | "atualizado_em">;

// CORREÇÃO DEFINITIVA: O nome da propriedade aqui deve ser 'url_logo'.
const defaultConfig: EscolaConfig = {
  nome: "",
  endereco: null,
  email: "",
  telefone: null,
  url_logo: null, 
  cor_primaria: "#6D28D9",
  cor_secundaria: "#2563EB",
};

interface EscolaConfigContextType {
  config: EscolaConfig;
  loading: boolean;
  saveConfig: (newConfig: EscolaConfig) => Promise<void>;
  refreshConfig: () => Promise<void>;
}

const EscolaConfigContext = createContext<EscolaConfigContextType | undefined>(undefined);

export const EscolaConfigProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [config, setConfig] = useState<EscolaConfig>(defaultConfig);
  const [loading, setLoading] = useState(true);
  const { user, refreshUserData, loadingUser } = useAuth();

  const fetchConfig = useCallback(async () => {
    if (!user?.escola_id) {
      setConfig(defaultConfig);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      // CORREÇÃO DEFINITIVA: Selecionando 'url_logo' do banco.
      const { data, error } = await supabase
        .from("escola_configuracao")
        .select("nome, endereco, email, telefone, url_logo, cor_primaria, cor_secundaria")
        .eq("id", user.escola_id)
        .single();

      if (error) throw error;
      if (data) setConfig(data);
    } catch (error) {
      console.error("Erro ao buscar configuração da escola:", error);
      setConfig(defaultConfig);
    } finally {
      setLoading(false);
    }
  }, [user?.escola_id]);

  useEffect(() => {
    if (!loadingUser) {
        fetchConfig();
    }
  }, [user?.escola_id, loadingUser, fetchConfig]);

  const saveConfig = async (newConfig: EscolaConfig) => {
    if (!user) {
      toast({ title: "Erro", description: "Usuário não autenticado.", variant: "destructive" });
      return;
    }
    setLoading(true);

    try {
      if (user.escola_id) {
        const { error } = await supabase
          .from("escola_configuracao")
          .update(newConfig)
          .eq("id", user.escola_id);

        if (error) throw error;
        toast({ title: "Sucesso!", description: "Configurações da escola atualizadas." });

      } else {
        const { error } = await supabase.rpc('criar_escola_e_associar_admin', {
            config_data: newConfig as unknown as TablesInsert<'escola_configuracao'>
        });

        if (error) throw error;

        toast({ title: "Escola Criada!", description: "O perfil da sua escola foi criado com sucesso." });
        await refreshUserData();
      }

      await fetchConfig();

    } catch (error: any) {
      console.error("Erro ao salvar configuração:", error);
      toast({ title: "Erro", description: error.message || "Não foi possível salvar as configurações.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <EscolaConfigContext.Provider value={{ config, loading, saveConfig, refreshConfig: fetchConfig }}>
      {children}
    </EscolaConfigContext.Provider>
  );
};

export const useEscolaConfig = (): EscolaConfigContextType => {
  const context = useContext(EscolaConfigContext);
  if (!context) {
    throw new Error("useEscolaConfig deve ser usado dentro de um EscolaConfigProvider");
  }
  return context;
};