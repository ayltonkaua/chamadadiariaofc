import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useEscolaConfig } from '@/contexts/EscolaConfigContext';
import { portalAlunoService, type StudentData, type MeusAtestados as MeusAtestadosType, type Beneficio } from '@/domains';

// Componentes UI
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea } from "@/components/ui/scroll-area";
import JustificarFaltaForm from '@/components/justificativa/JustificarFaltaForm';
import { toast } from "@/hooks/use-toast";
import { format, parseISO } from "date-fns";

// Componente de Boletim (Importação Nova)
import { BoletimAluno } from "@/components/notas/BoletimAluno";
import { DadosCadastraisTab } from "@/components/aluno/DadosCadastraisTab";

// Ícones
import {
  ClipboardList,
  FileText,
  LogOut,
  QrCode,
  Bell,
  GraduationCap,
  ChevronRight,
  ListChecks,
  Calendar as CalendarIcon,
  User,
  AlertTriangle,
  Ticket
} from 'lucide-react';

// --- Componente Visual: Gráfico de Frequência ---
const AttendanceRing = ({ percentage }: { percentage: number }) => {
  const radius = 30;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (percentage / 100) * circumference;

  const color = percentage >= 75 ? "text-green-500" : percentage >= 60 ? "text-yellow-500" : "text-red-500";

  return (
    <div className="relative flex items-center justify-center w-20 h-20">
      <svg className="transform -rotate-90 w-full h-full">
        <circle
          className="text-gray-200"
          strokeWidth="6"
          stroke="currentColor"
          fill="transparent"
          r={radius}
          cx="40"
          cy="40"
        />
        <circle
          className={`${color} transition - all duration - 1000 ease - out`}
          strokeWidth="6"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          stroke="currentColor"
          fill="transparent"
          r={radius}
          cx="40"
          cy="40"
        />
      </svg>
      <div className="absolute flex flex-col items-center">
        <span className={`text - sm font - bold ${color} `}>{Math.round(percentage)}%</span>
        <span className="text-[8px] text-gray-400 uppercase">Freq.</span>
      </div>
    </div>
  );
};

// --- Interfaces moved to domain types ---

