import { Home, FileText, User, ClipboardList } from "lucide-react";
import { Link, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";

export function MobileNav() {
  const location = useLocation();
  
  // Defina as rotas principais do aluno aqui
  const navItems = [
    { href: "/portal-aluno", icon: Home, label: "Início" },
    { href: "/student-query", icon: ClipboardList, label: "Faltas" },
    { href: "/portal-aluno?tab=atestados", icon: FileText, label: "Atestados" }, // Sugestão de rota
    // { href: "/perfil", icon: User, label: "Perfil" }, // Futuro
  ];

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 border-t bg-white pb-safe sm:hidden shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)]">
      <nav className="flex h-16 items-center justify-around px-1">
        {navItems.map((item) => {
          const isActive = location.pathname === item.href;
          return (
            <Link
              key={item.href}
              to={item.href}
              className={cn(
                "flex flex-1 flex-col items-center justify-center h-full gap-1 transition-colors",
                isActive ? "text-purple-600" : "text-gray-400 hover:text-gray-600"
              )}
            >
              <item.icon className={cn("h-6 w-6", isActive && "fill-current/20 stroke-current")} />
              <span className={cn("text-[10px] font-medium", isActive ? "font-bold" : "font-normal")}>
                {item.label}
              </span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}