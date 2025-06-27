import React, { createContext, useState, useContext, ReactNode, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

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
}

// Cria contexto
const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

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

    // Extrai username e escola_id dos metadados do usuário
    const username = sessionData.user.user_metadata?.username || "";
    const escola_id = sessionData.user.user_metadata?.escola_id || undefined;

    setUser({
      id: sessionData.user.id,
      username,
      email: sessionData.user.email || "",
      escola_id,
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
        setUser({
          id: user.id,
          username: user.user_metadata?.username || "",
          email: user.email || "",
          escola_id: user.user_metadata?.escola_id || undefined,
        });
        setIsAuthenticated(true);
      } else {
        setUser(null);
        setIsAuthenticated(false);
      }
    };
    getSession();
  }, []);

  return (
    <AuthContext.Provider value={{ user, login, logout, register, isAuthenticated }}>
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
