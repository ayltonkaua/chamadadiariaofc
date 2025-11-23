import React, { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
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
import { ImportarNotasDialog } from "@/components/notas/ImportarNotasDialog"; // MODIFICADO: Importação adicionada

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
  } = useAlunosTurma(turmaId, ["id", "nome", "matricula", "turma_id", "nome_responsavel", "telefone_responsavel"]);

  const navigate = useNavigate();

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
    navigate("/dashboard");
  };

  return (
    <div className="min-h-screen bg-gray-50 py-4 sm:py-6">
      <div className="max-w-7xl mx-auto px-2 sm:px-4">
        <div className="flex flex-col sm:flex-row items-center mb-4 sm:mb-6 gap-2 sm:gap-0">
          <Button variant="ghost" className="mr-0 sm:mr-2 w-10 h-10 flex items-center justify-center" onClick={voltar}>
            <ArrowLeft size={22} />
          </Button>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-800 text-center sm:text-left w-full">
            Gerenciar Alunos{turmaInfo ? ` - ${turmaInfo.nome}` : ""}
          </h1>
        </div>

        {turmaInfo && <TurmaStatsCards turmaInfo={turmaInfo} />}

        <div className="bg-white rounded-xl shadow-md p-3 sm:p-6">
          <div className="flex flex-col sm:flex-row justify-between items-center mb-4 sm:mb-6 gap-4">
            <h2 className="text-lg sm:text-xl font-semibold text-gray-800">Lista de Alunos</h2>
            
            {/* MODIFICADO: Agrupamento dos botões de Ação */}
            <div className="flex gap-2 w-full sm:w-auto">
              <ImportarNotasDialog />
              
              <Button 
                className="flex items-center gap-2 bg-green-600 hover:bg-green-700 flex-1 sm:flex-none justify-center"
                onClick={handleAddAluno}
              >
                <UserPlus size={20} /> <span className="hidden sm:inline">Adicionar Aluno</span>
              </Button>
            </div>
          </div>
          
          {loading ? (
            <div className="text-center py-8 text-gray-500">Carregando alunos...</div>
          ) : alunos.length > 0 ? (
            <AlunosTable 
              alunos={[...alunos].sort((a, b) => a.nome.localeCompare(b.nome))}
              onEdit={handleEditar}
              onRemove={handleRemover}
            />
          ) : (
            <div className="text-center py-10 text-gray-500">
              <p className="mb-4">Nenhum aluno cadastrado nesta turma.</p>
              <div className="flex flex-col sm:flex-row justify-center gap-3">
                 <ImportarNotasDialog />
                 <Button 
                  className="bg-green-600 hover:bg-green-700"
                  onClick={handleAddAluno}
                >
                  <UserPlus className="mr-2" size={18} /> Adicionar Primeiro Aluno
                </Button>
              </div>
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