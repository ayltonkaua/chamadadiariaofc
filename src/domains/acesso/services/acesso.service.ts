/**
 * Acesso (Access Management) Service
 * 
 * Business logic for user access and team management.
 */

import { supabase } from '@/integrations/supabase/client';
import { logger } from '@/core';
import type { MembroEquipe, AlunoAcesso, ConviteAcesso } from '../types/acesso.types';

const log = logger.child('AcessoService');

/**
 * Helper function to call RPC with type coercion.
 * Called at runtime to ensure supabase is initialized.
 */
function callRpc(name: string, params?: Record<string, unknown>) {
    return (supabase.rpc as (name: string, params?: Record<string, unknown>) => ReturnType<typeof supabase.rpc>)(name, params);
}

export const acessoService = {
    /**
     * Gets all school users (via RPC)
     */
    async getEquipe(escolaId: string): Promise<MembroEquipe[]> {
        log.debug('Getting equipe', { escolaId });

        const { data, error } = await callRpc('get_school_users', { _escola_id: escolaId });

        if (error) {
            log.error('Failed to get equipe', error);
            return [];
        }

        return (data as unknown as MembroEquipe[]) || [];
    },

    /**
     * Gets all students with access info
     */
    async getAlunosAcesso(escolaId: string): Promise<AlunoAcesso[]> {
        log.debug('Getting alunos acesso', { escolaId });

        const { data, error } = await supabase
            .from('alunos')
            .select('id, nome, matricula, user_id, turmas ( nome )')
            .order('nome');

        if (error) {
            log.error('Failed to get alunos acesso', error);
            return [];
        }

        return (data || []).map((aluno: any) => ({
            id: aluno.id,
            nome: aluno.nome,
            matricula: aluno.matricula,
            turma_nome: aluno.turmas?.nome || 'Sem Turma',
            user_id: aluno.user_id
        }));
    },

    /**
     * Sends an invitation to a new team member.
     * Uses UPSERT to handle resends gracefully (no 409 error).
     * Returns signup link for manual sharing (doesn't depend on Magic Link).
     */
    async enviarConvite(
        convite: ConviteAcesso,
        invitedBy: string
    ): Promise<{ isResend: boolean; signupLink: string; magicLinkSent: boolean }> {
        log.info('Sending convite', { email: convite.email, role: convite.role });

        // 1. UPSERT invitation (handles both new and resend)
        const { data, error: dbError } = await supabase
            .from('convites_acesso')
            .upsert(
                {
                    email: convite.email.trim().toLowerCase(),
                    escola_id: convite.escola_id,
                    role: convite.role,
                    invited_by: invitedBy,
                    reenviado_em: new Date().toISOString(),
                    status: 'pendente'
                } as any,
                {
                    onConflict: 'email,escola_id',
                    ignoreDuplicates: false
                }
            )
            .select()
            .single();

        if (dbError) {
            log.error('Failed to save convite', dbError);
            throw new Error(dbError.message);
        }

        const isResend = data?.criado_em && data?.reenviado_em &&
            new Date(data.criado_em).getTime() !== new Date(data.reenviado_em).getTime();

        if (isResend) {
            log.info('Convite reenviado', { email: convite.email });
        } else {
            log.info('Novo convite criado', { email: convite.email });
        }

        // 2. Generate signup link (always works)
        const signupLink = `${window.location.origin}/register?email=${encodeURIComponent(convite.email)}&escola=${convite.escola_id}`;

        // 3. Try to send Magic Link (non-blocking - failure is OK)
        let magicLinkSent = false;
        try {
            const { error: authError } = await supabase.auth.signInWithOtp({
                email: convite.email.trim(),
                options: {
                    emailRedirectTo: window.location.origin + '/dashboard',
                    data: {
                        invited_by: invitedBy,
                        escola_id: convite.escola_id
                    }
                }
            });

            if (!authError) {
                magicLinkSent = true;
                log.info('Magic link enviado com sucesso');
            } else {
                log.warn('Magic link falhou (não crítico)', { code: authError.code });
            }
        } catch (e) {
            log.warn('Magic link exception (não crítico)', e);
        }

        return { isResend, signupLink, magicLinkSent };
    },

    /**
     * Updates a user's role
     */
    async updateRole(userId: string, escolaId: string, newRole: string): Promise<void> {
        log.info('Updating role', { userId, newRole });

        const { error } = await supabase
            .from('user_roles')
            .update({ role: newRole } as any)
            .eq('user_id', userId)
            .eq('escola_id', escolaId);

        if (error) {
            log.error('Failed to update role', error);
            throw new Error(error.message);
        }
    },

    /**
     * Removes access for a staff member
     */
    async removerAcessoStaff(userId: string): Promise<void> {
        log.info('Removing staff access', { userId });

        const { error } = await supabase
            .from('user_roles')
            .delete()
            .eq('user_id', userId);

        if (error) {
            log.error('Failed to remove staff access', error);
            throw new Error(error.message);
        }
    },

    /**
     * Removes access for a student (unlink user_id)
     */
    async removerAcessoAluno(userId: string): Promise<void> {
        log.info('Removing aluno access', { userId });

        const { error } = await supabase
            .from('alunos')
            .update({ user_id: null } as any)
            .eq('user_id', userId);

        if (error) {
            log.error('Failed to remove aluno access', error);
            throw new Error(error.message);
        }
    }
};
