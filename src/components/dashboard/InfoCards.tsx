import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, GraduationCap, AlertTriangle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { getDadosEscolaOffline } from "@/lib/offlineChamada";
import { useNavigate } from "react-router-dom";

export function InfoCards() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const isProfessor = user?.role === 'professor';
  const [stats, setStats] = useState({
    totalAlunos: 0,
    totalTurmas: 0,
  });

  useEffect(() => {
    const fetchStats = async () => {
      // 1. TENTA ONLINE
      // RLS já filtra automaticamente por escola e role
      // Segurança: só busca se tiver escola_id
      if (navigator.onLine && user?.escola_id) {
        try {
          const { count: turmasCount } = await supabase
            .from("turmas")
            .select("id", { count: "exact", head: true })
            .eq("escola_id", user.escola_id);

          const { count: alunosCount } = await supabase
            .from("alunos")
            .select("id", { count: "exact", head: true })
            .eq("escola_id", user.escola_id);

          setStats({
            totalAlunos: alunosCount || 0,
            totalTurmas: turmasCount || 0,
          });
          return;
        } catch (error) {
          // Silencioso, tenta offline
        }
      }

      // 2. FALLBACK OFFLINE
      try {
        const dadosOffline = await getDadosEscolaOffline(user?.id);
        if (dadosOffline) {
          setStats({
            totalAlunos: dadosOffline.alunos.length,
            totalTurmas: dadosOffline.turmas.length,
          });
        }
      } catch (err) {
        console.error(err);
      }
    };

    fetchStats();
  }, [user?.escola_id]);

  return (
    <div className="grid gap-4 md:grid-cols-3">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">
            {isProfessor ? "Meus Alunos" : "Total de Alunos"}
          </CardTitle>
          <Users className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{stats.totalAlunos}</div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">
            {isProfessor ? "Minhas Turmas" : "Turmas Ativas"}
          </CardTitle>
          <GraduationCap className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{stats.totalTurmas}</div>
        </CardContent>
      </Card>

      <Card className="cursor-pointer hover:bg-slate-50 transition-colors" onClick={() => navigate('/alertas')}>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium text-amber-600">Alertas</CardTitle>
          <AlertTriangle className="h-4 w-4 text-amber-600" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-amber-600">Ver Alertas</div>
        </CardContent>
      </Card>
    </div>
  );
}