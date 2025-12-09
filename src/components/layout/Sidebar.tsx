import React, { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useEscolaConfig } from '@/contexts/EscolaConfigContext';
import { supabase } from '@/integrations/supabase/client'; // Importação do Supabase
import { Button } from '@/components/ui/button';
import {
  Home,
  Users,
  Calendar,
  Settings,
  LogOut,
  Menu,
  FileText,
  Bell,
  ClipboardList,
  Plus,
  Search,
  UserCheck,
  LineChart,
  Shield,
  BookOpen, // <--- ADICIONADO (Causava o erro)
  PartyPopper, // <--- ADICIONADO (Para Eventos)
  ScanLine,    // <--- ADICIONADO (Para Scanner)
  Ticket       // <--- ADICIONADO (Para Ingresso)
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
  const [isEventStaff, setIsEventStaff] = useState(false);

  // Verifica se o usuário é Staff de Eventos
  useEffect(() => {
    const checkStaff = async () => {
      if (!user) return;

      // Se for user normal (admin/prof)
      let query = supabase.from('eventos_staff').select('id').eq('user_id', user.id);

      // Se for aluno logado
      if (user.type === 'aluno' && user.aluno_id) {
        query = supabase.from('eventos_staff').select('id').eq('aluno_id', user.aluno_id);
      }

      const { data } = await query;
      if (data && data.length > 0) setIsEventStaff(true);
    };
    checkStaff();
  }, [user]);

  const handleSignOut = async () => {
    try {
      await logout();
      navigate('/login');
    } catch (error) {
      console.error('Erro ao fazer logout:', error);
    }
  };

  // --- MENU PADRÃO ---
  const menuItems = [
    { title: 'Página Inicial', icon: Home, href: '/dashboard', description: 'Visão geral' },
    {
      title: 'Chamadas', icon: UserCheck, href: '/dashboard',
      subItems: [
        { title: 'Fazer Chamada', href: '/dashboard', icon: Calendar },
        { title: 'Histórico', href: '/dashboard', icon: ClipboardList },
      ]
    },
    {
      title: 'Alunos', icon: Users, href: '/dashboard',
      subItems: [
        { title: 'Gerenciar Alunos', href: '/dashboard', icon: Users },
        { title: 'Consultar Faltas', href: '/consultar-faltas', icon: Search },
      ]
    },
    { title: 'Disciplinas', icon: BookOpen, href: '/disciplinas', description: 'Grade' },
    {
      title: 'Pesquisas', icon: FileText, href: '/pesquisas',
      subItems: [
        { title: 'Minhas Pesquisas', href: '/pesquisas', icon: FileText },
        { title: 'Nova Pesquisa', href: '/pesquisas/nova', icon: Plus },
        { title: 'Responder Pesquisa', href: '/responder-pesquisa', icon: Search },
      ]
    },
    { title: 'Relatórios', icon: LineChart, href: '/gestor/dashboard', roles: ['admin', 'diretor'] },
    { title: 'Atestados', icon: ClipboardList, href: '/atestados' },
    { title: 'Notificações', icon: Bell, href: '/notificacoes', roles: ['admin', 'diretor'] },
    { title: 'Perfil da Escola', icon: Settings, href: '/perfil-escola', roles: ['admin'] },
    { title: 'Acessos', icon: Shield, href: '/gestao-acesso', roles: ['admin'] },
  ];

  // --- INJEÇÃO DE ITENS DE EVENTO ---

  // 1. Scanner (Para Staff ou Admin)
  if (isEventStaff || user?.role === 'admin' || user?.role === 'diretor') {
    menuItems.push({
      title: 'Controlar Acesso',
      href: '/evento/scanner',
      icon: ScanLine
    });
  }

  // 2. Gestão de Eventos (Para Admin/Diretor)
  if (user?.role === 'admin' || user?.role === 'diretor') {
    menuItems.push({
      title: 'Gestão de Eventos',
      href: '/gestor/eventos',
      icon: PartyPopper
    });
  }

  // 3. Ingresso (Para Aluno)
  if (user?.type === 'aluno') {
    menuItems.push({
      title: 'Meus Ingressos',
      href: '/aluno/ingresso',
      icon: Ticket
    });
  }

  const isActive = (href: string) => {
    if (href === '/dashboard') return location.pathname === href;
    return location.pathname.startsWith(href);
  };

  const getDynamicClasses = (active: boolean) => {
    const primaryColor = config?.cor_primaria || '#7c3aed';
    return active
      ? { backgroundColor: `${primaryColor}20`, color: primaryColor, borderColor: primaryColor }
      : { color: '#374151', '&:hover': { backgroundColor: `${primaryColor}10` } };
  };

  const SidebarContent = () => (
    <div className="flex flex-col h-full bg-white text-slate-700">
      <div className="p-4 border-b flex items-center gap-3" style={{ backgroundColor: config?.cor_secundaria || '#f9fafb' }}>
        <div className="w-9 h-9 rounded-lg flex items-center justify-center shadow-sm" style={{ backgroundColor: config?.cor_primaria || '#7c3aed' }}>
          {config?.url_logo ? (
            <img src={config.url_logo} alt="Logo" className="h-6 w-6 object-contain" />
          ) : (
            <Home className="h-5 w-5 text-white" />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <h1 className="font-bold text-sm truncate leading-tight" style={{ color: config?.cor_primaria }}>
            {config?.nome || 'Chamada Diária'}
          </h1>
          <p className="text-[10px] text-gray-500 uppercase tracking-wider">Sistema Escolar</p>
        </div>
      </div>

      <nav className="flex-1 p-3 space-y-1 overflow-y-auto scrollbar-thin">
        {menuItems
          .filter(item => !item.roles || item.roles.includes(user?.role || ''))
          .map((item) => (
            <div key={item.title} className="mb-1">
              <Link
                to={item.href}
                className={cn("flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all")}
                style={getDynamicClasses(isActive(item.href))}
                onClick={() => setIsOpen(false)}
              >
                <item.icon className="h-5 w-5 shrink-0" />
                <span className="truncate">{item.title}</span>
              </Link>

              {item.subItems && (
                <div className="ml-9 mt-1 space-y-1 border-l-2 border-slate-100 pl-2">
                  {item.subItems.map((subItem) => (
                    <Link
                      key={subItem.title}
                      to={subItem.href}
                      className={cn("flex items-center gap-2 px-3 py-2 rounded-md text-xs font-medium transition-colors text-slate-500 hover:text-slate-900 hover:bg-slate-50")}
                      onClick={() => setIsOpen(false)}
                    >
                      <subItem.icon className="h-3.5 w-3.5" />
                      <span>{subItem.title}</span>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          ))}
      </nav>

      <div className="p-3 border-t bg-slate-50">
        <Button variant="ghost" onClick={handleSignOut} className="w-full justify-start text-red-600 hover:text-red-700 hover:bg-red-50 gap-3">
          <LogOut className="h-4 w-4" />
          <span>Sair</span>
        </Button>
      </div>
    </div>
  );

  return (
    <div className="flex h-screen w-full bg-gray-50 overflow-hidden">
      <aside className="hidden md:flex w-64 flex-col border-r bg-white shadow-sm z-20">
        <SidebarContent />
      </aside>

      {/* Área Principal */}
      <div className="flex-1 flex flex-col h-full w-full relative">
        {/* Header Mobile INTEGRADO */}
        <div className="md:hidden bg-white border-b border-gray-200 p-4 flex items-center sticky top-0 z-20 shadow-sm">
          <Sheet open={isOpen} onOpenChange={setIsOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="mr-2 -ml-2 text-slate-700">
                <Menu className="h-6 w-6" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-[85vw] max-w-xs p-0 bg-white">
              <SidebarContent />
            </SheetContent>
          </Sheet>

          <div className="flex-1 flex items-center justify-center mr-8">
            <h1 className="font-bold text-lg text-purple-700 text-center truncate">
              {config?.nome || 'Chamada Diária'}
            </h1>
          </div>
        </div>

        <main className="flex-1 overflow-y-auto p-4 md:p-6 pb-24 md:pb-6 scroll-smooth">
          {children}
        </main>
      </div>
    </div>
  );
};

export default Sidebar;