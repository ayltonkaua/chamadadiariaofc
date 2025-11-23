import React from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { InfoCards } from "@/components/dashboard/InfoCards";
import OfflineManager from "@/components/offline/OfflineManager"; // <--- Importação do componente

const DashboardPage: React.FC = () => {
  return (
    <div className="min-h-screen bg-gray-50 py-6">
      <div className="max-w-6xl mx-auto px-4">
        {/* Cabeçalho com Título e Ações */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
          <h1 className="text-2xl font-bold text-gray-800">Dashboard</h1>
          
          <div className="flex items-center gap-2 w-full sm:w-auto justify-between sm:justify-end">
            {/* Componente de Gestão Offline */}
            <OfflineManager /> 

            <Link to="/turmas/nova">
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                <span className="hidden sm:inline">Nova Turma</span>
                <span className="sm:hidden">Turma</span>
              </Button>
            </Link>
          </div>
        </div>

        {/* Cards Informativos */}
        <div className="mb-8">
          <InfoCards />
        </div>

        {/* Lista de Turmas */}
        <div className="bg-white rounded-xl shadow-md p-6">
          <h2 className="text-xl font-semibold text-gray-800 mb-4">Minhas Turmas</h2>
          {/* Aqui vai o componente de lista de turmas */}
          <div className="text-center py-10 text-gray-500 bg-gray-50 rounded-lg border border-dashed">
            <p>Seus cartões de turma aparecerão aqui.</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DashboardPage;