// --- Página Principal ---
const PortalAlunoPage: React.FC = () => {
  const { user, logout } = useAuth();
  const { config: escolaConfig } = useEscolaConfig();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  // Estados para controle da UI
  const [isJustifyDialogOpen, setIsJustifyDialogOpen] = useState(false);
  const [showCarteirinha, setShowCarteirinha] = useState(false);
  const [isBoletimOpen, setIsBoletimOpen] = useState(false); // Estado para o Boletim
  const [beneficios, setBeneficios] = useState<any[]>([]);

  // Estado para visualização segura de atestados
  const [isMeusAtestadosOpen, setIsMeusAtestadosOpen] = useState(false);
  const [meusAtestados, setMeusAtestados] = useState<MeusAtestadosType[]>([]);
  const [loadingAtestados, setLoadingAtestados] = useState(false);

  // Estado para Meus Dados
  const [isMeusDadosOpen, setIsMeusDadosOpen] = useState(false);
  const [showUpdateAlert, setShowUpdateAlert] = useState(false);

  // Estado para dados reais do aluno - using domain type
  const [studentData, setStudentData] = useState<StudentData>({
    turma: "Carregando...",
    matricula: "---",
    frequencia: 100,
    status: "Excelente",
    totalAulas: 0,
    totalFaltas: 0,
    dadosIncompletos: false
  });
  const [loadingData, setLoadingData] = useState(true);

  // --- EFEITO: Listener de URL para Navegação Mobile ---
  useEffect(() => {
    const tab = searchParams.get('tab');
    if (tab === 'atestados') {
      setIsMeusAtestadosOpen(true);
    } else if (tab === 'justificar') {
      setIsJustifyDialogOpen(true);
    } else if (tab === 'boletim') { // Adicionado listener para boletim
      setIsBoletimOpen(true);
    }
  }, [searchParams]);

  // Busca dados reais do aluno ao carregar - USING SERVICE
  const fetchStudentData = async () => {
    if (!user?.aluno_id) return;

    try {
      setLoadingData(true);
      const data = await portalAlunoService.getStudentData(user.aluno_id);
      setStudentData(data);

      // If data is incomplete, show update alert
      if (data.dadosIncompletos) {
        setShowUpdateAlert(true);
      }
    } catch (error) {
      console.error("Erro ao carregar dados do aluno:", error);
      toast({ title: "Erro", description: "Não foi possível carregar seus dados escolares.", variant: "destructive" });
    } finally {
      setLoadingData(false);
    }
  };

  useEffect(() => {
    fetchStudentData();
  }, [user?.aluno_id]);

  // Carregar benefícios - USING SERVICE
  const carregarBeneficios = async () => {
    const data = await portalAlunoService.getBeneficios();
    setBeneficios(data);
  };

  useEffect(() => {
    carregarBeneficios();
  }, []);

  // Buscar atestados do aluno - USING SERVICE
  const fetchMeusAtestados = async () => {
    if (!user?.aluno_id) return;
    setLoadingAtestados(true);
    try {
      const data = await portalAlunoService.getMeusAtestados(user.aluno_id);
      setMeusAtestados(data);
    } catch (error) {
      toast({ title: "Erro", description: "Erro ao carregar histórico de atestados.", variant: "destructive" });
    } finally {
      setLoadingAtestados(false);
    }
  };

  useEffect(() => {
    if (isMeusAtestadosOpen) {
      fetchMeusAtestados();
    }
  }, [isMeusAtestadosOpen]);

  const handleLogout = async () => {
    try {
      await logout();
      navigate('/');
    } catch (error) {
      toast({ title: "Erro", description: "Erro ao sair.", variant: "destructive" });
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'aprovado': return 'bg-green-100 text-green-800 border-green-200';
      case 'rejeitado': return 'bg-red-100 text-red-800 border-red-200';
      default: return 'bg-yellow-100 text-yellow-800 border-yellow-200';
    }
  };

  if (loadingData) {
    return (
      <div className="min-h-screen bg-gray-50 p-4 space-y-4">
        <Skeleton className="h-20 w-full rounded-xl" />
        <Skeleton className="h-40 w-full rounded-xl" />
        <div className="grid grid-cols-2 gap-4">
          <Skeleton className="h-32 w-full rounded-xl" />
          <Skeleton className="h-32 w-full rounded-xl" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50/50 pb-24 font-sans">
      {/* HEADER */}
      <header className="bg-white sticky top-0 z-10 border-b px-4 py-3 flex items-center justify-between shadow-sm sm:px-8 sm:py-4">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-full bg-purple-100 flex items-center justify-center text-purple-700 font-bold border border-purple-200 shadow-sm">
            {user?.username?.charAt(0).toUpperCase() || "A"}
          </div>
          <div>
            <h1 className="text-sm font-bold text-gray-900 leading-none">
              Olá, {user?.username?.split(' ')[0]}
            </h1>
            <p className="text-xs text-gray-500 mt-0.5 truncate max-w-[150px]">
              {escolaConfig?.nome || 'Escola Digital'}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="ghost" size="icon" className="text-gray-500 hover:bg-gray-100 rounded-full">
            <Bell className="h-5 w-5" />
          </Button>
          <Button variant="ghost" size="icon" onClick={handleLogout} className="text-red-500 hover:bg-red-50 rounded-full">
            <LogOut className="h-5 w-5" />
          </Button>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6 space-y-6 max-w-lg sm:max-w-4xl">

        {/* CARD DE VISÃO GERAL */}
        <section className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Card className="bg-white shadow-sm border-none overflow-hidden relative ring-1 ring-gray-100">
            <div className={`absolute top - 0 left - 0 w - 1.5 h - full ${studentData.frequencia >= 75 ? "bg-green-500" : "bg-red-500"} `}></div>
            <CardContent className="p-5 flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">Situação Atual</p>
                <h2 className="text-xl font-bold text-gray-800">{studentData.turma}</h2>
                <div className="flex gap-2 mt-2">
                  <Badge variant="secondary" className={`${studentData.frequencia >= 75 ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"} `}>
                    {studentData.status}
                  </Badge>
                  <span className="text-xs text-gray-400 flex items-center">
                    {studentData.totalFaltas} faltas registradas
                  </span>
                </div>
              </div>
              <AttendanceRing percentage={studentData.frequencia} />
            </CardContent>
          </Card>

          {/* Botão da Carteirinha Digital */}
          <Dialog open={showCarteirinha} onOpenChange={setShowCarteirinha}>
            <DialogTrigger asChild>
              <div className="bg-gradient-to-br from-purple-600 to-indigo-700 rounded-xl p-5 text-white shadow-lg shadow-purple-200 active:scale-95 transition-all cursor-pointer flex flex-col justify-between h-[130px] relative overflow-hidden group">
                <div className="absolute -right-4 -top-4 w-20 h-20 bg-white/10 rounded-full blur-xl group-hover:scale-150 transition-transform"></div>
                <div className="flex justify-between items-start relative z-10">
                  <div className="bg-white/20 p-1.5 rounded-lg backdrop-blur-sm">
                    <QrCode className="h-6 w-6 text-white" />
                  </div>
                  <span className="text-[10px] font-medium bg-white/20 px-2 py-1 rounded-full backdrop-blur-sm border border-white/10">
                    ID Estudantil
                  </span>
                </div>
                <div className="relative z-10">
                  <p className="text-sm font-medium opacity-90 mb-0.5">Matrícula</p>
                  <p className="text-xl font-mono font-bold tracking-widest text-white/95 shadow-sm">
                    {studentData.matricula}
                  </p>
                </div>
              </div>
            </DialogTrigger>

            <DialogContent className="sm:max-w-md border-none bg-transparent shadow-none p-0 flex justify-center items-center">
              <div className="w-full max-w-[320px] bg-white rounded-3xl overflow-hidden shadow-2xl border border-gray-100">
                <div className="bg-purple-700 p-6 text-center text-white relative overflow-hidden">
                  <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-10"></div>
                  <h3 className="font-bold text-lg relative z-10">{escolaConfig?.nome || 'Escola Digital'}</h3>
                  <p className="text-xs opacity-80 relative z-10 uppercase tracking-widest mt-1">Identidade Estudantil</p>
                </div>
                <div className="p-6 flex flex-col items-center gap-5">
                  <div className="h-28 w-28 rounded-full bg-gray-100 border-4 border-white shadow-lg -mt-20 overflow-hidden flex items-center justify-center relative z-10">
                    <GraduationCap size={48} className="text-purple-300" />
                  </div>
                  <div className="text-center space-y-1">
                    <h2 className="text-2xl font-bold text-gray-900 leading-tight">{user?.username}</h2>
                    <p className="text-sm font-medium text-purple-600">{studentData.turma}</p>
                    <p className="text-xs text-gray-400">Matrícula: {studentData.matricula}</p>
                  </div>
                  <div className="bg-white p-3 rounded-xl border-2 border-dashed border-gray-200 w-full flex justify-center">
                    <QrCode className="h-32 w-32 text-gray-800" />
                  </div>
                  <div className="w-full bg-green-50 text-green-700 text-xs py-2 rounded-lg text-center font-medium">
                    ● Documento Ativo
                  </div>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </section>

        {/* MENU DE SERVIÇOS */}
        <section>
          <h3 className="text-sm font-semibold text-gray-500 mb-3 px-1">Serviços Acadêmicos</h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">

            {/* 1. Consultar Faltas */}
            <Button
              variant="outline"
              className="h-auto flex-col gap-3 py-6 border-none shadow-sm bg-white hover:bg-purple-50 hover:text-purple-700 transition-all group"
              onClick={() => navigate('/student-query')}
            >
              <div className="p-3 bg-blue-50 rounded-2xl text-blue-600 group-hover:scale-110 transition-transform">
                <ClipboardList className="h-6 w-6" />
              </div>
              <div className="text-center">
                <span className="text-xs font-bold block text-gray-700 group-hover:text-purple-700">Histórico</span>
                <span className="text-[10px] text-gray-400 font-normal">Ver frequência</span>
              </div>
            </Button>

            {/* 1.5 Meus Dados (NOVO) */}
            <Dialog open={isMeusDadosOpen} onOpenChange={setIsMeusDadosOpen}>
              <DialogTrigger asChild>
                <Button
                  variant="outline"
                  className="h-auto flex-col gap-3 py-6 border-none shadow-sm bg-white hover:bg-purple-50 hover:text-purple-700 transition-all group"
                >
                  <div className="p-3 bg-indigo-50 rounded-2xl text-indigo-600 group-hover:scale-110 transition-transform">
                    <User className="h-6 w-6" />
                  </div>
                  <div className="text-center">
                    <span className="text-xs font-bold block text-gray-700 group-hover:text-purple-700">Meus Dados</span>
                    <span className="text-[10px] text-gray-400 font-normal">Atualizar cadastro</span>
                  </div>
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-lg">
                <DadosCadastraisTab
                  alunoId={user?.aluno_id || ""}
                  onUpdate={() => {
                    setIsMeusDadosOpen(false);
                    fetchStudentData(); // Atualiza localmente
                  }}
                />
              </DialogContent>
            </Dialog>

            {/* 2. Boletim Escolar (NOVO) */}
            <Dialog open={isBoletimOpen} onOpenChange={setIsBoletimOpen}>
              <DialogTrigger asChild>
                <Button
                  variant="outline"
                  className="h-auto flex-col gap-3 py-6 border-none shadow-sm bg-white hover:bg-purple-50 hover:text-purple-700 transition-all group"
                >
                  <div className="p-3 bg-pink-50 rounded-2xl text-pink-600 group-hover:scale-110 transition-transform">
                    <GraduationCap className="h-6 w-6" />
                  </div>
                  <div className="text-center">
                    <span className="text-xs font-bold block text-gray-700 group-hover:text-purple-700">Boletim</span>
                    <span className="text-[10px] text-gray-400 font-normal">Ver notas</span>
                  </div>
                </Button>
              </DialogTrigger>
              <DialogContent className="w-[95vw] max-w-4xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2">
                    <GraduationCap className="h-6 w-6 text-pink-600" />
                    Boletim Escolar
                  </DialogTitle>
                  <DialogDescription>Confira suas notas e médias por disciplina.</DialogDescription>
                </DialogHeader>
                {/* O componente busca as notas do aluno logado automaticamente */}
                <BoletimAluno />
              </DialogContent>
            </Dialog>

            {/* 3. Justificar Falta */}
            <Dialog open={isJustifyDialogOpen} onOpenChange={setIsJustifyDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" className="h-auto flex-col gap-3 py-6 border-none shadow-sm bg-white hover:bg-purple-50 hover:text-purple-700 transition-all group">
                  <div className="p-3 bg-orange-50 rounded-2xl text-orange-600 group-hover:scale-110 transition-transform">
                    <FileText className="h-6 w-6" />
                  </div>
                  <div className="text-center">
                    <span className="text-xs font-bold block text-gray-700 group-hover:text-purple-700">Justificar</span>
                    <span className="text-[10px] text-gray-400 font-normal">Enviar atestado</span>
                  </div>
                </Button>
              </DialogTrigger>
              <DialogContent className="w-[95vw] max-w-md rounded-2xl">
                <DialogHeader>
                  <DialogTitle>Justificar Ausência</DialogTitle>
                </DialogHeader>
                <JustificarFaltaForm
                  isPortal={true}
                  onSuccess={() => {
                    toast({ title: 'Enviado!', description: 'Sua justificativa será analisada.' });
                    setIsJustifyDialogOpen(false);
                  }}
                  onClose={() => setIsJustifyDialogOpen(false)}
                />
              </DialogContent>
            </Dialog>

            {/* 4. Meus Atestados */}
            <Dialog open={isMeusAtestadosOpen} onOpenChange={setIsMeusAtestadosOpen}>
              <DialogTrigger asChild>
                <Button
                  variant="outline"
                  className="h-auto flex-col gap-3 py-6 border-none shadow-sm bg-white hover:bg-purple-50 hover:text-purple-700 transition-all group"
                >
                  <div className="p-3 bg-purple-50 rounded-2xl text-purple-600 group-hover:scale-110 transition-transform">
                    <FileText className="h-6 w-6" />
                  </div>
                  <div className="text-center">
                    <span className="text-xs font-bold block text-gray-700 group-hover:text-purple-700">Atestados</span>
                    <span className="text-[10px] text-gray-400 font-normal">Status envios</span>
                  </div>
                </Button>
              </DialogTrigger>
              <DialogContent className="w-[95vw] max-w-md rounded-2xl h-[80vh] flex flex-col p-0 overflow-hidden">
                <DialogHeader className="p-6 pb-2">
                  <DialogTitle>Meus Atestados Enviados</DialogTitle>
                  <DialogDescription>Acompanhe o status das suas solicitações.</DialogDescription>
                </DialogHeader>
                <div className="flex-1 overflow-hidden bg-gray-50/50 relative">
                  {loadingAtestados ? (
                    <div className="p-6 space-y-3">
                      <Skeleton className="h-20 w-full rounded-lg" />
                      <Skeleton className="h-20 w-full rounded-lg" />
                    </div>
                  ) : meusAtestados.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-gray-400 p-6 text-center">
                      <FileText className="h-12 w-12 mb-2 opacity-20" />
                      <p className="text-sm">Nenhum atestado enviado ainda.</p>
                    </div>
                  ) : (
                    <ScrollArea className="h-full p-4">
                      <div className="space-y-3 pb-4">
                        {meusAtestados.map((atestado) => (
                          <div key={atestado.id} className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex flex-col gap-2">
                            <div className="flex justify-between items-start">
                              <div className="flex items-center gap-2 text-sm font-medium text-gray-700">
                                <CalendarIcon className="h-4 w-4 text-purple-500" />
                                {format(parseISO(atestado.data_inicio), "dd/MM")} - {format(parseISO(atestado.data_fim), "dd/MM/yy")}
                              </div>
                              <Badge variant="outline" className={getStatusColor(atestado.status)}>
                                {atestado.status}
                              </Badge>
                            </div>
                            <p className="text-xs text-gray-500 bg-gray-50 p-2 rounded-md line-clamp-2 italic">
                              "{atestado.descricao}"
                            </p>
                            <div className="text-[10px] text-gray-400 text-right">
                              Enviado em {format(parseISO(atestado.created_at), "dd/MM/yyyy")}
                            </div>
                          </div>
                        ))}
                      </div>
                    </ScrollArea>
                  )}
                </div>
              </DialogContent>
            </Dialog>

            {/* 4.5. Meu Ingresso (NOVO) */}
            <Button
              variant="outline"
              className="h-auto flex-col gap-3 py-6 border-none shadow-sm bg-white hover:bg-purple-50 hover:text-purple-700 transition-all group"
              onClick={() => navigate('/aluno/ingresso')}
            >
              <div className="p-3 bg-fuchsia-50 rounded-2xl text-fuchsia-600 group-hover:scale-110 transition-transform">
                <Ticket className="h-6 w-6" />
              </div>
              <div className="text-center">
                <span className="text-xs font-bold block text-gray-700 group-hover:text-purple-700">Meu Ingresso</span>
                <span className="text-[10px] text-gray-400 font-normal">Ver QR Code</span>
              </div>
            </Button>

            {/* 5. Pesquisas (Em Breve) */}
            <Button
              variant="outline"
              className="h-auto flex-col gap-3 py-6 border-none shadow-sm bg-white opacity-70 cursor-not-allowed hover:bg-white"
              disabled
            >
              <div className="p-3 bg-gray-100 rounded-2xl text-gray-400">
                <ListChecks className="h-6 w-6" />
              </div>
              <div className="text-center">
                <span className="text-xs font-bold block text-gray-400">Pesquisas</span>
                <Badge variant="secondary" className="text-[9px] px-1.5 h-4 mt-0.5 bg-gray-100 text-gray-500 hover:bg-gray-100">Em Breve</Badge>
              </div>
            </Button>

          </div>
        </section>

        {/* SEÇÃO BENEFÍCIOS - CORRIGIDA (Data Excel + Remoção de Processado) */}
        <section className="mt-6">
          <h3 className="text-sm font-semibold text-gray-500 mb-3 px-1">Benefícios e Auxílios</h3>
          <div id="container-beneficios" className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {(!beneficios || beneficios.length === 0) ? (
              <div className="col-span-full text-sm text-gray-500 bg-white border border-dashed rounded-xl p-6 text-center">
                <p>Nenhum benefício vinculado à sua matrícula.</p>
              </div>
            ) : (
              beneficios.map((beneficio: any) => {

                // 1. FORMATAÇÃO DE VALOR
                const valorFormatado = beneficio.valor
                  ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(beneficio.valor)
                  : 'Valor não informado';

                // 2. FORMATAÇÃO DA DATA (Correção Definitiva do Erro 45876)
                let dataPag = '--/--/----';

                if (beneficio.data_pagamento) {
                  // Se for número puro (Ex: 45876 ou "45876")
                  const dataComoNumero = Number(beneficio.data_pagamento);

                  if (!isNaN(dataComoNumero) && !beneficio.data_pagamento.toString().includes('-')) {
                    // FÓRMULA MÁGICA DO EXCEL PARA JS:
                    // (ValorExcel - 25569) * 86.400 * 1000 = Data Timestamp
                    const dataJs = new Date((dataComoNumero - 25569) * 86400 * 1000);
                    // Ajuste de fuso horário simples (adiciona horas para evitar cair no dia anterior devido a GMT)
                    dataJs.setHours(dataJs.getHours() + 12);
                    dataPag = format(dataJs, "dd/MM/yyyy");
                  }
                  // Se já vier formatado do banco como data ISO (2025-08-06)
                  else if (beneficio.data_pagamento.toString().includes('-')) {
                    dataPag = format(parseISO(beneficio.data_pagamento), "dd/MM/yyyy");
                  }
                  // Texto puro
                  else {
                    dataPag = beneficio.data_pagamento;
                  }
                }

                // 3. RESPONSÁVEL E CPF
                const responsavel = beneficio.nome_responsavel || 'Não informado';
                let cpfFormatado = 'CPF pendente';

                if (beneficio.cpf_responsavel) {
                  const cpfLimpo = beneficio.cpf_responsavel.toString().replace(/\D/g, '');
                  if (cpfLimpo.length === 11) {
                    cpfFormatado = cpfLimpo.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
                  } else {
                    cpfFormatado = beneficio.cpf_responsavel;
                  }
                }

                // 4. DADOS BANCÁRIOS
                const temBanco = beneficio.banco && beneficio.conta;
                const dadosBancarios = temBanco
                  ? `${beneficio.banco} | Ag: ${beneficio.agencia || 'S/N'} | Cc: ${beneficio.conta}`
                  : 'Dados bancários pendentes';

                return (
                  <div
                    key={beneficio.id}
                    className="bg-white border-l-4 border-l-emerald-500 rounded-xl p-5 shadow-sm hover:shadow-md transition-shadow flex flex-col gap-4"
                  >
                    {/* Cabeçalho */}
                    <div className="flex items-start justify-between gap-3 border-b border-gray-100 pb-3">
                      <div>
                        <h3 className="text-base font-bold text-gray-900 leading-tight">
                          🎁 {beneficio.programa_nome}
                        </h3>
                        {/* Removi o "Processado em" daqui */}
                        <p className="text-xs text-gray-500 mt-1">Benefício Ativo</p>
                      </div>
                      <span className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wide ${beneficio.situacao === 'Ativo' ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-600'
                        }`}>
                        {beneficio.situacao}
                      </span>
                    </div>

                    {/* Grid de Informações */}
                    <div className="grid grid-cols-2 gap-y-4 gap-x-2 text-sm">

                      {/* Valor */}
                      <div className="flex flex-col gap-0.5">
                        <span className="text-[10px] text-gray-500 uppercase font-semibold">Valor Recebido</span>
                        <span className="font-bold text-lg text-emerald-600">{valorFormatado}</span>
                      </div>

                      {/* Data do Pagamento (Agora Corrigida) */}
                      <div className="flex flex-col gap-0.5">
                        <span className="text-[10px] text-gray-500 uppercase font-semibold">Data do Pagamento</span>
                        <span className="font-medium text-gray-800">{dataPag}</span>
                      </div>

                      {/* Responsável e CPF */}
                      <div className="col-span-2 flex flex-col gap-0.5 bg-gray-50 p-2 rounded-lg border border-gray-100">
                        <span className="text-[10px] text-gray-500 uppercase font-semibold">Responsável Autorizado</span>
                        <div className="flex items-center gap-2">
                          <User className="h-4 w-4 text-gray-400" />
                          <div className="flex flex-col">
                            <span className="font-medium text-gray-800 uppercase leading-tight">{responsavel}</span>
                            <span className="text-xs text-gray-500 font-mono">CPF: {cpfFormatado}</span>
                          </div>
                        </div>
                      </div>

                      {/* Banco */}
                      <div className="col-span-2 flex flex-col gap-0.5 pt-1">
                        <span className="text-[10px] text-gray-500 uppercase font-semibold">Dados Bancários</span>
                        <span className={`text-xs ${temBanco ? 'font-mono text-gray-700 bg-emerald-50/50 p-1 rounded px-2 border border-emerald-100' : 'text-orange-500 italic'}`}>
                          {dadosBancarios}
                        </span>
                      </div>

                    </div>

                  </div>
                );
              })
            )}
          </div>
        </section>

        {/* ÁREA DE AVISOS */}
        <section className="bg-blue-50 rounded-xl p-4 border border-blue-100 flex gap-3 items-start animate-in slide-in-from-bottom-4 fade-in duration-700">
          <div className="bg-blue-100 p-2 rounded-full text-blue-600 shrink-0 mt-0.5">
            <Bell className="h-4 w-4" />
          </div>
          <div>
            <h4 className="text-sm font-semibold text-blue-900">Mantenha sua frequência!</h4>
            <p className="text-xs text-blue-700 mt-1 leading-relaxed">
              Lembre-se: para ser aprovado, você precisa de no mínimo <strong>75% de presença</strong>.
              Acompanhe suas faltas regularmente.
            </p>
          </div>
        </section>

      </main>

      {/* --- ALERTA MODAL BLOQUEANTE --- */}
      <Dialog open={showUpdateAlert} onOpenChange={setShowUpdateAlert}>
        <DialogContent className="sm:max-w-lg" onPointerDownOutside={(e) => e.preventDefault()}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-orange-600">
              <AlertTriangle className="h-5 w-5" /> Atualização Necessária
            </DialogTitle>
            <DialogDescription>
              Seus dados cadastrais estão incompletos. Por favor, atualize as informações abaixo para continuar.
            </DialogDescription>
          </DialogHeader>

          <div className="mt-4 border-t pt-4">
            <DadosCadastraisTab
              alunoId={user?.aluno_id || ""}
              onUpdate={() => {
                setShowUpdateAlert(false);
                fetchStudentData();
              }}
            />
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default PortalAlunoPage;
