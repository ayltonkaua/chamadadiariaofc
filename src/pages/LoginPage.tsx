import React from "react";
import Login from "@/components/Login";
import { useAuth } from "@/contexts/AuthContext";
import { Navigate } from "react-router-dom";

const LoginPage: React.FC = () => {
  const { user, loadingUser } = useAuth();

  // Enquanto carrega, não mostra nada (ou Spinner)
  if (loadingUser) {
    return null;
  }

  // Se já estiver logado, redireciona conforme o TIPO
  if (user) {
    // 1. Redireciona TODA a equipe para o Dashboard
    if (['admin', 'staff', 'professor', 'diretor', 'coordenador', 'secretario'].includes(user.type || user.role || '')) {
      return <Navigate to="/dashboard" replace />;
    }
    // 2. Redireciona Aluno
    if (user.type === 'aluno') {
      return <Navigate to="/portal-aluno" replace />;
    }
  }

  return (
    <div>
      <Login />
      <div className="flex justify-center mt-2">
        <p className="text-sm text-gray-700">
          Entre em contato com a secretaria se não conseguir acessar.
        </p>
      </div>
    </div>
  );
};

export default LoginPage;