/**
 * Dialog de Confirmação para Deletar Turma (CASCADE)
 * 
 * IMPORTANTE: Esta ação é IRREVERSÍVEL e deleta:
 * - Todos os alunos da turma
 * - Todas as presenças registradas
 * - Todas as observações
 * - Logs de sincronização
 */

import { useState } from "react";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Loader2, AlertTriangle, Trash2 } from "lucide-react";

interface DeleteTurmaDialogProps {
  turma: { id: string; nome: string } | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export function DeleteTurmaDialog({ turma, open, onOpenChange, onSuccess }: DeleteTurmaDialogProps) {
  const [loading, setLoading] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const { toast } = useToast();

  if (!turma) return null;

  const canDelete = confirmText === turma.nome;

  const handleClose = () => {
    setConfirmText("");
    onOpenChange(false);
  };

  const handleDelete = async () => {
    if (!canDelete) return;

    setLoading(true);
    try {
      // Usar RPC segura com CASCADE (criada na migration 035)
      const { data, error } = await (supabase.rpc as any)('delete_turma_cascade', {
        p_turma_id: turma.id
      });

      if (error) {
        // Se RPC não existe, usar método antigo
        if (error.message.includes('function') || error.code === '42883') {
          // Fallback: deletar manualmente (CASCADE no banco fará o resto)
          await supabase.from("turmas").delete().eq("id", turma.id);
          toast({
            title: "Turma removida",
            description: `"${turma.nome}" foi excluída com sucesso.`,
            className: "bg-red-600 text-white"
          });
        } else {
          throw error;
        }
      } else {
        // RPC funcionou - mostrar detalhes
        toast({
          title: "Turma Excluída Permanentemente",
          description: `"${data.turma_nome}" foi excluída junto com ${data.deleted.alunos} alunos, ${data.deleted.presencas} presenças e ${data.deleted.observacoes} observações.`,
          className: "bg-red-600 text-white"
        });
      }

      onSuccess();
      handleClose();
    } catch (error: any) {
      console.error('Delete error:', error);
      toast({
        variant: "destructive",
        title: "Erro ao remover",
        description: error.message || "Verifique se há dados vinculados que impedem a exclusão."
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={handleClose}>
      <AlertDialogContent className="max-w-lg">
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2 text-red-600">
            <AlertTriangle className="h-5 w-5" />
            Excluir Turma Permanentemente
          </AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-4">
              <Alert variant="destructive" className="mt-4">
                <Trash2 className="h-4 w-4" />
                <AlertTitle>Ação Irreversível!</AlertTitle>
                <AlertDescription>
                  Ao excluir a turma <strong>"{turma.nome}"</strong>, os seguintes dados serão <strong>permanentemente apagados</strong>:
                </AlertDescription>
              </Alert>

              <ul className="list-disc list-inside text-sm text-gray-600 space-y-1 ml-2">
                <li>Todos os <strong>alunos</strong> matriculados nesta turma</li>
                <li>Todos os registros de <strong>presença/falta</strong></li>
                <li>Todas as <strong>observações</strong> dos alunos</li>
                <li>Todo o <strong>histórico de chamadas</strong></li>
                <li>Todas as <strong>transferências</strong> de alunos</li>
                <li>Todos os <strong>registros de atrasos</strong></li>
                <li>Todos os <strong>atestados</strong> dos alunos</li>
                <li>Todas as <strong>notas</strong> e avaliações</li>
                <li>Vínculos de <strong>professores</strong> com a turma</li>
                <li>Dados de <strong>busca ativa</strong></li>
                <li>Dados de <strong>sincronização</strong></li>
              </ul>

              <div className="pt-4 border-t">
                <Label htmlFor="confirm" className="text-sm font-medium">
                  Para confirmar, digite o nome da turma: <strong className="text-red-600">{turma.nome}</strong>
                </Label>
                <Input
                  id="confirm"
                  value={confirmText}
                  onChange={(e) => setConfirmText(e.target.value)}
                  placeholder={turma.nome}
                  className="mt-2"
                  autoComplete="off"
                  disabled={loading}
                />
              </div>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={loading}>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => { e.preventDefault(); handleDelete(); }}
            className="bg-red-600 hover:bg-red-700 focus:ring-red-600"
            disabled={!canDelete || loading}
          >
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Excluindo...
              </>
            ) : (
              <>
                <Trash2 className="mr-2 h-4 w-4" />
                Excluir Permanentemente
              </>
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}