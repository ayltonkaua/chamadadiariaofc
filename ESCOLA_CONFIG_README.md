# Sistema de Configuração da Escola

Este documento descreve como funciona o sistema de configuração personalizada para cada escola no Chamada Diária.

## Visão Geral

O sistema permite que cada escola tenha sua própria identidade visual e informações institucionais únicas, incluindo:

- **Nome da escola**
- **Endereço e informações de contato**
- **Cores primária e secundária personalizadas**
- **Logo institucional**
- **Tema visual aplicado em toda a aplicação**

## Estrutura do Banco de Dados

### Tabela: `escola_configuracao`

```sql
CREATE TABLE escola_configuracao (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome VARCHAR(255) NOT NULL,
  endereco TEXT NOT NULL,
  telefone VARCHAR(50) NOT NULL,
  email VARCHAR(255) NOT NULL,
  criado_em TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  atualizado_em TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  cor_primaria VARCHAR(7) NOT NULL DEFAULT '#7c3aed',
  cor_secundaria VARCHAR(7) NOT NULL DEFAULT '#f3f4f6',
  url_logo TEXT
);
```

## Componentes Principais

### 1. EscolaConfigContext (`src/contexts/EscolaConfigContext.tsx`)

Contexto React que gerencia as configurações da escola:

```typescript
interface EscolaConfigContextType {
  config: EscolaConfig | null;
  loading: boolean;
  error: string | null;
  updateConfig: (config: Partial<EscolaConfig>) => Promise<boolean>;
  refreshConfig: () => Promise<void>;
}
```

**Funcionalidades:**
- Carrega configurações do banco de dados
- Cria configuração padrão se não existir
- Atualiza configurações em tempo real
- Gerencia estado de loading e erros

### 2. EscolaConfigForm (`src/components/EscolaConfigForm.tsx`)

Formulário completo para editar configurações da escola:

**Recursos:**
- Edição de informações básicas (nome, endereço, telefone, email)
- Upload de logo com validação de arquivo
- Seletor de cores primária e secundária
- Preview em tempo real das mudanças
- Validação de formulário
- Feedback visual de sucesso/erro

### 3. EscolaThemeProvider (`src/components/EscolaThemeProvider.tsx`)

Aplica o tema da escola globalmente usando CSS variables:

```typescript
const cssVariables = {
  '--escola-primary': primaryColor,
  '--escola-secondary': secondaryColor,
  '--escola-primary-light': `${primaryColor}20`,
  '--escola-primary-lighter': `${primaryColor}10`,
  // ...
};
```

### 4. useEscolaTheme Hook (`src/hooks/useEscolaTheme.ts`)

Hook personalizado para usar o tema da escola em componentes:

```typescript
const { primaryColor, secondaryColor, getThemeStyles, getCSSVariables } = useEscolaTheme();
```

## Como Usar

### 1. Configurando uma Nova Escola

1. Acesse `/perfil-escola` no sistema
2. Preencha as informações básicas da escola
3. Faça upload do logo (opcional)
4. Escolha as cores primária e secundária
5. Salve as configurações

### 2. Aplicando o Tema em Componentes

#### Usando o Hook useEscolaTheme:

```typescript
import { useEscolaTheme } from '@/hooks/useEscolaTheme';

const MeuComponente = () => {
  const { primaryColor, getThemeStyles } = useEscolaTheme();
  
  return (
    <button style={getThemeStyles.primaryButton}>
      Botão com tema da escola
    </button>
  );
};
```

#### Usando Classes CSS:

```typescript
// Classes disponíveis no CSS global
<button className="btn-escola-primary">Botão Primário</button>
<button className="btn-escola-secondary">Botão Secundário</button>
<div className="card-escola">Card com tema</div>
<span className="badge-escola">Badge</span>
```

#### Usando CSS Variables:

```css
.meu-componente {
  color: var(--escola-primary);
  background-color: var(--escola-secondary);
  border: 1px solid var(--escola-primary-light);
}
```

