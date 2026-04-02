-- Migration: Adicionar política de DELETE em whatsapp_justificativas
-- A tabela tinha RLS habilitado com SELECT, INSERT e UPDATE, mas não DELETE.
-- Isso fazia com que a exclusão pelo front-end (client-side Supabase) falhasse silenciosamente.

CREATE POLICY "Gestores podem excluir justificativas de suas escolas"
    ON public.whatsapp_justificativas FOR DELETE
    USING (
      escola_id IN (
        SELECT ur.escola_id FROM public.user_roles ur
        WHERE ur.user_id = auth.uid()
        AND ur.role IN ('admin', 'diretor', 'coordenador', 'secretario')
      )
    );
