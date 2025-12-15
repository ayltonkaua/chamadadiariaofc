import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, UserX, UserCheck, Percent } from "lucide-react";

interface TurmaStatsCardsProps {
  turmaInfo: {
    nome: string;
    numero_sala: string;
    totalAlunos?: number;
    alunosFaltosos?: number;
    alunosPresentes?: number;
    percentualPresencaHoje?: number;
  } | null;
}

export const TurmaStatsCards = ({ turmaInfo }: TurmaStatsCardsProps) => {
  if (!turmaInfo) return null;

  // Verifica se a chamada foi realizada hoje
  const chamadaRealizada = turmaInfo.percentualPresencaHoje !== undefined;

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
      {/* Total de Alunos */}
      <Card className="bg-white rounded-xl shadow-sm border-0">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-gray-500 flex items-center gap-2">
            <Users className="h-4 w-4 text-purple-500" />
            Total de Alunos
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-3xl font-bold text-purple-700">
            {turmaInfo.totalAlunos || 0}
          </p>
        </CardContent>
      </Card>

      {/* Faltosos Hoje */}
      <Card className="bg-white rounded-xl shadow-sm border-0">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-gray-500 flex items-center gap-2">
            <UserX className="h-4 w-4 text-red-500" />
            Faltosos Hoje
          </CardTitle>
        </CardHeader>
        <CardContent>
          {chamadaRealizada ? (
            <p className="text-3xl font-bold text-red-600">
              {turmaInfo.alunosFaltosos}
            </p>
          ) : (
            <div>
              <p className="text-2xl font-bold text-gray-300">--</p>
              <span className="text-[10px] text-gray-400">Chamada pendente</span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Presentes Hoje */}
      <Card className="bg-white rounded-xl shadow-sm border-0">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-gray-500 flex items-center gap-2">
            <UserCheck className="h-4 w-4 text-green-500" />
            Presentes Hoje
          </CardTitle>
        </CardHeader>
        <CardContent>
          {chamadaRealizada ? (
            <p className="text-3xl font-bold text-green-600">
              {turmaInfo.alunosPresentes}
            </p>
          ) : (
            <div>
              <p className="text-2xl font-bold text-gray-300">--</p>
              <span className="text-[10px] text-gray-400">Chamada pendente</span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* % Presença Hoje */}
      <Card className="bg-white rounded-xl shadow-sm border-0">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-gray-500 flex items-center gap-2">
            <Percent className="h-4 w-4 text-blue-500" />
            Presença Hoje
          </CardTitle>
        </CardHeader>
        <CardContent>
          {chamadaRealizada ? (
            <p className={`text-3xl font-bold ${(turmaInfo.percentualPresencaHoje || 0) >= 75
                ? 'text-green-600'
                : (turmaInfo.percentualPresencaHoje || 0) >= 50
                  ? 'text-yellow-600'
                  : 'text-red-600'
              }`}>
              {turmaInfo.percentualPresencaHoje}%
            </p>
          ) : (
            <div>
              <p className="text-2xl font-bold text-gray-300">--</p>
              <span className="text-[10px] text-gray-400">Chamada pendente</span>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
