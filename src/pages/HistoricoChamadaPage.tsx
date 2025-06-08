import React from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { useHistoricoChamada } from "@/hooks/useHistoricoChamada";
import { EstatisticasChamada } from "@/components/historico/EstatsticasChamada";
import { TabelaChamadas } from "@/components/historico/TabelaChamadas";

const HistoricoChamadaPage: React.FC = () => {
  const { turmaId } = useParams<{ turmaId: string }>();
  const navigate = useNavigate();
  const { turma, historico, loading, editarChamada, excluirChamada } = useHistoricoChamada(turmaId);

  const voltar = () => {
    navigate("/dashboard");
  };

  return (
    <div className="min-h-screen bg-gray-50 py-6">
      <div className="max-w-6xl mx-auto px-4">
        <div className="flex items-center mb-6">
          <Button variant="ghost" className="mr-2" onClick={voltar}>
            <ArrowLeft size={18} />
          </Button>
          <h1 className="text-2xl font-bold text-gray-800">
            Histórico de Chamadas{turma ? ` - ${turma.nome}` : ""}
          </h1>
        </div>

        <div className="bg-white rounded-xl shadow-md p-6 mb-6">
          {loading ? (
            <div className="text-center py-10 text-gray-500">
              Carregando dados...
            </div>
          ) : (
            <TabelaChamadas 
              historico={historico} 
              onEditarChamada={editarChamada}
              onExcluirChamada={excluirChamada}
            />
          )}
        </div>

        <EstatisticasChamada historico={historico} />
      </div>
    </div>
  );
};

export default HistoricoChamadaPage;

