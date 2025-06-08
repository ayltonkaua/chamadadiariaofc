import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Edit, Trash2, History } from "lucide-react";
import { Link } from "react-router-dom";

interface Aluno {
  id: string;
  nome: string;
  matricula: string;
  faltas: number;
  frequencia: number;
  turma_id: string;
}

interface AlunosTableProps {
  alunos: Aluno[];
  onEdit: (id: string) => void;
  onRemove: (aluno: Aluno) => void;
}

const AlunosTable = ({ alunos, onEdit, onRemove }: AlunosTableProps) => {
  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Nome</TableHead>
            <TableHead>Matrícula</TableHead>
            <TableHead>Faltas</TableHead>
            <TableHead>Frequência</TableHead>
            <TableHead className="text-right">Ações</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {alunos.map((aluno) => (
            <TableRow 
              key={aluno.id}
              className={aluno.faltas > 10 ? "bg-yellow-50" : ""}
            >
              <TableCell className="font-medium">{aluno.nome}</TableCell>
              <TableCell>{aluno.matricula}</TableCell>
              <TableCell>
                <span className={aluno.faltas > 10 ? "font-bold text-red-600" : ""}>
                  {aluno.faltas}
                </span>
              </TableCell>
              <TableCell>
                <div className="flex items-center gap-2">
                  <div className="w-24 bg-gray-200 rounded-full h-2">
                    <div
                      className={`h-2 rounded-full ${
                        aluno.frequencia > 80
                          ? "bg-green-500"
                          : aluno.frequencia > 60
                          ? "bg-yellow-500"
                          : "bg-red-500"
                      }`}
                      style={{ width: `${aluno.frequencia}%` }}
                    ></div>
                  </div>
                  <span>{aluno.frequencia}%</span>
                </div>
              </TableCell>
              <TableCell className="text-right">
                <div className="flex justify-end gap-2">
                  <Link to={`/turmas/${aluno.turma_id}/alunos/${aluno.id}`}>
                    <Button variant="ghost" size="icon" title="Ver histórico">
                      <History className="h-4 w-4" />
                    </Button>
                  </Link>
                  <Button 
                    onClick={() => onEdit(aluno.id)} 
                    variant="outline"
                    size="sm"
                    className="h-8 border-purple-300 text-purple-700"
                  >
                    <Edit size={16}/> Editar
                  </Button>
                  <Button 
                    onClick={() => onRemove(aluno)} 
                    variant="outline"
                    size="sm"
                    className="h-8 border-red-300 text-red-600"
                  >
                    <Trash2 size={16}/> Apagar
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
};

export default AlunosTable;
