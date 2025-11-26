import React, { createContext, useState, useContext, ReactNode, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

// Tipos
type UserType = 'admin' | 'aluno' | 'indefinido';

interface User {
  id: string;
  username: string;
  email: string;
  escola_id?: string;
  role?: string;
  type: UserType;
  aluno_id?: string;
}

interface AuthContextType {
  user: User | null;
  loadingUser: boolean;
  login: (email: string, password: string) => Promise<User | null>;
  logout: () => void;
  register: (username: string, email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  isAuthenticated: boolean;
  refreshUserData: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loadingUser, setLoadingUser] = useState(true);

  const loadUserSession = async (sessionUser: any): Promise<User | null> => {
    try {
      console.log("Carregando sessão para:", sessionUser.email);

      // 1. Tenta carregar como ALUNO
      const { data: alunoData, error: alunoError } = await supabase
        .from('alunos')
        .select('id, nome, turmas(escola_id)')
        .eq('user_id', sessionUser.id)
        .maybeSingle();

      if (alunoData) {
        // Correção Robusta: Garante que pega o escola_id seja objeto ou array
        let escolaIdFound = undefined;
        const turmasAny = alunoData.turmas as any;

        if (turmasAny) {
          if (Array.isArray(turmasAny) && turmasAny.length > 0) {
            escolaIdFound = turmasAny[0]?.escola_id;
          } else if (typeof turmasAny === 'object') {
            escolaIdFound = turmasAny.escola_id;
          }
        }

        console.log("Aluno detectado. Escola ID:", escolaIdFound);

        const alunoUser: User = {
          id: sessionUser.id,
          username: alunoData.nome,
          email: sessionUser.email || "",
          escola_id: escolaIdFound,
          type: 'aluno',
          aluno_id: alunoData.id,
        };
        setUser(alunoUser);
        return alunoUser;
      }

      // 2. Tenta carregar como STAFF (Admin/Prof)
      const { data: roleData } = await supabase
        .from('user_roles')
        .select('escola_id, role')
        .eq('user_id', sessionUser.id)
        .maybeSingle();

      if (roleData) {
        console.log("Staff detectado. Escola ID:", roleData.escola_id);
        const adminUser: User = {
          id: sessionUser.id,
          username: sessionUser.user_metadata?.username || "",
          email: sessionUser.email || "",
          escola_id: roleData.escola_id,
          role: roleData.role,
          type: 'admin',
        };
        setUser(adminUser);
        return adminUser;
      }

      // 3. Usuário sem vínculo
      console.log("Usuário sem vínculo detectado.");
      const unlinkedUser: User = {
        id: sessionUser.id,
        username: sessionUser.user_metadata?.username || "Usuário",
        email: sessionUser.email || "",
        type: 'indefinido',
      };
      setUser(unlinkedUser);
      return unlinkedUser;

    } catch (error) {
      console.error("Erro ao carregar sessão:", error);
      setUser(null);
      return null;
    }
  };

  const register = async (username: string, email: string, password: string): Promise<{ success: boolean; error?: string }> => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { username },
      },
    });

    if (error) {
      let errorMsg = error.message;
      if (error.message.includes("User already registered")) errorMsg = "E-mail já cadastrado.";
      return { success: false, error: errorMsg };
    }

    return { success: true };
  };

  const login = async (email: string, password: string): Promise<User | null> => {
    const { data: sessionData, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error || !sessionData.user) return null;
    return await loadUserSession(sessionData.user);
  };

  const logout = async () => {
    await supabase.auth.signOut();
    setUser(null);
  };

  const refreshUserData = async () => {
    const { data: { user: sessionUser } } = await supabase.auth.getUser();
    if (sessionUser) {
      await loadUserSession(sessionUser);
    }
  };

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

    const { data: authListener } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (session?.user) {
        setTimeout(() => loadUserSession(session.user), 100);
      } else {
        setUser(null);
        setLoadingUser(false);
      }
    });

    return () => {
      authListener?.subscription.unsubscribe();
    };
  }, []);

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