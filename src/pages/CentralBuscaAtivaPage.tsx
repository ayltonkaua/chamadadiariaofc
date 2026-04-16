import React, { useEffect, useState, useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { gestorService } from '@/domains/gestor/services/gestor.service';
import type { AlunoRiscoData, AlunoFaltasConsecutivasData } from '@/domains';
import { Skeleton } from '@/components/ui/skeleton';
import { ShieldAlert, RefreshCw, AlertTriangle, Clock, CheckCircle, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { AlunoBuscaCard } from '@/components/busca-ativa/AlunoBuscaCard';
import { toast } from '@/hooks/use-toast';
import { Card, CardContent } from '@/components/ui/card';
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';
import { RegistrarContatoModal } from '@/components/busca-ativa/RegistrarContatoModal';

export default function CentralBuscaAtivaPage() {
    const { user } = useAuth();
    const [loading, setLoading] = useState(true);
    const [alunosRisco, setAlunosRisco] = useState<AlunoRiscoData[]>([]);
    const [alunosConsecutivos, setAlunosConsecutivos] = useState<AlunoFaltasConsecutivasData[]>([]);
    const [buscaAtivaResumo, setBuscaAtivaResumo] = useState<Map<string, any>>(new Map());
    const [telefonesObj, setTelefonesObj] = useState<Record<string, string | null>>({});
    
    // Virtual Pagination State per Column
    const [visibleCount, setVisibleCount] = useState<Record<string, number>>({
        'NAO_MONITORADOS': 15,
        'MONITORADOS': 15,
        'RETORNARAM': 15
    });

    // Control the external Modal
    const [modalOpen, setModalOpen] = useState(false);
    const [studentToRegister, setStudentToRegister] = useState<any>(null);
    const [defaultStatusModal, setDefaultStatusModal] = useState('EM_ACOMPANHAMENTO');

    const carregarMais = (coluna: string) => {
        setVisibleCount(prev => ({ ...prev, [coluna]: prev[coluna] + 15 }));
    };

    const fetchData = async () => {
        if (!user?.escola_id) return;
        setLoading(true);
        try {
            const data = await gestorService.getDashboardData(user.escola_id);
            const risco = data.alunosRisco || [];
            const consecutivos = data.alunosConsecutivos || [];

            setAlunosRisco(risco);
            setAlunosConsecutivos(consecutivos);

            const idsUnicos = [...new Set([...risco.map(a => a.aluno_id), ...consecutivos.map(a => a.aluno_id)])];
            if (idsUnicos.length > 0) {
                const resumo = await gestorService.getBuscaAtivaResumo(user.escola_id, idsUnicos);
                setBuscaAtivaResumo(resumo);

                const { data: telefonesData } = await supabase
                    .from('alunos')
                    .select('id, telefone_responsavel')
                    .in('id', idsUnicos);
                
                if (telefonesData) {
                    const telMap: Record<string, string | null> = {};
                    telefonesData.forEach(t => { telMap[t.id] = t.telefone_responsavel; });
                    setTelefonesObj(telMap);
                }
            }
        } catch (error) {
            console.error('Erro ao carregar Central de Busca Ativa:', error);
            toast({ title: 'Erro', description: 'Não foi possível carregar os dados.', variant: 'destructive' });
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [user?.escola_id]);

    const handleContactRegistered = (novoRegistro: any, alunoId: string) => {
        if (!novoRegistro) {
            fetchData();
            return;
        }
        
        // Optimistic UI Update
        setBuscaAtivaResumo(prev => {
            const newMap = new Map(prev);
            const existing = newMap.get(alunoId);
            newMap.set(alunoId, {
                contatado: true,
                ultimoContato: novoRegistro.data_contato,
                totalContatos: (existing?.totalContatos || 0) + 1,
                ultimoStatus: novoRegistro.status_funil,
                historico: [novoRegistro, ...(existing?.historico || [])]
            });
            return newMap;
        });
    };

    const markAsResolvedSilently = async (aluno) => {
        try {
            const novoRegistro = {
                aluno_id: aluno.aluno_id,
                escola_id: user?.escola_id,
                forma_contato: 'Outro',
                justificativa_faltas: 'Marcado como retornado via Kanban',
                status_funil: 'RESOLVIDO',
                data_contato: new Date().toISOString(),
                monitor_responsavel: user?.nome || user?.email || 'Sistema'
            };

            const { error } = await supabase.from('registros_contato_busca_ativa').insert([novoRegistro]);
            if (error) throw error;
            handleContactRegistered(novoRegistro, aluno.aluno_id);
            toast({ title: 'Sucesso', description: 'Aluno movido para Resolvido.' });
        } catch (err) {
            console.error(err);
            toast({ title: 'Erro', description: 'Não foi possível mover o aluno.', variant: 'destructive' });
            fetchData(); // rollback
        }
    };

    // Agrupamento Kanban
    const colunas = useMemo(() => {
        const agrupar = {
            'NAO_MONITORADOS': [] as any[],
            'MONITORADOS': [] as any[],
            'RETORNARAM': [] as any[]
        };

        const mapDuplicados = new Set();
        const todosAlunos = [
            ...alunosConsecutivos.map(a => ({...a, isConsecutiva: true})),
            ...alunosRisco.map(a => ({...a, isConsecutiva: false}))
        ];

        todosAlunos.forEach(aluno => {
            if(mapDuplicados.has(aluno.aluno_id)) return;
            mapDuplicados.add(aluno.aluno_id);

            const resumo = buscaAtivaResumo.get(aluno.aluno_id);
            if (!resumo) {
                agrupar['NAO_MONITORADOS'].push(aluno);
            } else {
                const s = resumo.ultimoStatus;
                if (s === 'RESOLVIDO' || s === 'EVASAO_CONFIRMADA') {
                    agrupar['RETORNARAM'].push(aluno);
                } else {
                    agrupar['MONITORADOS'].push(aluno);
                }
            }
        });

        // Ordenar cada coluna: os casos urgentes (consecutivos) devem ficar no topo
        Object.keys(agrupar).forEach(key => {
            agrupar[key as keyof typeof agrupar].sort((a, b) => {
                if (a.isConsecutiva && !b.isConsecutiva) return -1;
                if (!a.isConsecutiva && b.isConsecutiva) return 1;
                return 0;
            });
        });

        return agrupar;
    }, [alunosConsecutivos, alunosRisco, buscaAtivaResumo]);

    const onDragEnd = (result: DropResult) => {
        const { source, destination, draggableId } = result;

        if (!destination) return; // dropped outside the list
        if (source.droppableId === destination.droppableId && source.index === destination.index) return; // same place

        const sourceColName = source.droppableId;
        const destColName = destination.droppableId;

        if (sourceColName === destColName) {
            return; // within same column reordering not strictly saved in DB for now
        }

        const alunoArrastado = colunas[sourceColName as keyof typeof colunas].find(a => a.aluno_id === draggableId);
        if (!alunoArrastado) return;

        // Regras de negócio ao trocar de coluna
        if (destColName === 'MONITORADOS') {
            // Abrir Modal de contato
            setStudentToRegister(alunoArrastado);
            setDefaultStatusModal('EM_ACOMPANHAMENTO');
            setModalOpen(true);
        } else if (destColName === 'RETORNARAM') {
            // Marcar silenciosamente como resolvido
            markAsResolvedSilently(alunoArrastado);
        } else if (destColName === 'NAO_MONITORADOS') {
            // Normalmente não se volta ao Não Monitorado se ele já tem histórico na DDB.
            toast({ title: 'Ação não permitida', description: 'Ele já possui histórico. Se não houve evolução, mantenha em Monitorados.', variant: 'destructive' });
        }
    };

    // Métricas Topo
    const contatosHoje = Array.from(buscaAtivaResumo.values()).filter(r => 
        r.ultimoContato && new Date(r.ultimoContato).toDateString() === new Date().toDateString()
    ).length;

    return (
        <div className="flex-1 flex flex-col h-[calc(100dvh-64px)] bg-slate-50 relative overflow-hidden">
            {/* Modal Controlado pelo Drag */}
            {studentToRegister && (
                <RegistrarContatoModal 
                    alunoId={studentToRegister.aluno_id} 
                    nomeAluno={studentToRegister.aluno_nome || 'Aluno Sem Nome'} 
                    escolaId={user?.escola_id!} 
                    open={modalOpen}
                    onOpenChange={(isOpen) => {
                        setModalOpen(isOpen);
                        if (!isOpen) setStudentToRegister(null); // Clear on close
                    }}
                    onSuccess={(reg) => {
                        handleContactRegistered(reg, studentToRegister.aluno_id);
                        setStudentToRegister(null);
                    }} 
                    hideTrigger={true}
                    defaultStatusFunil={defaultStatusModal}
                />
            )}

            {/* Header */}
            <div className="bg-white border-b px-4 md:px-6 py-3 md:py-4 flex-shrink-0 z-10 shadow-sm">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4">
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                            <ShieldAlert className="text-amber-500" />
                            Gestão de Evasão (Busca Ativa)
                        </h1>
                        <p className="text-gray-500 text-sm">Pipeline Kanban de resgate de alunos em situação de risco.</p>
                    </div>
                    <Button variant="outline" size="sm" onClick={fetchData} disabled={loading}>
                        <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                        Atualizar Funil
                    </Button>
                </div>

                {/* Widgets */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 md:gap-4">
                    <Card className="bg-red-50 border-red-100 flex-1">
                        <CardContent className="p-3 md:p-4 flex items-center justify-between">
                            <div>
                                <p className="text-xs md:text-sm font-medium text-red-600">Casos Críticos</p>
                                <h3 className="text-xl md:text-2xl font-bold text-red-900">{alunosConsecutivos.length}</h3>
                            </div>
                            <AlertTriangle className="h-5 w-5 md:h-8 md:w-8 text-red-200" />
                        </CardContent>
                    </Card>
                    <Card className="bg-amber-50 border-amber-100 flex-1">
                        <CardContent className="p-3 md:p-4 flex items-center justify-between">
                            <div>
                                <p className="text-xs md:text-sm font-medium text-amber-600">Risco Contínuo</p>
                                <h3 className="text-xl md:text-2xl font-bold text-amber-900">{alunosRisco.length}</h3>
                            </div>
                            <AlertCircle className="h-5 w-5 md:h-8 md:w-8 text-amber-200" />
                        </CardContent>
                    </Card>
                    <Card className="bg-blue-50 border-blue-100 flex-1">
                        <CardContent className="p-3 md:p-4 flex items-center justify-between">
                            <div>
                                <p className="text-xs md:text-sm font-medium text-blue-600">Por Fazer</p>
                                <h3 className="text-xl md:text-2xl font-bold text-blue-900">{colunas['NAO_MONITORADOS'].length}</h3>
                            </div>
                            <Clock className="h-5 w-5 md:h-8 md:w-8 text-blue-200" />
                        </CardContent>
                    </Card>
                    <Card className="bg-emerald-50 border-emerald-100 flex-1">
                        <CardContent className="p-3 md:p-4 flex items-center justify-between">
                            <div>
                                <p className="text-xs md:text-sm font-medium text-emerald-600">Alunos Tratados</p>
                                <h3 className="text-xl md:text-2xl font-bold text-emerald-900">{contatosHoje} hoje</h3>
                            </div>
                            <CheckCircle className="h-5 w-5 md:h-8 md:w-8 text-emerald-200" />
                        </CardContent>
                    </Card>
                </div>
            </div>

            {/* Kanban Board Area */}
            <div className="flex-1 overflow-x-auto overflow-y-hidden scrollbar-thin snap-x snap-mandatory">
                {loading ? (
                    <div className="flex gap-6 h-full items-stretch px-4 md:px-6 pt-4 md:pt-6 pb-2 w-max">
                        {[1, 2, 3].map(i => (
                            <div key={i} className="min-w-[85vw] md:min-w-[320px] max-w-[85vw] md:max-w-[320px] lg:min-w-[350px] lg:max-w-[350px] h-full flex flex-col gap-4 snap-center p-3">
                                <Skeleton className="h-10 w-full rounded" />
                                <Skeleton className="h-32 w-full rounded-xl" />
                                <Skeleton className="h-32 w-full rounded-xl" />
                            </div>
                        ))}
                    </div>
                ) : (
                    <DragDropContext onDragEnd={onDragEnd}>
                        <div className="flex gap-4 md:gap-6 h-full items-stretch w-max px-4 md:px-6 pt-4 md:pt-6 pb-2">
                            
                            {/* Coluna Não Monitorados */}
                            <Droppable droppableId="NAO_MONITORADOS">
                                {(provided, snapshot) => (
                                    <div 
                                        {...provided.droppableProps}
                                        ref={provided.innerRef}
                                        className={`w-[85vw] md:w-[320px] lg:w-[350px] h-full flex flex-col bg-slate-200/50 rounded-xl overflow-hidden border-2 shadow-sm transition-colors snap-center ${snapshot.isDraggingOver ? 'border-dashed border-gray-400 bg-slate-200' : 'border-transparent'}`}
                                    >
                                        <div className="flex items-center justify-between bg-slate-200/90 backdrop-blur z-10 border-b border-white/50 p-3 pt-3 flex-shrink-0">
                                            <h3 className="font-bold text-slate-700 uppercase text-sm tracking-wide">Não Monitorados</h3>
                                            <div className="bg-white text-slate-700 text-xs py-0.5 px-2 rounded font-bold shadow-sm">{colunas['NAO_MONITORADOS'].length}</div>
                                        </div>
                                        <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-3 scrollbar-thin">
                                            {colunas['NAO_MONITORADOS'].slice(0, visibleCount['NAO_MONITORADOS']).map((aluno, index) => (
                                                <Draggable key={`nao_mon_${aluno.aluno_id}`} draggableId={aluno.aluno_id} index={index}>
                                                    {(dragProv, dragSnap) => (
                                                        <div style={{...dragProv.draggableProps.style, filter: dragSnap.isDragging ? 'drop-shadow(0 10px 15px rgba(0,0,0,0.1))' : 'none', transform: dragSnap.isDragging ? dragProv.draggableProps.style?.transform + ' rotate(2deg)' : dragProv.draggableProps.style?.transform}}>
                                                            <AlunoBuscaCard 
                                                                aluno={aluno} 
                                                                escolaId={user?.escola_id!} 
                                                                telefone={telefonesObj[aluno.aluno_id]}
                                                                buscaAtivaResumo={buscaAtivaResumo.get(aluno.aluno_id)}
                                                                isConsecutiva={aluno.isConsecutiva}
                                                                onContactRegistered={(reg) => handleContactRegistered(reg, aluno.aluno_id)}
                                                                innerRef={dragProv.innerRef}
                                                                draggableProps={dragProv.draggableProps}
                                                                dragHandleProps={dragProv.dragHandleProps}
                                                            />
                                                        </div>
                                                    )}
                                                </Draggable>
                                            ))}
                                            {provided.placeholder}
                                            {colunas['NAO_MONITORADOS'].length > visibleCount['NAO_MONITORADOS'] && (
                                                <Button variant="ghost" size="sm" className="w-full text-slate-500 hover:bg-white mt-1" onClick={() => carregarMais('NAO_MONITORADOS')}>
                                                    Ver mais ({colunas['NAO_MONITORADOS'].length - visibleCount['NAO_MONITORADOS']})
                                                </Button>
                                            )}
                                        </div>
                                    </div>
                                )}
                            </Droppable>

                            {/* Coluna Monitorados */}
                            <Droppable droppableId="MONITORADOS">
                                {(provided, snapshot) => (
                                    <div 
                                        {...provided.droppableProps}
                                        ref={provided.innerRef}
                                        className={`w-[85vw] md:w-[320px] lg:w-[350px] h-full flex flex-col bg-blue-100/50 rounded-xl overflow-hidden border-2 shadow-sm transition-colors snap-center ${snapshot.isDraggingOver ? 'border-dashed border-blue-400 bg-blue-100' : 'border-transparent'}`}
                                    >
                                        <div className="flex items-center justify-between bg-blue-100/90 backdrop-blur z-10 border-b border-white/50 p-3 pt-3 flex-shrink-0">
                                            <h3 className="font-bold text-blue-800 uppercase text-sm tracking-wide">Monitorados</h3>
                                            <div className="bg-white text-blue-800 text-xs py-0.5 px-2 rounded font-bold shadow-sm">{colunas['MONITORADOS'].length}</div>
                                        </div>
                                        <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-3 scrollbar-thin">
                                            {colunas['MONITORADOS'].slice(0, visibleCount['MONITORADOS']).map((aluno, index) => (
                                                <Draggable key={`mon_${aluno.aluno_id}`} draggableId={aluno.aluno_id} index={index}>
                                                    {(dragProv, dragSnap) => (
                                                        <div style={{...dragProv.draggableProps.style, filter: dragSnap.isDragging ? 'drop-shadow(0 10px 15px rgba(0,0,0,0.1))' : 'none', transform: dragSnap.isDragging ? dragProv.draggableProps.style?.transform + ' rotate(2deg)' : dragProv.draggableProps.style?.transform}}>
                                                            <AlunoBuscaCard 
                                                                aluno={aluno} 
                                                                escolaId={user?.escola_id!} 
                                                                telefone={telefonesObj[aluno.aluno_id]}
                                                                buscaAtivaResumo={buscaAtivaResumo.get(aluno.aluno_id)}
                                                                isConsecutiva={aluno.isConsecutiva}
                                                                onContactRegistered={(reg) => handleContactRegistered(reg, aluno.aluno_id)}
                                                                innerRef={dragProv.innerRef}
                                                                draggableProps={dragProv.draggableProps}
                                                                dragHandleProps={dragProv.dragHandleProps}
                                                            />
                                                        </div>
                                                    )}
                                                </Draggable>
                                            ))}
                                            {provided.placeholder}
                                            {colunas['MONITORADOS'].length > visibleCount['MONITORADOS'] && (
                                                <Button variant="ghost" size="sm" className="w-full text-blue-600 hover:bg-white mt-1" onClick={() => carregarMais('MONITORADOS')}>
                                                    Ver mais ({colunas['MONITORADOS'].length - visibleCount['MONITORADOS']})
                                                </Button>
                                            )}
                                        </div>
                                    </div>
                                )}
                            </Droppable>

                            {/* Coluna Retornaram */}
                            <Droppable droppableId="RETORNARAM">
                                {(provided, snapshot) => (
                                    <div 
                                        {...provided.droppableProps}
                                        ref={provided.innerRef}
                                        className={`w-[85vw] md:w-[320px] lg:w-[350px] h-full flex flex-col bg-emerald-100/50 rounded-xl overflow-hidden border-2 shadow-sm transition-colors snap-center ${snapshot.isDraggingOver ? 'border-dashed border-emerald-400 bg-emerald-100' : 'border-transparent'}`}
                                    >
                                        <div className="flex items-center justify-between bg-emerald-100/90 backdrop-blur z-10 border-b border-white/50 p-3 pt-3 flex-shrink-0">
                                            <h3 className="font-bold text-emerald-800 uppercase text-sm tracking-wide">Retornaram</h3>
                                            <div className="bg-white text-emerald-800 text-xs py-0.5 px-2 rounded font-bold shadow-sm">{colunas['RETORNARAM'].length}</div>
                                        </div>
                                        <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-3 scrollbar-thin">
                                            {colunas['RETORNARAM'].slice(0, visibleCount['RETORNARAM']).map((aluno, index) => (
                                                <Draggable key={`ret_${aluno.aluno_id}`} draggableId={aluno.aluno_id} index={index}>
                                                    {(dragProv, dragSnap) => (
                                                        <div style={{...dragProv.draggableProps.style, filter: dragSnap.isDragging ? 'drop-shadow(0 10px 15px rgba(0,0,0,0.1))' : 'none', transform: dragSnap.isDragging ? dragProv.draggableProps.style?.transform + ' rotate(2deg)' : dragProv.draggableProps.style?.transform}}>
                                                            <AlunoBuscaCard 
                                                                aluno={aluno} 
                                                                escolaId={user?.escola_id!} 
                                                                telefone={telefonesObj[aluno.aluno_id]}
                                                                buscaAtivaResumo={buscaAtivaResumo.get(aluno.aluno_id)}
                                                                isConsecutiva={aluno.isConsecutiva}
                                                                onContactRegistered={(reg) => handleContactRegistered(reg, aluno.aluno_id)}
                                                                innerRef={dragProv.innerRef}
                                                                draggableProps={dragProv.draggableProps}
                                                                dragHandleProps={dragProv.dragHandleProps}
                                                            />
                                                        </div>
                                                    )}
                                                </Draggable>
                                            ))}
                                            {provided.placeholder}
                                            {colunas['RETORNARAM'].length > visibleCount['RETORNARAM'] && (
                                                <Button variant="ghost" size="sm" className="w-full text-emerald-600 hover:bg-white mt-1" onClick={() => carregarMais('RETORNARAM')}>
                                                    Ver mais ({colunas['RETORNARAM'].length - visibleCount['RETORNARAM']})
                                                </Button>
                                            )}
                                        </div>
                                    </div>
                                )}
                            </Droppable>

                        </div>
                    </DragDropContext>
                )}
            </div>
        </div>
    );
}
