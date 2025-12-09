import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";

interface ProtectedRouteProps {
    allowedRoles?: string[];
}

const ProtectedRoute = ({ allowedRoles }: ProtectedRouteProps) => {
    const { user, loadingUser } = useAuth();
    const location = useLocation();

    // DEBUG LOG - Remover após resolver o problema
    console.log("[ProtectedRoute] Debug:", {
        path: location.pathname,
        user: user ? { id: user.id?.slice(0, 8), type: user.type, role: user.role } : null,
        allowedRoles,
        loadingUser
    });

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
        console.log("[ProtectedRoute] Usuário não autenticado, redirecionando para /login");
        return <Navigate to="/login" state={{ from: location }} replace />;
    }

    // Se houver restrição de roles/types
    if (allowedRoles && allowedRoles.length > 0) {
        // CORREÇÃO: Verificar TANTO role QUANTO type
        const userRole = user.role || '';
        const userType = user.type || '';

        // Verifica se o usuário tem a permissão necessária
        // Checa role OU type para cobrir ambos os casos
        const hasPermission =
            allowedRoles.includes(userRole) ||
            allowedRoles.includes(userType) ||
            userRole === 'super_admin';

        console.log("[ProtectedRoute] Verificação de permissão:", {
            userRole,
            userType,
            allowedRoles,
            hasPermission,
            blocked: !hasPermission
        });

        if (!hasPermission) {
            console.log("[ProtectedRoute] BLOQUEADO - Redirecionando...");

            // Redirecionamento inteligente baseado no tipo de usuário
            if (userType === 'aluno') {
                return <Navigate to="/portal-aluno" replace />;
            }

            // Se for professor/staff tentando acessar área restrita
            return <Navigate to="/dashboard" replace />;
        }
    }

    console.log("[ProtectedRoute] LIBERADO - Renderizando Outlet");
    return <Outlet />;
};

export default ProtectedRoute;
