import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useEscolaConfig } from '@/contexts/EscolaConfigContext';
import {
  Home,
  CalendarCheck,
  FileText,
  Menu,
  ScanLine, // Ícone do Scanner
  Ticket    // Ícone do Ingresso
} from 'lucide-react';
import { cn } from '@/lib/utils';

export function MobileNav() {
  const { user } = useAuth();
  const { config } = useEscolaConfig();
  const location = useLocation();
  const [isStaff, setIsStaff] = useState(false);

  // Verifica se o usuário (aluno ou prof) é Staff de evento
  useEffect(() => {
    const checkMonitor = async () => {
      if (!user) return;

      let query = supabase.from('eventos_staff').select('id', { count: 'exact', head: true });

      if (user.aluno_id) {
        query = query.eq('aluno_id', user.aluno_id);
      } else {
        query = query.eq('user_id', user.id);
      }

      const { count } = await query;
      if (count && count > 0) setIsStaff(true);
    };
    checkMonitor();
  }, [user]);

  // Se não for aluno nem staff, e estiver em desktop, não mostra nada (o Sidebar cuida)
  // Mas no mobile, sempre mostra para navegação rápida

  const isActive = (path: string) => location.pathname === path;
  const activeColor = config?.cor_primaria || '#7c3aed';

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 px-4 py-2 z-50 md:hidden flex justify-around items-center h-16 shadow-[0_-2px_10px_rgba(0,0,0,0.05)]">

      {/* 1. Home / Dashboard */}
      <Link to={user?.type === 'aluno' ? '/portal-aluno' : '/dashboard'} className="flex flex-col items-center justify-center w-16">
        <Home
          size={24}
          color={isActive(user?.type === 'aluno' ? '/portal-aluno' : '/dashboard') ? activeColor : '#94a3b8'}
          strokeWidth={isActive(user?.type === 'aluno' ? '/portal-aluno' : '/dashboard') ? 2.5 : 2}
        />
        <span className={cn("text-[10px] mt-1 font-medium", isActive('/dashboard') ? "text-purple-600" : "text-slate-400")}>
          Início
        </span>
      </Link>

      {/* 2. Ingresso (Só para Alunos) */}
      {user?.type === 'aluno' && (
        <Link to="/aluno/ingresso" className="flex flex-col items-center justify-center w-16">
          <Ticket
            size={24}
            color={isActive('/aluno/ingresso') ? activeColor : '#94a3b8'}
          />
          <span className={cn("text-[10px] mt-1 font-medium", isActive('/aluno/ingresso') ? "text-purple-600" : "text-slate-400")}>
            Ingresso
          </span>
        </Link>
      )}

      {/* 3. Scanner (Só para Staff/Monitores) */}
      {isStaff && (
        <Link to="/evento/scanner" className="flex flex-col items-center justify-center w-16 -mt-6">
          <div className="bg-purple-600 rounded-full p-3 shadow-lg border-4 border-white">
            <ScanLine size={24} color="white" />
          </div>
          <span className="text-[10px] mt-1 font-bold text-purple-600">
            Scanner
          </span>
        </Link>
      )}

      {/* 4. Perfil / Outros (Exemplo) */}
      {/* Você pode adicionar mais itens aqui se precisar */}

    </nav>
  );
}