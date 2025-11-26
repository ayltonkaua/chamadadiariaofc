import React, { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Loader2 } from "lucide-react";

const Login: React.FC = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  // A LÓGICA DESTA FUNÇÃO FOI TOTALMENTE ATUALIZADA
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);

    try {
      // 1. A função login agora retorna o objeto do usuário ou nulo
      const user = await login(email, password);

      if (user) {
        // 2. A lógica de redirecionamento é baseada no tipo de usuário retornado
        if (user.type === 'admin') {
          navigate("/dashboard", { replace: true });
        } else if (user.type === 'aluno') {
          navigate("/portal-aluno", { replace: true });
        } else {
          setError("Sua conta não está vinculada a um perfil. Contate o suporte.");
        }
      } else {
        setError("E-mail ou senha incorretos. Tente novamente.");
      }
    } catch (err) {
      setError("Ocorreu um erro ao fazer login. Tente novamente.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-100">
      <Card className="w-full max-w-md shadow-lg">
        <CardHeader className="space-y-1 text-center bg-gradient-to-r from-purple-500 to-blue-500 text-white rounded-t-lg">
          <CardTitle className="text-2xl font-bold">Chamada Diária</CardTitle>
          <CardDescription className="text-gray-100">
            Acesso para gestores, professores, alunos e monitores da busca ativa.
          </CardDescription>
        </CardHeader>
        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-4 pt-6">
            <div className="space-y-2">
              <Label htmlFor="email">E-mail</Label>
              <Input
                id="email"
                type="email"
                placeholder="Digite seu e-mail"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Senha</Label>
              <Input
                id="password"
                type="password"
                placeholder="Digite sua senha"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
            <div className="text-right">
              <Button
                variant="link"
                className="px-0 font-normal text-xs text-blue-600 h-auto"
                onClick={() => navigate("/forgot-password")}
                type="button"
              >
                Esqueceu a senha?
              </Button>
            </div>
            {error && (
              <div className="text-sm font-medium text-red-500">
                {error}
              </div>
            )}
          </CardContent>
          <CardFooter className="flex flex-col sm:flex-row gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => navigate("/")}
              className="w-full sm:w-auto"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Voltar ao Início
            </Button>
            <Button
              type="submit"
              className="w-full sm:flex-1 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700"
              disabled={isLoading}
            >
              {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              {isLoading ? "Entrando..." : "Entrar"}
            </Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
};

export default Login;