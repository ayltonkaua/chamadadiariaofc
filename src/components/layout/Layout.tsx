import React from 'react';
import Sidebar from './Sidebar';
import { MobileNav } from './MobileNav'; // Importe o componente criado
import { useAuth } from '@/contexts/AuthContext';

interface LayoutProps {
  children: React.ReactNode;
  showSidebar?: boolean;
}

const Layout: React.FC<LayoutProps> = ({ children, showSidebar = true }) => {
  const { user, loadingUser } = useAuth();

  const isAdmin = user?.type === 'admin';
  const isStudent = user?.type === 'aluno' || !isAdmin; // Assume aluno se não for admin explícito

  if (loadingUser) {
    return <div className="flex h-screen w-full items-center justify-center">Carregando...</div>;
  }

  // Layout do ADMIN (Com Sidebar lateral)
  if (isAdmin && showSidebar) {
    return (
      <div className="flex h-screen">
        <Sidebar>
          <main className="flex-1 overflow-y-auto">{children}</main>
        </Sidebar>
      </div>
    );
  }

  // Layout do ALUNO (Com Mobile Nav no celular)
  return (
    <div className="min-h-screen bg-gray-50 pb-20 sm:pb-0"> {/* Padding bottom para não esconder conteúdo atrás da nav */}
      <main className="h-full overflow-y-auto">
        {children}
      </main>
      
      {/* A barra só aparece se for aluno e em telas pequenas (controlado via CSS no componente) */}
      {isStudent && <MobileNav />}
    </div>
  );
};

export default Layout;