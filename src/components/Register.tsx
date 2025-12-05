import React, { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Building2, GraduationCap, User, Mail, Lock, Loader2, AlertCircle, CheckCircle2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast"; // Importe o toast para feedback visual melhor

type AccountType = "aluno" | "escola";

export default function Register() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [accountType, setAccountType] = useState<AccountType>("aluno");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [matricula, setMatricula] = useState("");

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
      if (accountType === "aluno" && !matricula.trim()) throw new Error("Por favor, informe sua matrícula.");
      if (!name.trim()) throw new Error(accountType === "escola" ? "Informe o nome da escola." : "Informe seu nome completo.");
      if (password.length < 6) throw new Error("A senha deve ter no mínimo 6 caracteres.");

      // 2. Criar Usuário (O Supabase loga automaticamente se o email confirm for desligado)
      const response = await register(name, email, password);

      if (!response.success) {
        throw new Error(response.error || "Erro ao criar conta.");
      }

      // Pequeno delay para garantir que a sessão foi estabelecida (se auto-confirm)
      await new Promise(resolve => setTimeout(resolve, 500));

      // 3. Chamar a RPC para vincular
      let rpcName = "";
      let rpcParams = {};

      if (accountType === "aluno") {
        rpcName = "vincular_aluno_usuario";
        rpcParams = {
          p_matricula: matricula.trim(),
          p_email: email.trim().toLowerCase()
        };
      } else {
        rpcName = "registrar_escola_admin";
        rpcParams = {
          nome_escola: name.trim()
        };
      }

      // Chama a RPC. Se o usuário não estiver logado (email pendente), a RPC roda como 'anon',
      // mas como demos permissão GRANT EXECUTE TO anon, vai funcionar.
      // @ts-ignore
      const { data: rpcData, error: rpcError } = await supabase.rpc(rpcName, rpcParams);

      if (rpcError) {
        console.error("Erro RPC Detalhado:", rpcError);
        // Se o erro for 403, é permissão. Se for outro, é lógica.
        if (rpcError.code === '42501' || rpcError.code === 'PGRST301') {
          throw new Error("Erro de permissão no servidor. Contate o suporte.");
        }
        throw new Error(rpcError.message || "Erro ao vincular perfil.");
      }

      if (rpcData && (rpcData as any).success === false) {
        throw new Error((rpcData as any).message || "Falha lógica ao vincular.");
      }

      // 4. Sucesso e Logout de Segurança
      setSuccess("Conta criada e vinculada! Redirecionando...");

      // Forçamos logout para que o usuário faça login limpo e carregue os novos vínculos (roles/aluno_id)
      await supabase.auth.signOut();

      toast({
        title: "Cadastro realizado!",
        description: "Sua conta foi criada. Faça login para entrar.",
        duration: 4000,
      });

      setTimeout(() => {
        navigate("/login");
      }, 2000);

    } catch (err: any) {
      console.error("Erro no registro:", err);
      let msg = err.message;
      if (msg.includes("duplicate key") || msg.includes("User already registered")) {
        msg = "Este e-mail ou matrícula já estão cadastrados.";
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
        <div className="bg-gradient-to-r from-violet-600 to-indigo-600 p-8 text-center">
          <h1 className="text-3xl font-bold text-white mb-2">Bem-vindo(a)</h1>
          <p className="text-violet-100">Crie sua conta no Chamada Diária</p>
        </div>

        <CardContent className="pt-6">
          <Tabs defaultValue="aluno" value={accountType} onValueChange={(v) => setAccountType(v as AccountType)} className="w-full mb-6">
            <TabsList className="grid w-full grid-cols-2 bg-gray-100 p-1 rounded-lg">
              <TabsTrigger value="aluno" className="data-[state=active]:bg-white data-[state=active]:text-violet-700 data-[state=active]:shadow-sm flex items-center gap-2 transition-all">
                <GraduationCap className="h-4 w-4" />
                Sou Aluno
              </TabsTrigger>
              <TabsTrigger value="escola" className="data-[state=active]:bg-white data-[state=active]:text-indigo-700 data-[state=active]:shadow-sm flex items-center gap-2 transition-all">
                <Building2 className="h-4 w-4" />
                Sou Escola
              </TabsTrigger>
            </TabsList>
          </Tabs>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name" className="text-gray-700">
                {accountType === "escola" ? "Nome da Escola" : "Nome Completo"}
              </Label>
              <div className="relative">
                {accountType === "escola" ? (
                  <Building2 className="absolute left-3 top-3 h-5 w-5 text-gray-400" />
                ) : (
                  <User className="absolute left-3 top-3 h-5 w-5 text-gray-400" />
                )}
                <Input
                  id="name"
                  placeholder={accountType === "escola" ? "Ex: Escola Municipal..." : "Ex: João da Silva"}
                  className="pl-10 bg-gray-50 border-gray-200 focus:bg-white transition-colors"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="email" className="text-gray-700">E-mail</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-3 h-5 w-5 text-gray-400" />
                <Input
                  id="email"
                  type="email"
                  placeholder="seu@email.com"
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

            {accountType === "aluno" && (
              <div className="space-y-2 bg-blue-50/50 p-3 rounded-lg border border-blue-100 animate-in slide-in-from-top-2 fade-in duration-300">
                <Label htmlFor="matricula" className="text-blue-900 font-medium">
                  Número da Matrícula
                </Label>
                <Input
                  id="matricula"
                  placeholder="Ex: 2024001"
                  className="bg-white border-blue-200 focus:border-blue-400"
                  value={matricula}
                  onChange={(e) => setMatricula(e.target.value)}
                  required={accountType === "aluno"}
                />
                <p className="text-xs text-blue-600 mt-1 flex items-center gap-1">
                  <AlertCircle className="h-3 w-3" /> Necessário para vincular seus dados.
                </p>
              </div>
            )}

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
              className={`w-full h-11 text-base font-medium shadow-lg transition-all hover:scale-[1.02] ${accountType === "escola"
                  ? "bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700"
                  : "bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-700 hover:to-purple-700"
                }`}
              disabled={isLoading}
            >
              {isLoading ? (
                <><Loader2 className="mr-2 h-5 w-5 animate-spin" /> Processando...</>
              ) : (
                accountType === "escola" ? "Registrar Escola" : "Cadastrar Aluno"
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