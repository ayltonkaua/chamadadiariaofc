import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Building2, BookOpen, Save, Loader2 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DisciplinasTab } from "@/components/configuracao/DisciplinasTab";

interface EscolaConfig {
  nome: string;
  endereco: string;
  telefone: string;
  email: string;
}

const ConfiguracoesPage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [config, setConfig] = useState<EscolaConfig>({
    nome: "",
    endereco: "",
    telefone: "",
    email: "",
  });

  // Carrega as configurações ao abrir a página
  useEffect(() => {
    const carregarConfiguracoes = async () => {
      if (!user) return;

      try {
        const { data, error } = await supabase
          .from("escola_configuracao") // Confirme se o nome da tabela é 'escola_configuracao' ou 'escolas' no seu banco
          .select("*")
          // Se a relação for direta pelo user_id ou se você busca pelo ID da escola salvo no perfil
          // Ajuste conforme sua estrutura real. Assumindo que busca pela escola do usuário:
          .eq("id", user.escola_id) 
          .single();

        if (error && error.code !== 'PGRST116') throw error; // Ignora erro de "não encontrado"

        if (data) {
          setConfig({
            nome: data.nome || "",
            endereco: data.endereco || "",
            telefone: data.telefone || "",
            email: data.email || "",
          });
        }
      } catch (error) {
        console.error("Erro ao carregar configurações:", error);
        // Não mostra erro se for apenas porque ainda não configurou
      } finally {
        setLoading(false);
      }
    };

    if (user?.escola_id) {
      carregarConfiguracoes();
    } else {
      setLoading(false);
    }
  }, [user, toast]);

  const handleSalvar = async () => {
    if (!user?.escola_id) {
        toast({ title: "Erro", description: "ID da escola não encontrado.", variant: "destructive" });
        return;
    }

    try {
      setSaving(true);
      const { error } = await supabase
        .from("escola_configuracao")
        .update({
          nome: config.nome,
          endereco: config.endereco,
          telefone: config.telefone,
          email: config.email,
          atualizado_em: new Date().toISOString(),
        })
        .eq("id", user.escola_id);

      if (error) throw error;

      toast({
        title: "Sucesso",
        description: "Configurações salvas com sucesso",
      });
    } catch (error) {
      console.error("Erro ao salvar configurações:", error);
      toast({
        title: "Erro",
        description: "Não foi possível salvar as configurações",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 py-6 flex items-center justify-center">
        <p className="text-gray-500 flex items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin" /> Carregando...
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-6">
      <div className="max-w-5xl mx-auto px-4 space-y-6">
        
        {/* Cabeçalho */}
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={() => navigate("/dashboard")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-2xl font-bold text-gray-900">Configurações da Escola</h1>
        </div>

        {/* Sistema de Abas */}
        <Tabs defaultValue="dados" className="w-full">
          <TabsList className="grid w-full max-w-md grid-cols-2 mb-6">
            <TabsTrigger value="dados" className="gap-2">
              <Building2 className="h-4 w-4" /> Dados Gerais
            </TabsTrigger>
            <TabsTrigger value="disciplinas" className="gap-2">
              <BookOpen className="h-4 w-4" /> Disciplinas
            </TabsTrigger>
          </TabsList>

          {/* Aba 1: Dados Gerais (Seu formulário original) */}
          <TabsContent value="dados" className="animate-in fade-in slide-in-from-left-4 duration-300">
            <Card>
              <CardHeader>
                <CardTitle>Informações da Instituição</CardTitle>
                <CardDescription>Atualize os dados de contato e endereço.</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4 max-w-2xl">
                  <div className="space-y-2">
                    <Label htmlFor="nome">Nome da Escola</Label>
                    <Input
                      id="nome"
                      value={config.nome}
                      onChange={(e) => setConfig({ ...config, nome: e.target.value })}
                      placeholder="Ex: Escola Estadual..."
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="endereco">Endereço Completo</Label>
                    <Input
                      id="endereco"
                      value={config.endereco}
                      onChange={(e) => setConfig({ ...config, endereco: e.target.value })}
                      placeholder="Rua, Número, Bairro..."
                    />
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="telefone">Telefone</Label>
                      <Input
                        id="telefone"
                        value={config.telefone}
                        onChange={(e) => setConfig({ ...config, telefone: e.target.value })}
                        placeholder="(00) 00000-0000"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="email">E-mail Institucional</Label>
                      <Input
                        id="email"
                        type="email"
                        value={config.email}
                        onChange={(e) => setConfig({ ...config, email: e.target.value })}
                        placeholder="contato@escola.com"
                      />
                    </div>
                  </div>

                  <div className="pt-4 flex justify-end">
                    <Button onClick={handleSalvar} disabled={saving} className="bg-green-600 hover:bg-green-700 text-white gap-2">
                      {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                      {saving ? "Salvando..." : "Salvar Alterações"}
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Aba 2: Disciplinas (Novo Componente) */}
          <TabsContent value="disciplinas" className="animate-in fade-in slide-in-from-right-4 duration-300">
            <DisciplinasTab />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default ConfiguracoesPage;