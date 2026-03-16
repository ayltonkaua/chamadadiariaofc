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
            log.error('Failed to get alunos acesso', { message: error.message });
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
        const { data, error: dbError } = await (supabase
            .from('convites_acesso' as any)
            .upsert(
                {
                    email: convite.email.trim().toLowerCase(),
                    escola_id: convite.escola_id,
                    role: convite.role,
                    invited_by: invitedBy,
                    reenviado_em: new Date().toISOString(),
                    status: 'pendente'
                },
                {
                    onConflict: 'email,escola_id',
                    ignoreDuplicates: false
                }
            )
            .select()
            .single() as any);

        if (dbError) {
            log.error('Failed to save convite', { message: dbError.message });
            throw new Error(dbError.message);
        }

        const typedData = data as { criado_em?: string; reenviado_em?: string } | null;
        const isResend = typedData?.criado_em && typedData?.reenviado_em &&
            new Date(typedData.criado_em).getTime() !== new Date(typedData.reenviado_em).getTime();

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
            log.error('Failed to update role', { message: error.message });
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
            log.error('Failed to remove staff access', { message: error.message });
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
            log.error('Failed to remove aluno access', { message: error.message });
            throw new Error(error.message);
        }
    },

    /**
     * Sends password reset email to a user
     */
    async sendPasswordReset(email: string): Promise<void> {
        log.info('Sending password reset', { email });

        const { error } = await supabase.auth.resetPasswordForEmail(email, {
            redirectTo: `${window.location.origin}/update-password`
        });

        if (error) {
            log.error('Failed to send password reset', { message: error.message });
            throw new Error(error.message);
        }
    },

    /**
     * Unlinks a student account (removes user_id from aluno record)
     */
    async unlinkStudentAccount(userId: string): Promise<void> {
        log.info('Unlinking student account', { userId });

        const { error } = await supabase
            .from('alunos')
            .update({ user_id: null } as any)
            .eq('user_id', userId);

        if (error) {
            log.error('Failed to unlink student account', { message: error.message });
            throw new Error(error.message);
        }
    },

    /**
     * Creates a staff account using an isolated signUp + RPC configuration.
     * Uses a separate Supabase client for signUp to avoid switching the admin session.
     * Step 1: Isolated signUp creates the user in GoTrue (no session switch)
     * Step 2: RPC configurar_conta_equipe sets user_roles + confirms email (as admin)
     */
    async criarContaEquipe(params: {
        email: string;
        nome: string;
        role: string;
        password: string;
    }): Promise<{ success: boolean; userId: string; message: string }> {
        log.info('Creating staff account', { email: params.email, role: params.role });

        // Step 1: Create a SEPARATE Supabase client that won't affect the admin session
        const { createClient } = await import('@supabase/supabase-js');
        const isolatedClient = createClient(
            import.meta.env.VITE_SUPABASE_URL,
            import.meta.env.VITE_SUPABASE_ANON_KEY,
            {
                auth: {
                    persistSession: false,   // Don't save to localStorage
                    autoRefreshToken: false,  // Don't auto-refresh
                    detectSessionInUrl: false,
                },
            }
        );

        const { data: signUpData, error: signUpError } = await isolatedClient.auth.signUp({
            email: params.email.trim().toLowerCase(),
            password: params.password,
            options: {
                data: {
                    username: params.nome.trim(),
                    role: params.role,
                    must_change_password: true,
                },
            },
        });

        if (signUpError) {
            log.error('Failed to create staff account (signUp error)', { message: signUpError.message });
            if (signUpError.message.includes('already registered')) {
                throw new Error('Este email já está cadastrado no sistema');
            }
            throw new Error(signUpError.message || 'Erro ao criar conta');
        }

        const newUserId = signUpData.user?.id;
        if (!newUserId) {
            throw new Error('Erro inesperado: usuário criado mas sem ID');
        }

        // Step 2: Configure role + confirm email via SECURITY DEFINER RPC
        // This runs on the MAIN client (as the admin user)
        // @ts-expect-error RPC not in generated types
        const { data: rawData, error: rpcError } = await supabase.rpc('configurar_conta_equipe', {
            p_user_id: newUserId,
            p_role: params.role,
            p_nome: params.nome.trim(),
        });

        if (rpcError) {
            log.error('Failed to configure staff account (RPC error)', { message: rpcError.message });
            throw new Error(rpcError.message || 'Conta criada, mas erro ao configurar permissões');
        }

        const data = rawData as any;

        if (data && !data.success) {
            log.error('Failed to configure staff account (logic error)', { message: data.error });
            throw new Error(data.error || 'Conta criada, mas erro ao configurar permissões');
        }

        log.info('Staff account created and configured successfully', { userId: newUserId });
        return {
            success: true,
            userId: newUserId,
            message: data?.message || 'Conta criada com sucesso',
        };
    },
};

/**
 * Generates a random temporary password.
 * Format: 3 lowercase letters + 2 digits + 3 uppercase letters (e.g., abc12XYZ)
 * Easy to read aloud and type, but sufficiently random.
 */
export function generateTempPassword(): string {
    const lower = 'abcdefghijkmnopqrstuvwxyz'; // no 'l'
    const upper = 'ABCDEFGHJKLMNPQRSTUVWXYZ';  // no 'I', 'O'
    const digits = '23456789';                   // no '0', '1'

    let password = '';
    for (let i = 0; i < 3; i++) password += lower[Math.floor(Math.random() * lower.length)];
    for (let i = 0; i < 2; i++) password += digits[Math.floor(Math.random() * digits.length)];
    for (let i = 0; i < 3; i++) password += upper[Math.floor(Math.random() * upper.length)];

    return password;
}
