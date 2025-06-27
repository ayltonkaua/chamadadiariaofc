# Sidebar Responsivo - Chamada Diária

## Visão Geral

Foi implementado um sistema de sidebar responsivo para a aplicação Chamada Diária, que oferece navegação lateral em desktop e um menu hambúrguer em dispositivos móveis.

## Características

### 🖥️ Desktop (md e acima)
- Sidebar fixo na lateral esquerda
- Largura de 256px (w-64)
- Sempre visível
- Navegação completa com submenus

### 📱 Mobile (abaixo de md)
- Menu hambúrguer no canto superior esquerdo
- Sidebar deslizante (Sheet) da esquerda
- Largura de 320px (w-80)
- Header móvel com logo e botão de menu

## Componentes

### 1. Sidebar.tsx
Componente principal do sidebar que inclui:
- Navegação com ícones e texto
- Informações do usuário
- Submenus expansíveis
- Botão de logout
- Responsividade automática

### 2. Layout.tsx
Wrapper que gerencia quando mostrar o sidebar:
- Mostra sidebar apenas para usuários autenticados
- Opção de desabilitar sidebar para páginas específicas
- Fallback para layout simples quando necessário

## Estrutura do Menu

```typescript
const menuItems = [
  {
    title: 'Dashboard',
    icon: Home,
    href: '/dashboard',
    description: 'Visão geral do sistema'
  },
  {
    title: 'Chamadas',
    icon: UserCheck,
    href: '/dashboard',
    subItems: [
      { title: 'Fazer Chamada', href: '/dashboard', icon: Calendar },
      { title: 'Histórico', href: '/dashboard', icon: ClipboardList },
    ]
  },
  // ... outros itens
];
```

## Uso

### Páginas com Sidebar (padrão)
```tsx
<Route path="/dashboard" element={<Layout><Dashboard /></Layout>} />
```

### Páginas sem Sidebar
```tsx
<Route path="/login" element={<Layout showSidebar={false}><LoginPage /></Layout>} />
```

## Responsividade

### Breakpoints
- **Mobile**: < 768px - Menu hambúrguer
- **Desktop**: ≥ 768px - Sidebar fixo

### Comportamento
- **Mobile**: Sidebar deslizante com overlay
- **Desktop**: Sidebar sempre visível
- **Transição**: Suave entre os modos

## Estilização

### Cores
- **Primária**: Purple (roxo)
- **Background**: Gray-50
- **Bordas**: Gray-200
- **Texto**: Gray-900/700/600

### Animações
- Transições suaves no hover
- Animações de entrada/saída no mobile
- Feedback visual nos estados ativos

## Funcionalidades

### Navegação
- Links ativos destacados
- Submenus organizados
- Navegação por rota

### Usuário
- Exibe email do usuário logado
- Botão de logout integrado
- Avatar placeholder

### Mobile
- Botão de menu fixo
- Header responsivo
- Sidebar com overlay

## Tecnologias Utilizadas

- **React Router**: Navegação
- **Radix UI**: Componente Sheet
- **Tailwind CSS**: Estilização
- **Lucide React**: Ícones
- **Shadcn/ui**: Componentes base

## Customização

### Adicionar Novo Item de Menu
```typescript
{
  title: 'Novo Item',
  icon: IconComponent,
  href: '/nova-rota',
  description: 'Descrição do item'
}
```

### Modificar Estilos
Editar classes Tailwind no componente `Sidebar.tsx`

### Alterar Breakpoints
Modificar classes `md:` para outros breakpoints do Tailwind

## Considerações de Acessibilidade

- Navegação por teclado
- Labels semânticos
- Contraste adequado
- Foco visível
- Screen reader friendly 