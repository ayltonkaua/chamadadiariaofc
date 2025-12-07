import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Users,
  History,
  GraduationCap,
  ClipboardList,
  WifiOff,
  FileSpreadsheet,
  Edit,
  Trash2,
  RefreshCw
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useEscolaConfig } from "@/contexts/EscolaConfigContext"; // Seu contexto original
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

// Modais
import { EditTurmaDialog } from "./turmas/EditTurmaDialog";
import { DeleteTurmaDialog } from "./turmas/DeleteTurmaDialog";
import { ImportTurmasDialog } from "./turmas/ImportTurmasDialog";

// Interface
interface Turma {
  id: string;
  nome: string;
  escola_id: string;
  numero_sala?: string;
  turno?: string;
  _count?: { alunos: number };
  alunos?: number;
  user_id?: string;
}

interface TurmasCardsProps {
  turmas?: Turma[];
  loading?: boolean;
  onRefresh?: () => void;
  turno?: string;
}

// --- SUB-COMPONENTE: CARD VISUAL ---
const TurmaCardItem = ({
  turma,
  onEdit,
  onDeleteRequest,
  corPrimaria
}: {
  turma: Turma;
  onEdit: (t: Turma) => void;
  onDeleteRequest: (t: Turma) => void;
  corPrimaria: string;
}) => {
  const navigate = useNavigate();
  const qtdAlunos = turma._count?.alunos ?? turma.alunos ?? 0;

  // Estilos dinâmicos baseados na cor da escola
  const borderStyle = { borderLeftColor: corPrimaria, borderLeftWidth: '6px' };
  const buttonStyle = { backgroundColor: corPrimaria };
  const iconStyle = { color: corPrimaria };

  return (
    <Card
      className="flex flex-col h-full shadow-sm hover:shadow-lg transition-all duration-200 bg-white"
      style={borderStyle}
    >
      <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2 px-4 pt-4">
        <div className="space-y-1 w-[75%]">
          <CardTitle className="text-xl font-bold text-gray-800 line-clamp-1 leading-tight" title={turma.nome}>
            {turma.nome}
          </CardTitle>
          <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
            {turma.numero_sala && (
              <span className="bg-slate-100 px-2 py-1 rounded-md font-medium text-slate-600">
                Sala {turma.numero_sala}
              </span>
            )}
            {turma.turno && (
              <Badge variant="secondary" className="px-2 py-0.5 font-normal bg-slate-100 text-slate-600 hover:bg-slate-200">
                {turma.turno}
              </Badge>
            )}
          </div>
        </div>

        {/* Ações no Topo (Editar/Excluir) */}
        <div className="flex -mr-2">
          <Button
            variant="ghost"
            size="icon"
            className="h-10 w-10 text-blue-600 hover:bg-blue-50 rounded-full"
            onClick={() => onEdit(turma)}
          >
            <Edit className="h-5 w-5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-10 w-10 text-red-500 hover:bg-red-50 rounded-full"
            onClick={() => onDeleteRequest(turma)}
          >
            <Trash2 className="h-5 w-5" />
          </Button>
        </div>
      </CardHeader>

      <CardContent className="flex-grow flex flex-col justify-center px-4 py-2">
        <div className="flex items-center gap-4 my-2 p-3 bg-slate-50/80 rounded-lg border border-slate-100">
          <div className="bg-white p-2 rounded-full shadow-sm">
            <Users className="h-6 w-6" style={iconStyle} />
          </div>
          <div>
            <span className="text-3xl font-bold text-slate-800 block leading-none">{qtdAlunos}</span>
            <span className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Alunos</span>
          </div>
        </div>
      </CardContent>

      <CardFooter className="grid grid-cols-2 gap-3 p-4 pt-0">
        <Button
          className="col-span-2 w-full h-12 text-base font-bold text-white shadow-md active:scale-95 transition-transform hover:opacity-90"
          style={buttonStyle}
          onClick={() => navigate(`/turmas/${turma.id}/chamada`)}
        >
          <ClipboardList className="mr-2 h-5 w-5" />
          REALIZAR CHAMADA
        </Button>

        <Button
          variant="outline"
          className="w-full h-10 text-sm border-slate-300 hover:bg-slate-50 text-slate-600"
          onClick={() => navigate(`/turmas/${turma.id}/alunos`)}
        >
          <GraduationCap className="mr-2 h-4 w-4" />
          Alunos
        </Button>

        <Button
          variant="outline"
          className="w-full h-10 text-sm border-slate-300 hover:bg-slate-50 text-slate-600"
          onClick={() => navigate(`/historico-chamada/${turma.id}`)}
        >
          <History className="mr-2 h-4 w-4" />
          Histórico
        </Button>
      </CardFooter>
    </Card>
  );
};

