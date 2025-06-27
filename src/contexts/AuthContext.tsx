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
  loadingUser: boolean; // NOVO: Estado para controlar o carregamento completo do usuário
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
  const [loadingUser, setLoadingUser] = useState(true); // NOVO: Inicia como true

  // Função para buscar dados do usuário da tabela user_roles
  const fetchUserData = async (userId: string): Promise<{ escola_id?: string; role?: string }> => {
    try {
      const { data, error } = await supabase
        .from('user_roles')
        .select('escola_id, role')
        .eq('user_id', userId)
        .limit(1)
        .maybeSingle();

      if (error) {
        console.warn('Erro ao buscar dados do usuário (role/escola):', error);
        return {};
      }
      return data || {};
    } catch (err) {
      console.warn('Exceção ao buscar dados do usuário:', err);
      return {};
    }
  };

  const loadUserSession = async (sessionUser: any) => {
    const username = sessionUser.user_metadata?.username || "";
    const userData = await fetchUserData(sessionUser.id);

    setUser({
      id: sessionUser.id,
      username,
      email: sessionUser.email || "",
      escola_id: userData.escola_id,
      role: userData.role,
    });
  };

  // Cadastro
  const register = async (username: string, email: string, password: string): Promise<{ success: boolean; error?: string }> => {
    // ... (função register permanece igual)
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { username } },
    });
    if (error) {
      let errorMsg = error.message.includes("User already registered")
        ? "E-mail já cadastrado."
        : error.message;
      return { success: false, error: errorMsg };
    }
    return { success: true };
  };

  // Login por e-mail e senha
  const login = async (email: string, password: string): Promise<boolean> => {
    const { data: sessionData, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error || !sessionData.user) return false;
    
    // CORREÇÃO: Carrega todos os dados do usuário antes de finalizar
    await loadUserSession(sessionData.user);
    return true;
  };

  const logout = async () => {
    await supabase.auth.signOut();
    setUser(null);
  };

  // Mantém sessão ativa ao recarregar página
  useEffect(() => {
    const getSession = async () => {
      setLoadingUser(true);
      const { data: { session } } = await supabase.auth.getSession();
      
      if (session?.user) {
        await loadUserSession(session.user);
      } else {
        setUser(null);
      }
      setLoadingUser(false);
    };
    
    getSession();

    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        loadUserSession(session.user);
      } else {
        setUser(null);
      }
    });

    return () => {
      authListener?.subscription.unsubscribe();
    };
  }, []);

  const refreshUserData = async () => {
    if (!user) return;
    await loadUserSession(user);
  };
  
  // O isAuthenticated agora é derivado diretamente da existência do objeto user
  const isAuthenticated = !!user;

  return (
    <AuthContext.Provider value={{ user, loadingUser, login, logout, register, isAuthenticated, refreshUserData }}>
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