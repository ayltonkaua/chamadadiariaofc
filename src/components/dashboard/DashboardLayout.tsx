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
  const location = useLocation();

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="flex">
        {/* Sidebar */}
        <div className="w-64 bg-white border-r border-gray-200 min-h-screen">
          <div className="p-4">
            <h1 className="text-xl font-bold text-gray-800">Chamada Diária</h1>
          </div>
          <nav className="mt-4">
            {menuItems.map((item) => (
              <Link
                key={item.href}
                to={item.href}
                className={cn(
                  "flex items-center px-4 py-2 text-gray-700 hover:bg-gray-100",
                  location.pathname === item.href && "bg-gray-100"
                )}
              >
                {item.icon}
                <span className="ml-2">{item.title}</span>
              </Link>
            ))}
          </nav>
        </div>

        {/* Main content */}
        <div className="flex-1 p-6">
          {children}
        </div>
      </div>
    </div>
  );
}; 