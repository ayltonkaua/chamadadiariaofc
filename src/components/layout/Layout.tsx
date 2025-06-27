import React from 'react';
import { useAuth } from '@/contexts/AuthContext';
import Sidebar from './Sidebar';

interface LayoutProps {
  children: React.ReactNode;
  showSidebar?: boolean;
}

const Layout: React.FC<LayoutProps> = ({ children, showSidebar = true }) => {
  const { isAuthenticated } = useAuth();

  // Se não estiver autenticado ou não deve mostrar sidebar, renderiza apenas o conteúdo
  if (!isAuthenticated || !showSidebar) {
    return <div className="min-h-screen bg-gray-50">{children}</div>;
  }

  // Se estiver autenticado e deve mostrar sidebar, usa o layout com sidebar
  return <Sidebar>{children}</Sidebar>;
};

export default Layout; 