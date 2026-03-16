import React, { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Building2, Mail, Lock, Loader2, AlertCircle, CheckCircle2, Info } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function Register() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [success, setSuccess] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  // Limpa qualquer sessão antiga ao entrar na página de registro
  useEffect(() => {
    const clearSession = async () => {
      await supabase.auth.signOut();
    };
    clearSession();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    setIsLoading(true);

    try {
      // 1. Validações
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) throw new Error("Por favor, insira um e-mail válido.");
      if (!name.trim()) throw new Error("Informe o nome da escola.");
      if (password.length < 6) throw new Error("A senha deve ter no mínimo 6 caracteres.");

      // 2. Criar Usuário
      const response = await register(name, email, password);

      if (!response.success) {
        throw new Error(response.error || "Erro ao criar conta.");
      }

      // Pequeno delay para garantir que a sessão foi estabelecida
      await new Promise(resolve => setTimeout(resolve, 500));

      // 3. Chamar a RPC para registrar escola (status = pendente)
      // @ts-expect-error RPC generated types are stale for registrar_escola_admin
      const { data: rpcData, error: rpcError } = await supabase.rpc("registrar_escola_admin", {
        nome_escola: name.trim()
      });

      if (rpcError) {
        console.error("Erro RPC Detalhado:", rpcError);
        if (rpcError.code === '42501' || rpcError.code === 'PGRST301') {
          throw new Error("Erro de permissão no servidor. Contate o suporte.");
        }
        throw new Error(rpcError.message || "Erro ao vincular perfil.");
      }

      if (rpcData && (rpcData as any).success === false) {
        throw new Error((rpcData as any).message || "Falha lógica ao vincular.");
      }

      // 4. Sucesso
      setSuccess("Cadastro realizado! Aguarde a aprovação do administrador.");

      // Forçamos logout para que o usuário faça login limpo após aprovação
      await supabase.auth.signOut();

      toast({
        title: "Cadastro enviado!",
        description: "Sua escola foi registrada e aguarda aprovação.",
        duration: 5000,
      });

      setTimeout(() => {
        navigate("/login");
      }, 3000);

    } catch (err: any) {
      console.error("Erro no registro:", err);
      let msg = err.message;
      if (msg.includes("duplicate key") || msg.includes("User already registered")) {
        msg = "Este e-mail já está cadastrado.";
      }
      setError(msg);
      toast({
        title: "Erro no cadastro",
        description: msg,
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-50 p-4">
      <Card className="w-full max-w-md shadow-xl border-0 overflow-hidden">
        <div className="bg-gradient-to-r from-indigo-600 to-blue-600 p-8 text-center">
          <Building2 className="h-12 w-12 text-white mx-auto mb-3" />
          <h1 className="text-3xl font-bold text-white mb-2">Cadastro de Escola</h1>
          <p className="text-indigo-100">Registre sua instituição no Chamada Diária</p>
        </div>

        <CardContent className="pt-6">
          {/* Aviso de Aprovação */}
          <div className="bg-blue-50 border border-blue-100 rounded-lg p-4 mb-6 flex items-start gap-3">
            <Info className="h-5 w-5 text-blue-600 mt-0.5 shrink-0" />
            <div className="text-sm text-blue-800">
              <strong>Importante:</strong> Após o cadastro, sua escola passará por uma aprovação antes de poder utilizar o sistema.
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name" className="text-gray-700">Nome da Escola</Label>
              <div className="relative">
                <Building2 className="absolute left-3 top-3 h-5 w-5 text-gray-400" />
                <Input
                  id="name"
                  placeholder="Ex: Escola Municipal João da Silva"
                  className="pl-10 bg-gray-50 border-gray-200 focus:bg-white transition-colors"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="email" className="text-gray-700">E-mail Institucional</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-3 h-5 w-5 text-gray-400" />
                <Input
                  id="email"
                  type="email"
                  placeholder="contato@escola.edu.br"
                  className="pl-10 bg-gray-50 border-gray-200 focus:bg-white transition-colors"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="password" className="text-gray-700">Senha</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-3 h-5 w-5 text-gray-400" />
                <Input
                  id="password"
                  type="password"
                  placeholder="Mínimo 6 caracteres"
                  className="pl-10 bg-gray-50 border-gray-200 focus:bg-white transition-colors"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={6}
                />
              </div>
            </div>

            {error && (
              <div className="text-sm text-red-600 bg-red-50 p-3 rounded-md flex items-start gap-2 animate-in fade-in slide-in-from-bottom-1 border border-red-100">
                <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}
            {success && (
              <div className="text-sm text-green-600 bg-green-50 p-3 rounded-md flex items-start gap-2 animate-in fade-in slide-in-from-bottom-1 border border-green-100">
                <CheckCircle2 className="h-5 w-5 shrink-0 mt-0.5" />
                <span>{success}</span>
              </div>
            )}

            <Button
              type="submit"
              className="w-full h-11 text-base font-medium shadow-lg transition-all hover:scale-[1.02] bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700"
              disabled={isLoading}
            >
              {isLoading ? (
                <><Loader2 className="mr-2 h-5 w-5 animate-spin" /> Processando...</>
              ) : (
                "Cadastrar Escola"
              )}
            </Button>
          </form>
        </CardContent>

        <CardFooter className="justify-center pb-8 bg-white">
          <Button
            variant="link"
            onClick={() => navigate("/login")}
            className="text-gray-500 hover:text-gray-800 transition-colors"
          >
            Já tem uma conta? <span className="font-semibold ml-1 underline">Faça Login</span>
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
