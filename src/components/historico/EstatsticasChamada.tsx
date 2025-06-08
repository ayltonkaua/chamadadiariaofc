import React from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface ChamadaHistorico {
  data: string;
  presentes: number;
  faltosos: number;
  total: number;
}

interface EstatisticasChamadaProps {
  historico: ChamadaHistorico[];
}

export const EstatisticasChamada: React.FC<EstatisticasChamadaProps> = ({ historico }) => {
  if (historico.length === 0) {
    return null;
  }

  // Calcular frequência geral do mês atual
  const mesAtual = new Date().getMonth();
  const anoAtual = new Date().getFullYear();
  
  const chamadasMesAtual = historico.filter(chamada => {
    const dataChamada = new Date(chamada.data);
    return dataChamada.getMonth() === mesAtual && dataChamada.getFullYear() === anoAtual;
  });

  const presencaMedia = chamadasMesAtual.length > 0
    ? Math.round(
        chamadasMesAtual.reduce((acc, curr) => 
          acc + (curr.presentes / (curr.total || 1) * 100), 0
        ) / chamadasMesAtual.length
      )
    : 0;

  const diaMaisFaltas = historico.reduce((prev, curr) => 
    prev.faltosos > curr.faltosos ? prev : curr
  );

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-lg text-green-700">Frequência do mês</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-2xl font-bold">{presencaMedia}%</p>
          <p className="text-sm text-gray-500">
            Baseado em {chamadasMesAtual.length} chamada{chamadasMesAtual.length !== 1 ? 's' : ''} de {format(new Date(anoAtual, mesAtual, 1), "MMMM", { locale: ptBR })}
          </p>
        </CardContent>
      </Card>
      
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-lg text-blue-700">Total de chamadas</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-2xl font-bold">{historico.length}</p>
          <p className="text-sm text-gray-500">
            De {format(new Date(historico[historico.length - 1].data), "dd/MM/yyyy")} a {format(new Date(historico[0].data), "dd/MM/yyyy")}
          </p>
        </CardContent>
      </Card>
      
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-lg text-red-700">Dia com mais faltas</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-2xl font-bold">
            {format(new Date(diaMaisFaltas.data), "dd/MM/yyyy")}
          </p>
          <p className="text-sm text-gray-500">
            {diaMaisFaltas.faltosos} falta{diaMaisFaltas.faltosos !== 1 ? 's' : ''} ({Math.round((diaMaisFaltas.faltosos / diaMaisFaltas.total) * 100)}% dos alunos)
          </p>
        </CardContent>
      </Card>
    </div>
  );
};
