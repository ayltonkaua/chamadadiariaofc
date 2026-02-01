/**
 * Escola Types
 * 
 * Type definitions for the Escola domain.
 */

import type { Database } from '@/integrations/supabase/types';

// Database row type
export type EscolaConfig = Database['public']['Tables']['escola_configuracao']['Row'];
export type EscolaConfigInsert = Database['public']['Tables']['escola_configuracao']['Insert'];
export type EscolaConfigUpdate = Database['public']['Tables']['escola_configuracao']['Update'];

// Simplified config for theming
export interface EscolaTema {
    nome: string;
    corPrimaria: string;
    corSecundaria: string;
    urlLogo: string | null;
    tipo_chamada?: 'diaria' | 'disciplina'; // Added field
}
