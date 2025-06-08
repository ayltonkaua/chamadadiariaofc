import { useEffect, useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import HistoricoAluno from "@/components/turmas/alunos/HistoricoAluno";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

interface Aluno {
  id: string;
  nome: string;
  matricula: string;
  turma_id: string;
  created_at: string;
}

export default function AlunoPage() {
  const { turmaId, alunoId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [aluno, setAluno] = useState<Aluno | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchAluno = async () => {
      if (!user) {
        navigate("/login");
        return;
      }

      try {
        const { data, error } = await supabase
          .from("alunos")
          .select("*")
          .eq("id", alunoId)
          .eq("turma_id", turmaId)
          .single();

        if (error) throw error;
        setAluno(data);
      } catch (error) {
        setError("Erro ao carregar dados do aluno");
        console.error(error);
      } finally {
        setLoading(false);
      }
    };

    fetchAluno();
  }, [user, alunoId, turmaId, navigate]);

  if (loading) {
    return (
      <div className="container mx-auto py-6">
        <div className="flex items-center justify-center h-[200px]">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-500" />
        </div>
      </div>
    );
  }

  if (error || !aluno) {
    return (
      <div className="container mx-auto py-6">
        <div className="flex items-center justify-center h-[200px]">
          <p className="text-red-500">{error || "Aluno não encontrado"}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link to={`/turmas/${turmaId}/alunos`}>
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <h1 className="text-2xl font-bold">{aluno.nome}</h1>
        </div>
      </div>

      <div className="grid gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Informações do Aluno</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4">
              <div>
                <h3 className="font-medium text-gray-500">Nome Completo</h3>
                <p>{aluno.nome}</p>
              </div>
              <div>
                <h3 className="font-medium text-gray-500">Matrícula</h3>
                <p>{aluno.matricula}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <HistoricoAluno alunoId={alunoId!} turmaId={turmaId!} />
      </div>
    </div>
  );
} 