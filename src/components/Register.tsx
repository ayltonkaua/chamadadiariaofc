import React, { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox"; // Componente UI para checkbox
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client"; // Importante para chamar a função RPC

export default function Register() {
  const { register } = useAuth();
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  
  // Novos estados para controle do fluxo de aluno
  const [isStudent, setIsStudent] = useState(false);
  const [matricula, setMatricula] = useState("");

  const [success, setSuccess] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    setIsLoading(true);

    try {
      // Validação prévia
      if (isStudent && !matricula.trim()) {
        setError("Por favor, informe sua matrícula.");
        setIsLoading(false);
        return;
      }

      // 1. Cria o usuário no sistema de Autenticação (Auth)
      const response = await register(username, email, password);
      
      if (response.success) {
        // 2. Se for aluno, tenta vincular o cadastro usando a função SQL criada
        if (isStudent) {
          const { data: rpcData, error: rpcError } = await supabase.rpc('vincular_aluno_usuario', {
            p_matricula: matricula,
            p_email: email
          });

          // Se houver erro na chamada RPC ou a função retornar success: false
          if (rpcError || (rpcData && !rpcData.success)) {
             console.error("Erro ao vincular:", rpcError || rpcData);
             // Não impedimos o cadastro, mas avisamos o usuário
             setError(rpcData?.message || "Conta criada, mas houve erro ao vincular matrícula. Verifique se a matrícula está correta.");
             setIsLoading(false);
             return; 
          }
        }

        setSuccess(isStudent 
          ? "Conta criada e vinculada ao aluno! Verifique seu e-mail." 
          : "Conta criada com sucesso! Verifique seu e-mail.");
          
        // Redireciona após 2 segundos
        setTimeout(() => {
          navigate("/login");
        }, 2000);

      } else {
        // Erro vindo do Auth (ex: email já existe)
        setError(response.error || "Erro ao cadastrar.");
      }
    } catch (err) {
      setError("Ocorreu um erro inesperado.");
      console.error(err);
    } finally {
      // Só desativa o loading se não tivermos navegado (em caso de erro)
      if (!success) setIsLoading(false);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-100">
      <Card className="w-full max-w-md shadow-lg">
        <CardHeader className="space-y-1 text-center bg-gradient-to-r from-purple-500 to-blue-500 text-white rounded-t-lg">
          <CardTitle className="text-2xl font-bold">Cadastro</CardTitle>
          <CardDescription className="text-gray-100">
            Crie sua conta para acessar o sistema
          </CardDescription>
        </CardHeader>
        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-4 pt-6">
            <div className="space-y-2">
              <Label htmlFor="username">Nome de Usuário</Label>
              <Input
                id="username"
                type="text"
                placeholder="Seu nome de usuário"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
              />
            </div>
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
                placeholder="Crie uma senha"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>

            {/* Checkbox "Sou Aluno" */}
            <div className="flex items-center space-x-2 pt-2">
              <Checkbox 
                id="isStudent" 
                checked={isStudent}
                onCheckedChange={(checked) => setIsStudent(checked as boolean)}
              />
              <Label 
                htmlFor="isStudent" 
                className="text-sm font-medium leading-none cursor-pointer"
              >
                Sou Aluno (Tenho matrícula)
              </Label>
            </div>

            {/* Campo de Matrícula (Aparece apenas se for aluno) */}
            {isStudent && (
              <div className="space-y-2 bg-blue-50 p-3 rounded-md border border-blue-100 animate-in slide-in-from-top-2 fade-in duration-300">
                <Label htmlFor="matricula" className="text-blue-900 font-semibold">
                  Número da Matrícula
                </Label>
                <Input
                  id="matricula"
                  type="text"
                  placeholder="Ex: 2024001"
                  value={matricula}
                  onChange={(e) => setMatricula(e.target.value)}
                  required={isStudent}
                  className="bg-white"
                />
                <p className="text-xs text-blue-600 mt-1">
                  O sistema irá vincular seu usuário aos seus dados escolares automaticamente.
                </p>
              </div>
            )}

            {error && (
              <div className="text-sm font-medium text-red-500 bg-red-50 p-3 rounded border border-red-100">
                {error}
              </div>
            )}
            {success && (
              <div className="text-sm font-medium text-green-600 bg-green-50 p-3 rounded border border-green-100">
                {success}
              </div>
            )}
          </CardContent>
          <CardFooter className="flex flex-col">
            <Button
              type="submit"
              className="w-full bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 transition-all"
              disabled={isLoading}
            >
              {isLoading ? "Processando..." : (isStudent ? "Cadastrar e Vincular" : "Cadastrar")}
            </Button>
            <div className="mt-4 text-center">
              <Button
                variant="link"
                type="button"
                onClick={() => navigate("/login")}
                className="text-sm text-gray-600"
              >
                Já tem conta? Entrar
              </Button>
            </div>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}