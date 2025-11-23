// Imports atualizados para novos componentes e hooks
import { Home, Users, FileText, AlertTriangle, Clock, Menu, Bell, UserCircle } from "lucide-react";
import { Link, Outlet, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";

// O array de itens do menu permanece o mesmo
const menuItems = [
  {
    title: "Início",
    href: "/dashboard",
    icon: <Home className="h-5 w-5" />,
  },
  {
    title: "Alunos",
    href: "/alunos",
    icon: <Users className="h-5 w-5" />,
  },
  {
    title: "Atestados",
    href: "/atestados",
    icon: <FileText className="h-5 w-5" />,
    badge: 3, // Exemplo de como adicionar um contador
  },
  {
    title: "Alertas",
    href: "/alertas",
    icon: <AlertTriangle className="h-5 w-5" />,
  },
  {
    title: "Registro de Atrasos",
    href: "/registro-atrasos",
    icon: <Clock className="h-5 w-5" />,
  },
];

// Subcomponente para os links da navegação, tornando o código mais limpo
const NavLink = ({ href, children }: { href: string; children: React.ReactNode }) => {
  const location = useLocation();
  const isActive = location.pathname === href;

  return (
    <Link
      to={href}
      className={cn(
        "flex items-center gap-3 rounded-lg px-3 py-2 text-muted-foreground transition-all hover:text-primary",
        isActive && "bg-muted text-primary"
      )}
    >
      {children}
    </Link>
  );
};

// Componente que renderiza o conteúdo da Sidebar (reutilizado no menu mobile)
const SidebarContent = () => (
  <>
    <div className="flex h-14 items-center border-b px-4 lg:h-[60px] lg:px-6">
      <Link to="/" className="flex items-center gap-2 font-semibold">
        {/* Você pode adicionar sua Logo aqui */}
        <span className="">Chamada Diária</span>
      </Link>
      <Button variant="outline" size="icon" className="ml-auto h-8 w-8">
        <Bell className="h-4 w-4" />
        <span className="sr-only">Toggle notifications</span>
      </Button>
    </div>
    <div className="flex-1">
      <nav className="grid items-start px-2 text-sm font-medium lg:px-4">
        {menuItems.map((item) => (
          <NavLink key={item.href} href={item.href}>
            {item.icon}
            {item.title}
            {item.badge && (
              <Badge className="ml-auto flex h-6 w-6 shrink-0 items-center justify-center rounded-full">
                {item.badge}
              </Badge>
            )}
          </NavLink>
        ))}
      </nav>
    </div>
  </>
);

// Layout principal atualizado
export const DashboardLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return (
    // 1. Estrutura com CSS Grid: mais robusta para layouts de dashboard.
    //    - Define colunas para a sidebar e o conteúdo principal em telas médias (md) ou maiores.
    <div className="grid min-h-screen w-full md:grid-cols-[220px_1fr] lg:grid-cols-[280px_1fr]">
      
      {/* 2. Sidebar para Desktop: visível apenas em telas maiores. */}
      <div className="hidden border-r bg-muted/40 md:block">
        <div className="flex h-full max-h-screen flex-col gap-2">
          <SidebarContent />
        </div>
      </div>

      {/* 3. Área de Conteúdo Principal */}
      <div className="flex flex-col">
        {/* Header (Cabeçalho) */}
        <header className="flex h-14 items-center gap-4 border-b bg-muted/40 px-4 lg:h-[60px] lg:px-6">
          
          {/* Menu para Mobile: usa o componente Sheet (gaveta) do shadcn/ui. */}
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="outline" size="icon" className="shrink-0 md:hidden">
                <Menu className="h-5 w-5" />
                <span className="sr-only">Toggle navigation menu</span>
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="flex flex-col">
              <SidebarContent />
            </SheetContent>
          </Sheet>

          {/* Espaço para outros itens do header, como uma barra de busca */}
          <div className="w-full flex-1">
            {/* Exemplo: <Search /> */}
          </div>

          {/* Menu do Usuário */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="secondary" size="icon" className="rounded-full">
                <UserCircle className="h-5 w-5" />
                <span className="sr-only">Toggle user menu</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>Minha Conta</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem>Configurações</DropdownMenuItem>
              <DropdownMenuItem>Suporte</DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem>Sair</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </header>

        {/* 4. Conteúdo da Página:
              - `flex-1` garante que ele cresça e ocupe todo o espaço vertical disponível,
                eliminando o "espaço em branco" do bug.
        */}
        <main className="flex flex-1 flex-col gap-4 p-4 lg:gap-6 lg:p-6">
          {children}
          {/* Se você usar react-router-dom v6 com rotas aninhadas,
              você pode querer usar <Outlet /> aqui em vez de {children} */}
        </main>
      </div>
    </div>
  );
};