import { Home, Users, FileText, AlertTriangle, Clock } from "lucide-react";
import { Link, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";

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

export const DashboardLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="flex">
        <div className="flex-1 p-6">
          {children}
        </div>
      </div>
    </div>
  );
}; 