import React, { createContext, useState, useContext, ReactNode, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Tables } from "@/integrations/supabase/types";

// Tipos
interface User {
  id: string;
  username: string;
  email: string;
  escola_id?: string;
  role?: string;
}

interface AuthContextType {
  user: User | null;
  login: (email: string, password: string) => Promise<boolean>;
  logout: () => void;
  register: (username: string, email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  isAuthenticated: boolean;
  refreshUserData: () => Promise<void>;
}

// Cria contexto
const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  // Função para buscar dados do usuário da tabela user_roles
  const fetchUserData = async (userId: string): Promise<{ escola_id?: string; role?: string }> => {
    try {
      const { data, error } = await supabase
        .from('user_roles')
        .select('escola_id, role')
        .eq('user_id', userId)
        .limit(1) // Garante que no máximo 1 linha será retornada
        .maybeSingle(); // Retorna a linha ou null, sem causar erro

      if (error) {
        console.warn('Erro ao buscar dados do usuário:', error);
        return {};
      }

      if (data) {
        return {
          escola_id: data.escola_id,
          role: data.role
        };
      }

      return {};
    } catch (err) {
      console.warn('Erro ao acessar tabela user_roles:', err);
      return {};
    }
  };

  // Cadastro
  const register = async (username: string, email: string, password: string): Promise<{ success: boolean; error?: string }> => {
    // Cria usuário no Supabase Auth
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { username } },
    });
    if (error) {
      // Responde erro amigável se usuário já existe ou outro
      let errorMsg = error.message;
      if (error.message.includes("User already registered")) {
        errorMsg = "E-mail já cadastrado.";
      }
      return { success: false, error: errorMsg };
    }
    // Supabase envia e-mail de verificação, usuário ainda não logado
    return { success: true };
  };

  // Login por e-mail e senha
  const login = async (email: string, password: string): Promise<boolean> => {
    const { data: sessionData, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error || !sessionData.user) {
      return false;
    }

    // Extrai username dos metadados do usuário
    const username = sessionData.user.user_metadata?.username || "";
    
    // Busca escola_id e role da tabela user_roles
    const userData = await fetchUserData(sessionData.user.id);

    setUser({
      id: sessionData.user.id,
      username,
      email: sessionData.user.email || "",
      escola_id: userData.escola_id,
      role: userData.role,
    });
    setIsAuthenticated(true);
    return true;
  };

  const logout = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setIsAuthenticated(false);
  };

  // Mantém sessão ativa ao recarregar página
  useEffect(() => {
    const getSession = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        // Extrai username dos metadados do usuário
        const username = user.user_metadata?.username || "";
        
        // Busca escola_id e role da tabela user_roles
        const userData = await fetchUserData(user.id);

        setUser({
          id: user.id,
          username,
          email: user.email || "",
          escola_id: userData.escola_id,
          role: userData.role,
        });
        setIsAuthenticated(true);
      } else {
        setUser(null);
        setIsAuthenticated(false);
      }
    };
    getSession();
  }, []);

  const refreshUserData = async () => {
    if (!user) return;
    
    try {
      // Busca escola_id e role da tabela user_roles
      const userData = await fetchUserData(user.id);

      setUser({
        id: user.id,
        username: user.username,
        email: user.email,
        escola_id: userData.escola_id,
        role: userData.role,
      });
    } catch (error) {
      console.error('Erro ao atualizar dados do usuário:', error);
    }
  };

  return (
    <AuthContext.Provider value={{ user, login, logout, register, isAuthenticated, refreshUserData }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth deve ser usado dentro de um AuthProvider");
  }
  return context;
};