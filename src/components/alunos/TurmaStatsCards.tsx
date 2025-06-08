
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface TurmaStatsCardsProps {
  turmaInfo: {
    nome: string;
    numero_sala: string;
    totalAlunos?: number;
    alunosFaltosos?: number;
  } | null;
}

export const TurmaStatsCards = ({ turmaInfo }: TurmaStatsCardsProps) => {
  if (!turmaInfo) return null;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
      <Card className="bg-white rounded-xl shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-lg text-purple-700">Total de Alunos</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-2xl font-bold">{turmaInfo.totalAlunos || 0}</p>
        </CardContent>
      </Card>
      
      <Card className="bg-white rounded-xl shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-lg text-blue-700">Faltas Hoje</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-2xl font-bold">{turmaInfo.alunosFaltosos || 0}</p>
        </CardContent>
      </Card>
      
      <Card className="bg-white rounded-xl shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-lg text-green-700">Sala</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-2xl font-bold">{turmaInfo.numero_sala}</p>
        </CardContent>
      </Card>
    </div>
  );
};
