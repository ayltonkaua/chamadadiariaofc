import React, { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  SidebarProvider,
  Sidebar,
  SidebarTrigger,
  SidebarContent,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarSeparator,
} from "@/components/ui/sidebar";
import { School, Lock, FileText, AlertTriangle, Bell, Clock, Moon, Sun, PanelLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

const AppSidebar: React.FC = () => {
  const { user } = useAuth();
  const [theme, setTheme] = useState(() => localStorage.getItem("theme") || "light");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
    localStorage.setItem("theme", theme);
  }, [theme]);

  const toggleTheme = () => setTheme(theme === "dark" ? "light" : "dark");

  const handleTrocarSenha = async () => {
    try {
      setLoading(true);
      const { error } = await supabase.auth.resetPasswordForEmail(user?.email || "", {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (error) throw error;
      toast({
        title: "E-mail enviado",
        description: "Verifique seu e-mail para redefinir sua senha",
      });
    } catch (error) {
      toast({
        title: "Erro",
        description: "Não foi possível enviar o e-mail de redefinição de senha",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <SidebarProvider>
      <div className="fixed top-4 left-4 z-50 md:static md:z-auto">
        <SidebarTrigger />
      </div>
      <Sidebar collapsible="offcanvas" side="left">
        <SidebarContent className="pt-6">
          <div className="flex items-center gap-2 px-4 mb-6">
            <PanelLeft className="h-6 w-6 text-purple-700" />
            <span className="font-bold text-lg text-purple-700">Chamada Diária</span>
          </div>
          <SidebarMenu>
            <SidebarMenuItem>
              <Link to="/configuracoes">
                <SidebarMenuButton>
                  <School />
                  Configurações da Escola
                </SidebarMenuButton>
              </Link>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <SidebarMenuButton onClick={handleTrocarSenha} disabled={loading}>
                <Lock />
                {loading ? "Enviando..." : "Trocar Senha"}
              </SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <Link to="/atestados">
                <SidebarMenuButton>
                  <FileText />
                  Atestados
                </SidebarMenuButton>
              </Link>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <Link to="/alertas">
                <SidebarMenuButton>
                  <AlertTriangle />
                  Alertas
                </SidebarMenuButton>
              </Link>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <Link to="/notificacoes">
                <SidebarMenuButton>
                  <Bell />
                  Enviar Notificações
                </SidebarMenuButton>
              </Link>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <Link to="/registro-atrasos">
                <SidebarMenuButton>
                  <Clock />
                  Registro de Atrasos
                </SidebarMenuButton>
              </Link>
            </SidebarMenuItem>
            <SidebarSeparator />
            <SidebarMenuItem>
              <SidebarMenuButton onClick={toggleTheme}>
                {theme === "dark" ? <Sun /> : <Moon />}
                {theme === "dark" ? "Modo Claro" : "Modo Escuro"}
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarContent>
      </Sidebar>
    </SidebarProvider>
  );
};

export default AppSidebar; 