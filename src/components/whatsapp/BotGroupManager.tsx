import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Loader2, Save, Users, RefreshCw, Star } from 'lucide-react';
import { whatsappBotService } from '@/domains/whatsappBot';
import type { WhatsAppBotConfig, WhatsAppGroup } from '@/domains/whatsappBot';
import { toast } from 'sonner';

interface BotGroupManagerProps {
    escolaId: string;
    config: WhatsAppBotConfig | null;
    isConnected: boolean;
    onSaveConfig: (cfg: Partial<WhatsAppBotConfig>) => Promise<void>;
    savingConfig: boolean;
}

export default function BotGroupManager({ escolaId, config, isConnected, onSaveConfig, savingConfig }: BotGroupManagerProps) {
    const [groups, setGroups] = useState<WhatsAppGroup[]>([]);
    const [loading, setLoading] = useState(false);
    const [favorites, setFavorites] = useState<Array<{ id: string; name: string }>>([]);

    // Sync favorites from config on mount
    useEffect(() => {
        if (config?.grupos_favoritos) {
            setFavorites(config.grupos_favoritos);
        }
    }, [config?.grupos_favoritos]);

    const loadGroups = async () => {
        if (!escolaId || !isConnected) return;
        setLoading(true);
        try {
            const data = await whatsappBotService.getWhatsAppGroups(escolaId);
            setGroups(data);
        } catch (err: any) {
            toast.error('Erro ao carregar grupos: ' + err.message);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (isConnected) loadGroups();
    }, [isConnected, escolaId]);

    const toggleFavorite = (group: WhatsAppGroup) => {
        setFavorites(prev => {
            const exists = prev.find(f => f.id === group.id);
            if (exists) {
                return prev.filter(f => f.id !== group.id);
            }
            return [...prev, { id: group.id, name: group.name }];
        });
    };

    const isFavorite = (groupId: string) => favorites.some(f => f.id === groupId);

    const hasChanges = JSON.stringify(favorites) !== JSON.stringify(config?.grupos_favoritos || []);

    const handleSave = async () => {
        await onSaveConfig({ grupos_favoritos: favorites } as any);
        toast.success('Grupos favoritos atualizados!');
    };

    if (!isConnected) {
        return (
            <Card className="border-dashed border-2 border-slate-200 bg-slate-50/50">
                <CardContent className="flex flex-col items-center justify-center py-12 text-slate-400">
                    <Users className="w-10 h-10 mb-3 opacity-30" />
                    <p className="text-sm font-medium">Conecte o WhatsApp para gerenciar grupos favoritos</p>
                </CardContent>
            </Card>
        );
    }

    return (
        <Card className="animate-in fade-in zoom-in-95 duration-200">
            <CardHeader className="pb-3">
                <div className="flex justify-between items-center">
                    <div>
                        <CardTitle className="flex items-center gap-2">
                            <Star className="h-5 w-5 text-amber-500" />
                            Grupos Favoritos
                        </CardTitle>
                        <CardDescription className="mt-1">
                            Selecione os grupos do WhatsApp que aparecerão no painel de disparos rápidos.
                        </CardDescription>
                    </div>
                    <div className="flex gap-2">
                        <Button variant="outline" size="sm" onClick={loadGroups} disabled={loading}>
                            <RefreshCw className={`h-4 w-4 mr-1 ${loading ? 'animate-spin' : ''}`} />
                            Atualizar
                        </Button>
                        <Button size="sm" onClick={handleSave} disabled={!hasChanges || savingConfig} className="bg-amber-500 hover:bg-amber-600 text-white">
                            {savingConfig ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Save className="h-4 w-4 mr-1" />}
                            Salvar ({favorites.length})
                        </Button>
                    </div>
                </div>
            </CardHeader>
            <CardContent>
                {loading && groups.length === 0 ? (
                    <div className="space-y-3">
                        {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-14 w-full rounded-lg" />)}
                    </div>
                ) : groups.length === 0 ? (
                    <div className="text-center py-8 text-slate-400">
                        <Users className="w-10 h-10 mx-auto mb-2 opacity-20" />
                        <p className="text-sm">Nenhum grupo encontrado no WhatsApp conectado.</p>
                    </div>
                ) : (
                    <div className="space-y-2 max-h-[400px] overflow-y-auto pr-1">
                        {groups.map(group => (
                            <div
                                key={group.id}
                                className={`flex items-center justify-between p-3 rounded-lg border transition-all cursor-pointer hover:shadow-sm ${
                                    isFavorite(group.id)
                                        ? 'bg-amber-50 border-amber-200 ring-1 ring-amber-100'
                                        : 'bg-white border-slate-100 hover:bg-slate-50'
                                }`}
                                onClick={() => toggleFavorite(group)}
                            >
                                <div className="flex items-center gap-3 min-w-0">
                                    <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${
                                        isFavorite(group.id)
                                            ? 'bg-amber-100 text-amber-600'
                                            : 'bg-slate-100 text-slate-400'
                                    }`}>
                                        <Users className="w-4 h-4" />
                                    </div>
                                    <div className="min-w-0">
                                        <p className="text-sm font-medium text-slate-700 truncate">{group.name}</p>
                                        <p className="text-xs text-slate-400">{group.participants} participantes</p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2 shrink-0">
                                    {isFavorite(group.id) && (
                                        <Badge className="bg-amber-100 text-amber-700 hover:bg-amber-100 text-[10px]">
                                            ⭐ Favorito
                                        </Badge>
                                    )}
                                    <Switch
                                        checked={isFavorite(group.id)}
                                        onCheckedChange={() => toggleFavorite(group)}
                                        onClick={(e) => e.stopPropagation()}
                                    />
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
