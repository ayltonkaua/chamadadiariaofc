/**
 * AI Message Generator Component
 *
 * Allows school staff to describe what they want to communicate,
 * pick a tone & message type, and get 3 AI-generated WhatsApp messages.
 */

import { useState, type ReactNode } from 'react';
import { whatsappBotService } from '@/domains/whatsappBot';
import type { AiMessageTom, AiMessageTipo } from '@/domains/whatsappBot';
import { toast } from '@/components/ui/use-toast';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
    Sparkles,
    Loader2,
    Copy,
    Check,
    RefreshCw,
    MessageCircle,
    Wand2,
    ArrowRight,
    ClipboardList,
    Smile,
    AlertTriangle,
    Info,
    Megaphone,
    PartyPopper,
    Handshake,
    BarChart3,
    PenLine,
    Lightbulb,
    Zap,
    Brain,
    Clock,
} from 'lucide-react';

// =====================
// CONSTANTS
// =====================

const TOM_OPTIONS: { value: AiMessageTom; label: string; icon: ReactNode }[] = [
    { value: 'formal', label: 'Formal', icon: <ClipboardList className="h-4 w-4 text-slate-500" /> },
    { value: 'amigavel', label: 'Amigável', icon: <Smile className="h-4 w-4 text-amber-500" /> },
    { value: 'urgente', label: 'Urgente', icon: <AlertTriangle className="h-4 w-4 text-red-500" /> },
    { value: 'informativo', label: 'Informativo', icon: <Info className="h-4 w-4 text-blue-500" /> },
];

const TIPO_OPTIONS: { value: AiMessageTipo; label: string; icon: ReactNode }[] = [
    { value: 'aviso', label: 'Aviso Geral', icon: <Megaphone className="h-4 w-4 text-orange-500" /> },
    { value: 'evento', label: 'Evento Escolar', icon: <PartyPopper className="h-4 w-4 text-pink-500" /> },
    { value: 'reuniao', label: 'Reunião', icon: <Handshake className="h-4 w-4 text-indigo-500" /> },
    { value: 'frequencia', label: 'Frequência / Faltas', icon: <BarChart3 className="h-4 w-4 text-emerald-500" /> },
    { value: 'outro', label: 'Outro', icon: <PenLine className="h-4 w-4 text-slate-500" /> },
];

const EXEMPLOS = [
    'Amanhã não haverá aula devido à reunião pedagógica',
    'Dia 15 teremos festa junina na escola às 18h',
    'Lembrar que as provas bimestrais começam na próxima semana',
    'Solicitar que tragam 1kg de alimento não perecível para a campanha solidária',
    'Informar que as notas do 1º bimestre já estão disponíveis no portal',
];

interface AiMessageGeneratorProps {
    /** Callback when user selects a message to use elsewhere */
    onSelectMessage?: (message: string) => void;
    /** If true, wraps the entire component in a Dialog triggered by a button */
    isModal?: boolean;
    triggerButton?: ReactNode;
}

