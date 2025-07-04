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
import { FileSpreadsheet } from "lucide-react";

interface Turma {
  id: string;
  nome: string;
  numero_sala: string;
  alunos: number;
}

const TurmasCards: React.FC = () => {
  const [turmas, setTurmas] = useState<Turma[]>([]);
  const [loading, setLoading] = useState(true);
  const [turmaParaRemover, setTurmaParaRemover] = useState<Turma | null>(null);
  const [turmaParaEditar, setTurmaParaEditar] = useState<Turma | null>(null);
  const [showImportDialog, setShowImportDialog] = useState(false);
  const { user } = useAuth();

  const fetchTurmas = async () => {
    setLoading(true);
    if (!user?.id) {
      setTurmas([]);
      setLoading(false);
      return;
    }

    const { data: turmasDB, error } = await supabase
      .from("turmas")
      .select("id, nome, numero_sala")
      .eq("user_id", user.id)
      .order("nome", { ascending: true });

    if (error) {
      toast({
        title: "Erro ao carregar turmas",
        description: error.message,
        variant: "destructive",
      });
      setTurmas([]);
      setLoading(false);
      return;
    }

    if (turmasDB && turmasDB.length > 0) {
      const turmasWithAlunos: Turma[] = await Promise.all(
        turmasDB.map(async (turma: any) => {
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
      setTurmas(turmasWithAlunos);
    } else {
      setTurmas([]);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchTurmas();
  }, [user?.id]);

  const handleEditarTurma = (turma: Turma) => {
    setTurmaParaEditar(turma);
  };

  const handleRemoverTurma = async () => {
    if (turmaParaRemover) {
      try {
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
    return <div className="text-center py-10 text-gray-500">Carregando turmas...</div>;
  }

  return (
    <>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-gray-800">Turmas</h2>
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
