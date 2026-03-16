import React, { useState, useEffect } from "react";
import { useEscolaConfig } from "@/contexts/EscolaConfigContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Palette, Check, X, MapPin } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/hooks/use-toast";
import { LogoUploader } from "@/components/LogoUploader";
import { geocodeAddress } from "@/lib/geocoding.service";

const EscolaConfigForm: React.FC = () => {
  const { config, saveConfig, loading } = useEscolaConfig();
  const { user } = useAuth();
  const [formData, setFormData] = useState(config);

  // Color suggestion state
  const [coresSugeridas, setCoresSugeridas] = useState<{ primary: string; secondary: string } | null>(null);

  // Geocoding state
  const [geocodingStatus, setGeocodingStatus] = useState<'idle' | 'loading' | 'found' | 'not_found'>(
    (config as any)?.latitude ? 'found' : 'idle'
  );

  const handleEnderecoBlur = async () => {
    const endereco = formData.endereco;
    if (!endereco || endereco.trim().length < 5) {
      setGeocodingStatus('idle');
      return;
    }
    setGeocodingStatus('loading');
    const result = await geocodeAddress(endereco);
    if (result) {
      setFormData((prev: any) => ({ ...prev, latitude: result.latitude, longitude: result.longitude }));
      setGeocodingStatus('found');
    } else {
      setFormData((prev: any) => ({ ...prev, latitude: null, longitude: null }));
      setGeocodingStatus('not_found');
    }
  };

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

  const handleColorsExtracted = (primary: string, secondary: string) => {
    setCoresSugeridas({ primary, secondary });
    toast({
      title: "🎨 Cores detectadas!",
      description: "Cores extraídas da logo. Clique em 'Aplicar' se desejar usá-las.",
    });
  };

  const aplicarCoresSugeridas = () => {
    if (coresSugeridas) {
      setFormData((prev) => ({
        ...prev,
        cor_primaria: coresSugeridas.primary,
        cor_secundaria: coresSugeridas.secondary,
      }));
      setCoresSugeridas(null);
      toast({ title: "Cores aplicadas!", description: "Lembre-se de salvar as alterações." });
    }
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
                <Input
                  id="endereco"
                  name="endereco"
                  value={formData.endereco || ""}
                  onChange={handleInputChange}
                  onBlur={handleEnderecoBlur}
                  placeholder="Rua, número, bairro, cidade"
                />
                {geocodingStatus === 'loading' && (
                  <p className="text-xs text-blue-600 flex items-center gap-1">
                    <Loader2 className="h-3 w-3 animate-spin" /> Buscando localização...
                  </p>
                )}
                {geocodingStatus === 'found' && (
                  <p className="text-xs text-green-600 flex items-center gap-1">
                    <MapPin className="h-3 w-3" /> Localização da escola encontrada
                  </p>
                )}
                {geocodingStatus === 'not_found' && (
                  <p className="text-xs text-amber-600 flex items-center gap-1">
                    Endereço não localizado. Tente ser mais específico (ex: rua, número, cidade, estado).
                  </p>
                )}
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

            {/* IDENTIDADE VISUAL */}
            <div className="space-y-4 border-t pt-6">
              <h3 className="text-lg font-medium text-gray-700">Identidade Visual</h3>

              {/* Logo Upload */}
              <div className="space-y-2">
                <Label>Logo da Escola</Label>
                <LogoUploader
                  currentUrl={formData.url_logo}
                  escolaId={user.escola_id || "new"}
                  onUploadComplete={(url) => {
                    setFormData((prev) => ({ ...prev, url_logo: url }));
                  }}
                  onRemove={() => {
                    setFormData((prev) => ({ ...prev, url_logo: null }));
                    setCoresSugeridas(null);
                  }}
                  onColorsExtracted={handleColorsExtracted}
                />
              </div>

              {/* Color Suggestion Banner */}
              {coresSugeridas && (
                <div className="flex items-center justify-between bg-violet-50 border border-violet-200 rounded-xl p-4 animate-in fade-in slide-in-from-bottom-2">
                  <div className="flex items-center gap-3">
                    <Palette className="h-5 w-5 text-violet-600" />
                    <div>
                      <p className="text-sm font-medium text-violet-800">Cores detectadas na logo</p>
                      <div className="flex items-center gap-2 mt-1">
                        <div
                          className="w-6 h-6 rounded-full border-2 border-white shadow-sm"
                          style={{ backgroundColor: coresSugeridas.primary }}
                          title={`Primária: ${coresSugeridas.primary}`}
                        />
                        <div
                          className="w-6 h-6 rounded-full border-2 border-white shadow-sm"
                          style={{ backgroundColor: coresSugeridas.secondary }}
                          title={`Secundária: ${coresSugeridas.secondary}`}
                        />
                        <span className="text-xs text-violet-600 ml-1">
                          {coresSugeridas.primary} / {coresSugeridas.secondary}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={() => setCoresSugeridas(null)}
                      className="text-gray-500"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      onClick={aplicarCoresSugeridas}
                      className="bg-violet-600 hover:bg-violet-700 text-white"
                    >
                      <Check className="h-4 w-4 mr-1" /> Aplicar
                    </Button>
                  </div>
                </div>
              )}

              {/* Color Pickers */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="cor_primaria">Cor Primária</Label>
                  <div className="flex items-center gap-3">
                    <Input
                      id="cor_primaria"
                      name="cor_primaria"
                      type="color"
                      value={formData.cor_primaria || "#7c3aed"}
                      onChange={handleInputChange}
                      className="h-12 w-16 p-1 cursor-pointer"
                    />
                    <Input
                      type="text"
                      value={formData.cor_primaria || "#7c3aed"}
                      onChange={(e) => setFormData((prev) => ({ ...prev, cor_primaria: e.target.value }))}
                      className="font-mono text-sm flex-1"
                      maxLength={7}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="cor_secundaria">Cor Secundária</Label>
                  <div className="flex items-center gap-3">
                    <Input
                      id="cor_secundaria"
                      name="cor_secundaria"
                      type="color"
                      value={formData.cor_secundaria || "#2563eb"}
                      onChange={handleInputChange}
                      className="h-12 w-16 p-1 cursor-pointer"
                    />
                    <Input
                      type="text"
                      value={formData.cor_secundaria || "#2563eb"}
                      onChange={(e) => setFormData((prev) => ({ ...prev, cor_secundaria: e.target.value }))}
                      className="font-mono text-sm flex-1"
                      maxLength={7}
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-4 border-t pt-6">
              <h3 className="text-lg font-medium text-gray-700">Configurações Pedagógicas</h3>
              <div className="space-y-2">
                <Label htmlFor="tipo_chamada">Tipo de Chamada</Label>
                <select
                  id="tipo_chamada"
                  name="tipo_chamada"
                  value={formData.tipo_chamada || "diaria"}
                  onChange={(e) => setFormData((prev) => ({ ...prev, tipo_chamada: e.target.value as 'diaria' | 'disciplina' }))}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <option value="diaria">Dia Inteiro (Padrão)</option>
                  <option value="disciplina">Por Disciplina</option>
                </select>
                <p className="text-xs text-gray-500">
                  <strong>Dia Inteiro:</strong> Uma única chamada para o dia todo.<br />
                  <strong>Por Disciplina:</strong> O professor seleciona a disciplina ao fazer a chamada.
                </p>
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
