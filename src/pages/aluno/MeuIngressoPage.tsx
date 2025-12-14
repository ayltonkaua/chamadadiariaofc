import React, { useRef, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import QRCode from "react-qr-code";
import * as htmlToImage from 'html-to-image';
import download from 'downloadjs';
import { Button } from '@/components/ui/button';
import { Download, ArrowLeft, Loader2 } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { ingressoService, type EventoPublico } from '@/domains';

export default function MeuIngressoPage() {
    const { user, loadingUser } = useAuth();
    const navigate = useNavigate();
    const ticketRef = useRef<HTMLDivElement>(null);
    const [evento, setEvento] = useState<EventoPublico | null>(null);
    const [loading, setLoading] = useState(true);
    const [debugInfo, setDebugInfo] = useState<string>('');

    useEffect(() => {
        const fetchEvento = async () => {
            if (loadingUser) {
                console.log("[MeuIngresso] Aguardando user carregar...");
                return;
            }

            if (!user) {
                setLoading(false);
                setDebugInfo('Usuário não autenticado');
                return;
            }

            if (!user.escola_id) {
                setDebugInfo(`User carregado mas sem escola_id. Type: ${user.type}`);
                setLoading(false);
                return;
            }

            console.log("[MeuIngresso] Buscando evento via service");
            setDebugInfo(`Buscando eventos...`);

            try {
                const data = await ingressoService.getActiveEvento(user.escola_id);
                if (data) {
                    setEvento(data);
                    setDebugInfo('');
                } else {
                    setDebugInfo('Nenhum evento ativo encontrado');
                }
            } catch (err: any) {
                console.error("[MeuIngresso] Exception:", err);
                setDebugInfo(`Erro: ${err.message}`);
            } finally {
                setLoading(false);
            }
        };

        fetchEvento();
    }, [user, loadingUser]);

    const handleDownload = () => {
        if (ticketRef.current) {
            htmlToImage.toPng(ticketRef.current)
                .then((dataUrl) => {
                    download(dataUrl, `ingresso-${user?.username || 'aluno'}.png`);
                })
                .catch(err => console.error("Erro ao gerar imagem:", err));
        }
    };

    // Estado de carregamento
    if (loading || loadingUser) {
        return (
            <div className="flex flex-col items-center justify-center min-h-screen bg-slate-50 p-8">
                <Loader2 className="h-8 w-8 animate-spin text-purple-600 mb-4" />
                <p className="text-gray-500">Carregando ingresso...</p>
            </div>
        );
    }

    // Estado sem evento
    if (!evento) {
        return (
            <div className="flex flex-col items-center justify-center min-h-screen bg-slate-50 p-4">
                {/* Header com botão voltar */}
                <div className="w-full max-w-sm flex items-center gap-2 mb-8">
                    <Button variant="ghost" size="icon" onClick={() => navigate('/portal-aluno')}>
                        <ArrowLeft className="h-5 w-5" />
                    </Button>
                    <span className="text-gray-500">Voltar ao Portal</span>
                </div>

                <div className="bg-gray-100 p-6 rounded-full mb-4">
                    <span className="text-4xl">😢</span>
                </div>
                <h2 className="text-xl font-bold text-gray-700">Nenhum evento ativo</h2>
                <p className="text-gray-500 mt-2 text-center">
                    Não encontramos festas ativas para sua escola agora.
                </p>

                {/* Debug info para ajudar a diagnosticar */}
                {debugInfo && (
                    <div className="mt-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg text-xs text-yellow-800 max-w-sm">
                        <strong>Debug:</strong> {debugInfo}
                    </div>
                )}

                <div className="mt-4 text-xs text-gray-400">
                    User ID: {user?.id?.slice(0, 8)}...<br />
                    Escola ID: {user?.escola_id?.slice(0, 8) || 'N/A'}...<br />
                    Aluno ID: {user?.aluno_id?.slice(0, 8) || 'N/A'}...
                </div>
            </div>
        );
    }

    // CORREÇÃO 5: Garantir que aluno_id existe
    const qrData = JSON.stringify({
        e: evento.id,
        a: user?.aluno_id || user?.id // Fallback para user.id se aluno_id não existir
    });

    return (
        <div className="flex flex-col items-center min-h-screen bg-slate-50 p-4 pb-24 animate-in fade-in zoom-in duration-300">
            {/* Header com botão voltar */}
            <div className="w-full max-w-sm flex items-center gap-2 mb-4">
                <Button variant="ghost" size="icon" onClick={() => navigate('/portal-aluno')}>
                    <ArrowLeft className="h-5 w-5" />
                </Button>
                <h1 className="text-2xl font-bold text-purple-800">Seu Ingresso</h1>
            </div>

            <div
                ref={ticketRef}
                className="bg-white w-full max-w-sm rounded-3xl overflow-hidden shadow-2xl relative border border-gray-100"
            >
                <div className="bg-[#6D28D9] p-6 text-center pt-8 pb-12 rounded-b-[40px]">
                    <h2 className="text-white text-xl font-black uppercase tracking-wider">{evento.nome}</h2>
                    <p className="text-purple-200 text-xs mt-1">Acesso exclusivo para alunos</p>
                </div>

                <div className="flex flex-col items-center -mt-10 mb-6">
                    <div className="bg-white p-3 rounded-2xl shadow-lg">
                        <QRCode value={qrData} size={180} />
                    </div>

                    <div className="mt-4 text-center px-6">
                        <h3 className="text-lg font-bold text-gray-800">{user?.username || 'Aluno'}</h3>
                        <p className="text-gray-400 text-xs uppercase mt-1">Código Pessoal</p>
                    </div>
                </div>

                <div className="bg-gray-50 p-3 text-center border-t text-xs text-gray-400">
                    Válido apenas para o dia do evento
                </div>
            </div>

            <div className="mt-8 w-full max-w-sm">
                <Button onClick={handleDownload} className="w-full bg-green-600 hover:bg-green-700 h-12 text-lg rounded-xl shadow-md transition-transform active:scale-95">
                    <Download className="mr-2 h-5 w-5" /> Salvar no Celular
                </Button>
                <p className="text-center text-xs text-gray-400 mt-4">Apresente este código na portaria</p>
            </div>
        </div>
    );
}