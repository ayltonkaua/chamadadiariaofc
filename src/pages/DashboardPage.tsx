import React from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { InfoCards } from "@/components/dashboard/InfoCards";

const DashboardPage: React.FC = () => {
  return (
    <div className="min-h-screen bg-gray-50 py-6">
      <div className="max-w-6xl mx-auto px-4">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold text-gray-800">Dashboard</h1>
          <Link to="/turmas/nova">
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Nova Turma
            </Button>
          </Link>
        </div>

        {/* Cards Informativos */}
        <div className="mb-8">
          <InfoCards />
        </div>

        {/* Lista de Turmas */}
        <div className="bg-white rounded-xl shadow-md p-6">
          <h2 className="text-xl font-semibold text-gray-800 mb-4">Minhas Turmas</h2>
          {/* Aqui vai o componente de lista de turmas */}
        </div>
      </div>
    </div>
  );
};

export default DashboardPage; 