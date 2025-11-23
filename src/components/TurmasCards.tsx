import React, { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/hooks/use-toast";
import { TurmaCard } from "./turmas/TurmaCard";
import { DeleteTurmaDialog } from "./turmas/DeleteTurmaDialog";
import { EditTurmaDialog } from "./turmas/EditTurmaDialog";
import { ImportTurmasDialog } from "./turmas/ImportTurmasDialog";
import { EmptyTurmasState } from "./turmas/EmptyTurmasState";
import { Button } from "./ui/button";
import { FileSpreadsheet, WifiOff } from "lucide-react";
// Importações da lógica Offline/Híbrida
import { buscarTurmasHibrido, getDadosEscolaOffline } from "@/lib/offlineChamada";

interface Turma {
  id: string;
  nome: string;
  numero_sala: string;
  alunos: number;
  user_id?: string; // Adicionado para tipagem correta
  turno?: string;
}

const TurmasCards: React.FC<{ turno: 'Manhã' | 'Tarde' | 'Noite' }> = ({ turno }) => {
  const [turmas, setTurmas] = useState<Turma[]>([]);
  const [loading, setLoading] = useState(true);
  const [isOfflineMode, setIsOfflineMode] = useState(false);
  
  // Estados dos modais
  const [turmaParaRemover, setTurmaParaRemover] = useState<Turma | null>(null);
  const [turmaParaEditar, setTurmaParaEditar] = useState<Turma | null>(null);
  const [showImportDialog, setShowImportDialog] = useState(false);
  
  const { user } = useAuth();

  const fetchTurmas = async () => {
    setLoading(true);
    
    // Verificação de segurança: precisamos do ID do usuário e da escola
    if (!user?.id || !user?.escola_id) {
      console.log("Usuário ou Escola ID ausente");
      setTurmas([]);
      setLoading(false);
      return;
    }

    try {
      // 1. Busca Híbrida (Tenta Online -> Falha -> Busca Offline)
      const { data: dadosMist, fonte } = await buscarTurmasHibrido(user.escola_id);
      
      setIsOfflineMode(fonte === 'offline');

      if (!dadosMist) {
        setTurmas([]);
        setLoading(false);
        return;
      }

      // 2. Filtragem Inicial (Turno e Dono da Turma)
      // Filtramos pelo user_id para garantir que o prof só veja as turmas dele, mesmo offline
      let turmasFiltradas = dadosMist.filter((t: any) => 
        t.turno === turno && t.user_id === user.id
      );

      // 3. Processamento da contagem de alunos
      let turmasComContagem: Turma[] = [];

      if (fonte === 'online') {
        // --- CENÁRIO ONLINE: Buscamos a contagem precisa no banco ---
        // (Fazemos isso para garantir a contagem exata do banco)
        const turmasIds = turmasFiltradas.map((t: any) => t.id);
        
        // Se não houver turmas, paramos aqui
        if (turmasIds.length === 0) {
           setTurmas([]);
           setLoading(false);
           return;
        }

        // Refazemos a query específica para garantir os counts (como no seu original)
        // Ou, para otimizar, buscamos apenas os counts das turmas já filtradas
        turmasComContagem = await Promise.all(
          turmasFiltradas.map(async (turma: any) => {
            const { count } = await supabase
              .from("alunos")
              .select("id", { count: "exact", head: true })
              .eq("turma_id", turma.id);

            return {
              ...turma,
              alunos: count ?? 0,
            };
          })
        );

      } else {
        // --- CENÁRIO OFFLINE: Contamos baseado no cache local ---
        const dadosOffline = await getDadosEscolaOffline();
        const todosAlunos = dadosOffline?.alunos || [];

        turmasComContagem = turmasFiltradas.map((turma: any) => {
          // Conta quantos alunos neste array local pertencem a esta turma
          const qtdAlunos = todosAlunos.filter((a: any) => a.turma_id === turma.id).length;
          return {
            ...turma,
            alunos: qtdAlunos
          };
        });
      }

      // 4. Ordenação
      turmasComContagem.sort((a, b) => a.nome.localeCompare(b.nome));
      setTurmas(turmasComContagem);

    } catch (error: any) {
      console.error("Erro ao processar turmas:", error);
      toast({
        title: "Erro ao carregar",
        description: "Não foi possível carregar a lista de turmas.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  // Recarrega quando muda o turno ou o usuário
  useEffect(() => {
    fetchTurmas();
    
    // Opcional: Recarregar se a conexão voltar
    const handleOnline = () => fetchTurmas();
    window.addEventListener('online', handleOnline);
    return () => window.removeEventListener('online', handleOnline);
  }, [user?.id, turno, user?.escola_id]);

  // --- Funções de Manipulação (Iguais ao original) ---

  const handleEditarTurma = (turma: Turma) => {
    setTurmaParaEditar(turma);
  };

  const handleRemoverTurma = async () => {
    if (turmaParaRemover) {
      try {
        // Se estiver offline, avisa que não pode deletar
        if (!navigator.onLine) {
            toast({ 
                title: "Sem conexão", 
                description: "Você precisa de internet para excluir turmas.",
                variant: "destructive" 
            });
            return;
        }

        await supabase.from("alunos").delete().eq("turma_id", turmaParaRemover.id);
        await supabase.from("presencas").delete().eq("turma_id", turmaParaRemover.id);
        await supabase.from("turmas").delete().eq("id", turmaParaRemover.id);
        
        setTurmas((prev) => prev.filter((t) => t.id !== turmaParaRemover.id));
        toast({
          title: "Turma removida",
          description: `A turma ${turmaParaRemover.nome} foi removida com sucesso.`,
        });
        
        setTurmaParaRemover(null);
      } catch (error) {
        toast({
          title: "Erro ao remover turma",
          description: "Ocorreu um erro ao tentar remover a turma.",
          variant: "destructive",
        });
      }
    }
  };

  if (loading) {
    return <div className="text-center py-10 text-gray-500">A carregar turmas do turno da {turno.toLowerCase()}...</div>;
  }

  return (
    <>
      <div className="flex justify-between items-center mb-6">
        <div className="flex items-center gap-2">
            <h2 className="text-2xl font-bold text-gray-800">Turmas do Turno da {turno}</h2>
            {isOfflineMode && (
                <span className="text-xs bg-yellow-100 text-yellow-800 px-2 py-1 rounded-full flex items-center gap-1 border border-yellow-200">
                    <WifiOff size={12} /> Modo Offline
                </span>
            )}
        </div>
        
        <Button onClick={() => setShowImportDialog(true)} variant="outline" className="flex items-center gap-2">
          <FileSpreadsheet size={20} /> Importar Excel
        </Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-6">
        {turmas.map((turma) => (
          <TurmaCard
            key={turma.id}
            turma={turma}
            onEdit={handleEditarTurma}
            onDelete={(turma) => setTurmaParaRemover(turma)}
          />
        ))}
      </div>

      {turmas.length === 0 && !loading && (
        <EmptyTurmasState />
      )}

      {turmaParaRemover && (
        <DeleteTurmaDialog
          turma={turmaParaRemover}
          onClose={() => setTurmaParaRemover(null)}
          onConfirm={handleRemoverTurma}
        />
      )}

      {turmaParaEditar && (
        <EditTurmaDialog
          turma={turmaParaEditar}
          onClose={() => setTurmaParaEditar(null)}
          onTurmaUpdated={() => {
            fetchTurmas();
            setTurmaParaEditar(null);
          }}
        />
      )}

      {showImportDialog && (
        <ImportTurmasDialog
          onClose={() => setShowImportDialog(false)}
          onSuccess={() => {
            fetchTurmas();
            setShowImportDialog(false);
          }}
        />
      )}
    </>
  );
};

export default TurmasCards;