### 3. Exemplo de Implementação

```typescript
import React from 'react';
import { useEscolaTheme } from '@/hooks/useEscolaTheme';
import { Card, CardContent } from '@/components/ui/card';

const ExemploComponente = () => {
  const { primaryColor, secondaryColor } = useEscolaTheme();

  return (
    <Card className="card-escola">
      <CardContent>
        <h2 style={{ color: primaryColor }}>Título da Escola</h2>
        <p>Conteúdo com tema personalizado</p>
        <button 
          className="btn-escola-primary"
          style={{ backgroundColor: primaryColor }}
        >
          Ação Principal
        </button>
      </CardContent>
    </Card>
  );
};
```

## Configuração do Storage

Para o upload de logos, configure um bucket no Supabase Storage:

```sql
-- Criar bucket para assets da escola
INSERT INTO storage.buckets (id, name, public) 
VALUES ('escola-assets', 'escola-assets', true);

-- Política para permitir upload de imagens
CREATE POLICY "Permitir upload de imagens" ON storage.objects
FOR INSERT WITH CHECK (
  bucket_id = 'escola-assets' AND 
  (storage.extension(name)) = ANY(ARRAY['jpg', 'jpeg', 'png', 'gif', 'webp'])
);

-- Política para permitir visualização pública
CREATE POLICY "Visualização pública" ON storage.objects
FOR SELECT USING (bucket_id = 'escola-assets');
```

## Classes CSS Disponíveis

### Cores
- `.escola-primary` - Cor primária
- `.escola-primary-bg` - Background com cor primária
- `.escola-secondary-bg` - Background com cor secundária

### Botões
- `.btn-escola-primary` - Botão primário
- `.btn-escola-secondary` - Botão secundário

### Cards e Containers
- `.card-escola` - Card com tema da escola
- `.badge-escola` - Badge com tema

### Estados
- `.hover:escola-primary-light` - Hover com cor primária clara
- `.focus:escola-primary` - Focus com cor primária

### Componentes Específicos
- `.table-escola` - Tabela com tema
- `.pagination-escola` - Paginação com tema
- `.dropdown-escola` - Dropdown com tema
- `.alert-escola-info` - Alertas informativos
- `.spinner-escola` - Loading spinner

## Variáveis CSS Disponíveis

```css
:root {
  --escola-primary: #7c3aed;
  --escola-secondary: #f3f4f6;
  --escola-primary-light: #7c3aed20;
  --escola-primary-lighter: #7c3aed10;
  --escola-primary-dark: #7c3aeddd;
  --escola-primary-darker: #7c3aedbb;
}
```

## Melhores Práticas

1. **Sempre use o hook `useEscolaTheme`** para acessar as cores da escola
2. **Prefira classes CSS** para estilos comuns
3. **Use CSS variables** para estilos customizados
4. **Mantenha fallbacks** para quando as configurações não estiverem carregadas
5. **Teste com diferentes cores** para garantir contraste adequado

## Troubleshooting

### Problemas Comuns

1. **Cores não aparecem**: Verifique se o `EscolaConfigProvider` está envolvendo a aplicação
2. **Logo não carrega**: Verifique as políticas do Supabase Storage
3. **Tema não atualiza**: Verifique se o `EscolaThemeProvider` está aplicando as CSS variables

### Debug

```typescript
// Verificar configurações atuais
const { config, loading, error } = useEscolaConfig();
console.log('Configurações da escola:', config);

// Verificar cores do tema
const { primaryColor, secondaryColor } = useEscolaTheme();
console.log('Cores do tema:', { primaryColor, secondaryColor });
```

## Extensões Futuras

- [ ] Suporte a múltiplos temas (claro/escuro)
- [ ] Configuração de fonte personalizada
- [ ] Templates de layout pré-definidos
- [ ] Exportação/importação de configurações
- [ ] Histórico de mudanças de configuração 