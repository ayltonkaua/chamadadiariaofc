/**
 * Date Utilities
 * 
 * Funções centralizadas para manipulação de datas.
 * Sempre usa fuso horário LOCAL (não UTC) para evitar bugs
 * onde a data avança 1 dia após 21:00 no BRT (UTC-3).
 */

import { format } from 'date-fns';

/**
 * Retorna a data LOCAL no formato 'yyyy-MM-dd'.
 * 
 * ⚠️ NÃO use `new Date().toISOString().split('T')[0]` — 
 * isso converte para UTC e causa bugs de fuso horário.
 * 
 * @param date - Data a formatar (padrão: agora)
 * @returns string no formato 'yyyy-MM-dd' usando fuso local
 */
export function getLocalDateString(date: Date = new Date()): string {
    return format(date, 'yyyy-MM-dd');
}
