import React from "react";

export const EmptyTurmasState: React.FC = () => {
  return (
    <div className="text-center py-10 bg-white rounded-xl shadow-sm">
      <p className="text-gray-500 mb-4">Nenhuma turma cadastrada.</p>
      <p className="text-gray-500">Use o botão "Importar Excel" para adicionar turmas.</p>
    </div>
  );
};
