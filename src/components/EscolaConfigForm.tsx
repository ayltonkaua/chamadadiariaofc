import React, { useState, useEffect } from "react";
import { useEscolaConfig } from "@/contexts/EscolaConfigContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/hooks/use-toast";

const EscolaConfigForm: React.FC = () => {
  const { config, saveConfig, loading } = useEscolaConfig();
  const { user } = useAuth();
  const [formData, setFormData] = useState(config);

  useEffect(() => {
    setFormData(config);
  }, [config]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.nome) {
      toast({
        title: "Campo obrigatório",
        description: "O nome da escola não pode ficar em branco.",
        variant: "destructive"
      });
      return;
    }
    await saveConfig(formData);
  };

  if (!user) {
    return <div>Carregando...</div>;
  }

  const isNewUser = !user.escola_id;

  return (
    <div className="max-w-4xl mx-auto p-4 sm:p-6">
      <form onSubmit={handleSubmit}>
        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle className="text-2xl font-bold text-gray-800">Perfil da Escola</CardTitle>
            <CardDescription>
              {isNewUser
                ? "Como este é seu primeiro acesso, preencha os dados para criar o perfil da sua escola."
                : "Atualize as informações e a identidade visual da sua escola."}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label htmlFor="nome">Nome da Escola</Label>
                <Input id="nome" name="nome" value={formData.nome || ""} onChange={handleInputChange} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="endereco">Endereço</Label>
                <Input id="endereco" name="endereco" value={formData.endereco || ""} onChange={handleInputChange} />
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label htmlFor="email">E-mail</Label>
                <Input id="email" name="email" type="email" value={formData.email || ""} onChange={handleInputChange} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="telefone">Telefone</Label>
                <Input id="telefone" name="telefone" value={formData.telefone || ""} onChange={handleInputChange} />
              </div>
            </div>

            {/* --- SEÇÃO DO LOGO MODIFICADA --- */}
            <div className="space-y-4 border-t pt-6">
                <h3 className="text-lg font-medium text-gray-700">Identidade Visual</h3>
                <div className="space-y-2">
                    <Label htmlFor="logo_url">URL do Logo</Label>
                    <Input
                        id="logo_url"
                        name="logo_url"
                        type="url"
                        placeholder="https://exemplo.com/logo.png"
                        value={formData.logo_url || ""}
                        onChange={handleInputChange}
                    />
                    <p className="text-xs text-gray-500">Cole a URL completa da imagem do logo da sua escola.</p>
                </div>

                {/* Pré-visualização do logo a partir da URL */}
                {formData.logo_url && (
                    <div>
                        <Label>Pré-visualização</Label>
                        <div className="mt-2 w-32 h-32 flex items-center justify-center border rounded-md overflow-hidden bg-slate-50">
                            <img 
                                src={formData.logo_url} 
                                alt="Preview do logo" 
                                className="object-contain max-w-full max-h-full" 
                                onError={(e) => e.currentTarget.style.display = 'none'}
                                onLoad={(e) => e.currentTarget.style.display = 'block'}
                            />
                        </div>
                    </div>
                )}
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                    <Label htmlFor="cor_primaria">Cor Primária</Label>
                    <Input id="cor_primaria" name="cor_primaria" type="color" value={formData.cor_primaria || "#FFFFFF"} onChange={handleInputChange} className="h-12 p-1"/>
                </div>
                <div className="space-y-2">
                    <Label htmlFor="cor_secundaria">Cor Secundária</Label>
                    <Input id="cor_secundaria" name="cor_secundaria" type="color" value={formData.cor_secundaria || "#000000"} onChange={handleInputChange} className="h-12 p-1"/>
                </div>
            </div>
          </CardContent>
          <CardFooter>
            <Button type="submit" disabled={loading} className="w-full sm:w-auto">
              {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              {isNewUser ? "Criar Perfil da Escola" : "Salvar Alterações"}
            </Button>
          </CardFooter>
        </Card>
      </form>
    </div>
  );
};

export default EscolaConfigForm;