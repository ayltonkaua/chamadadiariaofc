import { useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export const usePresence = () => {
    const { user } = useAuth();

    useEffect(() => {
        if (!user) return;

        // Se não tiver escola_id, usa 'global' (isso ajuda a debugar quem está sem vínculo)
        const roomName = user.escola_id ? `escola:${user.escola_id}` : 'global';

        console.log(`[Presence] Usuário ${user.username} conectando na sala: ${roomName}`);

        const channel = supabase.channel(roomName, {
            config: {
                presence: {
                    key: user.id,
                },
            },
        });

        channel.subscribe(async (status) => {
            if (status === 'SUBSCRIBED') {
                // console.log(`[Presence] Conectado na sala ${roomName}`);
                await channel.track({
                    user_id: user.id,
                    online_at: new Date().toISOString(),
                    role: user.role || user.type, // Útil para debug
                });
            }
        });

        return () => {
            // console.log(`[Presence] Desconectando de ${roomName}`);
            supabase.removeChannel(channel);
        };
    }, [user?.id, user?.escola_id]); // Dependências cruciais
};