export default function AiMessageGenerator({ onSelectMessage, isModal = false, triggerButton }: AiMessageGeneratorProps) {
    const [open, setOpen] = useState(false);
    // Form state
    const [descricao, setDescricao] = useState('');
    const [tom, setTom] = useState<AiMessageTom>('amigavel');
    const [tipo, setTipo] = useState<AiMessageTipo>('aviso');

    // Results state
    const [versoes, setVersoes] = useState<string[]>([]);
    const [modelo, setModelo] = useState<string>('');
    const [loading, setLoading] = useState(false);
    const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

    // =====================
    // Generate
    // =====================
    const handleGenerate = async () => {
        if (!descricao.trim()) {
            toast({ title: 'Descreva o que deseja comunicar', variant: 'destructive' });
            return;
        }

        setLoading(true);
        setVersoes([]);
        setModelo('');

        try {
            const result = await whatsappBotService.generateAiMessage({
                descricao: descricao.trim(),
                tom,
                tipo,
            });

            setVersoes(result.versoes);
            setModelo(result.modelo);

            toast({
                title: 'Mensagens geradas!',
                description: `${result.versoes.length} versão(ões) via ${result.modelo === 'groq' ? 'Groq (Llama)' : result.modelo === 'gemini' ? 'Google Gemini' : result.modelo}`,
            });
        } catch (err: any) {
            toast({
                title: 'Erro ao gerar mensagens',
                description: err.message || 'Tente novamente em alguns segundos',
                variant: 'destructive',
            });
        } finally {
            setLoading(false);
        }
    };

    // =====================
    // Copy to clipboard
    // =====================
    const handleCopy = async (text: string, index: number) => {
        try {
            await navigator.clipboard.writeText(text);
            setCopiedIndex(index);
            toast({ title: 'Mensagem copiada!' });
            setTimeout(() => setCopiedIndex(null), 2000);
        } catch {
            toast({ title: 'Erro ao copiar', variant: 'destructive' });
        }
    };

    // =====================
    // Use example
    // =====================
    const handleUseExample = () => {
        const random = EXEMPLOS[Math.floor(Math.random() * EXEMPLOS.length)];
        setDescricao(random);
    };

    const handleSelectMessage = (message: string) => {
        if (onSelectMessage) {
            onSelectMessage(message);
        }
        setOpen(false); // fechar modal se estiver aberto
    };

    // =====================
    // Render
    // =====================
    const generatorContent = (
        <div className="space-y-6">
            <div className={`${!isModal ? 'border border-purple-200 rounded-lg p-5 shadow-sm bg-white' : ''}`}>
                {!isModal && (
                    <div className="pb-3 border-b mb-4">
                        <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-800">
                            <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center shadow-md">
                                <Wand2 className="h-4 w-4 text-white" />
                            </div>
                            Gerador de Mensagens com IA
                        </h2>
                        <p className="text-sm text-slate-500 mt-1">
                            Descreva o que deseja comunicar e a IA criará versões prontas para WhatsApp
                        </p>
                    </div>
                )}
                
                <div className="space-y-4">
                    {/* Description textarea */}
                    <div>
                        <div className="flex items-center justify-between mb-1.5">
                            <label className="text-sm font-medium text-slate-700">
                                O que você deseja comunicar?
                            </label>
                            <button
                                onClick={handleUseExample}
                                className="flex items-center gap-1 text-xs text-purple-600 hover:text-purple-800 hover:underline transition-colors"
                            >
                                <Lightbulb className="h-3 w-3" />
                                Usar exemplo
                            </button>
                        </div>
                        <Textarea
                            placeholder="Ex: Amanhã não haverá aula devido à reunião pedagógica dos professores..."
                            value={descricao}
                            onChange={(e) => setDescricao(e.target.value)}
                            rows={3}
                            className="resize-none border-purple-100 focus-visible:ring-purple-200"
                        />
                    </div>

                    {/* Tom + Tipo selectors */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                            <label className="text-sm font-medium text-slate-700 mb-1.5 block">
                                Tom da mensagem
                            </label>
                            <Select
                                value={tom}
                                onValueChange={(v) => setTom(v as AiMessageTom)}
                            >
                                <SelectTrigger className="w-full">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    {TOM_OPTIONS.map((opt) => (
                                        <SelectItem key={opt.value} value={opt.value}>
                                            <span className="flex items-center gap-2">
                                                {opt.icon}
                                                {opt.label}
                                            </span>
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div>
                            <label className="text-sm font-medium text-slate-700 mb-1.5 block">
                                Tipo de mensagem
                            </label>
                            <Select
                                value={tipo}
                                onValueChange={(v) => setTipo(v as AiMessageTipo)}
                            >
                                <SelectTrigger className="w-full">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    {TIPO_OPTIONS.map((opt) => (
                                        <SelectItem key={opt.value} value={opt.value}>
                                            <span className="flex items-center gap-2">
                                                {opt.icon}
                                                {opt.label}
                                            </span>
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    {/* Generate button */}
                    <Button
                        onClick={handleGenerate}
                        disabled={loading || !descricao.trim()}
                        className="w-full bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white shadow-md h-11"
                    >
                        {loading ? (
                            <>
                                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                Gerando mensagens...
                            </>
                        ) : (
                            <>
                                <Sparkles className="h-4 w-4 mr-2" />
                                Gerar com IA
                            </>
                        )}
                    </Button>
                </div>
            </div>

            {/* Results */}
            {versoes.length > 0 && (
                <div className="space-y-4">
                    {/* Header */}
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <MessageCircle className="h-5 w-5 text-purple-500" />
                            <h3 className="text-sm font-semibold text-slate-700">
                                {versoes.length} versão(ões) gerada(s)
                            </h3>
                            {modelo && (
                                <Badge variant="outline" className="text-xs flex items-center gap-1">
                                    {modelo === 'groq' ? (
                                        <><Zap className="h-3 w-3" /> Groq</>
                                    ) : modelo === 'gemini' ? (
                                        <><Brain className="h-3 w-3" /> Gemini</>
                                    ) : modelo}
                                </Badge>
                            )}
                        </div>
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={handleGenerate}
                            disabled={loading}
                            className="text-purple-600 hover:text-purple-800"
                        >
                            <RefreshCw className={`h-3.5 w-3.5 mr-1 ${loading ? 'animate-spin' : ''}`} />
                            Gerar novamente
                        </Button>
                    </div>

                    {/* version cards */}
                    {versoes.map((versao, index) => (
                        <div
                            key={index}
                            className="bg-white border rounded-lg border-slate-200 hover:border-purple-300 hover:shadow-md transition-all duration-200 group p-4"
                        >
                                {/* Version label */}
                                <div className="flex items-center justify-between mb-3">
                                    <Badge
                                        variant="secondary"
                                        className="bg-purple-100 text-purple-700 text-xs"
                                    >
                                        Versão {index + 1}
                                    </Badge>
                                    <div className={`flex items-center gap-1.5 transition-opacity ${isModal ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => handleCopy(versao, index)}
                                            className="h-7 px-2 text-xs"
                                        >
                                            {copiedIndex === index ? (
                                                <>
                                                    <Check className="h-3.5 w-3.5 mr-1 text-green-600" />
                                                    Copiado!
                                                </>
                                            ) : (
                                                <>
                                                    <Copy className="h-3.5 w-3.5 mr-1" />
                                                    Copiar
                                                </>
                                            )}
                                        </Button>
                                        {onSelectMessage && (
                                            <Button
                                                variant="default"
                                                size="sm"
                                                onClick={() => handleSelectMessage(versao)}
                                                className="h-7 px-2 text-xs bg-purple-600 hover:bg-purple-700"
                                            >
                                                <ArrowRight className="h-3.5 w-3.5 mr-1" />
                                                Aplicar Texto
                                            </Button>
                                        )}
                                    </div>
                                </div>

                                {/* WhatsApp-style message preview */}
                                <div className="bg-[#e5f7d3] rounded-lg rounded-tl-none p-3 shadow-sm max-w-[90%] font-sans text-sm">
                                    <p className="text-slate-800 whitespace-pre-wrap leading-relaxed">
                                        {versao}
                                    </p>
                                </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );

    if (isModal) {
        return (
            <Dialog open={open} onOpenChange={setOpen}>
                <DialogTrigger asChild>
                    {triggerButton || (
                        <Button variant="outline" className="text-purple-600 border-purple-200 bg-purple-50 hover:bg-purple-100">
                             <Sparkles className="h-4 w-4 mr-2" />
                             Gerar Mensagem
                        </Button>
                    )}
                </DialogTrigger>
                <DialogContent className="sm:max-w-[550px] max-h-[85vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2 text-purple-700">
                           <Wand2 className="h-5 w-5" /> 
                           Assistente de Escrita (IA)
                        </DialogTitle>
                        <DialogDescription>
                            Gere textos em segundos usando a Inteligência Artificial
                        </DialogDescription>
                    </DialogHeader>
                    <div className="pt-2 pb-4">
                        {generatorContent}
                    </div>
                </DialogContent>
            </Dialog>
        );
    }

    return generatorContent;
}