// --- COMPONENTE PRINCIPAL ---
export function TurmasCards({ turmas: turmasPai, loading: loadingPai, onRefresh, turno }: TurmasCardsProps) {
  const { user, escolaId } = useAuth();

  // --- ADAPTAÇÃO AO SEU CONTEXTO ORIGINAL ---
  // Seu contexto retorna { config, loading, ... }
  const { config } = useEscolaConfig();

  // Pega a cor do objeto 'config' ou usa fallback
  const corPrimaria = config?.cor_primaria || "#6D28D9";

  // Estados locais
  const [localTurmas, setLocalTurmas] = useState<Turma[]>([]);
  const [localLoading, setLocalLoading] = useState(false);
  const [isOfflineMode, setIsOfflineMode] = useState(!navigator.onLine);

  // Controle de Modais
  const [turmaParaEditar, setTurmaParaEditar] = useState<Turma | null>(null);
  const [turmaParaRemover, setTurmaParaRemover] = useState<Turma | null>(null);
  const [showImportDialog, setShowImportDialog] = useState(false);

  const turmasExibidas = turmasPai || localTurmas;
  const isLoading = loadingPai !== undefined ? loadingPai : localLoading;

  const fetchTurmasLocal = async () => {
    if (turmasPai) return;
    setLocalLoading(true);
    try {
      if (!escolaId) return;
      const { data, error } = await supabase
        .from('turmas')
        .select(`id, nome, numero_sala, turno, escola_id, alunos:alunos(count)`)
        .eq('escola_id', escolaId)
        .eq('turno', turno)
        .order('nome');

      if (error) throw error;

      const formatadas = (data || []).map((t: any) => ({
        id: t.id,
        nome: t.nome,
        escola_id: t.escola_id,
        numero_sala: t.numero_sala,
        turno: t.turno,
        _count: { alunos: t.alunos?.[0]?.count || 0 },
        alunos: t.alunos?.[0]?.count || 0
      }));
      setLocalTurmas(formatadas);
    } catch (error) {
      console.error("Erro fetch local:", error);
    } finally {
      setLocalLoading(false);
    }
  };

  useEffect(() => {
    fetchTurmasLocal();
    const handleStatus = () => setIsOfflineMode(!navigator.onLine);
    window.addEventListener('online', handleStatus);
    window.addEventListener('offline', handleStatus);
    return () => {
      window.removeEventListener('online', handleStatus);
      window.removeEventListener('offline', handleStatus);
    };
  }, [escolaId, turno, turmasPai]);

  const handleRefreshGlobal = () => {
    if (onRefresh) onRefresh();
    fetchTurmasLocal();
  };

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 animate-pulse p-2">
        {[1, 2, 3].map((i) => <div key={i} className="h-64 bg-slate-100 rounded-lg"></div>)}
      </div>
    );
  }

  return (
    <>
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 px-1 gap-4">
        <div className="flex items-center gap-2">
          {turno && !turmasPai && <h2 className="text-2xl font-bold text-gray-800">Turmas {turno}</h2>}
          {isOfflineMode && (
            <span className="text-xs bg-yellow-100 text-yellow-800 px-3 py-1 rounded-full flex items-center gap-2 border border-yellow-200 font-medium">
              <WifiOff size={14} /> Modo Offline
            </span>
          )}
        </div>

        {!turmasPai && (
          <Button onClick={() => setShowImportDialog(true)} variant="outline" className="w-full sm:w-auto flex items-center gap-2 border-dashed border-2 h-10">
            <FileSpreadsheet size={18} className="text-green-600" />
            <span>Importar Turmas (Excel)</span>
          </Button>
        )}
      </div>

      {turmasExibidas.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-center border-2 border-dashed rounded-lg bg-slate-50 mx-1">
          <RefreshCw className="w-10 h-10 text-gray-300 mb-2" />
          <p className="text-gray-500 font-medium">Nenhuma turma encontrada.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 sm:gap-6 animate-in fade-in pb-20">
          {turmasExibidas.map((turma) => (
            <TurmaCardItem
              key={turma.id}
              turma={turma}
              onEdit={setTurmaParaEditar}
              onDeleteRequest={setTurmaParaRemover}
              corPrimaria={corPrimaria} // Passando a cor lida corretamente
            />
          ))}
        </div>
      )}

      {/* --- MODAIS --- */}
      {turmaParaEditar && (
        <EditTurmaDialog
          open={!!turmaParaEditar}
          onOpenChange={(open) => !open && setTurmaParaEditar(null)}
          turma={turmaParaEditar}
          onSuccess={handleRefreshGlobal}
        />
      )}

      {turmaParaRemover && (
        <DeleteTurmaDialog
          open={!!turmaParaRemover}
          onOpenChange={(open) => !open && setTurmaParaRemover(null)}
          turma={turmaParaRemover}
          onSuccess={handleRefreshGlobal}
        />
      )}

      {showImportDialog && (
        <ImportTurmasDialog
          onSuccess={() => {
            handleRefreshGlobal();
            setShowImportDialog(false);
          }}
        />
      )}
    </>
  );
}