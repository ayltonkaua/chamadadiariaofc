/**
 * AddParticipantsModal - Add participants to a WhatsApp group
 * 
 * Features:
 * - Manual input (up to 5 comma-separated numbers)
 * - Select from registered students with phones
 * - Max 5 numbers per request to avoid WhatsApp ban
 * - Real-time feedback per number (success/fail)
 */

import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Checkbox } from '@/components/ui/checkbox';
import { UserPlus, Loader2, CheckCircle2, XCircle, Search } from 'lucide-react';
import { whatsappBotService } from '@/domains/whatsappBot';
import type { GroupCandidate, AddToGroupResult } from '@/domains/whatsappBot';
import { useToast } from '@/hooks/use-toast';

interface AddParticipantsModalProps {
    open: boolean;
    onClose: () => void;
    escolaId: string;
    groupId: string;
    groupName: string;
}

export default function AddParticipantsModal({
    open,
    onClose,
    escolaId,
    groupId,
    groupName,
}: AddParticipantsModalProps) {
    const { toast } = useToast();

    // Manual input
    const [manualNumbers, setManualNumbers] = useState('');

    // Student selection
    const [candidates, setCandidates] = useState<GroupCandidate[]>([]);
    const [selectedPhones, setSelectedPhones] = useState<Set<string>>(new Set());
    const [searchQuery, setSearchQuery] = useState('');
    const [loadingCandidates, setLoadingCandidates] = useState(false);

    // Submit state
    const [adding, setAdding] = useState(false);
    const [result, setResult] = useState<AddToGroupResult | null>(null);

    // Load candidates when modal opens
    useEffect(() => {
        if (open && escolaId && groupId) {
            loadCandidates();
        }
        if (!open) {
            // Reset state when closed
            setManualNumbers('');
            setSelectedPhones(new Set());
            setSearchQuery('');
            setResult(null);
        }
    }, [open, escolaId, groupId]);

    const loadCandidates = async () => {
        setLoadingCandidates(true);
        try {
            const data = await whatsappBotService.getGroupCandidates(escolaId, groupId);
            setCandidates(data);
        } catch (err: any) {
            console.error('Error loading candidates:', err);
        } finally {
            setLoadingCandidates(false);
        }
    };

    // Toggle a phone number selection
    const togglePhone = (phone: string) => {
        const newSet = new Set(selectedPhones);
        if (newSet.has(phone)) {
            newSet.delete(phone);
        } else {
            if (newSet.size >= 5) {
                toast({
                    title: 'Limite atingido',
                    description: 'Máximo de 5 números por vez',
                    variant: 'destructive',
                });
                return;
            }
            newSet.add(phone);
        }
        setSelectedPhones(newSet);
    };

    // Filter candidates by search
    const filteredCandidates = candidates.filter(c =>
        c.nome.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.matricula.includes(searchQuery) ||
        c.turma.toLowerCase().includes(searchQuery.toLowerCase())
    );

    // Handle manual add
    const handleManualAdd = async () => {
        const numbers = manualNumbers
            .split(/[,;\n]/)
            .map(n => n.trim())
            .filter(Boolean);

        if (numbers.length === 0) {
            toast({ title: 'Informe pelo menos um número', variant: 'destructive' });
            return;
        }
        if (numbers.length > 5) {
            toast({ title: 'Máximo de 5 números por vez', variant: 'destructive' });
            return;
        }

        await addToGroup(numbers);
    };

    // Handle student selection add
    const handleStudentAdd = async () => {
        const phones = Array.from(selectedPhones);
        if (phones.length === 0) {
            toast({ title: 'Selecione pelo menos um número', variant: 'destructive' });
            return;
        }
        await addToGroup(phones);
    };

    // Call API to add to group
    const addToGroup = async (telefones: string[]) => {
        setAdding(true);
        setResult(null);

        try {
            const res = await whatsappBotService.addToGroup(escolaId, groupId, telefones);
            setResult(res);

            toast({
                title: `${res.added} de ${res.total} adicionados`,
                description: res.failed > 0 ? `${res.failed} falharam` : 'Todos adicionados com sucesso!',
                variant: res.failed > 0 ? 'destructive' : 'default',
            });
        } catch (err: any) {
            toast({
                title: 'Erro ao adicionar',
                description: err.message,
                variant: 'destructive',
            });
        } finally {
            setAdding(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
            <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <UserPlus className="h-5 w-5" />
                        Adicionar Participantes
                    </DialogTitle>
                    <DialogDescription>
                        Grupo: <strong>{groupName}</strong>
                        <br />
                        <span className="text-amber-600 text-xs">
                            ⚠️ Máximo de 5 números por vez. O número conectado precisa ser admin do grupo.
                        </span>
                    </DialogDescription>
                </DialogHeader>

                {/* Results display */}
                {result && (
                    <div className="space-y-2 p-3 bg-gray-50 rounded-lg">
                        <div className="flex gap-2">
                            <Badge className="bg-green-100 text-green-700">
                                <CheckCircle2 className="h-3 w-3 mr-1" /> {result.added} adicionados
                            </Badge>
                            {result.failed > 0 && (
                                <Badge className="bg-red-100 text-red-700">
                                    <XCircle className="h-3 w-3 mr-1" /> {result.failed} falharam
                                </Badge>
                            )}
                        </div>
                        <div className="space-y-1">
                            {result.details.map((d, i) => (
                                <div key={i} className="flex items-center gap-2 text-xs">
                                    {d.success ? (
                                        <CheckCircle2 className="h-3 w-3 text-green-500" />
                                    ) : (
                                        <XCircle className="h-3 w-3 text-red-500" />
                                    )}
                                    <span className="font-mono">{d.phone}</span>
                                    {d.error && <span className="text-red-500">— {d.error}</span>}
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {!result && (
                    <Tabs defaultValue="manual" className="w-full">
                        <TabsList className="grid w-full grid-cols-2">
                            <TabsTrigger value="manual">Manual</TabsTrigger>
                            <TabsTrigger value="sistema">Do Sistema</TabsTrigger>
                        </TabsList>

                        {/* Manual Input Tab */}
                        <TabsContent value="manual" className="space-y-3">
                            <div className="space-y-2">
                                <Label>Números (máx 5, separados por vírgula)</Label>
                                <Input
                                    value={manualNumbers}
                                    onChange={(e) => setManualNumbers(e.target.value)}
                                    placeholder="(85) 91234-5678, (85) 98765-4321"
                                    disabled={adding}
                                />
                                <p className="text-xs text-gray-500">
                                    Separe múltiplos números com vírgula, ponto e vírgula ou em novas linhas.
                                </p>
                            </div>
                            <Button
                                onClick={handleManualAdd}
                                disabled={adding || !manualNumbers.trim()}
                                className="w-full gap-2"
                            >
                                {adding ? (
                                    <>
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                        Adicionando... (pode levar ~25s)
                                    </>
                                ) : (
                                    <>
                                        <UserPlus className="h-4 w-4" />
                                        Adicionar ao Grupo
                                    </>
                                )}
                            </Button>
                        </TabsContent>

                        {/* System Selection Tab */}
                        <TabsContent value="sistema" className="space-y-3">
                            {/* Search */}
                            <div className="relative">
                                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-400" />
                                <Input
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    placeholder="Buscar por nome, matrícula ou turma..."
                                    className="pl-9"
                                />
                            </div>

                            {/* Selection info */}
                            <div className="flex items-center justify-between text-sm">
                                <span className="text-gray-500">
                                    {selectedPhones.size} de 5 selecionados
                                </span>
                                {selectedPhones.size > 0 && (
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => setSelectedPhones(new Set())}
                                        className="text-xs h-6"
                                    >
                                        Limpar seleção
                                    </Button>
                                )}
                            </div>

                            {/* Candidates list */}
                            <div className="border rounded-lg max-h-[300px] overflow-y-auto divide-y">
                                {loadingCandidates ? (
                                    <div className="flex items-center justify-center py-8">
                                        <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
                                    </div>
                                ) : filteredCandidates.length === 0 ? (
                                    <div className="text-center py-6 text-sm text-gray-500">
                                        Nenhum aluno com telefone cadastrado
                                    </div>
                                ) : (
                                    filteredCandidates.map((candidate) => (
                                        <div key={candidate.id} className="p-2.5 hover:bg-gray-50">
                                            <div className="flex items-start justify-between gap-2">
                                                <div className="min-w-0">
                                                    <p className="text-sm font-medium truncate">{candidate.nome}</p>
                                                    <p className="text-xs text-gray-500">
                                                        {candidate.turma} • Mat: {candidate.matricula}
                                                    </p>
                                                </div>
                                            </div>
                                            {/* Phone checkboxes */}
                                            <div className="mt-1.5 space-y-1">
                                                {candidate.telefone_responsavel && (
                                                    <label className="flex items-center gap-2 cursor-pointer">
                                                        <Checkbox
                                                            checked={selectedPhones.has(candidate.telefone_responsavel)}
                                                            onCheckedChange={() => togglePhone(candidate.telefone_responsavel!)}
                                                            disabled={adding}
                                                        />
                                                        <span className="text-xs font-mono">
                                                            {candidate.telefone_responsavel}
                                                        </span>
                                                    </label>
                                                )}
                                                {candidate.telefone_responsavel_2 && (
                                                    <label className="flex items-center gap-2 cursor-pointer">
                                                        <Checkbox
                                                            checked={selectedPhones.has(candidate.telefone_responsavel_2)}
                                                            onCheckedChange={() => togglePhone(candidate.telefone_responsavel_2!)}
                                                            disabled={adding}
                                                        />
                                                        <span className="text-xs font-mono">
                                                            {candidate.telefone_responsavel_2}
                                                            <span className="text-gray-400 ml-1">(2º)</span>
                                                        </span>
                                                    </label>
                                                )}
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>

                            {/* Add button */}
                            <Button
                                onClick={handleStudentAdd}
                                disabled={adding || selectedPhones.size === 0}
                                className="w-full gap-2"
                            >
                                {adding ? (
                                    <>
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                        Adicionando... (pode levar ~25s)
                                    </>
                                ) : (
                                    <>
                                        <UserPlus className="h-4 w-4" />
                                        Adicionar {selectedPhones.size} ao Grupo
                                    </>
                                )}
                            </Button>
                        </TabsContent>
                    </Tabs>
                )}

                <DialogFooter>
                    <Button variant="outline" onClick={onClose}>
                        Fechar
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
