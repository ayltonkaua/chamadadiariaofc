import React from 'react';
import Sidebar from './Sidebar';
import { useAuth } from '@/contexts/AuthContext';

interface LayoutProps {
  children: React.ReactNode;
  showSidebar?: boolean; // Esta prop continua útil para forçar a ocultação em páginas públicas
}

const Layout: React.FC<LayoutProps> = ({ children, showSidebar = true }) => {
  const { user, loadingUser } = useAuth();

  // Condição para mostrar o Sidebar de Admin:
  // 1. A prop showSidebar não deve ser false.
  // 2. O usuário deve estar logado.
  // 3. O tipo do usuário deve ser 'admin'.
  const shouldShowAdminSidebar = showSidebar && user && user.type === 'admin';

  // Enquanto o contexto de autenticação está carregando, mostre um loader para evitar
  // que o layout errado pisque na tela.
  if (loadingUser) {
    return (
      <div className="flex h-screen w-full items-center justify-center">
        {/* Você pode colocar um componente de Spinner aqui */}
        <p>Carregando...</p>
      </div>
    );
  }

  // Se for um admin, renderiza o layout com o Sidebar
  if (shouldShowAdminSidebar) {
    return (
      <div className="flex h-screen">
        <Sidebar>
          <main className="flex-1 overflow-y-auto">{children}</main>
        </Sidebar>
      </div>
    );
  }

  // Para alunos, usuários não logados ou páginas públicas, renderiza apenas o conteúdo
  return (
    <div className="h-screen">
      <main className="h-full overflow-y-auto">{children}</main>
    </div>
  );
};

export default Layout;