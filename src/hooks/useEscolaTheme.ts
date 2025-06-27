import { useEscolaConfig } from '@/contexts/EscolaConfigContext';

export const useEscolaTheme = () => {
  const { config } = useEscolaConfig();

  const primaryColor = config?.cor_primaria || '#7c3aed';
  const secondaryColor = config?.cor_secundaria || '#f3f4f6';

  const getThemeStyles = {
    // Estilos para botões primários
    primaryButton: {
      backgroundColor: primaryColor,
      color: '#ffffff',
      '&:hover': {
        backgroundColor: `${primaryColor}dd`, // 87% de opacidade
      },
      '&:active': {
        backgroundColor: `${primaryColor}bb`, // 73% de opacidade
      }
    },

    // Estilos para botões secundários
    secondaryButton: {
      backgroundColor: 'transparent',
      color: primaryColor,
      border: `1px solid ${primaryColor}`,
      '&:hover': {
        backgroundColor: `${primaryColor}10`, // 10% de opacidade
      }
    },

    // Estilos para links ativos
    activeLink: {
      backgroundColor: `${primaryColor}20`, // 20% de opacidade
      color: primaryColor,
    },

    // Estilos para links inativos
    inactiveLink: {
      color: primaryColor,
      '&:hover': {
        backgroundColor: `${primaryColor}10`, // 10% de opacidade
      }
    },

    // Estilos para cards com tema
    themedCard: {
      borderColor: `${primaryColor}30`, // 30% de opacidade
      backgroundColor: secondaryColor,
    },

    // Estilos para textos com cor primária
    primaryText: {
      color: primaryColor,
    },

    // Estilos para backgrounds com cor secundária
    secondaryBackground: {
      backgroundColor: secondaryColor,
    },

    // Estilos para bordas com cor primária
    primaryBorder: {
      borderColor: primaryColor,
    },

    // Estilos para badges/indicadores
    badge: {
      backgroundColor: `${primaryColor}20`,
      color: primaryColor,
    }
  };

  const getCSSVariables = () => ({
    '--escola-primary': primaryColor,
    '--escola-secondary': secondaryColor,
    '--escola-primary-light': `${primaryColor}20`,
    '--escola-primary-lighter': `${primaryColor}10`,
    '--escola-primary-dark': `${primaryColor}dd`,
    '--escola-primary-darker': `${primaryColor}bb`,
  });

  return {
    primaryColor,
    secondaryColor,
    getThemeStyles,
    getCSSVariables,
    config
  };
}; 