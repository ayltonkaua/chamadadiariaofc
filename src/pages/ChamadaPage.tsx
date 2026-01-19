/**
 * Chamada Page - Realizar Chamada
 * 
 * Melhorias v2:
 * - Calendário para selecionar data  
 * - Toast "Rascunho salvo" ao sair
 * - Atestados aprovados são bloqueados com alerta
 * - Footer não cobre conteúdo (padding adequado)
 */

import React, { useEffect, useState, useCallback, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Calendar } from "@/components/ui/calendar";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Check,
  X,
  FileText,
  Save,
  ArrowLeft,
  Loader2,
  Wifi,
  WifiOff,
  MessageSquare,
  Users,
  CheckCircle,
  XCircle,
  Info,
  CalendarIcon,
  AlertTriangle,
  RotateCcw
} from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  getSession,
  upsertSession,
  getCachedAlunosByTurma,
  getCachedAtestadosVigentes,
  saveAtestadosCache
} from '@/lib/offlineStorage';
import { getAlunosByTurma } from '@/lib/dataProvider';
import { triggerSync } from '@/lib/SyncManager';
import { useAuth } from '@/contexts/AuthContext';
import { useEscolaConfig } from "@/contexts/EscolaConfigContext";
import {
  atestadosService,
  presencaService,
  observacoesService,
  turmaService,
  type Aluno,
  type Atestado
} from "@/domains";

type PresencaStatus = "presente" | "falta" | "atestado";

