import React, { useEffect } from 'react';
import { useEscolaTheme } from '@/hooks/useEscolaTheme';

interface EscolaThemeProviderProps {
  children: React.ReactNode;
}

const EscolaThemeProvider: React.FC<EscolaThemeProviderProps> = ({ children }) => {
  const { getCSSVariables } = useEscolaTheme();

  useEffect(() => {
    const cssVariables = getCSSVariables();
    
    // Aplicar variáveis CSS ao elemento root
    const root = document.documentElement;
    Object.entries(cssVariables).forEach(([property, value]) => {
      root.style.setProperty(property, value);
    });

    // Cleanup function para remover as variáveis quando o componente for desmontado
    return () => {
      Object.keys(cssVariables).forEach((property) => {
        root.style.removeProperty(property);
      });
    };
  }, [getCSSVariables]);

  return <>{children}</>;
};

export default EscolaThemeProvider; 