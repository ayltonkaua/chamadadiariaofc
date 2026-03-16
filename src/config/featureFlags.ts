/**
 * Feature Flags
 * 
 * Controle centralizado de funcionalidades.
 * Mude para `true` para reativar a feature.
 */
export const FEATURE_FLAGS = {
  /** Prevenção de Evasão (análise IA) - rota /evasao */
  EVASAO_AI: false,

  /** Mapa de Alunos - rota /mapa */
  MAPA_ALUNOS: false,

  /** Bot WhatsApp - rota /gestor/whatsapp-bot */
  WHATSAPP_BOT: false,
} as const;
