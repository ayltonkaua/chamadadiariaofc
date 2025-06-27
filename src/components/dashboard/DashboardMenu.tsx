// src/components/dashboard/DashboardMenu.tsx

import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
// Adicione o ícone ListChecks
import { Settings, School, Lock, FileText, AlertTriangle, Clock, Moon, Sun, Bell, ListChecks } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

export const DashboardMenu: React.FC = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [theme, setTheme] = useState(() => localStorage.getItem("theme") || "light");

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
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="text-white hover:bg-white/10">
          <Settings className="h-5 w-5 mr-2" />
          Menu
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuItem className="cursor-pointer" asChild>
          <Link to="/configuracoes" className="flex items-center">
            <School className="h-4 w-4 mr-2" />
            Configurações da Escola
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem 
          className="cursor-pointer" 
          onClick={handleTrocarSenha}
          disabled={loading}
        >
          <Lock className="h-4 w-4 mr-2" />
          {loading ? "Enviando e-mail..." : "Trocar Senha"}
        </DropdownMenuItem>
        <DropdownMenuItem className="cursor-pointer" asChild>
          <Link to="/atestados" className="flex items-center">
            <FileText className="h-4 w-4 mr-2" />
            Atestados
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem className="cursor-pointer" asChild>
          <Link to="/alertas" className="flex items-center">
            <AlertTriangle className="h-4 w-4 mr-2" />
            Alertas
          </Link>
        </DropdownMenuItem>
        {/* NOVO ITEM DE MENU PARA PESQUISAS */}
        <DropdownMenuItem className="cursor-pointer" asChild>
          <Link to="/pesquisas" className="flex items-center">
            <ListChecks className="h-4 w-4 mr-2" />
            Pesquisas
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem className="cursor-pointer" asChild>
          <Link to="/notificacoes" className="flex items-center">
            <Bell className="h-4 w-4 mr-2" />
            Enviar Notificações
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem className="cursor-pointer" asChild>
          <Link to="/registro-atrasos" className="flex items-center">
            <Clock className="h-4 w-4 mr-2" />
            Registro de Atrasos
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem className="cursor-pointer" onClick={toggleTheme}>
          {theme === "dark" ? (
            <>
              <Sun className="h-4 w-4 mr-2" /> Modo Claro
            </>
          ) : (
            <>
              <Moon className="h-4 w-4 mr-2" /> Modo Escuro
            </>
          )}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};