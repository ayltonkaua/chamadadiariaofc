import React, { createContext, useState, useContext, ReactNode, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { clearAllOfflineData } from "@/lib/offlineStorage";

// CORREÇÃO 1: Adicionar 'professor' na lista de tipos permitidos
type UserType = 'admin' | 'aluno' | 'staff' | 'professor' | 'indefinido';

interface User {
  id: string;
  username: string;
  email: string;
  escola_id?: string;
  role?: string;
  type: UserType;
  aluno_id?: string;
  mustChangePassword?: boolean;
}

interface AuthContextType {
  user: User | null;
  setUser: React.Dispatch<React.SetStateAction<User | null>>;
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
      console.log("Auth: Carregando...", sessionUser.email);

      // A. TENTA COMO ALUNO
      const { data: alunoData } = await supabase
        .from('alunos')
        .select('id, nome, turmas!inner(escola_id)')
        .eq('user_id', sessionUser.id)
        .maybeSingle();

      if (alunoData) {
        let escolaIdFound = undefined;
        const turmasAny = alunoData.turmas as any;
        if (turmasAny) {
          if (Array.isArray(turmasAny) && turmasAny.length > 0) {
            escolaIdFound = turmasAny[0]?.escola_id;
          } else if (typeof turmasAny === 'object') {
            escolaIdFound = turmasAny.escola_id;
          }
        }

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

      // B. TENTA COMO EQUIPE (User Roles)
      const { data: roleData } = await supabase
        .from('user_roles')
        .select('escola_id, role')
        .eq('user_id', sessionUser.id)
        .maybeSingle();

      if (roleData) {
        const userRole = roleData.role;
        // 2. LÓGICA DE SEPARAÇÃO IMPORTANTE
        const userType: UserType = userRole === 'professor' ? 'professor' : 'staff';

        console.log(`Auth: Papel identificado: ${userRole} -> Tipo: ${userType}`);

        const memberUser: User = {
          id: sessionUser.id,
          username: sessionUser.user_metadata?.username || "",
          email: sessionUser.email || "",
          escola_id: roleData.escola_id,
          role: userRole,
          type: userType, // Aqui garantimos que professor não é staff genérico
          mustChangePassword: sessionUser.user_metadata?.must_change_password === true,
        };
        setUser(memberUser);
        return memberUser;
      }

      // C. SEM VÍNCULO
      const unlinkedUser: User = {
        id: sessionUser.id,
        username: sessionUser.user_metadata?.username || "Usuário",
        email: sessionUser.email || "",
        type: 'indefinido',
      };
      setUser(unlinkedUser);
      return unlinkedUser;

    } catch (error) {
      console.error("Auth Error:", error);
      setUser(null);
      return null;
    }
  };

  // ... (Funções login, register, logout mantêm-se iguais)
  const register = async (username: string, email: string, password: string) => {
    const { error } = await supabase.auth.signUp({
      email, password, options: { data: { username } },
    });
    if (error) return { success: false, error: error.message };
    return { success: true };
  };

  const login = async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      if (error.status === 429 || error.message?.toLowerCase().includes('rate limit') || error.message?.toLowerCase().includes('too many')) {
        throw new Error('Muitas tentativas de login. Aguarde alguns instantes antes de tentar novamente.');
      }
      return null;
    }
    if (!data.user) return null;
    return await loadUserSession(data.user);
  };

  const logout = async () => {
    await clearAllOfflineData(); // Clear all IndexedDB data on logout
    await supabase.auth.signOut();
    setUser(null);
  };

  const refreshUserData = async () => {
    const { data } = await supabase.auth.getUser();
    if (data.user) await loadUserSession(data.user);
  };

  useEffect(() => {
    const init = async () => {
      setLoadingUser(true);
      const { data } = await supabase.auth.getSession();
      if (data.session?.user) await loadUserSession(data.session.user);
      else setUser(null);
      setLoadingUser(false);
    };
    init();

    const { data: sub } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (session?.user) setTimeout(() => loadUserSession(session.user), 100);
      else { setUser(null); setLoadingUser(false); }
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  return (
    <AuthContext.Provider value={{ user, setUser, loadingUser, login, logout, register, isAuthenticated: !!user, refreshUserData }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (context === undefined) throw new Error("useAuth deve ser usado dentro de um AuthProvider");
  return context;
};