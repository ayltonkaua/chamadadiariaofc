import React from 'react';
import Sidebar from './Sidebar';
import { MobileNav } from './MobileNav'; // Certifique-se que o caminho está correto
import { useAuth } from '@/contexts/AuthContext';

interface LayoutProps {
  children: React.ReactNode;
  showSidebar?: boolean;
}

const Layout: React.FC<LayoutProps> = ({ children, showSidebar = true }) => {
  const { user, loadingUser } = useAuth();

  // 1. Lógica para Sidebar de Admin
  const shouldShowAdminSidebar = showSidebar && user?.type === 'admin';

  // 2. CORREÇÃO DO BUG:
  // A barra mobile só aparece se:
  // - O usuário EXISTIR (estiver logado)
  // - E o tipo for 'aluno' (ou 'indefinido', se preferir)
  // Isso evita que ela apareça na tela de Login (onde user é null)
  const shouldShowMobileNav = !!user && user.type === 'aluno';

  if (loadingUser) {
    return (
      <div className="flex h-screen w-full items-center justify-center">
        <p>Carregando...</p>
      </div>
    );
  }

  // Layout do Admin (Desktop/Mobile com Sidebar)
  if (shouldShowAdminSidebar) {
    return (
      <div className="flex h-screen">
        <Sidebar>
          <main className="flex-1 overflow-y-auto">{children}</main>
        </Sidebar>
      </div>
    );
  }

  // Layout Padrão (Aluno / Público)
  return (
    // Adicionamos 'pb-20' apenas se a MobileNav for exibida, para o conteúdo não ficar escondido atrás dela
    <div className={`min-h-screen bg-gray-50 ${shouldShowMobileNav ? 'pb-20 sm:pb-0' : ''}`}>
      <main className="h-full overflow-y-auto">
        {children}
      </main>
      
      {/* Renderização Condicional Corrigida */}
      {shouldShowMobileNav && <MobileNav />}
    </div>
  );
};

export default Layout;