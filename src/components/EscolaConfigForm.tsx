import React, { useState } from 'react';
import { useEscolaConfig } from '@/contexts/EscolaConfigContext';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, Upload, Check, X, AlertTriangle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

const EscolaConfigForm: React.FC = () => {
  const { config, loading, error, updateConfig, refreshConfig } = useEscolaConfig();
  const { user, refreshUserData } = useAuth();
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

  // Debug: verificar dados do usuário
  console.log('EscolaConfigForm - User:', user);
  console.log('EscolaConfigForm - User escola_id:', user?.escola_id);
  console.log('EscolaConfigForm - User role:', user?.role);

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
        await refreshConfig();
        if (user?.escola_id) {
          alert('Configurações atualizadas com sucesso!');
        } else {
          alert('Escola criada com sucesso! Atualizando configurações...');
          await refreshUserData();
        }
      }
    } catch (error) {
      console.error('Erro ao atualizar configurações:', error);
    } finally {
      setIsUpdating(false);
    }
  };

  // Verificar se o usuário tem permissão para editar
  const canEdit = user; // Qualquer usuário logado pode editar

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin" />
        <span className="ml-2">Carregando configurações...</span>
      </div>
    );
  }

  // Se o usuário não está logado, mostrar aviso
  if (!canEdit) {
    return (
      <div className="max-w-4xl mx-auto p-6 space-y-6">
        <div className="text-center">
          <h1 className="text-3xl font-bold mb-2">Perfil da Escola</h1>
          <p className="text-gray-600">Gerencie as informações institucionais da sua escola.</p>
        </div>

        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            <strong>Acesso Restrito:</strong> Você precisa estar logado para configurar o perfil da escola.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      <div className="text-center">
        <h1 className="text-3xl font-bold mb-2">Perfil da Escola</h1>
        <p className="text-gray-600">Gerencie as informações institucionais da sua escola.</p>
        {!user?.escola_id ? (
          <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <p className="text-blue-800 text-sm">
              <strong>Primeira vez aqui?</strong> Configure o perfil da sua escola. 
              Uma nova escola será criada automaticamente para você.
            </p>
          </div>
        ) : (
          <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded-lg">
            <p className="text-green-800 text-sm">
              <strong>Escola configurada!</strong> Você pode editar as informações da sua escola abaixo.
            </p>
          </div>
        )}
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
                  <div className="flex-shrink-0">
                    <img 
                      src={formData.url_logo} 
                      alt="Logo da escola" 
                      className="h-20 w-auto object-contain border rounded"
                    />
                  </div>
                )}
                <div className="flex-1 space-y-2">
                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => document.getElementById('logo-upload')?.click()}
                      disabled={uploadingLogo}
                    >
                      {uploadingLogo ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Upload className="h-4 w-4" />
                      )}
                      {uploadingLogo ? 'Fazendo upload...' : 'Fazer upload'}
                    </Button>
                    <input
                      id="logo-upload"
                      type="file"
                      accept="image/*"
                      onChange={handleLogoUpload}
                      className="hidden"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="url_logo">Ou insira a URL do logo</Label>
                    <Input
                      id="url_logo"
                      value={formData.url_logo}
                      onChange={(e) => handleInputChange('url_logo', e.target.value)}
                      placeholder="https://exemplo.com/logo.png"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Cores */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="cor_primaria">Cor Primária *</Label>
                <div className="flex items-center gap-2">
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
                  />
                </div>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="cor_secundaria">Cor Secundária *</Label>
                <div className="flex items-center gap-2">
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
                  />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Botão de Salvar */}
        <div className="flex justify-end">
          <Button
            type="submit"
            disabled={isUpdating}
            className="flex items-center gap-2"
          >
            {isUpdating ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Check className="h-4 w-4" />
            )}
            {isUpdating 
              ? 'Salvando...' 
              : user?.escola_id 
                ? 'Atualizar Configurações' 
                : 'Criar Escola'
            }
          </Button>
        </div>
      </form>
    </div>
  );
};

export default EscolaConfigForm; 