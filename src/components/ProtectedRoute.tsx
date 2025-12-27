import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";

interface ProtectedRouteProps {
    allowedRoles?: string[];
    allowedTypes?: string[];
}

const ProtectedRoute = ({ allowedRoles, allowedTypes }: ProtectedRouteProps) => {
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

    // Se houver restrição de roles/types
    if ((allowedRoles && allowedRoles.length > 0) || (allowedTypes && allowedTypes.length > 0)) {
        const userRole = user.role || '';
        const userType = user.type || '';

        // Verifica se o usuário tem a permissão necessária
        // Checa role OU type para cobrir ambos os casos
        const hasPermission =
            (allowedRoles ? allowedRoles.includes(userRole) || allowedRoles.includes(userType) : false) ||
            (allowedTypes ? allowedTypes.includes(userType) || allowedTypes.includes(userRole) : false) ||
            userRole === 'super_admin';

        if (!hasPermission) {
            // Redirecionamento inteligente baseado no tipo de usuário
            if (userType === 'aluno') {
                return <Navigate to="/portal-aluno" replace />;
            }

            // Se for professor/staff tentando acessar área restrita
            return <Navigate to="/dashboard" replace />;
        }
    }

    return <Outlet />;
};

export default ProtectedRoute;
