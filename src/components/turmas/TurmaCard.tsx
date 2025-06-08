import React from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Edit, Trash2, Users, Calendar, ArrowRight } from "lucide-react";

interface TurmaCardProps {
  turma: {
    id: string;
    nome: string;
    numero_sala: string;
    alunos: number;
  };
  onEdit: (turma: TurmaCardProps['turma']) => void;
  onDelete: (turma: TurmaCardProps['turma']) => void;
}

export const TurmaCard: React.FC<TurmaCardProps> = ({ turma, onEdit, onDelete }) => {
  return (
    <div className="rounded-2xl shadow-md bg-white p-6 flex flex-col gap-5 border border-gray-100 hover:shadow-lg transition-shadow">
      <div>
        <h3 className="text-2xl font-bold text-purple-700">{turma.nome}</h3>
        <div className="mt-1 text-gray-600 font-medium">
          <span className="block">Sala: <span className="text-gray-800">{turma.numero_sala}</span></span>
          <span className="block">Alunos: <span className="text-gray-800">{turma.alunos}</span></span>
        </div>
      </div>
      <div className="flex flex-wrap gap-3 mt-3">
        <Link to={`/chamadas/${turma.id}`} className="flex-1">
          <Button
            variant="default"
            className="w-full flex items-center justify-center gap-2 bg-green-600 hover:bg-green-700 text-white transition-colors py-2 rounded-lg"
            title="Fazer Chamada"
          >
            <ArrowRight size={20} /> Chamada
          </Button>
        </Link>
        <Link to={`/historico-chamada/${turma.id}`} className="flex-1">
          <Button
            variant="secondary"
            className="w-full flex items-center justify-center gap-2 bg-blue-100 text-blue-700 hover:bg-blue-200 transition-colors py-2 rounded-lg"
            title="Histórico de Chamada"
          >
            <Calendar size={20} /> Histórico
          </Button>
        </Link>
        <Link to={`/gerenciar-alunos/${turma.id}`} className="flex-1">
          <Button
            variant="secondary"
            className="w-full flex items-center justify-center gap-2 bg-amber-100 text-amber-700 hover:bg-amber-200 transition-colors py-2 rounded-lg"
            title="Gerenciar Alunos"
          >
            <Users size={20} /> Alunos
          </Button>
        </Link>
        <Button
          variant="outline"
          className="flex-1 flex items-center justify-center gap-2 border-purple-200 text-purple-700 hover:bg-purple-100 transition-colors py-2 rounded-lg"
          onClick={() => onEdit(turma)}
          title="Editar Turma"
        >
          <Edit size={20} /> Editar
        </Button>
        <Button
          variant="destructive"
          className="flex-1 flex items-center justify-center gap-2 transition-colors py-2 rounded-lg"
          onClick={() => onDelete(turma)}
          title="Apagar Turma"
        >
          <Trash2 size={20} /> Apagar
        </Button>
      </div>
    </div>
  );
};
