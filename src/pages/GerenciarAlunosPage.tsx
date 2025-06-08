import React, { useState } from "react";
import { useParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowLeft, UserPlus } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { TurmaStatsCards } from "@/components/alunos/TurmaStatsCards";
import AlunosTable from "@/components/alunos/AlunosTable";
import { useAlunosTurma } from "@/hooks/useAlunosTurma";
import AddEditStudentDialog from "@/components/alunos/AddEditStudentDialog";

const GerenciarAlunosPage: React.FC = () => {
  const { turmaId } = useParams<{ turmaId: string }>();
  const { toast } = useToast();
  const [alunoParaRemover, setAlunoParaRemover] = useState<{
    id: string;
    nome: string;
  } | null>(null);
  const [showAddEditDialog, setShowAddEditDialog] = useState(false);
  const [selectedAluno, setSelectedAluno] = useState<any>(null);
  const [isEditing, setIsEditing] = useState(false);

  const { 
    alunos, 
    setAlunos, 
    turmaInfo, 
    loading,
    refreshAlunos
  } = useAlunosTurma(turmaId);

  const handleEditar = (id: string) => {
    const aluno = alunos.find((a) => a.id === id);
    if (aluno) {
      setSelectedAluno(aluno);
      setIsEditing(true);
      setShowAddEditDialog(true);
    }
  };

  const handleAddAluno = () => {
    setSelectedAluno(null);
    setIsEditing(false);
    setShowAddEditDialog(true);
  };

  const handleRemover = (aluno: { id: string; nome: string }) => {
    setAlunoParaRemover(aluno);
  };

  const confirmarRemocao = async () => {
    if (alunoParaRemover) {
      try {
        await supabase
          .from("presencas")
          .delete()
          .eq("aluno_id", alunoParaRemover.id);
          
        await supabase
          .from("alunos")
          .delete()
          .eq("id", alunoParaRemover.id);

        setAlunos((prev) => prev.filter((a) => a.id !== alunoParaRemover.id));
        setAlunoParaRemover(null);
        
        toast({
          title: "Aluno removido",
          description: `O aluno ${alunoParaRemover.nome} foi removido com sucesso.`,
        });
      } catch (error) {
        console.error("Erro ao remover aluno:", error);
        toast({
          title: "Erro ao remover aluno",
          description: "Ocorreu um erro ao tentar remover o aluno.",
          variant: "destructive",
        });
      }
    }
  };

  const handleStudentAdded = () => {
    refreshAlunos();
  };

  const voltar = () => {
    window.history.back();
  };

  return (
    <div className="min-h-screen bg-gray-50 py-6">
      <div className="max-w-7xl mx-auto px-4">
        <div className="flex items-center mb-6">
          <Button variant="ghost" className="mr-2" onClick={voltar}>
            <ArrowLeft size={18} />
          </Button>
          <h1 className="text-2xl font-bold text-gray-800">
            Gerenciar Alunos{turmaInfo ? ` - ${turmaInfo.nome}` : ""}
          </h1>
        </div>

        {turmaInfo && <TurmaStatsCards turmaInfo={turmaInfo} />}

        <div className="bg-white rounded-xl shadow-md p-6">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-semibold text-gray-800">Lista de Alunos</h2>
            <Button 
              className="flex items-center gap-2 bg-green-600 hover:bg-green-700"
              onClick={handleAddAluno}
            >
              <UserPlus size={18} /> Adicionar Aluno
            </Button>
          </div>
          
          {loading ? (
            <div className="text-center py-8 text-gray-500">Carregando alunos...</div>
          ) : alunos.length > 0 ? (
            <AlunosTable 
              alunos={alunos}
              onEdit={handleEditar}
              onRemove={handleRemover}
            />
          ) : (
            <div className="text-center py-10 text-gray-500">
              <p className="mb-4">Nenhum aluno cadastrado nesta turma.</p>
              <Button 
                className="bg-green-600 hover:bg-green-700"
                onClick={handleAddAluno}
              >
                <UserPlus className="mr-2" size={18} /> Adicionar Primeiro Aluno
              </Button>
            </div>
          )}
        </div>
      </div>

      <AlertDialog
        open={!!alunoParaRemover}
        onOpenChange={(open) => {
          if (!open) setAlunoParaRemover(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover aluno</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja remover o aluno{" "}
              <span className="font-semibold text-purple-700">
                {alunoParaRemover?.nome}
              </span>
              ? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700 text-white"
              onClick={confirmarRemocao}
            >
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {showAddEditDialog && (
        <AddEditStudentDialog
          open={showAddEditDialog}
          onClose={() => setShowAddEditDialog(false)}
          onStudentAdded={handleStudentAdded}
          turmaId={turmaId || ""}
          student={selectedAluno}
          isEditing={isEditing}
        />
      )}
    </div>
  );
};

export default GerenciarAlunosPage;
