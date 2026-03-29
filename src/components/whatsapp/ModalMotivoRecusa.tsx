import React, { useState } from 'react';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Loader2, AlertTriangle, Send } from 'lucide-react';

interface ModalMotivoRecusaProps {
    open: boolean;
    onClose: () => void;
    onConfirm: (motivo: string) => Promise<void>;
    alunoNome: string;
    telefonePai: string;
}

export default function ModalMotivoRecusa({ open, onClose, onConfirm, alunoNome, telefonePai }: ModalMotivoRecusaProps) {
    const [motivo, setMotivo] = useState('');
    const [submitting, setSubmitting] = useState(false);

    const isValid = motivo.trim().length >= 10;

    const handleConfirm = async () => {
        if (!isValid) return;
        setSubmitting(true);
        try {
            await onConfirm(motivo.trim());
            setMotivo('');
            onClose();
        } catch (err) {
            // Error handling is done by the parent
        } finally {
            setSubmitting(false);
        }
    };

    const handleClose = () => {
        if (submitting) return;
        setMotivo('');
        onClose();
    };

    return (
        <Dialog open={open} onOpenChange={handleClose}>
            <DialogContent className="sm:max-w-[480px]">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2 text-rose-700">
                        <AlertTriangle className="w-5 h-5" />
                        Motivo da Recusa
                    </DialogTitle>
                    <DialogDescription className="text-sm text-slate-500 pt-1">
                        A justificativa do aluno(a) <strong className="text-slate-700">{alunoNome}</strong> será 
                        recusada e o responsável ({telefonePai}) receberá uma notificação por WhatsApp.
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-3 py-2">
                    <label className="text-sm font-semibold text-slate-700">
                        Descreva o motivo da recusa: <span className="text-rose-500">*</span>
                    </label>
                    <Textarea
                        placeholder="Ex: O atestado enviado está ilegível / O documento não confere com as datas informadas..."
                        value={motivo}
                        onChange={(e) => setMotivo(e.target.value)}
                        className="min-h-[120px] text-sm resize-none bg-slate-50 focus:bg-white"
                        disabled={submitting}
                    />
                    {motivo.length > 0 && motivo.trim().length < 10 && (
                        <p className="text-xs text-rose-500">Mínimo de 10 caracteres.</p>
                    )}

                    <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-800 flex gap-2">
                        <Send className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                        <div>
                            <strong>O que acontecerá:</strong>
                            <ol className="list-decimal ml-4 mt-1 space-y-0.5">
                                <li>A justificativa será marcada como RECUSADA</li>
                                <li>O responsável receberá a mensagem via WhatsApp</li>
                                <li>O ticket será removido do Kanban automaticamente</li>
                            </ol>
                        </div>
                    </div>
                </div>

                <DialogFooter className="gap-2 sm:gap-0">
                    <Button variant="outline" onClick={handleClose} disabled={submitting}>
                        Cancelar
                    </Button>
                    <Button 
                        onClick={handleConfirm} 
                        disabled={!isValid || submitting}
                        className="bg-rose-600 hover:bg-rose-700 text-white"
                    >
                        {submitting ? (
                            <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Processando...</>
                        ) : (
                            <><AlertTriangle className="w-4 h-4 mr-2" /> Confirmar Recusa e Notificar</>
                        )}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