const ChamadaPage: React.FC = () => {
  const { turmaId } = useParams<{ turmaId: string }>();
  const { user } = useAuth();
  const { config } = useEscolaConfig();
  const navigate = useNavigate();

  // Estados
  const [alunos, setAlunos] = useState<Aluno[]>([]);
  const [presencas, setPresencas] = useState<Record<string, PresencaStatus>>({});
  const [atestadosAprovados, setAtestadosAprovados] = useState<Set<string>>(new Set());
  const [atestados, setAtestados] = useState<Record<string, Atestado[]>>({});
  const [turmaNome, setTurmaNome] = useState<string>("");
  const [date, setDate] = useState<Date>(new Date());
  const [calendarCollapsed, setCalendarCollapsed] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const isSubmittingRef = useRef(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [localEscolaId, setLocalEscolaId] = useState<string | null>(null);
  const hasChangesRef = useRef(false);
  const [showAtestadoAlert, setShowAtestadoAlert] = useState(false);

  // Refs para valores atuais (evita stale closure no cleanup)
  const presencasRef = useRef<Record<string, PresencaStatus>>({});
  const dateRef = useRef<Date>(new Date());
  const turmaIdRef = useRef<string | undefined>(turmaId);

  // Modal observação
  const [showObservacao, setShowObservacao] = useState<{ alunoId: string; alunoNome: string } | null>(null);
  const [tituloObservacao, setTituloObservacao] = useState('');
  const [descricaoObservacao, setDescricaoObservacao] = useState('');
  const [salvandoObservacao, setSalvandoObservacao] = useState(false);

  const corPrimaria = config?.cor_primaria || "#6D28D9";
  const hasChangesToastShownRef = useRef(false);

  // Manter refs sincronizados com state
  useEffect(() => {
    presencasRef.current = presencas;
  }, [presencas]);

  useEffect(() => {
    dateRef.current = date;
  }, [date]);

  useEffect(() => {
    turmaIdRef.current = turmaId;
  }, [turmaId]);

  // Salvar rascunho ao sair da página
  useEffect(() => {
    return () => {
      const currentPresencas = presencasRef.current;
      const currentDate = dateRef.current;
      const currentTurmaId = turmaIdRef.current;

      if (hasChangesRef.current && currentTurmaId && Object.keys(currentPresencas).length > 0 && !hasChangesToastShownRef.current) {
        const dateStr = format(currentDate, "yyyy-MM-dd");
        upsertSession(currentTurmaId, dateStr, currentPresencas);
        hasChangesToastShownRef.current = true;
        toast({ title: "Rascunho salvo", description: "Suas alterações foram salvas automaticamente." });
      }
    };
  }, []);

  // Monitor de conexão
  useEffect(() => {
    const handleStatusChange = async () => {
      const status = navigator.onLine;
      setIsOnline(status);
      if (status) {
        const results = await triggerSync();
        const successCount = results.filter(r => r.success).length;
        if (successCount > 0) {
          toast({ title: "Sincronizado", description: `${successCount} registros enviados.` });
        }
      }
    };
    window.addEventListener('online', handleStatusChange);
    window.addEventListener('offline', handleStatusChange);
    return () => {
      window.removeEventListener('online', handleStatusChange);
      window.removeEventListener('offline', handleStatusChange);
    };
  }, []);

  // Estado para indicar carregamento apenas da data (mais leve)
  const [isLoadingDate, setIsLoadingDate] = useState(false);
  const alunosCacheRef = useRef<Aluno[]>([]);
  const atestadosCacheRef = useRef<{ mapa: Record<string, Atestado[]>; aprovados: Set<string> } | null>(null);

  // Carregar dados iniciais (alunos, turma, atestados) - executado apenas uma vez
  const carregarDadosIniciais = useCallback(async () => {
    if (!turmaId) return;
    setIsLoading(true);

    try {
      let listaAlunos: Aluno[] = [];
      let escolaIdEncontrado: string | null = user?.escola_id || null;

      // Buscar nome da turma
      if (navigator.onLine) {
        try {
          const turma = await turmaService.getById(turmaId);
          if (turma) setTurmaNome(turma.nome);
        } catch { }
      }

      if (!navigator.onLine) {
        const cached = await getCachedAlunosByTurma(user?.escola_id || '', turmaId);
        listaAlunos = cached as Aluno[];
      } else {
        try {
          const result = await getAlunosByTurma(turmaId, user?.escola_id);
          listaAlunos = result.data as Aluno[];
        } catch {
          const cached = await getCachedAlunosByTurma(user?.escola_id || '', turmaId);
          listaAlunos = cached as Aluno[];
        }
      }

      if (!escolaIdEncontrado && listaAlunos.length > 0) {
        const alunoComEscola = listaAlunos.find(a => a.escola_id);
        if (alunoComEscola) escolaIdEncontrado = alunoComEscola.escola_id!;
      }
      setLocalEscolaId(escolaIdEncontrado);

      // Atestados - buscar APENAS aprovados (cache para todas as datas)
      let mapaAtestados: Record<string, Atestado[]> = {};
      const alunosComAtestadoAprovado = new Set<string>();
      const escolaIdParaAtestados = escolaIdEncontrado || user?.escola_id;

      try {
        if (navigator.onLine) {
          const atestadosVigentes = await atestadosService.getAtestadosVigentes();
          const aprovados = atestadosVigentes.filter(a => a.status === 'aprovado');
          mapaAtestados = atestadosService.groupByAluno(aprovados);
          aprovados.forEach(a => alunosComAtestadoAprovado.add(a.aluno_id));

          if (escolaIdParaAtestados && atestadosVigentes.length > 0) {
            await saveAtestadosCache({
              escola_id: escolaIdParaAtestados,
              atestados: atestadosVigentes.map(a => ({
                id: a.id,
                aluno_id: a.aluno_id,
                data_inicio: a.data_inicio,
                data_fim: a.data_fim,
                status: a.status
              })),
              cached_at: Date.now()
            });
          }
        } else if (escolaIdParaAtestados) {
          const cachedAtestados = await getCachedAtestadosVigentes(escolaIdParaAtestados);
          for (const atestado of cachedAtestados) {
            if (atestado.status === 'aprovado') {
              alunosComAtestadoAprovado.add(atestado.aluno_id);
              if (!mapaAtestados[atestado.aluno_id]) mapaAtestados[atestado.aluno_id] = [];
              mapaAtestados[atestado.aluno_id].push(atestado as unknown as Atestado);
            }
          }
        }
      } catch { }

      // Ordenar e cachear alunos
      listaAlunos.sort((a, b) => a.nome.localeCompare(b.nome));
      alunosCacheRef.current = listaAlunos;
      atestadosCacheRef.current = { mapa: mapaAtestados, aprovados: alunosComAtestadoAprovado };

      setAlunos(listaAlunos);
      setAtestados(mapaAtestados);
      setAtestadosAprovados(alunosComAtestadoAprovado);

    } catch (err) {
      console.error(err);
      toast({ variant: "destructive", title: "Erro ao carregar dados" });
    } finally {
      setIsLoading(false);
    }
  }, [turmaId, user]);

  // Carregar apenas dados da data selecionada (rascunho) - rápido
  const carregarDadosDaData = useCallback(async () => {
    if (!turmaId || alunosCacheRef.current.length === 0) return;
    setIsLoadingDate(true);
    hasChangesRef.current = false;

    try {
      const listaAlunos = alunosCacheRef.current;
      const alunosComAtestadoAprovado = atestadosCacheRef.current?.aprovados || new Set<string>();

      // Recuperar rascunho da data
      const dateStr = format(date, "yyyy-MM-dd");
      const rascunho = await getSession(turmaId, dateStr);
      const mapaPresencas: Record<string, PresencaStatus> = {};

      if (rascunho && rascunho.turma_id === turmaId) {
        Object.entries(rascunho.presencas).forEach(([id, status]) => {
          if (status) mapaPresencas[id] = status as PresencaStatus;
        });
        listaAlunos.forEach(a => { if (!mapaPresencas[a.id]) mapaPresencas[a.id] = "presente"; });
      } else {
        listaAlunos.forEach(a => mapaPresencas[a.id] = "presente");
      }

      // Auto-marca alunos com atestado APROVADO
      alunosComAtestadoAprovado.forEach(alunoId => {
        if (listaAlunos.some(al => al.id === alunoId)) {
          mapaPresencas[alunoId] = "atestado";
        }
      });

      setPresencas(mapaPresencas);

    } catch (err) {
      console.error(err);
    } finally {
      setIsLoadingDate(false);
    }
  }, [turmaId, date]);

  // Carregar dados iniciais na montagem
  useEffect(() => {
    carregarDadosIniciais();
  }, [carregarDadosIniciais]);

  // Carregar dados da data quando muda (rápido, usa cache)
  useEffect(() => {
    if (alunosCacheRef.current.length > 0) {
      carregarDadosDaData();
    }
  }, [date, carregarDadosDaData]);

  // Auto-save rascunho silencioso (sem toast)
  useEffect(() => {
    if (turmaId && Object.keys(presencas).length > 0 && hasChangesRef.current) {
      const timer = setTimeout(() => {
        const dateStr = format(date, "yyyy-MM-dd");
        upsertSession(turmaId, dateStr, presencas);
        // SEM TOAST aqui - apenas salva silenciosamente
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [presencas, date, turmaId]);

  // Limpar rascunho
  const handleLimparRascunho = useCallback(async () => {
    if (!turmaId) return;

    const dateStr = format(date, "yyyy-MM-dd");
    // Limpa do IndexedDB
    const { deleteSession } = await import('@/lib/offlineStorage');
    await deleteSession(turmaId, dateStr);

    // Reseta para todos presentes
    const novasPresencas: Record<string, PresencaStatus> = {};
    alunos.forEach(a => {
      // Mantém atestados aprovados
      if (atestadosAprovados.has(a.id)) {
        novasPresencas[a.id] = "atestado";
      } else {
        novasPresencas[a.id] = "presente";
      }
    });
    setPresencas(novasPresencas);
    hasChangesRef.current = false;

    toast({ title: "Rascunho redefinido", description: "Status de presença restaurado para o padrão." });
  }, [turmaId, date, alunos, atestadosAprovados]);

  // Toggle status com verificação de atestado aprovado
  const toggleStatus = useCallback((alunoId: string) => {
    if (atestadosAprovados.has(alunoId)) {
      setShowAtestadoAlert(true);
      return;
    }

    hasChangesRef.current = true;
    setPresencas(prev => {
      const atual = prev[alunoId];
      return { ...prev, [alunoId]: atual === "presente" ? "falta" : "presente" };
    });
  }, [atestadosAprovados]);

  const setStatusManual = useCallback((alunoId: string, status: PresencaStatus) => {
    // Se tem atestado aprovado e está tentando mudar, alerta
    if (atestadosAprovados.has(alunoId) && status !== "atestado") {
      setShowAtestadoAlert(true);
      return;
    }

    hasChangesRef.current = true;
    setPresencas(prev => ({ ...prev, [alunoId]: status }));
  }, [atestadosAprovados]);

  // Salvar
  const handleSalvar = async () => {
    if (isSubmittingRef.current) return;
    isSubmittingRef.current = true;
    setIsSaving(true);

    try {
      const idEscolaFinal = localEscolaId || user?.escola_id;
      if (!idEscolaFinal) {
        toast({ title: "Erro", description: "Escola não identificada", variant: "destructive" });
        return;
      }

      const dataFormatada = format(date, "yyyy-MM-dd");
      const registros = Object.entries(presencas).map(([alunoId, status]) => ({
        alunoId,
        presente: status === "presente",
        faltaJustificada: status === "atestado"
      }));

      const result = await presencaService.salvarChamada({
        turmaId: turmaId!,
        escolaId: idEscolaFinal,
        dataChamada: dataFormatada,
        registros
      });

      // Limpa rascunho após salvar
      hasChangesRef.current = false;

      if (result.syncTriggered) {
        toast({ title: "Chamada Registrada", description: "Dados sincronizados com sucesso.", className: "bg-green-600 text-white border-green-600" });
      } else {
        toast({ title: "Salvo Localmente", description: "Será sincronizado quando houver internet." });
      }

      navigate("/dashboard");
    } catch (error: any) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    } finally {
      setIsSaving(false);
      isSubmittingRef.current = false;
    }
  };

  const handleSalvarObservacao = async () => {
    if (!showObservacao || !localEscolaId || !user?.id || !turmaId) return;
    setSalvandoObservacao(true);

    try {
      await observacoesService.salvar({
        aluno_id: showObservacao.alunoId,
        turma_id: turmaId,
        escola_id: localEscolaId,
        user_id: user.id,
        data_observacao: format(date, "yyyy-MM-dd"),
        titulo: tituloObservacao.trim(),
        descricao: descricaoObservacao.trim(),
      });

      toast({ title: "Observação salva!" });
      setShowObservacao(null);
      setTituloObservacao("");
      setDescricaoObservacao("");
    } catch (err: any) {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    } finally {
      setSalvandoObservacao(false);
    }
  };

  // Contadores
  const totalPresentes = Object.values(presencas).filter(s => s === "presente").length;
  const totalFaltas = Object.values(presencas).filter(s => s === "falta").length;
  const totalAtestados = Object.values(presencas).filter(s => s === "atestado").length;

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center flex-col gap-4">
        <Loader2 className="h-8 w-8 animate-spin" style={{ color: corPrimaria }} />
        <p className="text-gray-500">Carregando alunos...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header FIXO */}
      <div className="bg-white border-b fixed top-0 left-0 right-0 z-20 shadow-sm">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Button variant="ghost" size="icon" onClick={() => navigate("/dashboard")}>
                <ArrowLeft className="h-5 w-5" />
              </Button>
              <div>
                <h1 className="text-xl font-bold text-gray-900">Realizar Chamada</h1>
                <p className="text-sm text-gray-500">
                  <span className="font-medium" style={{ color: corPrimaria }}>{turmaNome || "Turma"}</span>
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {isOnline ? (
                <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 gap-1">
                  <Wifi size={12} />
                  <span className="hidden sm:inline">Online</span>
                </Badge>
              ) : (
                <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200 gap-1">
                  <WifiOff size={12} />
                  <span className="hidden sm:inline">Offline</span>
                </Badge>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Conteúdo com padding para header fixo e footer fixo */}
      <div className="pt-20 pb-28">
        {/* Layout com Calendário Fixo */}
        <div className="max-w-4xl mx-auto px-4 py-3">
          {/* Botão para colapsar/expandir calendário */}
          <button
            onClick={() => setCalendarCollapsed(!calendarCollapsed)}
            className="flex items-center justify-between w-full bg-white p-3 rounded-lg border shadow-sm mb-3 hover:bg-gray-50 transition-colors"
          >
            <div className="flex items-center gap-2">
              <CalendarIcon className="h-5 w-5" style={{ color: corPrimaria }} />
              <span className="text-sm font-semibold text-gray-700">
                {format(date, "EEEE, dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
              </span>
              {isLoadingDate && (
                <Loader2 className="h-4 w-4 animate-spin text-gray-400" />
              )}
              {format(date, "yyyy-MM-dd") !== format(new Date(), "yyyy-MM-dd") && (
                <Badge variant="secondary" className="text-xs bg-orange-100 text-orange-700">Retroativa</Badge>
              )}
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-400">
                {calendarCollapsed ? "Mostrar calendário" : "Ocultar calendário"}
              </span>
              <svg
                className={`h-4 w-4 text-gray-400 transition-transform ${calendarCollapsed ? '' : 'rotate-180'}`}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </div>
          </button>

          {/* Calendário Fixo Sempre Visível */}
          {!calendarCollapsed && (
            <div className="bg-white rounded-xl border shadow-sm p-4 mb-4">
              <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
                <div className="flex-1 flex justify-center w-full">
                  <Calendar
                    mode="single"
                    selected={date}
                    onSelect={(newDate) => {
                      if (newDate) {
                        setDate(newDate);
                      }
                    }}
                    locale={ptBR}
                    disabled={(d) => d > new Date()}
                    className="rounded-md border-0"
                  />
                </div>
                <div className="flex flex-col gap-2 w-full sm:w-auto">
                  {/* Botão Hoje */}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setDate(new Date())}
                    className="gap-2 justify-center"
                    disabled={format(date, "yyyy-MM-dd") === format(new Date(), "yyyy-MM-dd")}
                  >
                    <CalendarIcon className="h-4 w-4" />
                    Ir para Hoje
                  </Button>
                  {/* Botão Desfazer */}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleLimparRascunho}
                    className="text-orange-600 border-orange-300 hover:bg-orange-50 gap-2 justify-center"
                  >
                    <RotateCcw className="h-4 w-4" />
                    Limpar Rascunho
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Instruções */}
        <div className="max-w-4xl mx-auto px-4 pb-3">
          <div className="flex items-center gap-2 text-sm text-gray-500 bg-blue-50 p-3 rounded-lg border border-blue-100">
            <Info className="h-4 w-4 text-blue-500 shrink-0" />
            <span>Toque em um aluno para alternar entre <strong className="text-green-600">presente</strong> e <strong className="text-red-600">falta</strong></span>
          </div>
        </div>

        {/* Contadores */}
        <div className="max-w-4xl mx-auto px-4 mb-4">
          <div className="grid grid-cols-3 gap-2">
            <Card className="border-green-200 bg-green-50">
              <CardContent className="p-3 text-center">
                <div className="flex items-center justify-center gap-1 mb-1">
                  <CheckCircle className="h-4 w-4 text-green-600" />
                  <span className="text-2xl font-bold text-green-600">{totalPresentes}</span>
                </div>
                <p className="text-xs text-green-700">Presentes</p>
              </CardContent>
            </Card>
            <Card className="border-red-200 bg-red-50">
              <CardContent className="p-3 text-center">
                <div className="flex items-center justify-center gap-1 mb-1">
                  <XCircle className="h-4 w-4 text-red-600" />
                  <span className="text-2xl font-bold text-red-600">{totalFaltas}</span>
                </div>
                <p className="text-xs text-red-700">Faltas</p>
              </CardContent>
            </Card>
            <Card className="border-blue-200 bg-blue-50">
              <CardContent className="p-3 text-center">
                <div className="flex items-center justify-center gap-1 mb-1">
                  <FileText className="h-4 w-4 text-blue-600" />
                  <span className="text-2xl font-bold text-blue-600">{totalAtestados}</span>
                </div>
                <p className="text-xs text-blue-700">Atestados</p>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Lista de Alunos */}
        <div className="max-w-4xl mx-auto px-4">
          <div className="space-y-2">
            {alunos.length === 0 ? (
              <div className="text-center py-12 text-gray-400">
                <Users className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p>Nenhum aluno nesta turma</p>
              </div>
            ) : (
              alunos.map((aluno) => {
                const status = presencas[aluno.id];
                const isPresente = status === "presente";
                const isFalta = status === "falta";
                const isAtestado = status === "atestado";
                const temAtestadoAprovado = atestadosAprovados.has(aluno.id);

                return (
                  <div
                    key={aluno.id}
                    onClick={() => toggleStatus(aluno.id)}
                    className={`
                    flex items-center justify-between p-4 rounded-xl border-2 cursor-pointer
                    transition-all duration-200 active:scale-[0.98]
                    ${isPresente ? "bg-green-50 border-green-300" : ""}
                    ${isFalta ? "bg-red-50 border-red-300" : ""}
                    ${isAtestado ? "bg-blue-50 border-blue-300" : ""}
                    ${temAtestadoAprovado ? "ring-2 ring-blue-400 ring-offset-1" : ""}
                  `}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={`
                        h-11 w-11 rounded-full flex items-center justify-center font-bold text-sm
                        ${isPresente ? "bg-green-200 text-green-800" : ""}
                        ${isFalta ? "bg-red-200 text-red-800" : ""}
                        ${isAtestado ? "bg-blue-200 text-blue-800" : ""}
                      `}
                      >
                        {isPresente && <Check className="h-5 w-5" />}
                        {isFalta && <X className="h-5 w-5" />}
                        {isAtestado && <FileText className="h-5 w-5" />}
                      </div>
                      <div>
                        <p className="font-semibold text-gray-800">{aluno.nome}</p>
                        <div className="flex items-center gap-2">
                          <p className="text-xs text-gray-400">{aluno.matricula}</p>
                          {temAtestadoAprovado && (
                            <Badge variant="outline" className="text-[10px] px-1 py-0 bg-blue-100 text-blue-700 border-blue-300">
                              Atestado aprovado
                            </Badge>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-1" onClick={e => e.stopPropagation()}>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-9 w-9"
                        onClick={() => setShowObservacao({ alunoId: aluno.id, alunoNome: aluno.nome })}
                      >
                        <MessageSquare className="h-4 w-4 text-gray-400" />
                      </Button>
                      <Button
                        variant={isAtestado ? "default" : "outline"}
                        size="icon"
                        className={`h-9 w-9 ${isAtestado ? "bg-blue-600 hover:bg-blue-700" : ""}`}
                        onClick={() => setStatusManual(aluno.id, isAtestado ? "presente" : "atestado")}
                        disabled={temAtestadoAprovado}
                      >
                        <FileText className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Footer Fixo */}
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t shadow-lg z-30 p-4 safe-area-bottom">
          <div className="max-w-4xl mx-auto">
            <Button
              onClick={handleSalvar}
              disabled={isSaving || alunos.length === 0}
              className="w-full h-14 text-lg font-bold rounded-xl shadow-lg"
              style={{ backgroundColor: corPrimaria }}
            >
              {isSaving ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin mr-2" />
                  Salvando...
                </>
              ) : (
                <>
                  <Save className="h-5 w-5 mr-2" />
                  Confirmar Chamada ({alunos.length} alunos)
                </>
              )}
            </Button>
          </div>
        </div>


        {/* Alert Dialog para atestado aprovado */}
        <AlertDialog open={showAtestadoAlert} onOpenChange={setShowAtestadoAlert}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-blue-500" />
                Atestado Aprovado
              </AlertDialogTitle>
              <AlertDialogDescription>
                Este aluno possui um atestado <strong>aprovado</strong> para esta data.
                O status de atestado não pode ser alterado manualmente.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogAction onClick={() => setShowAtestadoAlert(false)}>
                Entendi
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Modal Observação */}
        <Dialog open={!!showObservacao} onOpenChange={() => setShowObservacao(null)}>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle>Observação - {showObservacao?.alunoNome}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <Input
                placeholder="Título da observação"
                value={tituloObservacao}
                onChange={e => setTituloObservacao(e.target.value)}
              />
              <Textarea
                placeholder="Descreva a observação..."
                value={descricaoObservacao}
                onChange={e => setDescricaoObservacao(e.target.value)}
                rows={4}
              />
              <Button onClick={handleSalvarObservacao} disabled={salvandoObservacao} className="w-full">
                {salvandoObservacao ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Salvar Observação
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
};

export default ChamadaPage;