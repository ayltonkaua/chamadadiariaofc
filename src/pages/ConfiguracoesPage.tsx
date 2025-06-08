import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

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

  useEffect(() => {
    const carregarConfiguracoes = async () => {
      if (!user) return;

      try {
        const { data, error } = await supabase
          .from("escolas")
          .select("*")
          .eq("user_id", user.id)
          .single();

        if (error) throw error;

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
        toast({
          title: "Erro",
          description: "Não foi possível carregar as configurações da escola",
          variant: "destructive",
        });
      } finally {
        setLoading(false);
      }
    };

    carregarConfiguracoes();
  }, [user, toast]);

  const handleSalvar = async () => {
    if (!user) return;

    try {
      setSaving(true);
      const { error } = await supabase
        .from("escolas")
        .upsert({
          user_id: user.id,
          ...config,
          updated_at: new Date().toISOString(),
        });

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
      <div className="min-h-screen bg-gray-50 py-6">
        <div className="max-w-4xl mx-auto px-4">
          <div className="text-center">
            <p className="text-gray-600">Carregando configurações...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-6">
      <div className="max-w-4xl mx-auto px-4">
        <div className="flex items-center mb-6">
          <Button variant="ghost" className="mr-2" onClick={() => navigate("/dashboard")}>
            <ArrowLeft size={18} />
          </Button>
          <h1 className="text-2xl font-bold text-gray-800">Configurações da Escola</h1>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Informações da Escola</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <Label htmlFor="nome">Nome da Escola</Label>
                <Input
                  id="nome"
                  value={config.nome}
                  onChange={(e) => setConfig({ ...config, nome: e.target.value })}
                  placeholder="Digite o nome da escola"
                />
              </div>
              <div>
                <Label htmlFor="endereco">Endereço</Label>
                <Input
                  id="endereco"
                  value={config.endereco}
                  onChange={(e) => setConfig({ ...config, endereco: e.target.value })}
                  placeholder="Digite o endereço da escola"
                />
              </div>
              <div>
                <Label htmlFor="telefone">Telefone</Label>
                <Input
                  id="telefone"
                  value={config.telefone}
                  onChange={(e) => setConfig({ ...config, telefone: e.target.value })}
                  placeholder="Digite o telefone da escola"
                />
              </div>
              <div>
                <Label htmlFor="email">E-mail</Label>
                <Input
                  id="email"
                  type="email"
                  value={config.email}
                  onChange={(e) => setConfig({ ...config, email: e.target.value })}
                  placeholder="Digite o e-mail da escola"
                />
              </div>
              <div className="flex justify-end">
                <Button onClick={handleSalvar} disabled={saving}>
                  {saving ? "Salvando..." : "Salvar Configurações"}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default ConfiguracoesPage; 