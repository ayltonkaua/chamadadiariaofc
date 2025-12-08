import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";

interface ProtectedRouteProps {
    allowedRoles?: string[];
}

const ProtectedRoute = ({ allowedRoles }: ProtectedRouteProps) => {
    const { user, loadingUser } = useAuth();
    const location = useLocation();

    if (loadingUser) {
        return (
            <div className="flex h-screen w-full items-center justify-center bg-gray-50">
                <div className="flex flex-col items-center gap-2">
                    <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
                    <p className="text-sm text-gray-500">Verificando acesso...</p>
                </div>
            </div>
        );
    }

    if (!user) {
        return <Navigate to="/login" state={{ from: location }} replace />;
    }

    // Se houver restrição de roles
    if (allowedRoles) {
        // Normalizar role do usuário para comparação
        const userRole = user.role || '';

        // Verifica se o usuário tem a permissão necessária
        // Nota: 'super_admin' geralmente tem acesso a tudo, mas vamos seguir a lista explícita
        const hasPermission = allowedRoles.includes(userRole) || (userRole === 'super_admin');

        if (!hasPermission) {
            // Redirecionamento inteligente baseada no tipo de usuário
            if (user.type === 'aluno') {
                return <Navigate to="/portal-aluno" replace />;
            }

            // Se for professor tentando acessar área de gestão, vai pro dashboard comum
            return <Navigate to="/dashboard" replace />;
        }
    }

    return <Outlet />;
};

export default ProtectedRoute;
