import React from 'react';
import Sidebar from './Sidebar';
import { MobileNav } from './MobileNav';
import { useAuth } from '@/contexts/AuthContext';
import { usePresence } from "@/hooks/usePresence";

interface LayoutProps {
  children: React.ReactNode;
  showSidebar?: boolean;
}

const Layout: React.FC<LayoutProps> = ({ children, showSidebar = true }) => {
  usePresence();
  const { user, loadingUser } = useAuth();

  // Lista de quem pode ver a Sidebar
  const authorizedTypes = ['admin', 'staff', 'professor', 'diretor', 'coordenador', 'secretario'];
  const shouldShowAdminSidebar = showSidebar && user && (authorizedTypes.includes(user.type) || authorizedTypes.includes(user.role || ''));

  // Barra mobile apenas para alunos
  const shouldShowMobileNav = !!user && user.type === 'aluno';

  if (loadingUser) {
    return (
      <div className="flex h-screen w-full items-center justify-center">
        <p className="text-slate-500 animate-pulse">Carregando sistema...</p>
      </div>
    );
  }

  // Layout com Sidebar (Equipe/Professores)
  if (shouldShowAdminSidebar) {
    // CORREÇÃO: Removemos a div envolvente. O Sidebar já é o layout completo.
    return (
      <Sidebar>
        {children}
      </Sidebar>
    );
  }

  // Layout Padrão (Aluno / Público)
  return (
    <div className={`min-h-screen bg-gray-50 ${shouldShowMobileNav ? 'pb-20 sm:pb-0' : ''}`}>
      <main className="h-full overflow-y-auto">
        {children}
      </main>
      {shouldShowMobileNav && <MobileNav />}
    </div>
  );
};

export default Layout;