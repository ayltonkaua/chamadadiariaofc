import React, { useState } from 'react';
import { useEscolaConfig } from '@/contexts/EscolaConfigContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, Upload, Check, X } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

const EscolaConfigForm: React.FC = () => {
  const { config, loading, error, updateConfig } = useEscolaConfig();
  const [isUpdating, setIsUpdating] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [formData, setFormData] = useState({
    nome: '',
    endereco: '',
    telefone: '',
    email: '',
    cor_primaria: '#7c3aed',
    cor_secundaria: '#f3f4f6',
    url_logo: ''
  });

  React.useEffect(() => {
    if (config) {
      setFormData({
        nome: config.nome,
        endereco: config.endereco,
        telefone: config.telefone,
        email: config.email,
        cor_primaria: config.cor_primaria,
        cor_secundaria: config.cor_secundaria,
        url_logo: config.url_logo || ''
      });
    }
  }, [config]);

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleLogoUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      setUploadingLogo(true);
      
      // Verificar tipo de arquivo
      if (!file.type.startsWith('image/')) {
        alert('Por favor, selecione apenas arquivos de imagem.');
        return;
      }

      // Verificar tamanho (máximo 5MB)
      if (file.size > 5 * 1024 * 1024) {
        alert('O arquivo deve ter no máximo 5MB.');
        return;
      }

      const fileExt = file.name.split('.').pop();
      const fileName = `${Date.now()}.${fileExt}`;
      const filePath = `logos/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('escola-assets')
        .upload(filePath, file);

      if (uploadError) {
        throw uploadError;
      }

      const { data: { publicUrl } } = supabase.storage
        .from('escola-assets')
        .getPublicUrl(filePath);

      handleInputChange('url_logo', publicUrl);
    } catch (error) {
      console.error('Erro ao fazer upload do logo:', error);
      alert('Erro ao fazer upload do logo. Tente novamente.');
    } finally {
      setUploadingLogo(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsUpdating(true);

    try {
      const success = await updateConfig(formData);
      if (success) {
        alert('Configurações atualizadas com sucesso!');
      }
    } catch (error) {
      console.error('Erro ao atualizar configurações:', error);
    } finally {
      setIsUpdating(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin" />
        <span className="ml-2">Carregando configurações...</span>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      <div className="text-center">
        <h1 className="text-3xl font-bold mb-2">Perfil da Escola</h1>
        <p className="text-gray-600">Gerencie as informações institucionais da sua escola.</p>
      </div>

      {error && (
        <Alert variant="destructive">
          <X className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Informações Básicas */}
        <Card>
          <CardHeader>
            <CardTitle>Informações Básicas</CardTitle>
            <CardDescription>
              Configure o nome, endereço e informações de contato da escola.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="nome">Nome da Escola *</Label>
                <Input
                  id="nome"
                  value={formData.nome}
                  onChange={(e) => handleInputChange('nome', e.target.value)}
                  placeholder="Nome da escola"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">E-mail *</Label>
                <Input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => handleInputChange('email', e.target.value)}
                  placeholder="contato@escola.com"
                  required
                />
              </div>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="endereco">Endereço *</Label>
              <Textarea
                id="endereco"
                value={formData.endereco}
                onChange={(e) => handleInputChange('endereco', e.target.value)}
                placeholder="Endereço completo da escola"
                required
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="telefone">Telefone *</Label>
              <Input
                id="telefone"
                value={formData.telefone}
                onChange={(e) => handleInputChange('telefone', e.target.value)}
                placeholder="(11) 1234-5678"
                required
              />
            </div>
          </CardContent>
        </Card>

        {/* Identidade Visual */}
        <Card>
          <CardHeader>
            <CardTitle>Identidade Visual</CardTitle>
            <CardDescription>
              Personalize as cores e logo da sua escola.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Logo */}
            <div className="space-y-4">
              <Label>Logo da Escola</Label>
              <div className="flex items-center gap-4">
                {formData.url_logo && (
                  <div className="relative">
                    <img
                      src={formData.url_logo}
                      alt="Logo da escola"
                      className="w-20 h-20 object-contain border rounded-lg"
                    />
                  </div>
                )}
                <div className="flex-1 space-y-3">
                  {/* URL Externa */}
                  <div className="space-y-2">
                    <Label htmlFor="url_logo">URL do Logo (opcional)</Label>
                    <Input
                      id="url_logo"
                      type="url"
                      value={formData.url_logo}
                      onChange={(e) => handleInputChange('url_logo', e.target.value)}
                      placeholder="https://exemplo.com/logo.png"
                      className="w-full"
                    />
                    <p className="text-xs text-gray-500">
                      Cole aqui a URL de uma imagem externa para usar como logo
                    </p>
                  </div>
                  
                  {/* Upload de Arquivo */}
                  <div className="space-y-2">
                    <Label>Ou faça upload de um arquivo</Label>
                    <Input
                      type="file"
                      accept="image/*"
                      onChange={handleLogoUpload}
                      disabled={uploadingLogo}
                      className="hidden"
                      id="logo-upload"
                    />
                    <Label
                      htmlFor="logo-upload"
                      className="cursor-pointer inline-flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50"
                    >
                      {uploadingLogo ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Upload className="h-4 w-4" />
                      )}
                      {uploadingLogo ? 'Fazendo upload...' : 'Selecionar Logo'}
                    </Label>
                    <p className="text-sm text-gray-500">
                      Formatos aceitos: JPG, PNG, GIF. Máximo 5MB.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Cores */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="cor_primaria">Cor Primária</Label>
                <div className="flex gap-2">
                  <Input
                    id="cor_primaria"
                    type="color"
                    value={formData.cor_primaria}
                    onChange={(e) => handleInputChange('cor_primaria', e.target.value)}
                    className="w-16 h-10 p-1"
                  />
                  <Input
                    value={formData.cor_primaria}
                    onChange={(e) => handleInputChange('cor_primaria', e.target.value)}
                    placeholder="#7c3aed"
                    className="flex-1"
                  />
                </div>
                <p className="text-sm text-gray-500">
                  Cor principal usada no sistema
                </p>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="cor_secundaria">Cor Secundária</Label>
                <div className="flex gap-2">
                  <Input
                    id="cor_secundaria"
                    type="color"
                    value={formData.cor_secundaria}
                    onChange={(e) => handleInputChange('cor_secundaria', e.target.value)}
                    className="w-16 h-10 p-1"
                  />
                  <Input
                    value={formData.cor_secundaria}
                    onChange={(e) => handleInputChange('cor_secundaria', e.target.value)}
                    placeholder="#f3f4f6"
                    className="flex-1"
                  />
                </div>
                <p className="text-sm text-gray-500">
                  Cor de fundo e elementos secundários
                </p>
              </div>
            </div>

            {/* Preview */}
            <div className="space-y-2">
              <Label>Preview da Identidade Visual</Label>
              <div 
                className="p-4 rounded-lg border"
                style={{ backgroundColor: formData.cor_secundaria }}
              >
                <div className="flex items-center gap-3">
                  {formData.url_logo && (
                    <img
                      src={formData.url_logo}
                      alt="Logo preview"
                      className="w-8 h-8 object-contain"
                    />
                  )}
                  <h3 
                    className="font-bold text-lg"
                    style={{ color: formData.cor_primaria }}
                  >
                    {formData.nome || 'Nome da Escola'}
                  </h3>
                </div>
                <p className="text-sm text-gray-600 mt-2">
                  Esta é uma prévia de como sua escola aparecerá no sistema.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Botões */}
        <div className="flex justify-end gap-4">
          <Button
            type="submit"
            disabled={isUpdating}
            className="min-w-[120px]"
          >
            {isUpdating ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                Salvando...
              </>
            ) : (
              <>
                <Check className="h-4 w-4 mr-2" />
                Salvar Alterações
              </>
            )}
          </Button>
        </div>
      </form>
    </div>
  );
};

export default EscolaConfigForm; 