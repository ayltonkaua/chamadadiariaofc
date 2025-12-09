import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import QrScanner from 'react-qr-scanner';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Search, RotateCcw, ArrowLeft, Loader2 } from 'lucide-react';

export default function ScannerPage() {
    const { user } = useAuth();
    const navigate = useNavigate();
    const [lastResult, setLastResult] = useState<string | null>(null);
    const [feedback, setFeedback] = useState<{ status: 'success' | 'error', msg: string, nome?: string, turma?: string } | null>(null);
    const [manualSearch, setManualSearch] = useState('');
    const [loadingManual, setLoadingManual] = useState(false);
    const [alunosEncontrados, setAlunosEncontrados] = useState<any[]>([]);

    const previewStyle = {
        height: 300,
        width: '100%',
        objectFit: 'cover' as const,
        borderRadius: '12px'
    };

    const handleScan = (data: any) => {
        if (data && data.text) {
            processarEntrada(data.text);
        }
    };

    const handleError = (err: any) => {
        console.error("Erro na câmera:", err);
    };

    const processarEntrada = async (textoQrCode: string) => {
        if (textoQrCode === lastResult) return;
        setLastResult(textoQrCode);

        try {
            const { e, a } = JSON.parse(textoQrCode);

            console.log("[Scanner] Processando QR:", { evento_id: e, aluno_id: a });

            const { data, error } = await (supabase as any).rpc('registrar_entrada_evento', {
                _evento_id: e,
                _aluno_id: a,
                _controller_uid: user?.id
            });

            if (error) {
                console.error("[Scanner] Erro RPC:", error);
                throw error;
            }

            console.log("[Scanner] Resposta RPC:", data);
            exibirFeedback(data);
        } catch (error: any) {
            console.error("[Scanner] Erro ao processar QR:", error);
            setFeedback({ status: 'error', msg: error?.message || 'QR Code inválido' });
            setTimeout(limparFeedback, 3000);
        }
    };

    // CORREÇÃO: Busca manual melhorada
    const buscarManual = async () => {
        if (!manualSearch || manualSearch.length < 3) {
            setFeedback({ status: 'error', msg: 'Digite pelo menos 3 letras' });
            setTimeout(limparFeedback, 2000);
            return;
        }

        if (!user?.escola_id) {
            setFeedback({ status: 'error', msg: 'Escola não identificada. Relogue.' });
            setTimeout(limparFeedback, 3000);
            return;
        }

        setLoadingManual(true);
        setAlunosEncontrados([]);

        try {
            console.log("[Scanner] Buscando alunos:", manualSearch, "na escola:", user.escola_id);

            // CORREÇÃO 1: Buscar alunos da mesma escola via join com turmas
            const { data: alunos, error: alunosError } = await supabase
                .from('alunos')
                .select('id, nome, turmas!inner(nome, escola_id)')
                .ilike('nome', `%${manualSearch}%`)
                .limit(5);

            if (alunosError) {
                console.error("[Scanner] Erro ao buscar alunos:", alunosError);
                throw alunosError;
            }

            console.log("[Scanner] Alunos encontrados:", alunos);

            // CORREÇÃO 2: Filtrar alunos que pertencem à escola do operador
            const alunosDaEscola = (alunos || []).filter((aluno: any) => {
                const turma = aluno.turmas;
                if (Array.isArray(turma)) {
                    return turma.some((t: any) => t.escola_id === user.escola_id);
                }
                return turma?.escola_id === user.escola_id;
            });

            console.log("[Scanner] Alunos filtrados por escola:", alunosDaEscola);

            if (alunosDaEscola.length === 0) {
                setFeedback({ status: 'error', msg: 'Nenhum aluno encontrado nesta escola.' });
                setTimeout(limparFeedback, 3000);
                setLoadingManual(false);
                return;
            }

            // Se encontrou apenas 1, registra entrada automaticamente
            if (alunosDaEscola.length === 1) {
                await registrarEntradaAluno(alunosDaEscola[0]);
            } else {
                // Se encontrou múltiplos, mostra lista para seleção
                setAlunosEncontrados(alunosDaEscola);
            }

        } catch (error: any) {
            console.error("[Scanner] Exception:", error);
            setFeedback({ status: 'error', msg: error?.message || 'Erro ao buscar.' });
            setTimeout(limparFeedback, 3000);
        } finally {
            setLoadingManual(false);
        }
    };

    // CORREÇÃO 3: Função separada para registrar entrada
    const registrarEntradaAluno = async (aluno: any) => {
        try {
            console.log("[Scanner] Registrando entrada para:", aluno.nome);

            // Busca evento ativo da escola
            const { data: evento, error: eventoError } = await (supabase as any)
                .from('eventos')
                .select('id, nome')
                .eq('escola_id', user?.escola_id)
                .eq('ativo', true)
                .single();

            if (eventoError || !evento) {
                console.error("[Scanner] Erro ao buscar evento:", eventoError);
                setFeedback({ status: 'error', msg: 'Nenhum evento ativo encontrado.' });
                setTimeout(limparFeedback, 3000);
                return;
            }

            console.log("[Scanner] Evento ativo:", evento);

            // Chama a RPC
            const { data: res, error: rpcError } = await (supabase as any).rpc('registrar_entrada_evento', {
                _evento_id: evento.id,
                _aluno_id: aluno.id,
                _controller_uid: user?.id
            });

            if (rpcError) {
                console.error("[Scanner] Erro RPC:", rpcError);
                setFeedback({ status: 'error', msg: rpcError.message || 'Erro ao registrar entrada.' });
                setTimeout(limparFeedback, 3000);
                return;
            }

            console.log("[Scanner] Resultado RPC:", res);

            // CORREÇÃO 4: Tratar resposta da RPC
            if (res) {
                exibirFeedback(res);
            } else {
                // Se RPC não retornou objeto, assume sucesso com dados do aluno
                const turmaInfo = Array.isArray(aluno.turmas) ? aluno.turmas[0]?.nome : aluno.turmas?.nome;
                setFeedback({
                    status: 'success',
                    msg: 'ACESSO LIBERADO',
                    nome: aluno.nome,
                    turma: turmaInfo || 'Turma'
                });
                setTimeout(limparFeedback, 3000);
            }

            // Limpa a lista de seleção e busca
            setAlunosEncontrados([]);
            setManualSearch('');

        } catch (error: any) {
            console.error("[Scanner] Exception registrar:", error);
            setFeedback({ status: 'error', msg: error?.message || 'Erro ao registrar.' });
            setTimeout(limparFeedback, 3000);
        }
    };

    const exibirFeedback = (data: any) => {
        if (data?.success) {
            setFeedback({
                status: 'success',
                msg: 'ACESSO LIBERADO',
                nome: data.nome,
                turma: data.turma
            });
        } else {
            setFeedback({
                status: 'error',
                msg: data?.message || 'Acesso Negado',
                nome: data?.nome,
                turma: data?.turma
            });
        }
        setTimeout(limparFeedback, 3000);
    };

    const limparFeedback = () => {
        setFeedback(null);
        setLastResult(null);
        setAlunosEncontrados([]);
    };

    return (
        <div className={`min-h-screen flex flex-col p-4 transition-colors duration-300 ${feedback?.status === 'success' ? 'bg-green-600' : feedback?.status === 'error' ? 'bg-red-600' : 'bg-black'}`}>

            {/* TELA DE FEEDBACK */}
            {feedback ? (
                <div className="flex-1 flex flex-col items-center justify-center text-white text-center animate-in zoom-in duration-300">
                    {feedback.status === 'success' ? (
                        <div className="w-24 h-24 bg-white rounded-full flex items-center justify-center mb-6 shadow-xl">
                            <span className="text-6xl">✅</span>
                        </div>
                    ) : (
                        <div className="w-24 h-24 bg-white rounded-full flex items-center justify-center mb-6 shadow-xl">
                            <span className="text-6xl">🚫</span>
                        </div>
                    )}

                    <h1 className="text-3xl font-black mb-2 uppercase tracking-tighter leading-none">{feedback.msg}</h1>

                    {feedback.nome && (
                        <div className="bg-black/20 p-4 rounded-xl mt-4 w-full max-w-xs backdrop-blur-sm border border-white/10">
                            <h2 className="text-xl font-bold truncate">{feedback.nome}</h2>
                            <p className="text-lg opacity-90">{feedback.turma}</p>
                        </div>
                    )}

                    <Button variant="ghost" className="mt-8 text-white/70" onClick={limparFeedback}>
                        <RotateCcw className="mr-2 h-4 w-4" /> Próximo
                    </Button>
                </div>
            ) : (
                /* TELA DE ESCANEAMENTO */
                <div className="flex flex-col h-full animate-in fade-in">
                    {/* Botão Voltar */}
                    <div className="flex items-center gap-2 mb-4">
                        <Button variant="ghost" size="icon" className="text-white" onClick={() => navigate('/dashboard')}>
                            <ArrowLeft className="h-5 w-5" />
                        </Button>
                        <h1 className="text-white font-bold text-lg">Controle de Acesso</h1>
                    </div>

                    <div className="rounded-2xl overflow-hidden border-4 border-white/20 shadow-2xl relative bg-black aspect-square max-w-md mx-auto w-full">
                        <QrScanner
                            delay={300}
                            onError={handleError}
                            onScan={handleScan}
                            style={previewStyle}
                            constraints={{ video: { facingMode: { exact: "environment" } } }}
                        />
                        <div className="absolute inset-0 pointer-events-none border-[3px] border-white/50 rounded-2xl m-8"></div>
                    </div>

                    <p className="text-white/60 text-center mt-4 text-sm">Aponte para o QR Code do ingresso</p>

                    {/* Busca Manual */}
                    <div className="mt-6 flex gap-2 max-w-md mx-auto w-full">
                        <Input
                            placeholder="Buscar aluno pelo nome..."
                            className="bg-white/10 border-white/20 text-white placeholder:text-white/50"
                            value={manualSearch}
                            onChange={e => setManualSearch(e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && buscarManual()}
                        />
                        <Button onClick={buscarManual} disabled={loadingManual} className="bg-white/20 hover:bg-white/30">
                            {loadingManual ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                        </Button>
                    </div>

                    {/* CORREÇÃO 5: Lista de alunos para seleção */}
                    {alunosEncontrados.length > 0 && (
                        <div className="mt-4 max-w-md mx-auto w-full space-y-2">
                            <p className="text-white/60 text-sm text-center">Selecione o aluno:</p>
                            {alunosEncontrados.map((aluno: any) => {
                                const turmaInfo = Array.isArray(aluno.turmas) ? aluno.turmas[0]?.nome : aluno.turmas?.nome;
                                return (
                                    <button
                                        key={aluno.id}
                                        onClick={() => registrarEntradaAluno(aluno)}
                                        className="w-full p-3 bg-white/10 hover:bg-white/20 rounded-lg text-left transition-colors"
                                    >
                                        <p className="text-white font-medium">{aluno.nome}</p>
                                        <p className="text-white/60 text-sm">{turmaInfo}</p>
                                    </button>
                                );
                            })}
                        </div>
                    )}

                    {/* Reset Button */}
                    <div className="mt-auto pt-6 text-center">
                        <Button variant="ghost" className="text-white/50" onClick={limparFeedback}>
                            <RotateCcw className="mr-2 h-4 w-4" /> Limpar
                        </Button>
                    </div>
                </div>
            )}
        </div>
    );
}
