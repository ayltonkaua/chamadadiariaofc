import React, { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { 
  Home, 
  Users, 
  Calendar, 
  Settings, 
  LogOut, 
  Menu, 
  X, 
  FileText, 
  BarChart3, 
  Bell, 
  AlertTriangle,
  ClipboardList,
  Plus,
  Search,
  UserCheck
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';

interface SidebarProps {
  children: React.ReactNode;
}

const Sidebar: React.FC<SidebarProps> = ({ children }) => {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);

  const handleSignOut = async () => {
    try {
      await logout();
      navigate('/login');
    } catch (error) {
      console.error('Erro ao fazer logout:', error);
    }
  };

  const menuItems = [
    {
      title: 'Dashboard',
      icon: Home,
      href: '/dashboard',
      description: 'Visão geral do sistema'
    },
    {
      title: 'Chamadas',
      icon: UserCheck,
      href: '/dashboard',
      description: 'Realizar chamadas',
      subItems: [
        { title: 'Fazer Chamada', href: '/dashboard', icon: Calendar },
        { title: 'Histórico', href: '/dashboard', icon: ClipboardList },
      ]
    },
    {
      title: 'Alunos',
      icon: Users,
      href: '/dashboard',
      description: 'Gerenciar alunos',
      subItems: [
        { title: 'Gerenciar Alunos', href: '/dashboard', icon: Users },
        { title: 'Consultar Faltas', href: '/consultar-faltas', icon: Search },
      ]
    },
    {
      title: 'Pesquisas',
      icon: FileText,
      href: '/pesquisas',
      description: 'Sistema de pesquisas',
      subItems: [
        { title: 'Minhas Pesquisas', href: '/pesquisas', icon: FileText },
        { title: 'Nova Pesquisa', href: '/pesquisas/nova', icon: Plus },
        { title: 'Responder Pesquisa', href: '/responder-pesquisa', icon: Search },
      ]
    },
    {
      title: 'Relatórios',
      icon: BarChart3,
      href: '/dashboard',
      description: 'Relatórios e estatísticas'
    },
    {
      title: 'Atestados',
      icon: ClipboardList,
      href: '/atestados',
      description: 'Gerenciar atestados'
    },
    {
      title: 'Alertas',
      icon: AlertTriangle,
      href: '/alertas',
      description: 'Sistema de alertas'
    },
    {
      title: 'Notificações',
      icon: Bell,
      href: '/notificacoes',
      description: 'Central de notificações'
    },
    {
      title: 'Configurações',
      icon: Settings,
      href: '/configuracoes',
      description: 'Configurações do sistema'
    },
  ];

  const isActive = (href: string) => {
    return location.pathname === href || location.pathname.startsWith(href + '/');
  };

  const SidebarContent = () => (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="p-4 border-b">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-purple-600 rounded-lg flex items-center justify-center">
            <Home className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="font-bold text-lg text-gray-900">Chamada Diária</h1>
            <p className="text-xs text-gray-500">Sistema de Gestão</p>
          </div>
        </div>
      </div>

      {/* User Info */}
      <div className="p-4 border-b bg-gray-50">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-purple-100 rounded-full flex items-center justify-center">
            <Users className="h-5 w-5 text-purple-600" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-gray-900 truncate">
              {user?.email || 'Usuário'}
            </p>
            <p className="text-xs text-gray-500">Professor</p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
        {menuItems.map((item) => (
          <div key={item.title}>
            <Link
              to={item.href}
              className={cn(
                "flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors",
                isActive(item.href)
                  ? "bg-purple-100 text-purple-700"
                  : "text-purple-700 hover:bg-purple-50"
              )}
              onClick={() => setIsOpen(false)}
            >
              <item.icon className="h-5 w-5" />
              <span>{item.title}</span>
            </Link>
            
            {/* Sub-items */}
            {item.subItems && (
              <div className="ml-8 mt-1 space-y-1">
                {item.subItems.map((subItem) => (
                  <Link
                    key={subItem.title}
                    to={subItem.href}
                    className={cn(
                      "flex items-center gap-2 px-3 py-1.5 rounded text-xs transition-colors",
                      isActive(subItem.href)
                        ? "bg-purple-50 text-purple-700"
                        : "text-purple-700 hover:bg-purple-50"
                    )}
                    onClick={() => setIsOpen(false)}
                  >
                    <subItem.icon className="h-4 w-4" />
                    <span>{subItem.title}</span>
                  </Link>
                ))}
              </div>
            )}
          </div>
        ))}
      </nav>

      {/* Footer */}
      <div className="p-4 border-t">
        <Button
          variant="ghost"
          onClick={handleSignOut}
          className="w-full justify-start text-red-600 hover:text-red-700 hover:bg-red-50"
        >
          <LogOut className="h-5 w-5 mr-3" />
          <span className="hidden lg:block">Sair</span>
        </Button>
      </div>
    </div>
  );

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Desktop Sidebar */}
      <div className="hidden md:flex md:w-64 md:flex-col">
        <div className="flex flex-col flex-grow bg-white border-r border-gray-200 shadow-sm">
          <SidebarContent />
        </div>
      </div>

      {/* Mobile Sidebar */}
      <Sheet open={isOpen} onOpenChange={setIsOpen}>
        <SheetTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="md:hidden fixed top-4 left-4 z-50 bg-white shadow-md border"
          >
            <Menu className="h-5 w-5" />
          </Button>
        </SheetTrigger>
        <SheetContent side="left" className="w-80 p-0">
          <SidebarContent />
        </SheetContent>
      </Sheet>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Mobile Header */}
        <div className="md:hidden bg-white border-b border-gray-200 p-4 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-purple-600 rounded-lg flex items-center justify-center">
              <Home className="h-5 w-5 text-white" />
            </div>
            <h1 className="font-bold text-lg text-gray-900">Chamada Diária</h1>
          </div>
        </div>

        {/* Page Content */}
        <main className="flex-1 overflow-y-auto bg-gray-50">
          {children}
        </main>
      </div>
    </div>
  );
};

export default Sidebar; 