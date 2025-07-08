import React from "react";
import Login from "@/components/Login";
import { useAuth } from "@/contexts/AuthContext";
import { Navigate } from "react-router-dom";

const LoginPage: React.FC = () => {
  const { user, loadingUser } = useAuth();

  // Enquanto o contexto está carregando a sessão, não faça nada para evitar piscar a tela.
  if (loadingUser) {
    return null; // ou um componente de Spinner/Loading
  }

  // Se, após o carregamento, o usuário já estiver logado, redirecione para o local correto.
  if (user) {
    if (user.type === 'admin') {
      return <Navigate to="/dashboard" replace />;
    }
    if (user.type === 'aluno') {
      return <Navigate to="/portal-aluno" replace />;
    }
    // Se o tipo for 'indefinido', ele permanecerá na tela de login,
    // e o componente Login exibirá a mensagem de erro apropriada.
  }

  // Se não houver usuário logado, mostre o formulário de login.
  return (
    <div>
      <Login />
      <div className="flex justify-center mt-2">
        <p className="text-sm text-gray-700">
          Entre em contato com @chamada_diaria
        </p>
      </div>
    </div>
  );
};

export default LoginPage;
