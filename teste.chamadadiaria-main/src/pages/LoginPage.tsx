
import React from "react";
import Login from "@/components/Login";
import { Navigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";

const LoginPage: React.FC = () => {
  const { isAuthenticated } = useAuth();

  if (isAuthenticated) return <Navigate to="/dashboard" />;

  return (
    <div>
      <Login />
      <div className="flex justify-center mt-2">
        <p className="text-sm text-gray-700">
          Entre em contato com @ayltonkauaw
        </p>
      </div>
    </div>
  );
};

export default LoginPage;
