
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogFooter,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogCancel,
  AlertDialogAction,
} from "@/components/ui/alert-dialog";

interface DeleteTurmaDialogProps {
  turma: {
    id: string;
    nome: string;
  } | null;
  onClose: () => void;
  onConfirm: () => void;
}

export const DeleteTurmaDialog: React.FC<DeleteTurmaDialogProps> = ({
  turma,
  onClose,
  onConfirm,
}) => {
  return (
    <AlertDialog open={!!turma} onOpenChange={(open) => !open && onClose()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Remover turma</AlertDialogTitle>
          <AlertDialogDescription>
            Tem certeza que deseja apagar a turma{" "}
            <span className="font-semibold text-purple-700">{turma?.nome}</span>?
            <br />
            Essa ação não poderá ser desfeita.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={onClose}>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            className="bg-red-600 hover:bg-red-700 text-white"
            onClick={onConfirm}
          >
            Apagar
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};
