import { Sidebar, SidebarProvider, SidebarMenu, SidebarMenuItem, SidebarMenuButton } from "@/components/ui/sidebar";
import { Home, Users, FileText, AlertTriangle, Clock, LogOut } from "lucide-react";
import { Link, useLocation, useNavigate, Outlet } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import React from "react";

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

const DefaultLayout: React.FC<{ children?: React.ReactNode }> = ({ children }) => {
  const location = useLocation();
  const { logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate("/");
  };

  return (
    <SidebarProvider>
      <div className="min-h-screen bg-gray-50 flex">
        <Sidebar>
          <div className="p-4">
            <h1 className="text-xl font-bold text-gray-800">Chamada Diária</h1>
          </div>
          <SidebarMenu>
            {menuItems.map((item) => (
              <SidebarMenuItem key={item.href}>
                <Link to={item.href} className={cn("flex items-center w-full", location.pathname === item.href && "font-bold text-primary") }>
                  {item.icon}
                  <span className="ml-2">{item.title}</span>
                </Link>
              </SidebarMenuItem>
            ))}
            <SidebarMenuItem>
              <SidebarMenuButton onClick={handleLogout} variant="default" className="w-full flex items-center">
                <LogOut className="h-5 w-5 mr-2" /> Sair
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </Sidebar>
        <main className="flex-1 p-4 md:p-6">{children ? children : <Outlet />}</main>
      </div>
    </SidebarProvider>
  );
};

export default DefaultLayout; 