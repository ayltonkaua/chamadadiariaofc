import React, { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useEscolaConfig } from '@/contexts/EscolaConfigContext';
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
  UserCheck,
  LineChart // Ícone modificado/adicionado
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';

interface SidebarProps {
  children: React.ReactNode;
}

const Sidebar: React.FC<SidebarProps> = ({ children }) => {
  const { user, logout } = useAuth();
  const { config } = useEscolaConfig();
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
      title: 'Página Inicial',
      icon: Home,
      href: '/dashboard',
      description: 'Visão geral do sistema'
    },
    {
      title: 'Chamadas',
      icon: UserCheck,
      href: '/dashboard', // Manter o href principal para o grupo
      description: 'Realizar chamadas',
      subItems: [
        { title: 'Fazer Chamada', href: '/dashboard', icon: Calendar },
        { title: 'Histórico', href: '/dashboard', icon: ClipboardList },
      ]
    },
    {
      title: 'Alunos',
      icon: Users,
      href: '/dashboard', // Manter o href principal para o grupo
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
      title: 'Relatórios de Gestão',
      icon: LineChart, 
      href: '/gestor/dashboard',
      description: 'Visão estratégica para gestores',
      roles: ['admin', 'diretor'] 
    },
    {
      title: 'Atestados',
      icon: ClipboardList,
      href: '/atestados',
      description: 'Gerenciar atestados'
    },
    {
      title: 'Notificações',
      icon: Bell,
      href: '/notificacoes',
      description: 'Central de notificações',
      roles: ['admin', 'diretor'] // Exemplo de permissão
    },
    {
      title: 'Perfil da Escola',
      icon: Settings,
      href: '/perfil-escola',
      description: 'Informações da escola',
      roles: ['admin'] // Exemplo de permissão
    },
  ];

  const isActive = (href: string) => {
    if (href === '/dashboard') {
        return location.pathname === href;
    }
    return location.pathname.startsWith(href);
  };

  const getDynamicClasses = (isActive: boolean) => {
    const primaryColor = config?.cor_primaria || '#7c3aed';
    
    if (isActive) {
      return {
        backgroundColor: `${primaryColor}20`,
        color: primaryColor,
        borderColor: primaryColor
      };
    }
    
    return {
      color: 'inherit', // Cor padrão do texto para itens não ativos
      '&:hover': {
        backgroundColor: `${primaryColor}10`
      }
    };
  };

  const SidebarContent = () => (
    <div className="flex flex-col h-full">
      <div
        className="p-4 border-b"
        style={{ backgroundColor: config?.cor_secundaria || '#f3f4f6' }}
      >
        <div className="flex items-center gap-3">
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center"
            style={{ backgroundColor: config?.cor_primaria || '#7c3aed' }}
          >
            {config?.url_logo ? (
              <img
                src={config.url_logo}
                alt="Logo da escola"
                className="h-5 w-5 object-contain"
              />
            ) : (
              <Home className="h-5 w-5 text-white" />
            )}
          </div>
          <div>
            <h1
              className="font-bold text-lg"
              style={{ color: config?.cor_primaria || '#7c3aed' }}
            >
              {config?.nome || 'Chamada Diária'}
            </h1>
            <p className="text-xs text-gray-500">Sistema de Gestão</p>
          </div>
        </div>
      </div>

      <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
        {/* ===== LÓGICA DE FILTRAGEM ADICIONADA ===== */}
        {menuItems
          .filter(item => !item.roles || item.roles.includes(user?.role || ''))
          .map((item) => (
            <div key={item.title}>
              <Link
                to={item.href}
                className={cn(
                  "flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors text-gray-700"
                )}
                style={getDynamicClasses(isActive(item.href))}
                onClick={() => setIsOpen(false)}
              >
                <item.icon className="h-5 w-5" />
                <span>{item.title}</span>
              </Link>
              
              {item.subItems && (
                <div className="ml-8 mt-1 space-y-1">
                  {item.subItems.map((subItem) => (
                    <Link
                      key={subItem.title}
                      to={subItem.href}
                      className={cn(
                        "flex items-center gap-2 px-3 py-1.5 rounded text-xs transition-colors text-gray-600"
                      )}
                      style={getDynamicClasses(isActive(subItem.href))}
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
      <div className="hidden md:flex md:w-64 md:flex-col">
        <div className="flex flex-col flex-grow bg-white border-r border-gray-200 shadow-sm">
          <SidebarContent />
        </div>
      </div>

      <Sheet open={isOpen} onOpenChange={setIsOpen}>
        <SheetTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="md:hidden fixed top-4 left-4 z-50 bg-white"
          >
            <Menu className="h-5 w-5" />
          </Button>
        </SheetTrigger>
        <SheetContent side="left" className="w-80 p-0 bg-white">
          <SidebarContent />
        </SheetContent>
      </Sheet>

      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="md:hidden bg-white border-b border-gray-200 p-4">
          <div className="flex items-center justify-center">
            <h1 className="font-bold text-lg text-purple-700 text-center">Chamada Diária</h1>
          </div>
        </div>

        <main className="flex-1 overflow-y-auto bg-gray-50">
          {children}
        </main>
      </div>
    </div>
  );
};

export default Sidebar;